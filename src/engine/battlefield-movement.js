import { fieldPaths } from './field-command.js';

// A lost starting province may be exited into friendly land, never traversed as a road.
export function recoveryPaths(state,atlas,nation,start){
 const paths=fieldPaths(state,atlas,nation,start);
 if(!paths.size&&Number.isInteger(start))for(const next of atlas.cells[start].neighbors)if(state.cells[next].owner===nation){
  for(const [end,path] of fieldPaths(state,atlas,nation,next))if(!paths.has(end)||paths.get(end).length>path.length+1)paths.set(end,[start,...path]);
 }
 return paths;
}
export function emptyCommanderDestination(state,nation,g,capital){
 const personal=state.cells.filter(c=>c.owner===nation&&c.commander===g.slot).map(c=>c.id).sort((a,b)=>a-b);
 return personal.length?{to:personal.includes(g.station)?g.station:personal[0],reason:'home'}:Number.isInteger(capital)?{to:capital,reason:'capital'}:null;
}
export function returnEmptyCommanders(state,atlas,capitalCell,emit,nations=state.countries.map(c=>c.id),battleIndex){
 for(const nation of nations)for(const g of state.countries[nation].generals){
  if(!g.active||!g.alive||g.troops!==0)continue;
  const destination=emptyCommanderDestination(state,nation,g,capitalCell(state,nation));if(!destination)continue;
  const {to,reason}=destination,from=g.position;if(from===to)continue;
  const path=recoveryPaths(state,atlas,nation,from).get(to),moves=Number.isInteger(from)?[{nation,slot:g.slot,generation:g.generation,kind:path?'recovery':'redeploy',from,to,path:path||[from,to]}]:[];
  g.position=to;g.stranded=false;
  emit('empty_return',g.name+' · '+(reason==='home'?'병력 0 · 주둔지 복귀':'병력 0 · 수도 복귀'),reason==='home'?'병력 없는 생존 지휘관은 본인 담당 주둔지로 복귀해.':'남은 본인 주둔지가 없어 수도로 복귀해.',{nation,slot:g.slot,role:'general',battleIndex,moves,destination:to,reason,relocation:!path},true);
 }
}
export function defeatedAttackPosition(state,atlas,nation,g,target,launch){
 const paths=recoveryPaths(state,atlas,nation,g.position);
 const candidates=atlas.cells[target].neighbors.filter(id=>state.cells[id].owner===nation&&paths.has(id));
 candidates.sort((a,b)=>Number(b===launch)-Number(a===launch)||paths.get(a).length-paths.get(b).length||a-b);
 return candidates.length?paths.get(candidates[0]):null;
}
