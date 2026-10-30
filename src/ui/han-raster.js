// Decorative source art is baked once at build time. Boundaries, labels, hit
// areas and simulation state remain in the independent game SVG.
export const HAN_VISIBLE_BYTES=48*1024*1024,HAN_IDLE_BYTES=16*1024*1024;
export function visibleRasterTiles(level,box){
 const sx=1800/level.width,sy=1060/level.height;
 return level.tiles.filter(t=>t.x*sx<box[2]&&t.y*sy<box[3]&&(t.x+t.width)*sx>box[0]&&(t.y+t.height)*sy>box[1]);
}
export function chooseRasterLevel(data,box,scale){
 if(1800*scale<=data.manifest.previewWidth*1.12)return null;
 let chosen=data.levels.find(l=>l.width>=1800*scale)||data.levels.at(-1);
 while(chosen){const bytes=visibleRasterTiles(chosen,box).reduce((n,t)=>n+t.width*t.height*4,0);if(bytes<=HAN_VISIBLE_BYTES)return chosen;chosen=data.levels[data.levels.indexOf(chosen)-1];}
 return null;
}
export function createHanRasterManager(host,data){
 const ns='http://www.w3.org/2000/svg',surface=document.createElement('div');surface.className='han-map-surface';surface.style.cssText='width:100%;height:100%;pointer-events:none';host.append(surface);
 const shadow=surface.attachShadow({mode:'open'}),svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','-1800 -1270 5400 3600');svg.setAttribute('preserveAspectRatio','none');svg.style.cssText='display:block;width:100%;height:100%;pointer-events:none';shadow.append(svg);
 const image=(parent,bounds)=>{const e=document.createElementNS(ns,'image');for(const [i,k] of ['x','y','width','height'].entries())e.setAttribute(k,String(bounds[i]));e.setAttribute('preserveAspectRatio','none');parent.append(e);return e;};
 const base=[{id:'overview',data:data.overview,width:2304,height:1536,el:image(svg,data.manifest.overviewBounds)},{id:'preview',data:data.preview,width:data.manifest.previewWidth,height:data.manifest.previewHeight,el:image(svg,data.manifest.mainBounds)}];
 const groups=new Map(),cells=data.levels.flatMap(l=>{const group=document.createElementNS(ns,'g');group.dataset.rasterWidth=String(l.width);group.setAttribute('opacity','0');svg.append(group);groups.set(l.width,group);return l.tiles.map(t=>({...t,level:l.width,el:image(group,[t.x/l.width*1800,t.y/l.height*1060,t.width/l.width*1800,t.height/l.height*1060])}));});
 let disposed=false,frame=null,timer=null,viewKey='',view=null,shown=0,clock=0;
 const release=c=>{if(c.probe){c.probe.onload=c.probe.onerror=null;c.probe.src='';c.probe=null;}c.el.removeAttribute('href');if(c.url)URL.revokeObjectURL(c.url);c.url=null;c.ready=false;c.loading=false;c.bytes=0;};
 const intersects=(c,box)=>{const l=data.levels.find(l=>l.width===c.level);return c.x/l.width*1800<box[2]&&(c.x+c.width)/l.width*1800>box[0]&&c.y/l.height*1060<box[3]&&(c.y+c.height)/l.height*1060>box[1];};
 const counts=()=>{host.dataset.hanPending=String((timer?1:0)+[...base,...cells].filter(c=>(c.wanted||base.includes(c))&&!c.ready&&!c.failed).length);host.dataset.hanLoaded=String(cells.filter(c=>c.wanted&&c.ready).length);host.dataset.hanCached=String(cells.filter(c=>!c.wanted&&c.ready).length);host.dataset.hanBytes=String([...base,...cells].reduce((n,c)=>n+(c.bytes||0),0));host.dataset.hanReady=String(base.every(c=>c.ready));};
 const trim=()=>{const idle=cells.filter(c=>c.ready&&!c.wanted&&!(c.level===shown&&view&&intersects(c,view.box))).sort((a,b)=>b.used-a.used);let bytes=0;for(const c of idle){bytes+=c.bytes||0;if(bytes>HAN_IDLE_BYTES)release(c);}};
 const present=()=>{
  if(!view)return;const target=view.level?.width||0,wanted=cells.filter(c=>c.wanted);
  if(!wanted.every(c=>c.ready||c.failed))return;
  for(const [width,g] of groups)g.setAttribute('opacity',width===target?'1':'0');shown=target;host.dataset.hanQuality=String(target||data.manifest.previewWidth);trim();counts();
 };
 const load=c=>{
  const binary=atob(c.data),bytes=Uint8Array.from(binary,ch=>ch.charCodeAt(0));c.url=URL.createObjectURL(new Blob([bytes],{type:'image/webp'}));c.loading=true;c.used=++clock;const probe=new Image();c.probe=probe;
  probe.onload=()=>{if(disposed||c.probe!==probe)return;c.ready=true;c.loading=false;c.probe=null;c.bytes=c.width*c.height*4+bytes.length;c.el.setAttribute('href',c.url);present();trim();counts();};
  probe.onerror=()=>{if(disposed)return;release(c);c.failed=true;host.dataset.hanError=c.id;present();counts();};probe.src=c.url;
 };
 const decode=()=>{frame=null;if(disposed||!host.isConnected)return;for(const c of cells.filter(c=>c.wanted&&!c.ready&&!c.loading&&!c.failed).slice(0,2))load(c);counts();if(cells.some(c=>c.wanted&&!c.ready&&!c.loading&&!c.failed))frame=requestAnimationFrame(decode);};
 const settle=()=>{
  timer=null;if(disposed||!view||!host.isConnected)return;view.level=chooseRasterLevel(data,view.box,view.scale);const wanted=new Set(view.level?visibleRasterTiles(view.level,view.box).map(t=>t.id):[]);
  for(const c of cells){c.wanted=wanted.has(c.id);if(c.wanted)c.used=++clock;}
  present();counts();if(frame===null&&cells.some(c=>c.wanted&&!c.ready&&!c.loading&&!c.failed))frame=requestAnimationFrame(decode);
 };
 const update=()=>{
  if(disposed||!host.isConnected)return;const matrix=svg.getScreenCTM();if(!matrix)return;const rect=host.closest('.atlas-scroll').getBoundingClientRect(),inverse=matrix.inverse(),a=new DOMPoint(rect.left,rect.top).matrixTransform(inverse),b=new DOMPoint(rect.right,rect.bottom).matrixTransform(inverse),box=[a.x-24,a.y-24,b.x+24,b.y+24],scale=Math.hypot(matrix.a,matrix.b)*(globalThis.devicePixelRatio||1),key=box.join(',')+':'+scale;
  if(key===viewKey)return;if(frame!==null){cancelAnimationFrame(frame);frame=null;}viewKey=key;view={box,scale,level:view?.level};if(timer!==null)clearTimeout(timer);timer=setTimeout(settle,120);counts();
 };
 host.dataset.hanArt=data.manifest.sourceVersion;host.dataset.hanRenderer='raster';host.dataset.hanQuality=String(data.manifest.previewWidth);base.forEach(load);counts();
 return {update,dispose:()=>{disposed=true;if(frame!==null)cancelAnimationFrame(frame);if(timer!==null)clearTimeout(timer);[...base,...cells].forEach(release);}};
}
