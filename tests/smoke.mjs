// Source-level smoke tests. Full authenticated publishing needs a browser and GitHub owner approval.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
const file = path => readFileSync(path,"utf8");
const publicHtml=file("index.html"),studioHtml=file("studio.html"),studio=file("studio.js"),runtime=file("visual-runtime.js");
const inlineScripts=[...publicHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
assert.ok(inlineScripts.length,"Missing public page JavaScript");
inlineScripts.forEach((code,i)=>new Script(code,{filename:"index-inline-"+i+".js"}));
const data=JSON.parse(file("data.json")),visual=JSON.parse(file("visual.json"));
assert.ok(publicHtml.includes('src="./visual-runtime.js"'),"Public site must load visual renderer");
assert.ok(!publicHtml.includes('localStorage.getItem("alankrita-portfolio")'),"Public site must not read local drafts");
assert.ok(!publicHtml.includes('id="editButton"'),"No public editor button");
assert.ok(publicHtml.includes("window.PortfolioContent"),"Studio preview content API missing");
assert.ok(studioHtml.includes('name="robots" content="noindex,nofollow"'),"Studio should not be indexed");
for(const id of ["gate","token","connect","publish","undo","redo","history","content-value","site-frame",
    "add-text","add-shape","add-image","add-canva","replace-image","native-text","selection","resize-handle"]){
  assert.ok(studioHtml.includes('id="'+id+'"'),"Studio control missing: "+id);
}
for(const token of ["localStorage.setItem(KEY","onFrameDown","onResize","checkpoint()","doUndo()",
    "doRedo()","function publish()","/git/trees","/git/blobs","/git/refs/heads/main","headSha",
    "createImageBitmap","textOverrides","saveDraft","showHistory"]){
  assert.ok(studio.includes(token),"Studio functionality missing: "+token);
}
assert.ok(!/localStorage\.setItem\([^\n]*token/.test(studio),"Do not persist GitHub credentials");
assert.ok(runtime.includes("canvaEmbed"),"Canva embed support missing");
assert.ok(runtime.includes("safeImage"),"Graphics support missing");
assert.ok(runtime.includes("textOverrides"),"Native text editing missing");
assert.ok(file(".pages.yml").includes("path: data.json"),"Pages CMS content config missing");
assert.ok(Array.isArray(data.projects)&&data.projects.length>=3,"Projects missing");
assert.ok(Array.isArray(visual.items)&&visual.placements?.desktop&&visual.placements?.mobile,"Visual JSON structure invalid");
console.log("All static portfolio smoke tests passed.");
