/* Alankrita Portfolio Studio — authenticated browser authoring and atomic GitHub publishing.
   Tokens are held only in JS memory; never put them in URLs, saved drafts or files. */
(() => {
"use strict";
const REPO = "alansri08/alankrita-portfolio", API = "https://api.github.com";
const KEY = "alankrita-studio-local-draft-v2";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const frame = $("#site-frame"), wrap = $("#frame-wrap"), outline = $("#selection");
const copy = x => JSON.parse(JSON.stringify(x));
let token = "", headSha = "", data = {}, visual = {version:1,items:[],placements:{desktop:{},mobile:{}}};
let selection = null, device = "desktop", undo = [], redo = [], drag = null, saveTimer = null, busy = false;
let toastTimer;
function flash(message, error=false) {
  const t=$("#toast"); t.textContent=message; t.className="visible"+(error?" error":"");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.className="",5000);
}
function labelStatus(message){$("#status").textContent=message;}
function markDirty(){
  labelStatus("Unpublished changes");
  clearTimeout(saveTimer);
  saveTimer=setTimeout(saveDraft,650);
}
function saveDraft(){
  if (!token || !Object.keys(data).length) return;
  try {
    localStorage.setItem(KEY,JSON.stringify({data,visual,headSha,updatedAt:Date.now()}));
    labelStatus("Draft saved locally");
  } catch { flash("Draft is too large for browser storage. Publish images soon, or use smaller files.",true); }
}
function checkpoint(){
  undo.push(JSON.stringify({data,visual}));
  if(undo.length>70)undo.shift();
  redo.length=0;
}
function restoreSnapshot(snapshot){
  const obj=JSON.parse(snapshot);
  data=obj.data;visual=obj.visual;
  updatePreview();refreshInspector();refreshLayers();loadContentInput();markDirty();
}
function doUndo(){
  if(!undo.length)return;
  redo.push(JSON.stringify({data,visual}));
  restoreSnapshot(undo.pop());
}
function doRedo(){
  if(!redo.length)return;
  undo.push(JSON.stringify({data,visual}));
  restoreSnapshot(redo.pop());
}
async function api(path, opts={}){
  const r=await fetch(API+path,{...opts,headers:{
    "Accept":"application/vnd.github+json",
    "Authorization":"Bearer "+token,
    "X-GitHub-Api-Version":"2022-11-28",
    ...(opts.headers||{})
  }});
  const body=await r.text();
  let result;
  try{result=body?JSON.parse(body):{};}catch{result={message:body};}
  if(!r.ok)throw Error("GitHub "+r.status+": "+String(result.message||"Request failed").slice(0,250));
  return result;
}
const repoApi=path=>"/repos/"+REPO+path;
function decode64(s){
  const binary=atob(String(s).replace(/\s/g,""));
  const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
async function readFile(path){
  const f=await api(repoApi("/contents/"+path+"?ref=main"));
  return JSON.parse(decode64(f.content));
}
async function getHead(){
  const ref=await api(repoApi("/git/ref/heads/main"));
  return ref.object.sha;
}
async function loadFromGithub(restore=true){
  labelStatus("Loading...");
  const [h,d,v]=await Promise.all([getHead(),readFile("data.json"),readFile("visual.json")]);
  headSha=h;data=d;visual=v;
  visual.items=Array.isArray(visual.items)?visual.items:[];
  visual.placements=visual.placements||{desktop:{},mobile:{}};
  visual.placements.desktop ||= {}; visual.placements.mobile ||= {};
  undo=[];redo=[];selection=null;
  const local=restore?localStorage.getItem(KEY):null;
  if(local){
    try {
      const draft=JSON.parse(local);
      if(draft && draft.data && draft.visual && confirm("Restore your saved local draft? Cancel loads the published version.")) {
        data=draft.data;visual=draft.visual;
        if(draft.headSha!==headSha)flash("Draft restored, but main changed since it was saved. Publishing will require reviewing changes.",true);
      }
    }catch{localStorage.removeItem(KEY);}
  }
  updatePreview();updateInspector();loadContentInput();refreshLayers();labelStatus("Connected · "+headSha.slice(0,7));
}
async function connect(){
  const value=$("#token").value.trim();
  $("#gate-error").textContent="";
  if(!value){$("#gate-error").textContent="Enter your fine-grained GitHub token.";return;}
  $("#connect").disabled=true;
  token=value;
  try{
    const [user,repo]=await Promise.all([api("/user"),api(repoApi(""))]);
    if(user.login!=="alansri08" || !(repo.permissions?.push||repo.permissions?.admin)) {
      throw Error("This token must belong to alansri08 and allow writes to this portfolio repository.");
    }
    $("#token").value="";
    $("#gate").hidden=true;$("#app").hidden=false;
    await loadFromGithub(true);
    flash("Studio unlocked. Your public site is unchanged until Publish.");
  } catch(e){
    token="";
    $("#app").hidden=true;$("#gate").hidden=false;
    $("#gate-error").textContent=e.message;
  }finally{$("#connect").disabled=false;}
}
function lock(){
  token="";headSha="";data={};visual={version:1,items:[],placements:{desktop:{},mobile:{}}};
  undo=[];redo=[];selection=null;
  $("#app").hidden=true;$("#gate").hidden=false;$("#token").value="";$("#token").focus();
}
function view(){return frame.contentWindow?.PortfolioVisual;}
function contentView(){return frame.contentWindow?.PortfolioContent;}
function updatePreview(){
  try{
    contentView()?.set(data);
    view()?.apply(visual);
    view()?.setPreview(true);
    updateOutline();
  }catch(e){console.warn("Preview update error",e);}
}
function onFrameLoaded(){
  if(!token)return;
  updatePreview();
  const doc=frame.contentDocument;
  doc.addEventListener("pointerdown",onFrameDown,true);
  doc.addEventListener("pointermove",onFrameMove,true);
  doc.addEventListener("pointerup",endDrag,true);
  doc.addEventListener("click",e=>{if(selection){e.preventDefault();e.stopPropagation();}},true);
  // Content and visual JSON load asynchronously on the public page.
  setTimeout(updatePreview,300);
  setTimeout(updatePreview,900);
}
function getElement(){
  if(!selection || !frame.contentDocument)return null;
  const doc=frame.contentDocument;
  if(selection.kind==="item")return [...doc.querySelectorAll("[data-visual-item]")].find(x=>x.dataset.visualItem===selection.id)||null;
  return [...doc.querySelectorAll("[data-visual-id]")].find(x=>x.dataset.visualId===selection.id)||null;
}
function getItem(){
  return visual.items.find(i=>String(i.id)===selection?.id);
}
function placement(create=false){
  if(!selection || selection.kind!=="native")return null;
  visual.placements ||= {desktop:{},mobile:{}};
  visual.placements[device] ||= {};
  if(create && !visual.placements[device][selection.id]){
    visual.placements[device][selection.id]=copy(visual.placements.desktop?.[selection.id]||{dx:0,dy:0});
  }
  return visual.placements[device][selection.id] || visual.placements.desktop?.[selection.id] || {};
}
function itemDims(item,create=false){
  if(create && !item[device])item[device]=copy(item.desktop||{x:20,y:20,w:20,h:10});
  return item[device]||item.desktop||{x:20,y:20,w:20,h:10};
}
function select(kind,id){
  selection={kind,id:String(id)};
  refreshInspector();refreshLayers();updateOutline();
}
function updateOutline(){
  const el=getElement();
  if(!el || !token){outline.hidden=true;return;}
  const wr=wrap.getBoundingClientRect();
  const fr=frame.getBoundingClientRect();
  const er=el.getBoundingClientRect();
  const sx=fr.width/(frame.contentWindow?.innerWidth||fr.width);
  const sy=fr.height/(frame.contentWindow?.innerHeight||fr.height);
  outline.style.left=(fr.left-wr.left+er.left*sx)+"px";
  outline.style.top=(fr.top-wr.top+er.top*sy)+"px";
  outline.style.width=Math.max(3,er.width*sx)+"px";
  outline.style.height=Math.max(3,er.height*sy)+"px";
  outline.hidden=false;
  $("#selection-label").textContent=selection.kind==="item"?(getItem()?.type||"Object"):"Page element";
}
function onFrameDown(e){
  if(!token || e.button!==0)return;
  const item=e.target.closest("[data-visual-item]");
  const native=e.target.closest("[data-visual-id]");
  if(!item&&!native){selection=null;updateInspector();outline.hidden=true;return;}
  e.preventDefault();e.stopPropagation();
  if(item)select("item",item.dataset.visualItem);
  else select("native",native.dataset.visualId);
  checkpoint();
  drag={kind:"move",x:e.clientX,y:e.clientY,initial:copy(selection.kind==="item"?itemDims(getItem()):placement()),changed:false};
}
function onFrameMove(e){
  if(!drag||drag.kind!=="move"||!selection)return;
  e.preventDefault();
  const shell=frame.contentDocument.querySelector(".shell").getBoundingClientRect();
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(Math.abs(dx)+Math.abs(dy)>1)drag.changed=true;
  if(selection.kind==="item"){
    const it=getItem();if(!it)return;
    const p=itemDims(it,true);
    p.x=round((+drag.initial.x||0)+100*dx/shell.width);
    p.y=round((+drag.initial.y||0)+100*dy/shell.height);
  }else{
    const p=placement(true);
    p.dx=Math.round((+drag.initial.dx||0)+dx);
    p.dy=Math.round((+drag.initial.dy||0)+dy);
  }
  updatePreview();updateInspectorValues();
}
function endDrag(){
  if(!drag)return;
  if(!drag.changed && undo.length)undo.pop();
  if(drag.changed)markDirty();
  drag=null;refreshInspector();
}
function round(v){return Math.round(v*10)/10;}
function startResize(e){
  if(!selection)return;
  e.preventDefault();e.stopPropagation();
  checkpoint();
  const r=outline.getBoundingClientRect();
  drag={kind:"resize",x:e.clientX,y:e.clientY,initial:copy(selection.kind==="item"?itemDims(getItem()):placement()),rect:{w:r.width,h:r.height},changed:false};
  document.addEventListener("pointermove",onResize);
  document.addEventListener("pointerup",stopResize,{once:true});
}
function onResize(e){
  if(!drag || drag.kind!=="resize")return;
  const fr=frame.getBoundingClientRect(),shell=frame.contentDocument.querySelector(".shell").getBoundingClientRect();
  const sx=fr.width/frame.contentWindow.innerWidth,sy=fr.height/frame.contentWindow.innerHeight;
  const dx=(e.clientX-drag.x)/sx,dy=(e.clientY-drag.y)/sy;
  if(Math.abs(dx)+Math.abs(dy)>1)drag.changed=true;
  if(selection.kind==="item"){
    const it=getItem(),p=itemDims(it,true);
    p.w=round(Math.max(0.5,(drag.rect.w/sx+dx)*100/shell.width));
    p.h=round(Math.max(0.5,(drag.rect.h/sy+dy)*100/shell.height));
  }else{
    const p=placement(true);
    p.w=Math.max(10,Math.round(drag.rect.w/sx+dx));
    p.h=Math.max(10,Math.round(drag.rect.h/sy+dy));
  }
  updatePreview();updateInspectorValues();
}
function stopResize(){
  document.removeEventListener("pointermove",onResize);
  endDrag();
}
function insert(type,extra={}){
  checkpoint();
  const id="art-"+(crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random());
  const item={id,type,text:type==="text"?"Your new text":"",src:"",alt:"",
    color:"#24583d",bg:type==="shape"?"#b3d2ad":"",fontSize:25,fontFamily:"DM Sans",
    align:"center",radius:0,opacity:1,z:visual.items.length+10,
    desktop:{x:30,y:35,w:type==="image"?18:26,h:type==="text"?9:18},
    ...extra
  };
  visual.items.push(item);
  select("item",id);updatePreview();refreshInspector();refreshLayers();markDirty();
}
function readFileAsData(file){return new Promise((resolve,reject)=>{
  const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);
});}
async function addImage(file){
  if(!file)return;
  if(!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(file.type)){flash("Use PNG, JPG, WebP, GIF, or SVG.",true);return;}
  try{
    let source;
    if(file.type==="image/svg+xml" || (file.type==="image/gif"&&file.size<1100000)) {
      if(file.size>2000000)throw Error("SVG or animated GIF must be under 2 MB.");
      source=await readFileAsData(file);
    }else{
      const bmp=await createImageBitmap(file);
      const scale=Math.min(1,2000/Math.max(bmp.width,bmp.height));
      const c=document.createElement("canvas");c.width=Math.max(1,Math.round(bmp.width*scale));c.height=Math.max(1,Math.round(bmp.height*scale));
      c.getContext("2d").drawImage(bmp,0,0,c.width,c.height);
      source=c.toDataURL("image/webp",0.83);
      bmp.close?.();
    }
    insert("image",{src:source,alt:file.name.replace(/\.[^.]+$/,""),bg:"",desktop:{x:35,y:28,w:25,h:25}});
    flash("Image added. You can move, resize, and publish it.");
  }catch(e){flash("Image error: "+e.message,true);}
}
function showTab(tab){
  $$(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  $$(".tabview").forEach(s=>s.hidden=s.id!=="tab-"+tab);
}
function contentPath(){return $("#content-key").value.split(".");}
function getContent(){
  let obj=data;for(const k of contentPath())obj=obj?.[k];
  return String(obj??"");
}
function setContent(v){
  const path=contentPath();let obj=data;
  for(let i=0;i<path.length-1;i++)obj=obj[path[i]];
  obj[path.at(-1)]=v;
}
function loadContentInput(){$("#content-value").value=getContent();}
function updateInspector(){
  const el=getElement(),has=!!selection;
  $("#inspector-empty").hidden=has;$("#inspector").hidden=!has;
  if(!has)return;
  const item=selection.kind==="item"?getItem():null;
  $("#selected-name").textContent=item?(item.text?.slice(0,40)||item.alt||item.type):"Website element";
  $("#item-properties").hidden=!item;$("#native-properties").hidden=!!item;
  for(const row of $$(".prop-row[data-prop]")){
    const key=row.dataset.prop;
    row.hidden=!item || (key==="text" && item.type!=="text")
      || (key==="src" && !["image","canva"].includes(item.type))
      || (key==="alt" && !["image","canva"].includes(item.type))
      || (key==="editUrl" && !["image","canva"].includes(item.type))
      || (key==="align" && item.type!=="text")
      || (key==="fontFamily" && item.type!=="text")
      || (key==="href" && item.type==="canva");
  }
  updateInspectorValues();
}
function updateInspectorValues(){
  if(!selection)return;
  const item=selection.kind==="item"?getItem():null;
  const dims=item?itemDims(item):placement();
  for(const inp of $$("#inspector [data-key]")){
    const key=inp.dataset.key, value=(["x","y","w","h","dx","dy"].includes(key)?dims?.[key]:(item||placement())?.[key]);
    if(document.activeElement===inp)continue;
    if(inp.type==="color")inp.value=/^#[0-9a-f]{6}$/i.test(String(value))?String(value):key==="color"?"#203e31":"#ffffff";
    else inp.value=value===undefined||value===null?"":String(value);
  }
}
function onPropertyInput(e){
  if(!selection || busy)return;
  const input=e.target.closest("[data-key]");if(!input)return;
  const key=input.dataset.key;
  const item=selection.kind==="item"?getItem():null;
  const obj=item?(["x","y","w","h"].includes(key)?itemDims(item,true):item):placement(true);
  if(!obj)return;
  checkpoint();
  if(["x","y","w","h","dx","dy","fontSize","rotate","opacity","radius"].includes(key))obj[key]=input.value===""?undefined:+input.value;
  else obj[key]=input.value;
  updatePreview();refreshLayers();markDirty();
}
function refreshInspector(){updateInspector();}
function refreshLayers(){
  const list=$("#layers-list");list.replaceChildren();
  for(const item of [...(visual.items||[])].reverse()){
    const btn=document.createElement("button");
    btn.textContent=(item.type==="text"?"T · ":item.type==="image"?"▧ · ":item.type==="canva"?"◈ · ":"▢ · ")+(item.text||item.alt||item.type).slice(0,35);
    btn.classList.toggle("is-selected",selection?.id===String(item.id));
    btn.addEventListener("click",()=>select("item",item.id));
    list.appendChild(btn);
  }
  if(!visual.items.length)list.textContent="No extra layers yet. Add one in the Add tab.";
}
function duplicate(){
  if(selection?.kind!=="item"){flash("To duplicate an existing website section, first add a freeform text/image layer.");return;}
  const current=getItem();if(!current)return;
  checkpoint();
  const next=copy(current);
  next.id="art-"+crypto.randomUUID();
  next.z=Math.max(0,...visual.items.map(x=>+x.z||0))+1;
  for(const dev of ["desktop","mobile"]){if(next[dev]){next[dev].x+=3;next[dev].y+=3;}}
  visual.items.push(next);select("item",next.id);updatePreview();refreshLayers();markDirty();
}
function remove(){
  if(!selection)return;
  checkpoint();
  if(selection.kind==="item")visual.items=visual.items.filter(x=>String(x.id)!==selection.id);
  else delete visual.placements?.[device]?.[selection.id];
  selection=null;updatePreview();updateInspector();refreshLayers();outline.hidden=true;markDirty();
}
function onKeydown(e){
  const typing=["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName);
  const mod=e.metaKey||e.ctrlKey;
  if(mod && e.key.toLowerCase()==="z"){e.preventDefault();e.shiftKey?doRedo():doUndo();}
  else if(mod && e.key.toLowerCase()==="y"){e.preventDefault();doRedo();}
  else if(mod && e.key.toLowerCase()==="d" && !typing){e.preventDefault();duplicate();}
  else if(!typing && selection && (e.key==="Delete" || e.key==="Backspace")){e.preventDefault();remove();}
  else if(!typing && selection && ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)){
    e.preventDefault();checkpoint();
    const x=e.key==="ArrowLeft"?-1:e.key==="ArrowRight"?1:0;
    const y=e.key==="ArrowUp"?-1:e.key==="ArrowDown"?1:0;
    if(selection.kind==="item"){
      const d=itemDims(getItem(),true);d.x=round(d.x+x*(e.shiftKey?2:0.2));d.y=round(d.y+y*(e.shiftKey?2:0.2));
    }else{const d=placement(true);d.dx=(+d.dx||0)+x*(e.shiftKey?10:1);d.dy=(+d.dy||0)+y*(e.shiftKey?10:1);}
    updatePreview();refreshInspector();markDirty();
  }
}
function encodingFromUrl(url){
  const match=String(url||"").match(/^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,(.+)$/i);
  if(!match)return null;
  return {extension:({jpeg:"jpg","svg+xml":"svg"}[match[1].toLowerCase()]||match[1].toLowerCase()),base64:match[2]};
}
async function createBlob(content,encoding="utf-8"){
  return (await api(repoApi("/git/blobs"),{method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({content,encoding})})).sha;
}
async function publish(){
  if(busy)return;
  if(!confirm("Publish these changes to your public portfolio? They will become visible to recruiters after GitHub Pages deploys."))return;
  busy=true;$("#publish").disabled=true;labelStatus("Publishing...");
  try{
    // Reject stale drafts rather than overwrite a Pages CMS or other editor's changes.
    const latest=await getHead();
    if(latest!==headSha)throw Error("The GitHub repository changed since you unlocked Studio. Save your draft locally, reload the published version, then reapply or review your changes before publishing.");
    const next=copy(visual);
    const files=[];
    for(const item of next.items){
      const asset=encodingFromUrl(item.src);
      if(!asset)continue;
      const name="assets/studio/"+item.id.replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80)+"-"+Date.now()+"."+asset.extension;
      const sha=await createBlob(asset.base64,"base64");
      files.push({path:name,mode:"100644",type:"blob",sha});
      item.src="./"+name;
    }
    labelStatus("Saving content...");
    const [dataBlob,visualBlob]=await Promise.all([
      createBlob(JSON.stringify(data,null,2)+"\n"),
      createBlob(JSON.stringify(next,null,2)+"\n")
    ]);
    files.push({path:"data.json",mode:"100644",type:"blob",sha:dataBlob});
    files.push({path:"visual.json",mode:"100644",type:"blob",sha:visualBlob});
    const currentCommit=await api(repoApi("/git/commits/"+headSha));
    const newTree=await api(repoApi("/git/trees"),{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({base_tree:currentCommit.tree.sha,tree:files})});
    const commit=await api(repoApi("/git/commits"),{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({message:"Publish portfolio updates from Visual Studio",tree:newTree.sha,parents:[headSha]})});
    await api(repoApi("/git/refs/heads/main"),{method:"PATCH",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({sha:commit.sha,force:false})});
    visual=next;headSha=commit.sha;undo=[];redo=[];
    localStorage.removeItem(KEY);
    labelStatus("Published · "+headSha.slice(0,7));
    updatePreview();refreshLayers();
    flash("Published! GitHub Pages will deploy the new version shortly.");
  }catch(e){
    flash("Publish failed: "+e.message,true);
    labelStatus("Not published · draft safe");
    saveDraft();
  }finally{busy=false;$("#publish").disabled=false;}
}
function initialize(){
  $("#connect").addEventListener("click",connect);
  $("#token").addEventListener("keydown",e=>{if(e.key==="Enter")connect();});
  $("#logout").addEventListener("click",lock);
  $("#undo").addEventListener("click",doUndo);$("#redo").addEventListener("click",doRedo);
  $("#publish").addEventListener("click",publish);
  $("#save-draft").addEventListener("click",()=>{saveDraft();flash("Draft saved in this browser. It is not public.");});
  $("#restore").addEventListener("click",async()=>{if(!confirm("Discard the current draft and reload the published website?"))return;
    localStorage.removeItem(KEY);try{await loadFromGithub(false);flash("Published version loaded.");}catch(e){flash(e.message,true);}
  });
  $$(".tab").forEach(b=>b.addEventListener("click",()=>showTab(b.dataset.tab)));
  $("#add-text").addEventListener("click",()=>insert("text"));
  $("#add-shape").addEventListener("click",()=>insert("shape"));
  $("#add-image").addEventListener("click",()=>$("#upload").click());
  $("#upload").addEventListener("change",async e=>{await addImage(e.target.files?.[0]);e.target.value="";});
  $("#add-canva").addEventListener("click",()=>{
    const url=prompt("Paste your published Canva EMBED link (https://www.canva.com/design/.../view?embed). Changes to this design will show live and bypass GitHub rollback.");
    if(!url)return;
    try{const u=new URL(url);if(!["www.canva.com","canva.com"].includes(u.hostname)||!u.pathname.startsWith("/design/")||u.protocol!=="https:")throw Error();
      insert("canva",{src:url,alt:"Canva portfolio graphic",bg:"",desktop:{x:30,y:25,w:38,h:37}});
    }catch{flash("Please provide a valid canva.com/design/... link.",true);}
  });
  $("#content-key").addEventListener("change",loadContentInput);
  $("#content-value").addEventListener("input",e=>{checkpoint();setContent(e.target.value);updatePreview();markDirty();});
  $("#inspector").addEventListener("input",onPropertyInput);
  $("#inspector").addEventListener("change",onPropertyInput);
  $("#duplicate").addEventListener("click",duplicate);
  $("#remove").addEventListener("click",remove);
  $("#resize-handle").addEventListener("pointerdown",startResize);
  $("#desktop").addEventListener("click",()=>setDevice("desktop"));
  $("#mobile").addEventListener("click",()=>setDevice("mobile"));
  frame.addEventListener("load",onFrameLoaded);
  frame.addEventListener("pointerleave",()=>{if(drag?.kind==="move")endDrag();});
  document.addEventListener("keydown",onKeydown);
  window.addEventListener("resize",updateOutline);
  if(frame.contentDocument?.readyState==="complete")onFrameLoaded();
}
function setDevice(next){
  device=next;wrap.classList.toggle("mobile",next==="mobile");
  $("#desktop").classList.toggle("active",next==="desktop");
  $("#mobile").classList.toggle("active",next==="mobile");
  updatePreview();refreshInspector();
}
initialize();
})();