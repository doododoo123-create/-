import {arrangeUnits} from './unit-layout.js';
import {mapAnchor} from '../model/cartography-geometry.js';

// These participants have already rolled in the army table. Group their map
// choreography only; recorded worlds, positions, distances and results stay intact.
export function cohortMapScenes(scenes,record){
 const cohorts=[],seen=new Set();
 for(const scene of scenes){
  const campaign=scene.campaign;if(!campaign?.modern||seen.has(campaign.id))continue;seen.add(campaign.id);
  const runs=[];for(const b of campaign.battles){const last=runs.at(-1),p=last?.at(-1);if(!b.automatic&&p&&!p.automatic&&p.actorId===b.actorId&&p.attackerPersonId===b.attackerPersonId&&p.territoryId===b.territoryId&&p.assaultId===b.assaultId)last.push(b);else runs.push([b]);}
  for(const battles of runs){if(new Set(battles.filter(b=>!b.automatic).map(b=>b.defenderPersonId)).size<2)continue;
   const first=battles[0],ids=new Set(battles.map(b=>b.index)),indexes=scenes.flatMap((s,i)=>s.campaign===campaign&&s.campaignPhase==='map'&&ids.has(s.battleIndex)?[i]:[]);if(!indexes.length)continue;
   const people=new Map(),defenseMoves=[];
   for(const b of battles){const e=record.events.find(e=>e.type==='territory'&&e.battleIndex===b.index),world=record.frames?.[e?.index]?.before||scenes[indexes[0]].worldBefore;for(const id of [b.attackerPersonId,b.defenderPersonId]){const p=world.people.find(p=>p.id===id);if(p&&!people.has(id))people.set(id,p);}for(const m of record.movements?.find(m=>m.eventIndex===e?.index)?.moves||[])if(m.kind!=='outbound'&&!defenseMoves.some(v=>v.personId===m.personId))defenseMoves.push(m);}
   const start=indexes[0],last=indexes.at(-1),defenseAt=indexes.find(i=>scenes[i].kind==='movement'&&scenes[i].movementSide==='defense'||scenes[i].kind==='route'&&scenes[i].formationSide==='defense'),flush=indexes.find(i=>scenes[i].event?.type==='occupation')??last+1;
   cohorts.push({id:'cohort-'+campaign.id+'-'+first.index,first,ids,battles,people:[...people.values()],defenseMoves,start,last,defenseAt,flush});
  }
 }
 const flushDeferred=c=>{
  if(!c.deferred?.length)return [];
  const source=scenes[Math.min(c.flush,scenes.length-1)],last=scenes[c.last],world=c.flush<scenes.length?source.worldBefore:last.worldAfter,moves=c.deferred.flatMap(s=>s.moves),baseCamps=c.flush<scenes.length?(source.campsBefore||source.camps):last.camps,campsBefore={...baseCamps},camps={...baseCamps};
  for(const m of moves){campsBefore[m.personId]={territoryId:m.fromId,homeId:world.people.find(p=>p.id===m.personId)?.stationId};camps[m.personId]={territoryId:m.toId,homeId:world.people.find(p=>p.id===m.personId)?.stationId};}
  const cursor=c.flush<scenes.length?(source.mapEventIndex??source.event.index)-1:last.event.index;
  return [{...last,id:c.id+'-retreat',kind:'movement',title:'전투 종료 · 부대 후퇴',event:{type:'cohort_retreat',index:cursor},mapEventIndex:cursor,worldBefore:world,worldAfter:world,campsBefore,camps,moves,engagement:undefined,parallelRetreat:true}];
 };
 const out=[];for(let i=0;i<scenes.length;i++){
  const s=scenes[i],c=cohorts.find(c=>i>=c.start&&i<=c.last);
  for(const pending of cohorts.filter(c=>c.flush===i))out.push(...flushDeferred(pending));
  if(s.kind==='focus'&&s.event?.type==='army_release'&&!s.event.moves?.length)continue;
  if(!c){out.push(s);continue;}
  if(s.kind==='roll'){out.push({...s,engagement:c});continue;}
  const participants=new Set(c.people.map(p=>p.id));
  if(s.kind==='movement'&&s.event?.type!=='territory'&&s.event?.type!=='occupation'&&s.moves?.some(m=>participants.has(m.personId))){(c.deferred??=[]).push({...s,engagement:undefined});continue;}
  const first=s.battleIndex===c.first.index;
  if(s.event?.type==='territory'&&(!first&&(s.kind==='movement'||s.kind==='route')||s.kind==='movement'&&s.movementSide==='defense')){
   if(i!==c.defenseAt)continue;
  }
  if(i===c.defenseAt&&c.defenseMoves.length){
   const camps={...(s.campsBefore||s.camps)};for(const m of c.defenseMoves)camps[m.personId]={territoryId:m.toId,homeId:c.people.find(p=>p.id===m.personId)?.stationId};
   out.push({...s,id:c.id+'-defense-arrival',kind:'movement',movementSide:'defense',readySides:['attack'],revealedRoutes:['attack','defense'],campsBefore:s.campsBefore||s.camps,camps,moves:c.defenseMoves,parallelDefense:true,title:'수비대 전장 합류'});
  }
  if(i===c.defenseAt&&s.kind==='movement')continue;
  const engagement=i>=(c.defenseAt??c.start)&&i<c.flush?c:undefined;
  out.push({...s,...(engagement?{engagement}:{} )});
 }
 for(const pending of cohorts.filter(c=>c.flush===scenes.length))out.push(...flushDeferred(pending));
 return out;
}

