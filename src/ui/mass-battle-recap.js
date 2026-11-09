import {mapAnchor} from '../model/cartography-geometry.js';
// A separate map ledger carries every displayed position and owner forward.
// Combat facts are final, but future map moves/ownership are never substituted
// into an earlier scene. A retreat batch does not advance the event cursor.
export function massBattleRecap(group,plan,previousReveal=null){
 const sources=group.originalScenes,first=sources[0],out=[],lastMoves=new Map();
 for(const s of sources)if(s.kind==='movement')for(const m of s.moves||[])lastMoves.set(m.personId,{s,m});
 const retreats=[...lastMoves.values()].filter(({m})=>plan.after.people.some(p=>p.id===m.personId&&p.alive!==false)&&['retreat','redeploy','isolated-return','evacuation'].includes(m.kind)&&m.fromId!==m.toId);
 let camps={...(first.campsBefore||first.camps)},territories=plan.before.territories.map(t=>({...t})),countries=plan.before.countries;
 for(const p of plan.before.people)if(p.active&&p.alive&&!camps[p.id]&&(p.positionId||p.stationId))camps[p.id]={territoryId:p.positionId||p.stationId};
 const reveal={baseIndex:previousReveal?.baseIndex??first.event.index-1,battles:[...previousReveal?.battles||[]],captures:[...previousReveal?.captures||[]],moves:[...previousReveal?.moves||[]]},snapshot=()=>({...plan.before,countries,territories,people:plan.after.people.map(p=>({...p,positionId:camps[p.id]?.territoryId||plan.before.people.find(b=>b.id===p.id)?.positionId||p.positionId}))});
 const ledger=()=>({baseIndex:reveal.baseIndex,battles:[...reveal.battles],captures:[...reveal.captures],moves:[...reveal.moves]});
 const add=(source,moves=null,batch=false)=>{
  const before=snapshot(),campsBefore={...camps};
  for(const m of moves||[])camps={...camps,[m.personId]:{...camps[m.personId],territoryId:m.toId}};
  const battle=plan.engagements.find(b=>b.index===source.battleIndex),target=group.battles.find(b=>b.index===source.battleIndex);
  if(source.kind==='capture'&&target){
   const taken=new Set(target.takenTerritoryIds||[]);territories=territories.map(t=>taken.has(t.id)?{...source.worldAfter.territories.find(v=>v.id===t.id)}:t);countries=source.worldAfter.countries;
   if(!reveal.captures.includes(target.index))reveal.captures.push(target.index);
  }
  if(target&&!reveal.battles.includes(target.index))reveal.battles.push(target.index);
  const cameraTerritory=target?.territoryId||moves?.[0]?.fromId||plan.engagements[0]?.territoryId;
  const scene={...source,id:group.id+'-recap-'+out.length,kind:moves?'movement':'capture',massRecap:true,dissolveArmies:true,rapidMovement:false,worldBefore:before,worldAfter:snapshot(),campsBefore,camps:{...camps},visitorIds:Object.keys(camps),moves:moves||undefined,mapEventIndex:first.event.index-1,mapReveal:ledger(),cameraGroup:group.id+':map:'+cameraTerritory,cameraPoint:mapAnchor(plan.before,cameraTerritory,'battle'),title:batch?'부대 동시 후퇴':moves?'점령지 진입':'점령 전선 전진'};
  if(source.kind==='capture')scene.captureSteps=Math.max(1,target?.takenTerritoryIds?.length||1);
  if(batch)Object.assign(scene,{batchMovement:true,batchRetreat:true,battleIndex:undefined,event:{type:'retreat',index:source.event.index}});
  out.push(scene);
  for(const m of moves||[])reveal.moves.push(`${m.sourceEventIndex??source.event.index}:${m.personId}`);
  scene.mapAfterReveal=ledger();
 };
 if(retreats.length){for(const {m} of retreats)camps[m.personId]={...camps[m.personId],territoryId:m.fromId};add(retreats[0].s,retreats.map(({s,m})=>({...m,sourceEventIndex:s.event.index,kind:'retreat'})),true);}
 for(const s of sources){
  if(s.kind==='capture'){add(s);continue;}
  if(s.kind!=='movement')continue;
  const moves=(s.moves||[]).filter(m=>(['occupation','royal-return'].includes(m.kind)||s.automaticEntry)&&plan.after.people.some(p=>p.id===m.personId&&p.alive!==false)).map(m=>s.automaticEntry?{...m,kind:'occupation',sourceEventIndex:sources.find(c=>c.kind==='capture'&&c.battleIndex===s.battleIndex)?.event.index??s.event.index}:m);
  if(moves.length)add(s,moves);
 }
 return out;
}
