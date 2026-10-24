import { fieldPaths } from './field-command.js';
export const campaignOfficerKey=(nation,g)=>`${nation}:${g.slot}:${g.generation}`;
export function advanceDefenders(state,atlas,nation,target,home,radius,defeated){
 const can=g=>g&&g.active&&g.alive&&g.troops>0&&!g.stranded&&!defeated.has(campaignOfficerKey(nation,g));
 const queue=state.countries[nation].generals.filter(g=>can(g)&&g.position===target).sort((a,b)=>a.slot-b.slot).map(g=>({general:g,path:[target],kind:'resident'}));
 const path=can(home)?fieldPaths(state,atlas,nation,home.position).get(target):null;
 if(path&&!queue.some(v=>v.general===home))queue.push({general:home,path,kind:'return'});
 if(!path)for(const g of state.countries[nation].generals.filter(g=>can(g)&&!queue.some(v=>v.general===g)).sort((a,b)=>a.slot-b.slot)){
  const route=fieldPaths(state,atlas,nation,g.position).get(target);if(route&&route.length-1<=radius)queue.push({general:g,path:route,kind:'relief'});
 }
 return {queue,blocked:can(home)&&!path};
}