export function cohortMarkers(world,geometry,markers,scene){
 const c=scene?.engagement;if(!c)return markers;
 const territory=world.territories.find(t=>t.id===c.first.territoryId),point=territory&&mapAnchor(world,territory.id,'label',geometry);if(!point)return markers;
 const ids=new Set(c.people.map(p=>p.id)),out=markers.filter(m=>!ids.has(m.person?.id));
 for(const initial of c.people){
  const original=markers.find(m=>m.person?.id===initial.id),person=world.people.find(p=>p.id===initial.id)||initial;if(person.alive===false&&!original?.ghost)continue;
  const side=initial.id===c.first.attackerPersonId?'attack':'defense',previous=side==='defense'&&c.battles.find(b=>b.index===scene.battleIndex)?.defenderPersonId!==initial.id?c.battles.filter(b=>b.index<scene.battleIndex&&b.defenderPersonId===initial.id).at(-1):null;
  const result=previous?{loss:previous.losses?.defense?.amount||0,result:previous.winner===null?'draw':previous.winner===previous.target?'victory':'defeat'}:null;
  out.push(...arrangeUnits([{...original,country:world.countries.find(n=>n.id===initial.countryId),person,territory,point,role:person.role,troops:person.troops,batchSide:side,batchResult:result,batchId:c.id}]));
 }
 return out;
}

// Normal home-return events already contain all actual paths. Run them on one
// clock instead of creating a separate wait for every commander.
export function parallelReturnScenes(scenes){
 const out=[];for(let i=0;i<scenes.length;i++){
  const first=scenes[i];if(first.kind!=='movement'||!['home_return','unit_spacing'].includes(first.event?.type)){out.push(first);continue;}
  const batch=[first];while(scenes[i+1]?.kind==='movement'&&scenes[i+1].event===first.event)batch.push(scenes[++i]);
  const last=batch.at(-1);out.push({...first,id:'parallel-'+first.id,parallelReturn:true,title:first.event.type==='home_return'?'전 부대 주둔지 복귀':'부대 분산 배치',worldAfter:last.worldAfter,camps:last.camps,moves:batch.flatMap(s=>s.moves)});
 }
 return out;
}
