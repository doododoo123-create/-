

// Source art lives in an isolated SVG tree. Its shapes, image cells and paint
// order stay intact, while game-owned paths/cards remain in the outer SVG.
const hanHosts=new Map(),hanManagers=new WeakMap();let hanData=null,hanLoading=null;
function loadHanData(){
 if(hanData)return Promise.resolve(hanData);
 const embedded=document.getElementById('studio-han-art');
 if(embedded){hanData=JSON.parse(embedded.textContent);embedded.remove();return Promise.resolve(hanData);}
 if(!hanLoading)hanLoading=fetch('./assets/maps/han/art.json').then(r=>{if(!r.ok)throw Error('첨부 지도 자료를 읽지 못했습니다.');return r.json();}).then(data=>hanData=data);
 return hanLoading;
}
export function usesHanMap(world){return world.cartography?.plate==='continent160'&&!world.cartography?.background&&world.cartography?.style!=='classic';}
export function hanMapPlaceholder(){return '<foreignObject class="han-map-host" x="-1200" y="-800" width="3600" height="2400" pointer-events="none" data-han-map="true"/>';}
export function preserveHanMaps(root){for(const host of root.querySelectorAll('.han-map-host')){const context=host.closest('[data-map-camera]')?.dataset.mapCamera;if(context)hanHosts.set(context,host);}}
function createHanManager(host,data){
 const surface=document.createElement('div');surface.className='han-map-surface';surface.style.cssText='width:100%;height:100%;pointer-events:none';host.append(surface);
 const shadow=surface.attachShadow({mode:'open'});shadow.innerHTML=data.svg;
 const svg=shadow.querySelector('svg'),cells=[...svg.querySelectorAll('[data-texture-id]')].map(el=>({el,id:el.dataset.textureId,kind:el.dataset.textureKind,bounds:el.dataset.textureBounds.split(' ').map(Number),url:null,probe:null,loading:false}));
 let decodeFrame=null,disposed=false,viewKey='',clock=0;
 const release=c=>{if(c.probe){c.probe.onload=c.probe.onerror=null;c.probe.src='';c.probe=null;}c.el.removeAttribute('href');if(c.url)URL.revokeObjectURL(c.url);c.url=null;c.loading=false;c.bytes=0;};
 const counts=()=>{host.dataset.hanPending=String(cells.filter(c=>c.wanted&&(!c.url||c.loading)&&!c.failed).length);host.dataset.hanLoaded=String(cells.filter(c=>c.wanted&&c.url&&!c.loading).length);host.dataset.hanCached=String(cells.filter(c=>!c.wanted&&c.url).length);};
 const trim=()=>{const idle=cells.filter(c=>!c.wanted&&c.url).sort((a,b)=>b.used-a.used);let bytes=0;for(const [i,c] of idle.entries()){bytes+=c.bytes||0;if(i>=8||bytes>8*1024*1024)release(c);}};
 const decode=()=>{
  decodeFrame=null;if(disposed||!host.isConnected)return;
  // Decode a few visible source tiles per frame; camera input stays responsive.
  for(const c of cells.filter(c=>c.wanted&&!c.url&&!c.failed).slice(0,3)){
   const bytes=atob(data.textures[c.id]),buffer=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)buffer[i]=bytes.charCodeAt(i);
   c.url=URL.createObjectURL(new Blob([buffer],{type:'image/jpeg'}));c.loading=true;const probe=new Image();c.probe=probe;
   probe.onload=()=>{if(c.probe!==probe)return;c.bytes=bytes.length+probe.naturalWidth*probe.naturalHeight*4;c.loading=false;c.probe=null;if(c.wanted)c.el.setAttribute('href',c.url);trim();counts();};
   probe.onerror=()=>{release(c);c.failed=true;host.dataset.hanError=c.id;counts();};probe.src=c.url;
  }
  counts();if(cells.some(c=>c.wanted&&!c.url&&!c.failed))decodeFrame=requestAnimationFrame(decode);
 };
 const update=()=>{
  if(!host.isConnected)return;const matrix=svg.getScreenCTM();if(!matrix)return;
  const rect=host.closest('.atlas-scroll').getBoundingClientRect(),inverse=matrix.inverse(),corners=[[rect.left,rect.top],[rect.right,rect.bottom]].map(p=>new DOMPoint(...p).matrixTransform(inverse));
  const box=[corners[0].x-12,corners[0].y-12,corners[1].x+12,corners[1].y+12],scale=Math.hypot(matrix.a,matrix.b)*(globalThis.devicePixelRatio||1),high=scale>1.27;
  const key=box.join(',')+':'+scale;if(viewKey===key)return;viewKey=key;
  for(const c of cells){const b=c.bounds,wanted=high&&['sea','terrain'].includes(c.kind)&&b[2]>=box[0]&&b[0]<=box[2]&&b[3]>=box[1]&&b[1]<=box[3];
   c.wanted=wanted;if(!wanted){if(c.loading)release(c);else c.el.removeAttribute('href');continue;}
   c.used=++clock;if(c.url&&!c.loading)c.el.setAttribute('href',c.url);
  }
  trim();counts();host.dataset.hanArt=data.manifest.version;if(decodeFrame===null&&cells.some(c=>c.wanted&&!c.url&&!c.failed))decodeFrame=requestAnimationFrame(decode);
 };
 return {update,dispose:()=>{disposed=true;if(decodeFrame!==null)cancelAnimationFrame(decodeFrame);cells.forEach(release);}};
}
// Keep the expensive, unchanging source art in its own SVG paint surface.
// Both SVGs use the exact same viewBox; only the foreground has game hit areas.
function isolateHanBackground(host){
 const map=host.closest('.atlas-scroll'),foreground=map?.querySelector('.atlas-map');if(!foreground)return;
 let art=map.querySelector(':scope > .atlas-art-surface');
 if(!art){art=document.createElementNS('http://www.w3.org/2000/svg','svg');art.setAttribute('class','atlas-art-surface');art.setAttribute('aria-hidden','true');map.append(art);}
 const view=foreground.getAttribute('viewBox');if(art.getAttribute('viewBox')!==view)art.setAttribute('viewBox',view);
 if(host.parentNode!==art)art.append(host);
}
export function mountHanMaps(root){
 for(const placeholder of root.querySelectorAll('.han-map-host')){
  const context=placeholder.closest('[data-map-camera]')?.dataset.mapCamera,previous=hanHosts.get(context);let host=placeholder;
  if(previous&&previous!==placeholder){placeholder.replaceWith(previous);host=previous;}
  hanHosts.set(context,host);isolateHanBackground(host);
  if(!hanManagers.has(host))loadHanData().then(data=>{if(!host.isConnected||hanManagers.has(host))return;const manager=createHanManager(host,data);hanManagers.set(host,manager);manager.update();}).catch(error=>{host.dataset.hanError=error.message;});
 }
 // Retain decoded art only for maps that are actually present, including during
 // fullscreen/page switches; the encoded source is shared in the module.
 for(const [context,host] of hanHosts)if(!host.isConnected){hanManagers.get(host)?.dispose();hanHosts.delete(context);}
}
export function updateHanMaps(root){for(const host of root.querySelectorAll('.han-map-host'))hanManagers.get(host)?.update();}
