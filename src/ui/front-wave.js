import { cellPoints,mapAnchor } from '../model/cartography-geometry.js';
import { pointInShape } from '../model/cartography.js';
import { frontSegments } from './front-segments.js';
const waveCache=new WeakMap();
const frontNumber=n=>Math.round(n*1000)/1000;
function segmentDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);}
function wavePush(heap,item){let i=heap.length;heap.push(item);while(i){const parent=(i-1)>>1;if(heap[parent][0]<=item[0])break;heap[i]=heap[parent];i=parent;}heap[i]=item;}
function wavePop(heap){const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1][0]<heap[child][0])child++;if(heap[child][0]>=last[0])break;heap[i]=heap[child];i=child;}heap[i]=last;}return first;}
export function buildFrontWave(world,geometry,index,fromId){
 const key=world.cartography?.polygons||geometry;if(!waveCache.has(key))waveCache.set(key,new Map());const cache=waveCache.get(key),cacheKey=[world.rows,world.cols,index,fromId,geometry.cells[index].path].join(':');if(cache.has(cacheKey))return cache.get(cacheKey);
 const cell=geometry.cells[index],points=cellPoints(cell),shape={points,holes:cell.holes||[]},fromIndex=world.territories.findIndex(t=>t.id===fromId),source=geometry.cells[fromIndex],shared=source?frontSegments(geometry,cell,source):[];
 const origin=mapAnchor(world,fromId,'reference',geometry)||[Math.min(...points.map(p=>p[0]))-1,cell.center[1]];
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),minX=Math.min(...xs),minY=Math.min(...ys),width=Math.max(...xs)-minX,height=Math.max(...ys)-minY,step=Math.max(1.5,Math.sqrt(width*height/1100)),cols=Math.ceil(width/step)+3,rows=Math.ceil(height/step)+3;
 const nodes=Array.from({length:cols*rows},(_,i)=>[minX-step+(i%cols)*step,minY-step+Math.floor(i/cols)*step]),inside=nodes.map(p=>pointInShape(p,shape)),distance=nodes.map(()=>Infinity),heap=[];
 const border=shared.length?shared:points.map((p,i)=>[p,points[(i+1)%points.length]]).sort((a,b)=>segmentDistance(origin,...a)-segmentDistance(origin,...b)).slice(0,1);
 for(let i=0;i<nodes.length;i++)if(inside[i]){const d=Math.min(...border.map(([a,b])=>segmentDistance(nodes[i],a,b)));if(d<=step*1.7){distance[i]=d;wavePush(heap,[d,i]);}}
 if(!heap.length){let best=-1;for(let i=0;i<nodes.length;i++)if(inside[i]&&(best<0||Math.hypot(nodes[i][0]-origin[0],nodes[i][1]-origin[1])<Math.hypot(nodes[best][0]-origin[0],nodes[best][1]-origin[1])))best=i;if(best>=0){distance[best]=0;wavePush(heap,[0,best]);}}
 while(heap.length){const [d,i]=wavePop(heap);if(d!==distance[i])continue;const x=i%cols,y=Math.floor(i/cols);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy,j=ny*cols+nx;if((!dx&&!dy)||nx<0||ny<0||nx>=cols||ny>=rows||!inside[j])continue;const candidate=d+Math.hypot(dx,dy)*step;if(candidate<distance[j]){distance[j]=candidate;wavePush(heap,[candidate,j]);}}}
 const finite=distance.filter(Number.isFinite),maximum=Math.max(step,...finite);
 for(let i=0;i<nodes.length;i++)if(!Number.isFinite(distance[i])){let near=Infinity;const x=i%cols,y=Math.floor(i/cols);for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){const nx=x+dx,ny=y+dy,j=ny*cols+nx;if(nx>=0&&nx<cols&&ny>=0&&ny<rows&&inside[j]&&Number.isFinite(distance[j]))near=Math.min(near,distance[j]+step);}distance[i]=Number.isFinite(near)?near:maximum+step*2;}
 const model={nodes,distance,cols,rows,maximum:maximum+step*2,step,path:cell.path};cache.set(cacheKey,model);return model;
}
function smoothFront(segments){
 const key=p=>p.map(frontNumber).join(','),links=new Map();segments.forEach((s,i)=>s.forEach(p=>{const k=key(p);if(!links.has(k))links.set(k,[]);links.get(k).push(i);}));
 const used=new Set(),paths=[];for(let first=0;first<segments.length;first++)if(!used.has(first)){
  const chain=[segments[first][0],segments[first][1]];used.add(first);
  for(const prepend of [false,true]){while(true){const endpoint=prepend?chain[0]:chain.at(-1),next=links.get(key(endpoint))?.find(i=>!used.has(i));if(next===undefined)break;used.add(next);const segment=segments[next],point=key(segment[0])===key(endpoint)?segment[1]:segment[0];if(prepend)chain.unshift(point);else chain.push(point);}}
  let d='M'+chain[0].map(frontNumber).join(',');for(let i=1;i<chain.length-1;i++){const mid=chain[i].map((v,k)=>(v+chain[i+1][k])/2);d+=` Q${chain[i].map(frontNumber)} ${mid.map(frontNumber)}`;}d+=' L'+chain.at(-1).map(frontNumber).join(',');paths.push(d);
 }return paths.join(' ');
}
export function frontWaveAt(model,progress){
 if(progress<=0)return {fill:'',front:''};if(progress>=1)return {fill:model.path,front:''};
 const threshold=progress*model.maximum,filled=[],segments=[];
 const triangle=indices=>{
  const verts=indices.map(i=>({p:model.nodes[i],v:model.distance[i]})),output=[],cuts=[];
  for(let i=0;i<3;i++){const a=verts[i],b=verts[(i+1)%3],ain=a.v<=threshold,bin=b.v<=threshold;if(ain)output.push(a.p);if(ain!==bin){const t=(threshold-a.v)/(b.v-a.v),p=a.p.map((v,k)=>v+(b.p[k]-v)*t);output.push(p);cuts.push(p);}}
  if(output.length>=3)filled.push('M'+output.map(p=>p.map(frontNumber).join(',')).join(' L')+'Z');if(cuts.length===2)segments.push(cuts);
 };
 for(let y=0;y<model.rows-1;y++)for(let x=0;x<model.cols-1;x++){const a=y*model.cols+x,b=a+1,c=a+model.cols,d=c+1;triangle([a,b,d]);triangle([a,d,c]);}
 return {fill:filled.join(''),front:smoothFront(segments)};
}
export function frontSequenceProgress(progress,index,count){return Math.max(0,Math.min(1,progress*Math.max(1,count)-index));}
