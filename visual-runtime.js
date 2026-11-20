/* Portfolio Visual Runtime v2 — public rendering only. No credentials or editing UI. */
(() => {
  "use strict";
  const defaults = {version:1,items:[],placements:{desktop:{},mobile:{}}};
  const clone = x => JSON.parse(JSON.stringify(x));
  const root = document.querySelector(".shell");
  if (!root) return;
  root.style.position = "relative";
  const css = document.createElement("style");
  css.textContent = `
    .visual-layer{position:absolute;inset:0;pointer-events:none;z-index:28;overflow:visible}
    .visual-item{position:absolute;box-sizing:border-box;pointer-events:auto;overflow:hidden;display:flex;align-items:center;justify-content:center;line-height:1.2}
    .visual-item img{height:100%;width:100%;object-fit:contain;display:block}
    .visual-item iframe{height:100%;width:100%;border:0}
    .visual-item a{color:inherit;text-decoration:inherit;width:100%;height:100%;display:flex;align-items:center;justify-content:center}
    .visual-item[data-kind="shape"]{pointer-events:none}
    .visual-layer.preview-mode .visual-item{outline:1px dashed rgba(35,100,75,.35);cursor:move}
    .visual-layer.preview-mode .visual-item iframe{pointer-events:none}
    @media print{.visual-layer{z-index:1}}
  `;
  document.head.appendChild(css);
  const layer = document.createElement("div");
  layer.id = "visual-layer";
  layer.className = "visual-layer";
  root.appendChild(layer);
  let state = clone(defaults);
  let preview = false;
  const isMobile = () => window.matchMedia("(max-width:700px)").matches;
  const mode = () => isMobile() ? "mobile" : "desktop";
  const safeUrl = raw => {
    try {
      const u = new URL(String(raw || ""), location.href);
      return ["https:","http:","mailto:"].includes(u.protocol) ? u.href : "";
    } catch { return ""; }
  };
  const safeImage = raw => {
    const s = String(raw || "");
    if (/^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,/i.test(s)) return s;
    return safeUrl(s);
  };
  const canvaEmbed = raw => {
    try {
      const u = new URL(String(raw || ""));
      if (u.protocol !== "https:" || !["www.canva.com","canva.com"].includes(u.hostname) || !/^\/design\//.test(u.pathname)) return "";
      u.searchParams.set("embed","");
      return u.href;
    } catch { return ""; }
  };
  const targets = () => [...document.querySelectorAll(".shell header, .shell header *, .shell main, .shell main *")]
    .filter(el => !el.closest("#visual-layer") && !el.closest(".overlay"));
  const ident = el => {
    const ids = [];
    while (el && el !== root) {
      const parent = el.parentElement;
      if (!parent) break;
      ids.unshift([...parent.children].indexOf(el));
      el = parent;
    }
    return "node-" + ids.join("-");
  };
  function applyPlacements() {
    const placements = state.placements || {};
    const desktop = placements.desktop || {};
    const mobile = placements.mobile || {};
    for (const el of targets()) {
      const id = ident(el);
      el.dataset.visualId = id;
      const p = (isMobile() && mobile[id]) || desktop[id];
      const old = el.dataset.visualApplied;
      if (old) {
        el.style.transform = "";
        el.style.width = "";
        el.style.height = "";
        el.style.fontSize = "";
        el.style.color = "";
        el.style.opacity = "";
        el.style.zIndex = "";
        el.style.position = "";
        el.style.backgroundColor = "";
        el.style.borderRadius = "";
        delete el.dataset.visualApplied;
      }
      if (!p) continue;
      el.dataset.visualApplied = "1";
      if (+p.dx || +p.dy || +p.rotate) el.style.transform = "translate(" + (+p.dx || 0) + "px," + (+p.dy || 0) + "px) rotate(" + (+p.rotate || 0) + "deg)";
      if (+p.w > 0) el.style.width = p.w + "px";
      if (+p.h > 0) el.style.height = p.h + "px";
      if (+p.fontSize > 0) el.style.fontSize = p.fontSize + "px";
      if (p.color && /^#[0-9a-f]{3,8}$/i.test(p.color)) el.style.color = p.color;
      if (p.bg && /^#[0-9a-f]{3,8}$/i.test(p.bg)) el.style.backgroundColor = p.bg;
      if (p.opacity !== undefined) el.style.opacity = String(Math.min(1,Math.max(0,+p.opacity)));
      if (p.radius !== undefined) el.style.borderRadius = Math.max(0,+p.radius) + "px";
      if (p.z !== undefined) {el.style.position = "relative"; el.style.zIndex = String(+p.z||0);}
    }
  }
  function itemBox(item) {
    const d = isMobile() ? (item.mobile || item.desktop || item) : (item.desktop || item);
    const o = document.createElement("div");
    o.className = "visual-item";
    o.dataset.visualItem = String(item.id || "");
    o.dataset.kind = String(item.type || "text");
    o.style.left = (+d.x || 0) + "%";
    o.style.top = (+d.y || 0) + "%";
    o.style.width = Math.max(0.2,+d.w || 15) + "%";
    o.style.height = Math.max(0.2,+d.h || 8) + "%";
    o.style.transform = "rotate(" + (+d.rotate || 0) + "deg)";
    o.style.zIndex = String(+item.z || 0);
    o.style.opacity = String(item.opacity===undefined ? 1 : Math.min(1,Math.max(0,+item.opacity)));
    if (item.bg && /^#[0-9a-f]{3,8}$/i.test(item.bg)) o.style.background = item.bg;
    if (item.color && /^#[0-9a-f]{3,8}$/i.test(item.color)) o.style.color = item.color;
    if (+item.radius >= 0) o.style.borderRadius = (+item.radius) + "px";
    if (+item.fontSize > 0) o.style.fontSize = (+item.fontSize) + "px";
    if (item.fontFamily && /^[a-z0-9 ,'"-]{1,100}$/i.test(item.fontFamily)) o.style.fontFamily = item.fontFamily;
    o.style.textAlign = ["left","center","right"].includes(item.align) ? item.align : "center";
    const type = item.type;
    let inner;
    if (type === "image") {
      inner = document.createElement("img");
      inner.alt = String(item.alt || "");
      inner.src = safeImage(item.src) || "";
      inner.loading = "lazy";
    } else if (type === "canva") {
      inner = document.createElement("iframe");
      inner.src = canvaEmbed(item.src) || "about:blank";
      inner.loading = "lazy";
      inner.title = String(item.alt || "Canva design");
      inner.referrerPolicy = "strict-origin-when-cross-origin";
      inner.setAttribute("allowfullscreen","");
    } else if (type === "shape") {
      o.style.pointerEvents = preview ? "auto" : "none";
    } else {
      inner = document.createElement("span");
      inner.textContent = String(item.text || "Double-click to edit");
      inner.style.width = "100%";
    }
    const href = safeUrl(item.href);
    if (href && type !== "canva") {
      const a = document.createElement("a"); a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer";
      if (inner) a.appendChild(inner);
      o.appendChild(a);
    } else if (inner) o.appendChild(inner);
    return o;
  }
  function draw() {
    applyPlacements();
    layer.replaceChildren(...(Array.isArray(state.items) ? state.items.map(itemBox) : []));
    layer.classList.toggle("preview-mode",preview);
  }
  function apply(next) {
    state = Object.assign(clone(defaults),clone(next || {}));
    state.placements = state.placements || clone(defaults.placements);
    draw();
  }
  const api = {
    apply, draw, targets, ident, layer,
    mode, getState: () => clone(state),
    setPreview: value => {preview = !!value;draw();},
    get preview() { return preview; }
  };
  window.PortfolioVisual = api;
  const p = new URLSearchParams(location.search);
  if (p.has("studio-preview")) api.setPreview(true);
  fetch("./visual.json",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(data=>{if(data)apply(data);else draw();}).catch(draw);
  const projects = document.querySelector("#projects");
  if (projects) new MutationObserver(() => applyPlacements()).observe(projects,{childList:true});
  window.addEventListener("resize",draw);
})();