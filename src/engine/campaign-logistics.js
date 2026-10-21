import { fieldPaths } from './field-command.js';
export const movementFatigue=(edges,rules)=>(-Math.floor(Math.max(0,edges)/(rules.fatigueStep*(rules.distanceScale||1)))*rules.fatiguePenalty)||0;
export function reinforcementRoom(state,id,rules){
 const c=state.countries[id],total=c.reserve+c.generals.reduce((n,g)=>n+g.troops,0);
 return Math.max(0,state.cells.filter(t=>t.owner===id).length*rules.territoryArmyLimit-total);
}
export function campaignDefenders(state,atlas,id,targetId,home,radius){
 const generals=state.countries[id].generals,canFight=g=>g.active&&g.alive&&g.troops>0&&!g.stranded;
 const queue=generals.filter(g=>canFight(g)&&g.position===targetId).sort((a,b)=>a.slot-b.slot).map(g=>({general:g,path:[targetId],kind:'resident'}));
 const route=canFight(home)?fieldPaths(state,atlas,id,home.position).get(targetId):null;
 const blocked=canFight(home)&&!route;
 if(route&&!queue.some(v=>v.general===home))queue.push({general:home,path:route,kind:'return'});
 if(blocked){
  const relief=generals.filter(g=>canFight(g)&&g!==home&&!queue.some(v=>v.general===g)).flatMap(g=>{
   const paths=fieldPaths(state,atlas,id,g.position),toHome=paths.get(home.station),path=paths.get(targetId);
   return toHome&&toHome.length-1<=radius&&path?[{general:g,path,kind:'relief',homeDistance:toHome.length-1}]:[];
  }).sort((a,b)=>a.homeDistance-b.homeDistance||a.general.slot-b.general.slot)[0];
  if(relief)queue.push(relief);
 }
 return {queue,blocked};
}
export function retreatPath(state,atlas,id,g){
 const start=g.position;if(!Number.isInteger(start))return null;
 const owned=state.cells[start]?.owner===id;
 const paths=owned?fieldPaths(state,atlas,id,start):new Map();
 if(!owned)for(const next of atlas.cells[start].neighbors)if(state.cells[next].owner===id){
  for(const [end,path] of fieldPaths(state,atlas,id,next))if(!paths.has(end)||paths.get(end).length>path.length+1)paths.set(end,[start,...path]);
 }
 const personal=[...paths.keys()].filter(v=>state.cells[v].commander===g.slot);
 personal.sort((a,b)=>paths.get(a).length-paths.get(b).length||Number(b===g.station)-Number(a===g.station)||a-b);
 if(personal.length)return paths.get(personal[0]);
 const home=paths.get(g.station);if(home)return home;
 const nearby=[...paths.keys()].sort((a,b)=>paths.get(a).length-paths.get(b).length||a-b);
 return nearby.length?paths.get(nearby[0]):null;
}
