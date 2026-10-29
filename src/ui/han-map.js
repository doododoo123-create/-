

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
 const release=c=>{if(c.probe){c.probe.onload=c.probe.onerror=null;c.probe.src='';c.probe=null;}c.el.removeAttribute('href');if(c.url)URL.revokeObjectURL(c.url);c.url=null;c.loading=false;};
 const update=()=>{
  if(!host.isConnected)return;const matrix=svg.getScreenCTM();if(!matrix)return;
  const rect=host.closest('.atlas-scroll').getBoundingClientRect(),inverse=matrix.inverse(),corners=[[rect.left,rect.top],[rect.right,rect.bottom]].map(p=>new DOMPoint(...p).matrixTransform(inverse));
  const box=[corners[0].x-12,corners[0].y-12,corners[1].x+12,corners[1].y+12],scale=Math.hypot(matrix.a,matrix.b)*(globalThis.devicePixelRatio||1),high=scale>1.27;
  let pending=0,loaded=0;
  for(const c of cells){const b=c.bounds,wanted=high&&['sea','terrain'].includes(c.kind)&&b[2]>=box[0]&&b[0]<=box[2]&&b[3]>=box[1]&&b[1]<=box[3];
   if(!wanted){if(c.url)release(c);continue;}
   if(!c.url){const bytes=atob(data.textures[c.id]),buffer=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)buffer[i]=bytes.charCodeAt(i);c.url=URL.createObjectURL(new Blob([buffer],{type:'image/jpeg'}));c.loading=true;const probe=new Image();c.probe=probe;probe.onload=()=>{if(c.probe!==probe)return;c.el.setAttribute('href',c.url);c.loading=false;c.probe=null;host.dataset.hanPending=String(Math.max(0,Number(host.dataset.hanPending)-1));host.dataset.hanLoaded=String(cells.filter(c=>c.url&&!c.loading).length);};probe.onerror=()=>{release(c);host.dataset.hanError=c.id;};probe.src=c.url;}
   if(c.loading)pending++;else loaded++;
  }
  host.dataset.hanPending=String(pending);host.dataset.hanLoaded=String(loaded);host.dataset.hanArt=data.manifest.version;
 };
 return {update,dispose:()=>cells.forEach(release)};
}
export function mountHanMaps(root){
 for(const placeholder of root.querySelectorAll('.han-map-host')){
  const context=placeholder.closest('[data-map-camera]')?.dataset.mapCamera,previous=hanHosts.get(context);let host=placeholder;
  if(previous&&previous!==placeholder){placeholder.replaceWith(previous);host=previous;}
  hanHosts.set(context,host);
  if(!hanManagers.has(host))loadHanData().then(data=>{if(!host.isConnected||hanManagers.has(host))return;const manager=createHanManager(host,data);hanManagers.set(host,manager);manager.update();}).catch(error=>{host.dataset.hanError=error.message;});
 }
 // Retain decoded art only for maps that are actually present, including during
 // fullscreen/page switches; the encoded source is shared in the module.
 for(const [context,host] of hanHosts)if(!host.isConnected){hanManagers.get(host)?.dispose();hanHosts.delete(context);}
}
export function updateHanMaps(root){for(const host of root.querySelectorAll('.han-map-host'))hanManagers.get(host)?.update();}
