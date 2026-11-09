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
 return out;
}
