import {fieldPaths} from './field-command.js';
import {fieldOfficers} from './war-readiness.js';

export function stationedOfficers(state,nation){return fieldOfficers(state.countries[nation]).filter(g=>g.active&&g.alive&&Number.isInteger(g.position));}
export function placementCounts(state,nation,excluded=[]){
 const omit=new Set(excluded),counts=new Map();
 for(const g of stationedOfficers(state,nation))if(!omit.has(g))counts.set(g.position,(counts.get(g.position)||0)+1);
 return counts;
}
// Two is a soft capacity only when no other legally reachable friendly space exists.
export function openPosition(state,atlas,nation,g,preferred=g.position,counts=placementCounts(state,nation,[g])){
 const paths=fieldPaths(state,atlas,nation,g.position),distance=fieldPaths(state,atlas,nation,preferred);
 const candidates=[...paths.keys()].sort((a,b)=>Number((counts.get(a)||0)>=2)-Number((counts.get(b)||0)>=2)||(distance.get(a)?.length??Infinity)-(distance.get(b)?.length??Infinity)||(counts.get(a)||0)-(counts.get(b)||0)||paths.get(a).length-paths.get(b).length||a-b);
 return candidates.length?paths.get(candidates[0]):null;
}
export function spreadCommanders(state,atlas,emit,{travel=null,nations=state.countries.map(c=>c.id),battleIndex,protectedOfficers=[]}={}){
 const all=[];
 for(const nation of nations){
  const officers=stationedOfficers(state,nation),counts=placementCounts(state,nation);
  // A king keeps the capital; move excess generals rather than displacing the king.
  for(const g of officers.sort((a,b)=>Number(b.role==='king')-Number(a.role==='king')||a.slot-b.slot)){
   if(g.role==='king'||protectedOfficers.includes(g)||(counts.get(g.position)||0)<=2)continue;
   counts.set(g.position,counts.get(g.position)-1);const path=openPosition(state,atlas,nation,g,g.position,counts);
   if(path?.length>1){const from=g.position;g.position=path.at(-1);g.stranded=false;all.push({nation,slot:g.slot,generation:g.generation,kind:'spacing',from,to:g.position,path});if(travel){const key=`${nation}:${g.slot}:${g.generation}`;travel.set(key,(travel.get(key)||0)+path.length-1);}}
   counts.set(g.position,(counts.get(g.position)||0)+1);
  }
 }
 if(all.length)emit('unit_spacing','인근 아군 영토로 분산','영토당 지휘관2명을 우선해 이동 가능한 아군 영토에 나누어 배치해.',{moves:all,battleIndex},true);
 return all;
}
export function formationPositions(state,atlas,nation,members,centre){
 const counts=placementCounts(state,nation,members),around=fieldPaths(state,atlas,nation,centre),plans=[];
 for(const g of members){
  const paths=fieldPaths(state,atlas,nation,g.position),candidates=[...paths.keys()].filter(id=>around.has(id));
  candidates.sort((a,b)=>Number((counts.get(a)||0)>=2)-Number((counts.get(b)||0)>=2)||around.get(a).length-around.get(b).length||paths.get(a).length-paths.get(b).length||(counts.get(a)||0)-(counts.get(b)||0)||a-b);
  const to=candidates[0]??g.position;counts.set(to,(counts.get(to)||0)+1);plans.push({g,path:paths.get(to)||[g.position]});
 }
 return plans;
}
export function centralRally(state,atlas,nation,members){
 const paths=members.map(g=>fieldPaths(state,atlas,nation,g.position)),points=members.map(g=>atlas.cells[g.position].center),mean=points.reduce((a,p)=>[a[0]+p[0]/points.length,a[1]+p[1]/points.length],[0,0]);
 const candidates=[...paths[0].keys()].filter(id=>paths.every(p=>p.has(id)));
 const score=id=>{const distances=paths.map(p=>p.get(id).length-1),point=atlas.cells[id].center;return [distances.reduce((a,b)=>a+b,0),Math.max(...distances),Math.hypot(point[0]-mean[0],point[1]-mean[1]),id];};
 candidates.sort((a,b)=>{const x=score(a),y=score(b);for(let i=0;i<x.length;i++)if(x[i]!==y[i])return x[i]-y[i];return 0;});return candidates[0];
}
