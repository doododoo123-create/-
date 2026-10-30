import {createHanRasterManager} from './han-raster.js';


// Baked decorative art uses an isolated image surface; game geometry stays
// in the foreground SVG. Original source assets remain available for rebaking.
const hanHosts=new Map(),hanManagers=new WeakMap();let hanData=null,hanLoading=null;
function loadHanData(){
 if(hanData)return Promise.resolve(hanData);
 const embedded=document.getElementById('studio-han-art');
 if(embedded){hanData=JSON.parse(embedded.textContent);embedded.remove();return Promise.resolve(hanData);}
 if(!hanLoading)hanLoading=fetch('./assets/maps/han/raster.json').then(r=>{if(!r.ok)throw Error('첨부 지도 자료를 읽지 못했습니다.');return r.json();}).then(data=>hanData=data);
 return hanLoading;
}
export function usesHanMap(world){return world.cartography?.plate==='continent160'&&!world.cartography?.background&&world.cartography?.style!=='classic';}
export function hanMapPlaceholder(){return '<foreignObject class="han-map-host" x="-1200" y="-800" width="3600" height="2400" pointer-events="none" data-han-map="true"/>';}
export function preserveHanMaps(root){for(const host of root.querySelectorAll('.han-map-host')){const context=host.closest('[data-map-camera]')?.dataset.mapCamera;if(context)hanHosts.set(context,host);}}
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
  if(!hanManagers.has(host))loadHanData().then(data=>{if(!host.isConnected||hanManagers.has(host))return;const manager=createHanRasterManager(host,data);hanManagers.set(host,manager);manager.update();}).catch(error=>{host.dataset.hanError=error.message;});
 }
 // Retain decoded art only for maps that are actually present, including during
 // fullscreen/page switches; the encoded source is shared in the module.
 for(const [context,host] of hanHosts)if(!host.isConnected){hanManagers.get(host)?.dispose();hanHosts.delete(context);}
}
export function updateHanMaps(root){for(const host of root.querySelectorAll('.han-map-host'))hanManagers.get(host)?.update();}
