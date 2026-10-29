import {arrangeUnits} from './unit-layout.js';
import {mapAnchor} from '../model/cartography-geometry.js';

// These participants have already rolled in the army table. Group their map
// choreography only; recorded worlds, positions, distances and results stay intact.
export function cohortMapScenes(scenes,record){
 const cohorts=[],seen=new Set();
 for(const scene of scenes){
  const campaign=scene.campaign;if(!campaign?.modern||seen.has(campaign.id))continue;seen.add(campaign.id);
  const runs=[];for(const b of campaign.battles){const last=runs.at(-1),p=last?.at(-1);if(!b.automatic&&p&&!p.automatic&&p.actorId===b.actorId&&p.defenderId===b.defenderId&&p.territoryId===b.territoryId)last.push(b);else runs.push([b]);}
  for(const battles of runs){if(!['attackerPersonId','defenderPersonId'].some(key=>new Set(battles.filter(b=>!b.automatic).map(b=>b[key])).size>1))continue;
   const first=battles[0],ids=new Set(battles.map(b=>b.index)),indexes=scenes.flatMap((s,i)=>s.campaign===campaign&&s.campaignPhase==='map'&&ids.has(s.battleIndex)?[i]:[]);if(!indexes.length)continue;
   const people=new Map(),defenseMoves=[],attackMoves=[];
   for(const b of battles){const e=record.events.find(e=>e.type==='territory'&&e.battleIndex===b.index),world=record.frames?.[e?.index]?.before||scenes[indexes[0]].worldBefore;for(const id of [b.attackerPersonId,b.defenderPersonId]){const p=world.people.find(p=>p.id===id);if(p&&!people.has(id))people.set(id,p);}for(const m of record.movements?.find(m=>m.eventIndex===e?.index)?.moves||[])if(m.kind!=='outbound'&&!defenseMoves.some(v=>v.personId===m.personId))defenseMoves.push(m);}
   for(const i of indexes){const scene=scenes[i];if(scene.kind==='movement'&&scene.event?.type==='territory')for(const m of scene.moves||[])if(m.kind==='outbound'&&!attackMoves.some(v=>v.personId===m.personId))attackMoves.push(m);}
   const start=indexes[0],last=indexes.at(-1),attackAt=indexes.find(i=>scenes[i].kind==='movement'&&scenes[i].movementSide==='attack'||scenes[i].kind==='route'&&scenes[i].formationSide==='attack'),defenseAt=indexes.find(i=>scenes[i].kind==='movement'&&scenes[i].movementSide==='defense'||scenes[i].kind==='route'&&scenes[i].formationSide==='defense'),flush=indexes.find(i=>scenes[i].event?.type==='occupation')??last+1;
   const resultAt=indexes.findLast(i=>scenes[i].kind==='apply'&&scenes[i].event?.type==='resolve');
   cohorts.push({id:'cohort-'+campaign.id+'-'+first.index,first,ids,battles,people:[...people.values()],defenseMoves,attackMoves,start,last,attackAt,defenseAt,flush,resultAt});
  }
 }
 const flushDeferred=c=>{
  if(!c.deferred?.length)return [];
  const source=scenes[Math.min(c.flush,scenes.length-1)],last=scenes[c.last],world=c.flush<scenes.length?source.worldBefore:last.worldAfter,moves=c.deferred.flatMap(s=>s.moves),baseCamps=c.flush<scenes.length?(source.campsBefore||source.camps):last.camps,campsBefore={...baseCamps},camps={...baseCamps};
  for(const m of moves){campsBefore[m.personId]={territoryId:m.fromId,homeId:world.people.find(p=>p.id===m.personId)?.stationId};camps[m.personId]={territoryId:m.toId,homeId:world.people.find(p=>p.id===m.personId)?.stationId};}
  const cursor=c.flush<scenes.length&&source.event?(source.mapEventIndex??source.event.index)-1:(last.mapEventIndex??last.event?.index??record.events.at(-1)?.index??-1);
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
  for(const side of ['attack','defense'])if(i===c[side+'At']&&c[side+'Moves'].length){
   const moves=c[side+'Moves'],camps={...(s.campsBefore||s.camps)};for(const m of moves)camps[m.personId]={territoryId:m.toId,homeId:c.people.find(p=>p.id===m.personId)?.stationId};
   out.push({...s,id:c.id+'-'+side+'-arrival',kind:'movement',movementSide:side,readySides:side==='attack'?[]:['attack'],revealedRoutes:side==='attack'?['attack']:['attack','defense'],campsBefore:s.campsBefore||s.camps,camps,moves,parallelAttack:side==='attack',parallelDefense:side==='defense',...(side==='defense'?{engagement:c}:{}),title:side==='attack'?'공격대 전장 접근':'수비대 전장 합류'});
  }
  if(s.event?.type==='territory'&&(s.kind==='movement'||!first&&s.kind==='route'))continue;
  const engagement=i>=(c.attackAt??c.start)&&i<c.flush?c:undefined;
  out.push({...s,...(engagement?{engagement,cohortComplete:i>=c.resultAt}:{} )});
 }
 for(const pending of cohorts.filter(c=>c.flush===scenes.length))out.push(...flushDeferred(pending));
 return out;
}

// This battlefield's last resolved duel decides whether the assault broke
// through. Do not substitute the army table's overall win count or margin.
export function cohortWinner(scene,presentation){
 const c=scene?.engagement;if(!c||!scene.cohortComplete||presentation?.phase==='settled')return null;
 if(scene.event?.type==='resolve'&&scene.kind==='apply'&&(!presentation?.effectStage||presentation.effectStage==='outcome'))return null;
 const last=c.battles.at(-1);if(last.winner===null)return null;
 return last.winner===last.actor?last.actorId:last.defenderId;
}

export function cohortMarkers(world,geometry,markers,scene){
 const c=scene?.engagement;if(!c)return markers;
 const territory=world.territories.find(t=>t.id===c.first.territoryId),point=territory&&mapAnchor(world,territory.id,'label',geometry);if(!point)return markers;
 const ready=scene.readySides||['attack','defense'],visible=c.people.filter(p=>ready.includes(p.countryId===c.first.actorId?'attack':'defense')),ids=new Set(visible.map(p=>p.id)),out=markers.filter(m=>!ids.has(m.person?.id));
 for(const initial of visible){
  const original=markers.find(m=>m.person?.id===initial.id),person=world.people.find(p=>p.id===initial.id)||initial;if(person.alive===false&&!original?.ghost)continue;
  const side=initial.countryId===c.first.actorId?'attack':'defense',key=side==='attack'?'attackerPersonId':'defenderPersonId',current=c.battles.find(b=>b.index===scene.battleIndex),previous=current?.[key]!==initial.id?c.battles.filter(b=>b.index<scene.battleIndex&&b[key]===initial.id).at(-1):null;
  const result=previous?{loss:previous.losses?.[side]?.amount||0,result:previous.winner===null?'draw':previous.winner===(side==='attack'?previous.actor:previous.target)?'victory':'defeat'}:null;
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
