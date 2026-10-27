import { mapAnchor } from '../model/cartography-geometry.js';
// Screen-only geometry. No path here is used for movement legality or fatigue.
export function armyArrowWidth(army=0){return 3.8*(army>=120?6:army>=80?5:army>=50?4.3:army>=30?3.8:army>=21?3.3:army>=15?2.5:army>=8?1.7:1);}
export function polylineAt(points,progress=1){
 const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1])),total=lengths.reduce((a,b)=>a+b,0);
 let left=Math.max(0,Math.min(1,progress))*total;const path=points.length?[[...points[0]]]:[];
 for(let i=0;i<lengths.length;i++){if(left>=lengths[i]){path.push([...points[i+1]]);left-=lengths[i];}else{const f=lengths[i]?left/lengths[i]:0;path.push(points[i].map((v,k)=>v+(points[i+1][k]-v)*f));break;}}
 return {point:path.at(-1)||[0,0],path,total};
}
export const operationPath=points=>points.length?'M'+points.map(p=>p.join(',')).join(' L'):'';
export function operationGeometry(world,geometry,operations){
 const edges=new Map(),edgeWidths=new Map();for(const route of operations){const ids=route.path||[route.fromId,route.toId];for(let i=1;i<ids.length;i++){const key=[ids[i-1],ids[i]].sort().join('|');edgeWidths.set(key,Math.max(edgeWidths.get(key)||0,armyArrowWidth(route.army)));}}
 return operations.map(route=>{
  const ids=route.path||[route.fromId,route.toId],points=[];
  const anchor=(id,i)=>{const p=mapAnchor(world,id,i===ids.length-1?'battle':i===0?'label':'station',geometry);return i===0?[p[0],p[1]-12]:p;};
  for(let i=1;i<ids.length;i++){
   const key=[ids[i-1],ids[i]].sort().join('|'),people=edges.get(key)||new Map(),person=route.personId||route.key;
   if(!people.has(person))people.set(person,people.size);edges.set(key,people);
   const lane=people.get(person),signed=lane?Math.ceil(lane/2)*(lane%2?1:-1):0;
   const a=anchor(ids[i-1],i-1),b=anchor(ids[i],i),dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1;
   const canonical=ids[i-1]<ids[i]?1:-1,offset=signed*Math.max(14,(edgeWidths.get(key)||0)*2.5)*canonical;
   if(!points.length)points.push(a);
   for(const t of [.3,.7])points.push([a[0]+dx*t-dy/length*offset,a[1]+dy*t+dx/length*offset]);
   points.push(b);
  }
  return {...route,points,width:armyArrowWidth(route.army)};
 });
}
