import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createServer} from "node:http";
import {chromium} from "playwright";

const files={
  "/":"index.html","/index.html":"index.html","/data.json":"data.json","/visual.json":"visual.json",
  "/visual-runtime.js":"visual-runtime.js","/studio.html":"studio.html",
  "/studio.js":"studio.js","/studio.css":"studio.css"
};
const types={html:"text/html",js:"text/javascript",css:"text/css",json:"application/json"};
const server=createServer((req,res)=>{
  const path=(req.url||"/").split("?")[0],file=files[path];
  if(!file){res.writeHead(404);res.end();return;}
  const content=readFileSync(file);
  res.writeHead(200,{"Content-Type":types[file.split(".").at(-1)]||"text/plain"});
  res.end(content);
});
await new Promise(r=>server.listen(8765,"127.0.0.1",r));
let browser;
try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:920},acceptDownloads:true});
  let gitHead="mock-head-0", blobIndex=0,treeWrites=0,refWrites=0;
  const data=readFileSync("data.json"),visual=readFileSync("visual.json");
  await page.route("https://api.github.com/**",async route=>{
    const u=new URL(route.request().url()),p=u.pathname,method=route.request().method();
    if(method==="OPTIONS"){
      await route.fulfill({status:204,headers:{
        "Access-Control-Allow-Origin":"*",
        "Access-Control-Allow-Methods":"GET,POST,PATCH,OPTIONS",
        "Access-Control-Allow-Headers":"Authorization,Content-Type,Accept,X-GitHub-Api-Version"
      }});
      return;
    }
    let response={};
    if(p==="/user")response={login:"alansri08"};
    else if(p==="/repos/alansri08/alankrita-portfolio")response={permissions:{push:true}};
    else if(p.endsWith("/git/ref/heads/main"))response={object:{sha:gitHead}};
    else if(p.endsWith("/contents/data.json"))response={content:data.toString("base64")};
    else if(p.endsWith("/contents/visual.json"))response={content:visual.toString("base64")};
    else if(p.includes("/git/commits/"))response={tree:{sha:"mock-tree"}};
    else if(p.endsWith("/git/blobs")&&method==="POST")response={sha:"blob-"+(++blobIndex)};
    else if(p.endsWith("/git/trees")&&method==="POST"){
      const request=JSON.parse(route.request().postData()||"{}");
      assert.ok(request.tree.some(f=>f.path==="data.json"));
      assert.ok(request.tree.some(f=>f.path==="visual.json"));
      treeWrites++;
      response={sha:"mock-new-tree"};
    }
    else if(p.endsWith("/git/commits")&&method==="POST")response={sha:"mock-new-head"};
    else if(p.endsWith("/git/refs/heads/main")&&method==="PATCH"){
      const request=JSON.parse(route.request().postData()||"{}");
      assert.equal(request.force,false);
      gitHead=request.sha;refWrites++;response={ref:"refs/heads/main",object:{sha:gitHead}};
    }
    else if(p.endsWith("/commits"))response=[{sha:gitHead,commit:{message:"Latest version"}}];
    else {await route.fulfill({status:404,contentType:"application/json",body:JSON.stringify({message:"Unhandled mocked route: "+method+" "+p})});return;}
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(response),headers:{"Access-Control-Allow-Origin":"*"}});
  });
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto("http://127.0.0.1:8765/studio.html",{waitUntil:"load"});
  assert.equal(await page.locator("#app").isVisible(),false,"Studio should start locked");
  await page.locator("#token").fill("github_pat_mock_for_test");
  await page.locator("#connect").click();
  await page.locator("#app").waitFor({state:"visible",timeout:15000});
  await page.frameLocator("#site-frame").locator(".shell").waitFor();
  await page.waitForFunction(()=>document.querySelector("#site-frame").contentWindow.PortfolioVisual);
  await page.locator("#add-text").click();
  assert.equal(await page.frameLocator("#site-frame").locator(".visual-item[data-kind='text']").count(),1,"Text insert failed");
  await page.locator('#inspector input[data-key="fontSize"]').fill("35");
  await page.locator("#save-draft").click();
  const draft=await page.evaluate(()=>localStorage.getItem("alankrita-studio-local-draft-v2"));
  assert.ok(draft?.includes('"fontSize":35'),"Draft should preserve typography");
  assert.ok(!draft.includes("github_pat_mock_for_test"),"Token must never be stored in draft");
  await page.locator("#mobile").click();
  await page.locator("#desktop").click();
  await page.locator("#export-draft").click();
  const clientApi=await page.evaluate(()=>Boolean(document.querySelector("#site-frame").contentWindow.PortfolioContent));
  assert.equal(clientApi,true,"Public preview must expose content updates");
  page.on("dialog",async dialog=>dialog.accept());
  await page.locator("#publish").click();
  await page.waitForFunction(()=>document.querySelector("#status").textContent.includes("Published"),{timeout:15000});
  assert.equal(refWrites,1,"Publishing must update main ref exactly once");
  assert.equal(treeWrites,1,"Publishing must create one atomic tree");
  assert.equal(errors.length,0,"Browser JavaScript errors: "+errors.join("; "));
  console.log("Browser acceptance test passed: login, preview, insert, style, draft, mobile, export, atomic publish.");
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
