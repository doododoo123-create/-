import { recoveryTerritoryCandidates } from './recovery-priority.js';
// Rank only legal land-front targets. Shape preferences never bypass defenders or paths.
export function frontierScores(state,atlas,actor,candidates,{paths=new Map(),recent=[],supply=null}={}){
 const enemySize=id=>supply?supply(state,state.cells[id].owner,id).length:state.cells.filter(c=>c.owner===state.cells[id].owner).length;
 const distances=candidates.map(id=>paths.get(id)?.length??0),nearest=Math.min(...distances);
 return candidates.map((id,i)=>{
  const cell=state.cells[id],near=atlas.cells[id].neighbors,own=near.filter(v=>state.cells[v].owner===actor).length;
  const defenders=state.countries[cell.owner].generals.filter(g=>g.active&&g.alive&&g.position===id);
  const total=state.cells.filter(c=>c.owner===cell.owner).length,part=enemySize(id),pocket=part<total&&part<=3;
  let cutPenalty=0;
  if(supply&&part>3){
   const future={...state,cells:state.cells.map(c=>c.id===id?{...c,owner:actor}:c)},seen=new Set();
   for(const next of near)if(future.cells[next].owner===cell.owner&&!seen.has(next)){
    const component=supply(future,cell.owner,next);component.forEach(v=>seen.add(v));
    if(component.length<=3&&component.length<part-1)cutPenalty+=(4-component.length)*5;
   }
  }
  // A nearby concavity beats a one-edge spearhead. Long detours and strong garrisons cost points.
  const distance=distances[i],close=distance<=nearest+2;
  const score=own*12+(close&&pocket?30:0)+(close&&recent.some(v=>near.includes(v))?5:0)
   -Math.max(0,distance-nearest)*5-(own===1?8:0)-cutPenalty-defenders.reduce((n,g)=>n+g.troops,0)*.1;
  return {id,score,distance,pocket,own,cutPenalty};
 }).sort((a,b)=>b.score-a.score||a.distance-b.distance||a.id-b.id);
}
export function chooseFrontier(state,atlas,actor,candidates,options,randomInt){
 const available=options?.recoveryPriority?recoveryTerritoryCandidates(state,atlas,actor,candidates):candidates;
 const ranked=frontierScores(state,atlas,actor,available,options),best=ranked[0];
 if(!best)return null;const ties=ranked.filter(v=>Math.abs(v.score-best.score)<1e-9&&v.distance===best.distance);
 return ties[randomInt(state,ties.length)].id;
}
