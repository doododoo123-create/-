import { cellPoints } from '../model/cartography-geometry.js';
const frontPathCache=new WeakMap();
export function frontSegments(geometry,a,b){
 if(!a||!b)return [];
 if(!frontPathCache.has(geometry))frontPathCache.set(geometry,new Map());const cache=frontPathCache.get(geometry),key=[geometry.cells.indexOf(a),geometry.cells.indexOf(b)].sort((x,y)=>x-y).join(':');if(cache.has(key))return cache.get(key);
 const paths=[];
 for(const ringA of [cellPoints(a),...(a.holes||[])])for(let i=0;i<ringA.length;i++){
  const p=ringA[i],q=ringA[(i+1)%ringA.length],dx=q[0]-p[0],dy=q[1]-p[1],length=Math.hypot(dx,dy);if(!length)continue;
  for(const ringB of [cellPoints(b),...(b.holes||[])])for(let j=0;j<ringB.length;j++){
   const r=ringB[j],s=ringB[(j+1)%ringB.length];
   if(Math.abs(dx*(r[1]-p[1])-dy*(r[0]-p[0]))/length>.015||Math.abs(dx*(s[1]-p[1])-dy*(s[0]-p[0]))/length>.015)continue;
   const at=v=>((v[0]-p[0])*dx+(v[1]-p[1])*dy)/(length*length),lo=Math.max(0,Math.min(at(r),at(s))),hi=Math.min(1,Math.max(at(r),at(s)));
   if(hi-lo>.0001)paths.push([[p[0]+lo*dx,p[1]+lo*dy],[p[0]+hi*dx,p[1]+hi*dy]]);
  }
 }
 cache.set(key,paths);return paths;
}
