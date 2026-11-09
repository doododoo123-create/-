import {batchRetreats} from './batched-movement.js';
// Reuse committed movement/ownership frames, without replaying dice or deaths.
export function massBattleRecap(group,plan){
 const visible=w=>({...w,people:plan.after.people}),out=[];
 for(const s of group.originalScenes){
  const moves=s.kind==='movement'?s.moves?.filter(m=>['retreat','occupation','royal-return','isolated-return','evacuation'].includes(m.kind)||m.kind==='redeploy'&&['retreat','isolated_return'].includes(s.event?.type)):null;
  if(moves?.length||s.kind==='capture')out.push({...s,id:'recap-'+s.id,massRecap:true,dissolveArmies:true,rapidMovement:false,moves:moves||s.moves,worldBefore:visible(s.worldBefore),worldAfter:visible(s.worldAfter),title:moves?.some(m=>m.kind==='retreat')?'전장 후퇴':'점령지 진입'});
 }
 if(plan.changes.length&&!out.some(s=>s.kind==='capture')){
  const first=group.originalScenes[0],last=group.originalScenes.at(-1);out.push({...last,id:group.id+'-recap-land',kind:'capture',massRecap:true,dissolveArmies:true,battleIndex:group.battles.at(-1).index,worldBefore:visible(plan.before),worldAfter:plan.after,event:{...last.event,type:'occupation'},camps:last.camps});
 }
 const lastByPerson=new Map();for(const s of out)for(const m of s.moves||[])lastByPerson.set(m.personId,{s,m});
 const retreats=[...lastByPerson.values()].filter(({s,m})=>plan.after.people.some(p=>p.id===m.personId&&p.alive!==false)&&(['retreat','redeploy','isolated-return','evacuation'].includes(m.kind)));
 const remaining=out.flatMap(s=>{if(s.kind!=='movement')return [s];const moves=s.moves.filter(m=>!['retreat','redeploy','isolated-return','evacuation'].includes(m.kind));return moves.length?[{...s,moves}]:[];});
 if(retreats.length){const source=retreats[0].s,campsBefore={...(group.originalScenes[0].campsBefore||group.originalScenes[0].camps)},camps={...campsBefore};for(const {m} of retreats){campsBefore[m.personId]={territoryId:m.fromId};camps[m.personId]={territoryId:m.toId};}
 remaining.unshift({...source,id:group.id+'-retreat',batchMovement:true,batchRetreat:true,battleIndex:undefined,event:{type:'retreat',index:source.event.index},moves:retreats.map(({m})=>({...m,kind:'retreat'})),campsBefore,camps});}
 return remaining;
}
