/* ContinentMap v1 — no dependencies; SVG coordinates are the source of truth. */
(function () {
  'use strict';
  const svg = document.documentElement.localName === 'svg' ? document.documentElement : document.getElementById('atlas');
  if (!svg) return;
  if (document.documentElement === svg) { svg.style.width='100vw';svg.style.height='100vh';svg.style.display='block'; }
  const data = JSON.parse(svg.querySelector('#map-data').textContent);
  const base = {x: data.viewBox[0], y: data.viewBox[1], w: data.viewBox[2], h: data.viewBox[3]};
  const MAX_ZOOM = 5, records = new Map(data.territories.map(t => [t.id, t]));
  const elements = new Map(Array.from(svg.querySelectorAll('.territory'), el => [el.id, el]));
  const spatial = Array.from(svg.querySelectorAll('[data-spatial-bounds]'),el=>({el,bounds:el.dataset.spatialBounds.split(' ').map(Number),hidden:false}));
  const subscribers = new Map(), state = new Map(), layers = {...data.layers}, listeners = [];
  const pointers = new Map();
  let seaTexture = {...(data.seaTexture || {strength:90})};
  let groundTexture = {...(data.groundTexture || {style:"terrain",strength:90})};
  let view = {...base}, zoom = 1, selected = null, hovered = null, destroyed = false;
  let gesture = null, hadMultiple = false, moving = false, lastZoomTime = 0;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function listen(target, type, fn, opts) { target.addEventListener(type, fn, opts); listeners.push(() => target.removeEventListener(type, fn, opts)); }
  function idOf(id) {
    if (typeof id === 'number' || /^\d{1,3}$/.test(String(id))) id = 'territory-' + String(id).padStart(3,'0');
    return records.has(id) ? id : null;
  }
  function info(id) { const t = records.get(id); return t ? {...t, neighbors:[...t.neighbors], center:[...t.center], centroid:[...t.centroid], bounds:[...t.bounds], state:structuredClone(state.get(id) || {})} : null; }
  function emit(type, detail) {
    const snapshot = structuredClone(detail);
    for (const fn of subscribers.get(type) || []) { try { fn(structuredClone(snapshot)); } catch (e) { console.error('ContinentMap subscriber:', e); } }
    svg.dispatchEvent(new CustomEvent('continentmap:' + type, {detail:snapshot, bubbles:true}));
    if (type === 'select' || type === 'hover') svg.dispatchEvent(new CustomEvent('territory' + type, {detail:structuredClone(snapshot), bubbles:true}));
  }
  function coordinate(clientX, clientY) {
    const p = svg.createSVGPoint(); p.x = clientX; p.y = clientY;
    const matrix = svg.getScreenCTM();
    return matrix ? p.matrixTransform(matrix.inverse()) : p;
  }
  function updateView() {
    const padX = base.w * .025, padY = base.h * .025;
    view.x = zoom <= 1 ? base.x : clamp(view.x, base.x-padX, base.x+base.w-view.w+padX);
    view.y = zoom <= 1 ? base.y : clamp(view.y, base.y-padY, base.y+base.h-view.h+padY);
    svg.setAttribute('viewBox', `${view.x.toFixed(4)} ${view.y.toFixed(4)} ${view.w.toFixed(4)} ${view.h.toFixed(4)}`);
    // Cull only tiles completely outside the actual viewport, including letterboxing.
    // The same vector art remains intact at every scale; no raster or detail swap.
    const rect=svg.getBoundingClientRect(),scale=Math.min(rect.width/view.w,rect.height/view.h);
    if(scale>0){
      const vw=rect.width/scale,vh=rect.height/scale,margin=10;
      const left=view.x-(vw-view.w)/2-margin,top=view.y-(vh-view.h)/2-margin,right=left+vw+margin*2,bottom=top+vh+margin*2;
      for(const tile of spatial){const b=tile.bounds,hidden=b[2]<left||b[0]>right||b[3]<top||b[1]>bottom;
        if(hidden!==tile.hidden){tile.el.style.display=hidden?'none':'';tile.el.toggleAttribute('data-culled',hidden);tile.hidden=hidden;}
      }
    }
    scheduleTextures();
    svg.dataset.zoom = zoom.toFixed(3);
    emit('viewchange', {zoom, percent:Math.round(zoom*100), viewBox:[view.x,view.y,view.w,view.h]});
  }
  function zoomTo(value, point) {
    const next = clamp(Number(value) || 1, 1, MAX_ZOOM);
    const center = point || {x:view.x+view.w/2,y:view.y+view.h/2};
    const fx = (center.x-view.x)/view.w, fy = (center.y-view.y)/view.h;
    zoom = next; view.w = base.w/zoom; view.h = base.h/zoom;
    view.x = center.x-fx*view.w; view.y = center.y-fy*view.h;
    updateView(); return zoom;
  }
  function clearSelection() {
    if (selected) { elements.get(selected).classList.remove('is-selected'); elements.get(selected).setAttribute('aria-pressed','false'); }
    svg.querySelectorAll('.is-neighbor').forEach(e=>e.classList.remove('is-neighbor'));
    selected = null; emit('select', {territory:null, id:null});
  }
  function select(input, options = {}) {
    const id = idOf(input); if (!id) return null;
    if (selected) { elements.get(selected).classList.remove('is-selected'); elements.get(selected).setAttribute('aria-pressed','false'); }
    svg.querySelectorAll('.is-neighbor').forEach(e=>e.classList.remove('is-neighbor'));
    selected = id;
    elements.get(id).classList.add('is-selected'); elements.get(id).setAttribute('aria-pressed','true');
    if (options.showNeighbors) records.get(id).neighbors.forEach(n=>elements.get(n).classList.add('is-neighbor'));
    const territory = info(id); emit('select', {territory, id});
    if (options.focus) focus(id,options.zoom);
    return territory;
  }
  function focus(input, targetZoom) {
    const id = idOf(input); if (!id) return false;
    const t=records.get(id), b=t.bounds;
    const fit = Math.min(base.w/(Math.max(20,b[2]-b[0])*2.8),base.h/(Math.max(20,b[3]-b[1])*2.8));
    zoom = clamp(targetZoom || fit,1,MAX_ZOOM); view.w=base.w/zoom;view.h=base.h/zoom;
    view.x=t.center[0]-view.w/2;view.y=t.center[1]-view.h/2;
    updateView();return true;
  }
  function fit() { zoom = 1; view = {...base}; updateView(); }
  function setLayer(name, visible) {
    const el = svg.querySelector('#layer-'+name);
    if (!el || !(name in layers)) return false;
    layers[name]=Boolean(visible);el.style.display=layers[name]?'':'none';
    if(name==='cultivation'){for(const id of ['layer-field-edge-ground','layer-field-edge-finish']){const margin=svg.querySelector('#'+id);if(margin)margin.style.display=layers[name]?'':'none';}}
    const shadowGroup=svg.querySelector('#shadow-'+name);if(shadowGroup)shadowGroup.style.display=layers[name]?'':'none';
    for(const prefix of ['support-','fringe-']){const group=svg.querySelector('#'+prefix+name);if(group)group.style.display=layers[name]?'':'none';}
    if(name==='landuse'){for(const id of ['layer-integration','layer-contact-fringe']){const group=svg.querySelector('#'+id);if(group)group.style.display=layers[name]?'':'none';}}
    scheduleTextures();
    emit('layerchange',{name,visible:layers[name]});return true;
  }
  function setTerritoryState(input, patch) {
    const id=idOf(input); if (!id || !patch || typeof patch !== 'object' || Array.isArray(patch)) return false;
    const next={...(state.get(id)||{}),...structuredClone(patch)};
    state.set(id,next);
    const el=elements.get(id),t=records.get(id);
    const name=typeof next.name==='string'&&next.name.trim()?next.name.trim():t.name;
    el.setAttribute('aria-label', `${name}, ${t.terrain}`);
    el.querySelector('title').textContent=name+' · '+t.terrain;
    emit('statechange',{id,territory:info(id)});return true;
  }

  function applyGroundTexture() {
    const layer=svg.querySelector('#layer-ground');if(!layer)return;
    data.groundTexture={...groundTexture};svg.querySelector('#map-data').textContent=JSON.stringify(data);
    layer.dataset.groundStyle=groundTexture.style;
    layer.querySelectorAll('[data-ground-mode]').forEach(el=>{el.style.display=el.dataset.groundMode===groundTexture.style?'':'none';});
    layer.querySelectorAll('[data-strength-weight]').forEach(el=>el.setAttribute('opacity',String(Number(el.dataset.strengthWeight)*groundTexture.strength/100)));
    scheduleTextures();
    emit('groundchange',{...groundTexture});
  }
  function setGroundStyle(style) {
    if(!['parchment','soil','terrain'].includes(style))return false;
    groundTexture.style=style;applyGroundTexture();return true;
  }
  function setGroundStrength(strength) {
    const value=Number(strength);if(!Number.isFinite(value))return false;
    groundTexture.strength=clamp(value,0,100);applyGroundTexture();return true;
  }


  function applySeaTexture() {
    const layer=svg.querySelector('#layer-sea-texture');if(!layer)return;
    data.seaTexture={...seaTexture};svg.querySelector('#map-data').textContent=JSON.stringify(data);
    layer.dataset.seaStrength=String(seaTexture.strength);
    layer.querySelectorAll('[data-sea-weight]').forEach(el=>el.setAttribute('opacity',String(Number(el.dataset.seaWeight)*seaTexture.strength/100)));
    scheduleTextures();
    emit('seachange',{...seaTexture});
  }
  function setSeaStrength(strength) {
    const value=Number(strength);if(!Number.isFinite(value))return false;
    seaTexture.strength=clamp(value,0,100);applySeaTexture();return true;
  }

  // Decode only the visible native-resolution surface cells. The preview is always
  // underneath, so zooming or panning never flashes an untextured patch.
  const textureBankNode=svg.querySelector('#texture-assets');
  const textureBank=textureBankNode?JSON.parse(textureBankNode.textContent):{};
  const surfaceCells=Array.from(svg.querySelectorAll('[data-texture-id]'),el=>({
    el,id:el.dataset.textureId,kind:el.dataset.textureKind,
    bounds:el.dataset.textureBounds.split(' ').map(Number),
    pixels:Number(el.dataset.texturePixels),loaded:false,url:null,loading:null,probe:null
  }));
  let textureFrame=0,textureEpoch=0;
  function releaseTexture(cell) {
    cell.el.removeAttribute('href');cell.loaded=false;
    if(cell.probe){cell.probe.src='';cell.probe=null;}
    if(cell.url){URL.revokeObjectURL(cell.url);cell.url=null;}
  }
  function textureViewport() {
    const rect=svg.getBoundingClientRect();
    const scale=Math.min(rect.width/view.w,rect.height/view.h);
    const vw=scale>0?rect.width/scale:view.w,vh=scale>0?rect.height/scale:view.h;
    return {scale,box:[view.x-(vw-view.w)/2-12,view.y-(vh-view.h)/2-12,
      view.x+(vw+view.w)/2+12,view.y+(vh+view.h)/2+12]};
  }
  function wantedTextures() {
    const {scale,box}=textureViewport();
    // 1.25 native pixels per world unit in the preview; retain 5 in detail cells.
    if(scale*(window.devicePixelRatio||1)<=1.27)return new Set();
    return new Set(surfaceCells.filter(c=>{
      const active=c.kind==='sea'?(layers['sea-texture']!==false&&seaTexture.strength>0):
        (layers.ground!==false&&groundTexture.strength>0&&c.kind===groundTexture.style);
      const b=c.bounds;return active&&b[2]>=box[0]&&b[0]<=box[2]&&b[3]>=box[1]&&b[1]<=box[3];
    }).map(c=>c.id));
  }
  function nativeTextureURL(id) {
    const bytes=atob(textureBank[id]);const buffer=new Uint8Array(bytes.length);
    for(let i=0;i<bytes.length;i++)buffer[i]=bytes.charCodeAt(i);
    return URL.createObjectURL(new Blob([buffer],{type:'image/jpeg'}));
  }
  function refreshTextures() {
    if(destroyed)return [];
    textureEpoch++;const wanted=wantedTextures(),pending=[];
    for(const cell of surfaceCells){
      if(!wanted.has(cell.id)){if(!cell.loading)releaseTexture(cell);continue;}
      if(cell.loaded)continue;
      if(cell.loading){pending.push(cell.loading);continue;}
      const url=nativeTextureURL(cell.id);cell.url=url;
      const probe=new Image();cell.probe=probe;probe.src=url;
      cell.loading=probe.decode().then(()=>{
        if(!destroyed&&wantedTextures().has(cell.id)){
          cell.el.setAttribute('href',url);cell.loaded=true;
        }else releaseTexture(cell);
      }).catch(()=>{
        releaseTexture(cell);
        if(!destroyed)emit('textureerror',{id:cell.id});
      }).finally(()=>{cell.loading=null;cell.probe=null;});
      pending.push(cell.loading);
    }
    return pending;
  }
  function scheduleTextures() {
    if(!textureFrame&&!destroyed)textureFrame=requestAnimationFrame(()=>{
      textureFrame=0;refreshTextures();
    });
  }
  async function texturesReady() {
    if(textureFrame){cancelAnimationFrame(textureFrame);textureFrame=0;}
    await Promise.all(refreshTextures());
    // Decode completion can race with a drag or a mode switch.
    await Promise.all(refreshTextures());
    await new Promise(resolve=>requestAnimationFrame(resolve));
  }
  function textureStats() {
    const loaded=surfaceCells.filter(c=>c.loaded),pending=surfaceCells.filter(c=>c.loading);
    return {assetCount:surfaceCells.length,loadedTiles:loaded.length,pendingTiles:pending.length,
      decodedNativePixels:loaded.reduce((n,c)=>n+c.pixels,0),
      nativeRGBABytes:loaded.reduce((n,c)=>n+c.pixels*4,0),
      previewPixelsPerWorldUnit:1.25,nativePixelsPerWorldUnit:5,
      activeKinds:[...new Set(loaded.map(c=>c.kind))]};
  }
  function bakeTextureExport(clone) {
    for(const el of clone.querySelectorAll('[data-texture-id]')){
      el.setAttribute('href','data:image/jpeg;base64,'+textureBank[el.dataset.textureId]);
    }
    clone.querySelectorAll('[data-texture-preview]').forEach(el=>el.remove());
    clone.querySelector('#texture-assets')?.remove();
  }
  function disposeTextures() {
    if(textureFrame)cancelAnimationFrame(textureFrame);
    surfaceCells.forEach(releaseTexture);
  }

  function exportState() { return {schemaVersion:1,mapId:data.mapId,selected,zoom,viewBox:[view.x,view.y,view.w,view.h],layers:{...layers},groundTexture:{...groundTexture},seaTexture:{...seaTexture},territories:Array.from(state,([id,value])=>({id,state:structuredClone(value)}))}; }
  function importState(saved) {
    if (!saved || saved.schemaVersion!==1 || saved.mapId!==data.mapId || !Array.isArray(saved.territories)) throw new Error('지도 ID 또는 데이터 형식이 일치하지 않습니다.');
    for (const row of saved.territories) if (!idOf(row.id) || !row.state || typeof row.state!=='object'||Array.isArray(row.state)) throw new Error('올바르지 않은 영지 데이터입니다.');
    if (saved.selected != null && !idOf(saved.selected)) throw new Error('선택 영지 ID가 올바르지 않습니다.');
    if (saved.viewBox && (!Array.isArray(saved.viewBox)||saved.viewBox.length!==4||!saved.viewBox.every(Number.isFinite)||saved.viewBox[2]<=0||saved.viewBox[3]<=0)) throw new Error('화면 좌표가 올바르지 않습니다.');
    if(saved.groundTexture && (!["parchment","soil","terrain"].includes(saved.groundTexture.style)||!Number.isFinite(saved.groundTexture.strength)||saved.groundTexture.strength<0||saved.groundTexture.strength>100))throw new Error("바닥 질감 설정이 올바르지 않습니다.");
    if(saved.seaTexture && (!Number.isFinite(saved.seaTexture.strength)||saved.seaTexture.strength<0||saved.seaTexture.strength>100))throw new Error("Sea texture strength must be between 0 and 100.");
    state.clear();
    for (const [id,el] of elements) { el.querySelector('title').textContent=records.get(id).name+' · '+records.get(id).terrain;el.setAttribute('aria-label',records.get(id).name+', '+records.get(id).terrain); }
    saved.territories.forEach(row=>setTerritoryState(row.id,row.state));
    if(saved.seaTexture){seaTexture={...saved.seaTexture};applySeaTexture();}
    if(saved.groundTexture){groundTexture={...saved.groundTexture};applyGroundTexture();}
    for (const [name,on] of Object.entries(saved.layers||{})) setLayer(name,on);
    if (saved.selected) select(saved.selected);else clearSelection();
    zoom=clamp(Number(saved.zoom)||1,1,MAX_ZOOM); view={x:saved.viewBox?.[0]||0,y:saved.viewBox?.[1]||0,w:base.w/zoom,h:base.h/zoom};
    updateView(); return true;
  }
  function download(text, name, type) {
    const url=URL.createObjectURL(new Blob([text],{type}));
    const a=document.createElementNS('http://www.w3.org/1999/xhtml','a'); a.href=url;a.download=name;
    document.documentElement.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function exportSVG({currentView=false, selection=false}={}) {
    const clone=svg.cloneNode(true);clone.querySelectorAll('script').forEach(e=>e.remove());
    bakeTextureExport(clone);
    clone.removeAttribute('style');clone.removeAttribute('data-zoom');
    clone.querySelectorAll('[data-spatial-bounds]').forEach(el=>{el.style.display='';el.removeAttribute('data-culled');});
    clone.setAttribute('width',String(base.w));clone.setAttribute('height',String(base.h));
    if (!currentView) clone.setAttribute('viewBox',data.viewBox.join(' '));
    if (!selection) clone.querySelectorAll('.is-selected,.is-neighbor').forEach(e=>{e.classList.remove('is-selected','is-neighbor');e.setAttribute('aria-pressed','false');});
    return '<?xml version="1.0" encoding="UTF-8"?>\n'+new XMLSerializer().serializeToString(clone);
  }
  listen(svg,'wheel',e=>{
    e.preventDefault();
    const unit=e.deltaMode===1?16:e.deltaMode===2?svg.clientHeight:1;
    zoomTo(zoom*Math.exp(-e.deltaY*unit*.0015),coordinate(e.clientX,e.clientY));
    lastZoomTime=performance.now();
  },{passive:false});
  listen(svg,'dblclick',e=>{e.preventDefault();zoomTo(zoom*(e.shiftKey ? .5 : 1.8),coordinate(e.clientX,e.clientY));});
  listen(svg,'pointerdown',e=>{
    if (e.button && e.button!==0) return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    svg.setPointerCapture(e.pointerId);
    if (pointers.size===1) {
      hadMultiple=false;moving=false;
      gesture={type:'pan',sx:e.clientX,sy:e.clientY,view:{...view},id:e.target.closest?.('.territory')?.id||null};
    } else if (pointers.size===2) {
      hadMultiple=true;const [a,b]=Array.from(pointers.values());
      const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
      gesture={type:'pinch',distance:Math.hypot(a.x-b.x,a.y-b.y),zoom,point:coordinate(mid.x,mid.y)};
    }
  });
  listen(svg,'pointermove',e=>{
    if (!pointers.has(e.pointerId)) {
      const id=e.target.closest?.('.territory')?.id||null;
      if (id!==hovered) { hovered=id;emit('hover',{id,territory:info(id),clientX:e.clientX,clientY:e.clientY}); }
      return;
    }
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if (gesture?.type==='pinch' && pointers.size>=2) {
      const [a,b]=Array.from(pointers.values());const dist=Math.hypot(a.x-b.x,a.y-b.y);
      zoomTo(gesture.zoom*dist/Math.max(1,gesture.distance),gesture.point);moving=true;
    } else if (gesture?.type==='pan' && pointers.size===1) {
      const dx=e.clientX-gesture.sx,dy=e.clientY-gesture.sy;
      if (Math.hypot(dx,dy)>4) moving=true;
      if (!moving) return;
      const rect=svg.getBoundingClientRect(),scale=Math.min(rect.width/gesture.view.w,rect.height/gesture.view.h);
      view.x=gesture.view.x-dx/scale;view.y=gesture.view.y-dy/scale;updateView();
      svg.style.cursor='grabbing';
    }
  });
  function finishPointer(e,cancelled) {
    if (!pointers.has(e.pointerId))return;
    pointers.delete(e.pointerId);
    if (!cancelled && !moving && !hadMultiple && gesture?.id && performance.now()-lastZoomTime>80) select(gesture.id);
    if (svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);
    svg.style.cursor='';
    if (pointers.size===1) {
      const a=Array.from(pointers.values())[0];gesture={type:'pan',sx:a.x,sy:a.y,view:{...view},id:null};
    } else if (!pointers.size) {gesture=null;moving=false;}
  }
  listen(svg,'pointerup',e=>finishPointer(e,false));
  listen(svg,'pointercancel',e=>finishPointer(e,true));
  listen(svg,'pointerleave',()=>{if(!pointers.size){hovered=null;emit('hover',{id:null,territory:null});}});
  listen(svg,'keydown',e=>{
    const id=e.target.closest?.('.territory')?.id;
    if ((e.key==='Enter'||e.key===' ')&&id) {e.preventDefault();select(id);return;}
  });
  listen(document,'keydown',e=>{
    if (e.defaultPrevented || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.closest?.('[role="dialog"]') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key==='+'||e.key==='=') {e.preventDefault();zoomTo(zoom*1.25);}
    else if(e.key==='-') {e.preventDefault();zoomTo(zoom/1.25);}
    else if(e.key==='Home'||e.key==='0') {e.preventDefault();fit();}
    else if(e.key==='Escape')clearSelection();
    else if(e.key.startsWith('Arrow') && zoom>1) {
      e.preventDefault();const n=e.shiftKey ? .22 : .09;
      if(e.key==='ArrowLeft')view.x-=view.w*n;if(e.key==='ArrowRight')view.x+=view.w*n;
      if(e.key==='ArrowUp')view.y-=view.h*n;if(e.key==='ArrowDown')view.y+=view.h*n;updateView();
    }
  });
  listen(window,'resize',updateView);
  const api={
    version:'2.3.0', get metadata(){return structuredClone(data);},
    get selected(){return selected;},get zoom(){return zoom;},get viewBox(){return [view.x,view.y,view.w,view.h];},
    getLandUse:()=>structuredClone(data.landuse||{}),getSettlements:()=>structuredClone(data.settlements||[]),getSettlementForTerritory:id=>structuredClone((data.settlements||[]).find(s=>s.territoryId===idOf(id))||null),
    getTerritory:id=>info(idOf(id)),getTerritories:()=>Array.from(records.keys(),info),
    select,clearSelection,focus,fit,zoomTo,setLayer,getLayers:()=>({...layers}),
    setTerritoryState,exportState,importState,exportSVG,texturesReady,textureStats,setGroundStyle,setGroundStrength,getGroundTexture:()=>({...groundTexture}),setSeaStrength,getSeaTexture:()=>({...seaTexture}),
    on(type,fn){if(typeof fn!=='function')throw new TypeError('Callback required');if(!subscribers.has(type))subscribers.set(type,new Set());subscribers.get(type).add(fn);return()=>subscribers.get(type)?.delete(fn);},
    downloadSVG:()=>download(exportSVG(),'continent_160.svg','image/svg+xml;charset=utf-8'),
    downloadState:()=>download(JSON.stringify(exportState(),null,2),'continent_160_state.json','application/json;charset=utf-8'),
    downloadData:()=>download(JSON.stringify(data,null,2),'territories_160.json','application/json;charset=utf-8'),
    destroy(){if(destroyed)return;listeners.forEach(fn=>fn());subscribers.clear();pointers.clear();destroyed=true;disposeTextures();}
  };
  window.ContinentMap=api;applyGroundTexture();applySeaTexture();updateView();emit('ready',{mapId:data.mapId,territoryCount:160});
})();
