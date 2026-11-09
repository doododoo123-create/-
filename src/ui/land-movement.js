import {pointInShape} from '../model/cartography.js';
import {cellPoints,mapAnchor} from '../model/cartography-geometry.js';
import {frontSegments} from './front-segments.js';
import {atlasGeometry} from './atlas-cache.js';
const landMovementCache=new WeakMap();
const landDistance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function landInside(point,shape){
 if(pointInShape(point,shape))return true;
 return [shape.points,...shape.holes].some(r=>r.some((a,i)=>{const b=r[(i+1)%r.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy)<.002;}));
}
function withinLand(a,b,cell){
 const shape={points:cellPoints(cell),holes:cell.holes||[]},xs=shape.points.map(p=>p[0]),ys=shape.points.map(p=>p[1]),x0=Math.min(...xs),y0=Math.min(...ys),width=Math.max(...xs)-x0,height=Math.max(...ys)-y0;
 const clear=(p,q)=>{const n=Math.max(8,Math.ceil(landDistance(p,q)/Math.max(.5,Math.min(width,height)/36)));for(let i=0;i<=n;i++){const sample=[p[0]+(q[0]-p[0])*i/n,p[1]+(q[1]-p[1])*i/n];if(!(i===0||i===n?landInside(sample,shape):pointInShape(sample,shape)))return false;}return true;};
 if(clear(a,b))return [a,b];
 const cols=25,points=[];for(let y=0;y<cols;y++)for(let x=0;x<cols;x++){const p=[x0+width*(x+.5)/cols,y0+height*(y+.5)/cols];points.push(pointInShape(p,shape)?p:null);}
 const closest=p=>points.flatMap((q,i)=>q?[{i,d:landDistance(p,q)}]:[]).sort((x,y)=>x.d-y.d).slice(0,32).filter(v=>clear(p,points[v.i])).slice(0,8).map(v=>v.i),starts=closest(a),ends=new Set(closest(b)),queue=[...starts],previous=new Map(starts.map(i=>[i,-1]));let end;
 for(let cursor=0;cursor<queue.length;cursor++){const i=queue[cursor];if(ends.has(i)){end=i;break;}const x=i%cols,y=Math.floor(i/cols);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const nx=x+dx,ny=y+dy,j=ny*cols+nx;if(nx<0||ny<0||nx>=cols||ny>=cols||!points[j]||previous.has(j)||!clear(points[i],points[j]))continue;previous.set(j,i);queue.push(j);}}
 if(end===undefined)return null;
 const route=[b];for(let i=end;i!==-1;i=previous.get(i))route.push(points[i]);route.push(a);route.reverse();
 const simplified=[route[0]];for(let i=0;i<route.length-1;){let j=route.length-1;while(j>i+1&&!clear(route[i],route[j]))j--;simplified.push(route[j]);i=j;}return simplified;
}
// Precompute a continuous visual corridor through the recorded territory path.
// This never changes engine paths/distances. Disconnected relocation fades at
// its endpoints instead of drawing a fictitious march over water.
export function landMovementPath(world,ids,start,end,lane=.5){
 const geometry=atlasGeometry(world);let cache=landMovementCache.get(geometry);if(!cache){cache=new Map();landMovementCache.set(geometry,cache);}
 const key=ids.join('>')+':'+start.join(',')+':'+end.join(',')+':'+lane;if(cache.has(key))return cache.get(key);
 const cells=ids.map(id=>geometry.cells[world.territories.findIndex(t=>t.id===id)]);let from=start,route=[start],failed=!cells.every(Boolean);
 for(let i=0;!failed&&i<cells.length;i++){
  let to=end;if(i<cells.length-1){const shared=frontSegments(geometry,cells[i],cells[i+1]);if(!shared.length){failed=true;break;}const bridges=shared.map(([a,b])=>[a[0]+(b[0]-a[0])*lane,a[1]+(b[1]-a[1])*lane]),next=mapAnchor(world,ids[i+1],'station',geometry);to=bridges.sort((a,b)=>landDistance(from,a)+landDistance(a,next)-landDistance(from,b)-landDistance(b,next))[0];}
  const part=withinLand(from,to,cells[i]);if(!part){failed=true;break;}route.push(...part.slice(1));from=to;
 }
 const result=failed?null:route;cache.set(key,result);while(cache.size>256)cache.delete(cache.keys().next().value);return result;
}
