import {BALANCE_V27_SWITCHES} from '../model/balance-v27.js';
import { MAP_SCALE_DEFAULTS } from '../model/map-scale.js';
import { planCommandMovements, validCamps, fieldCamps } from './command-movement.js';
import { clone,validateWorld,landCount,countryPeople,neighbors } from '../model/world.js';
import { V11_ATLAS,V11_NATIONS } from '../data/v11-preset.js';
import { seaSupplyPorts } from '../model/sea-supply.js';
import { createV11Engine } from './v11-core.js';
export const ENGINE_VERSION='studio-v11-33';
const engineCache=new WeakMap();
export const livingCountries=world=>world.countries.filter(c=>landCount(world,c.id)>0);
export function numericSeed(seed){const text=String(seed??123456).trim();if(!/^\d+$/.test(text)||Number(text)>4294967295)throw new Error('원본과 같은 난수를 사용하려면 시드를 0~4294967295 정수로 입력해 주세요.');return Number(text)>>>0;}
export function engineFor(definition){
  if(engineCache.has(definition))return engineCache.get(definition);
  const ids=definition.countries.map(c=>c.id),territoryIndex=new Map(definition.territories.map((t,i)=>[t.id,i]));
  const free=definition.mapKind==='free';
  const atlas=definition.mapKind==='v11'?clone(V11_ATLAS):{id:free?`studio-free-${definition.id}`:`studio-grid-${definition.rows}-${definition.cols}`,width:1200,height:800,cells:definition.territories.map((t,i)=>({id:i,row:free?Math.round(definition.cartography.polygons[t.id].center[1]*1000):t.row,col:free?Math.round(definition.cartography.polygons[t.id].center[0]*1000):t.col,center:free?definition.cartography.polygons[t.id].center:[80+(t.col+.5)*1040/definition.cols,80+(t.row+.5)*640/definition.rows],neighbors:neighbors(definition,t).map(n=>territoryIndex.get(n.id))})),capitals:[],edges:[]};
  atlas.cells=atlas.cells.map((t,i)=>({...t,owner:ids.indexOf(definition.territories[i].ownerId),name:definition.territories[i].name,...(definition.cartography?.links!==null&&definition.cartography?.links!==undefined?{neighbors:neighbors(definition,definition.territories[i]).map(n=>territoryIndex.get(n.id))}:{})}));
  atlas.capitals=definition.countries.map(c=>territoryIndex.get(c.capitalId)??definition.territories.findIndex(t=>t.ownerId===c.id)).map(i=>i<0?0:i);
  const nations=definition.countries.map((c,id)=>{
    const match=definition.mapKind==='v11'?/^nation-([0-6])$/.exec(c.id):null,base=match?clone(V11_NATIONS[Number(match[1])]):{};
    const people=countryPeople(definition,c.id),king=people.find(p=>p.role==='king'),minister=people.find(p=>p.role==='minister');
    return {...base,id,name:c.name,short:c.name.replace(/국$/,'')||c.name,color:c.color,...(definition.rules.royalDefense?{kingAbility:king?.ability||0}:{}),kingName:king?.name||`${c.name} 국왕`,ministerName:minister?.name||`${c.name} 승상`,king:{balanced:'balanced',peaceful:'domestic',aggressive:'warlike'}[king?.personality||c.personality],minister:minister?.ministerStyle||'balanced',ministerAbility:minister?.ability||0,commandBonus:c.commandBonus,feature:c.feature,kingFeature:king?.feature||'',ministerFeature:minister?.feature||''};
  });
  const rosters=definition.countries.map(c=>{
    const generals=countryPeople(definition,c.id).filter(p=>p.role==='general');const last=Math.max(4,...generals.map(g=>g.slot));
    return Array.from({length:last+1},(_,slot)=>{const g=generals.find(p=>p.slot===slot);return g?[g.name,g.ability,g.commandBonus,g.feature]:[`${c.name.slice(0,1)}${slot+1}군`,0,0,'새 지역 지휘관'];});
  });
  const deployment=(definition.deployment?.generals||[]).map(e=>{const p=definition.people.find(p=>p.id===e.personId);return {nation:ids.indexOf(p.countryId),slot:p.slot,station:territoryIndex.get(e.stationId),position:territoryIndex.get(e.positionId),territories:e.territoryIds.map(id=>territoryIndex.get(id))};});
  const engine=createV11Engine(atlas,{deployment,freeform:free,rows:free?800001:definition.rows,cols:free?1200001:definition.cols,nations,rosters,initials:definition.countries.map(c=>({troops:c.troops,recruitment:c.recruitment})),maxGenerals:Math.max(20,Math.ceil(definition.territories.length/4)),rules:definition.rules,terrains:definition.territories.map(t=>t.terrain||'plain'),seaPorts:definition.rules.seaSupply?seaSupplyPorts(definition):[]});
  const result={engine,ids,territoryIds:definition.territories.map(t=>t.id)};engineCache.set(definition,result);return result;
}
function projectRoyal(person,c,id,territoryIds,engine){const g=c.royal;return {...person,...g,id:g.generation?`monarch-${id}-${g.generation}`:person.id,countryId:id,stationId:territoryIds[g.station]||null,positionId:territoryIds[g.position]||null,capacity:engine.capacity(c,g)};}
export function projectWorld(definition,state,providedEngine=null){
  const {engine,ids,territoryIds}=providedEngine||engineFor(definition);
  const countries=definition.countries.map((base,i)=>{const c=state.countries[i];return {...base,troops:c.army,reserve:c.reserve,recruitment:c.extraRecruitment,supplyBonus:c.supplyBonus,ownTurns:c.ownTurns,capitalId:territoryIds[engine.capitalCell(state,i)]||null,...(definition.rules.advancedCampaign&&definition.rules.fieldCommand&&definition.rules.battleMode==='additive30'?{armyLimit:engine.lands(state,i)*definition.rules.territoryArmyLimit,reinforcementRoom:Math.max(0,engine.lands(state,i)*definition.rules.territoryArmyLimit-c.army)}:{}),...(c.reorganization!==undefined?{reorganization:c.reorganization}:{}),...(c.strategy?{strategy:{...clone(c.strategy),primaryId:ids[c.strategy.primary]||null,temporaryId:ids[c.strategy.temporary]||null}}:{}),...(definition.rules.territoryRecruitment||definition.rules.capitalDisruption||definition.rules.royalDefense?{production:engine.productionPlan(state,i),royalTroops:c.royal?.troops,royalAlive:c.royal?.alive,capitalShock:c.capitalShock||0,unassignedTroops:c.reserve+(c.reorganization||0)}:{}),commanders:c.generals.filter(g=>g.active&&g.alive).length,...(c.initialUnassigned?{initialUnassigned:c.initialUnassigned}:{})};});
  const people=[];
  for(let i=0;i<countries.length;i++){
    const configured=countryPeople(definition,ids[i]);people.push(...configured.filter(p=>p.role!=='general').map(p=>p.role==='king'&&state.countries[i].royal?projectRoyal(p,state.countries[i],ids[i],territoryIds,engine):p));
    if(state.countries[i].royal&&!configured.some(p=>p.role==='king'))people.push(projectRoyal({id:`monarch-${ids[i]}-0`,role:'king',personality:definition.countries[i].personality},state.countries[i],ids[i],territoryIds,engine));
    for(const g of state.countries[i].generals){const original=configured.find(p=>p.role==='general'&&p.slot===g.slot);if(!original&&!g.active&&!g.generation)continue;const station=engine.stationCell(state,i,g.slot),displaced=g.active&&g.alive&&Number.isInteger(g.position)&&state.cells[g.position]?.owner!==i,stranded=!!g.stranded||(definition.rules.retreatMode==='blocked'&&g.stranded!==undefined&&displaced);people.push({...(original||{}),id:g.generation||!original?`officer-${ids[i]}-${g.slot}-${g.generation}`:original.id,countryId:ids[i],name:g.name,role:'general',personality:original?.personality||'balanced',feature:g.feature,ability:g.ability,commandBonus:g.commandBonus,slot:g.slot,...(g.confusion!==undefined?{confusion:g.confusion,...(g.restedThisSeason!==undefined?{restedThisSeason:g.restedThisSeason}:{}),readiness:g.readiness?clone(g.readiness):null}:{}),troops:g.troops,capacity:engine.capacity(state.countries[i],g),active:g.active,alive:g.alive,waited:g.waited,generation:g.generation,...(g.wins!==undefined?{wins:g.wins}:{}),...(g.underdogWins!==undefined?{underdogWins:g.underdogWins}:{}),...(g.stranded!==undefined?{stranded,displaced}:{}),stationId:territoryIds[station]||null,...(definition.rules.battleMode==='additive30'&&definition.rules.fieldCommand?{positionId:territoryIds[g.position]||null}:{}),connected:g.active&&!stranded&&station!==null?engine.capitalConnected(state,i,g.slot):false,territoryIds:state.cells.filter(t=>t.owner===i&&t.commander===g.slot).map(t=>territoryIds[t.id])});}
  }
  const territories=definition.territories.map((t,i)=>{const cell=state.cells[i],commander=people.find(p=>p.countryId===ids[cell.owner]&&p.role==='general'&&p.slot===cell.commander);return {...t,ownerId:ids[cell.owner],commanderSlot:cell.commander,commanderId:commander?.id||null};});
  return {...definition,rules:{...definition.rules,roundLimit:state.roundLimit},countries,people,territories};
}
function resultFor(state,ids){return state.result?{reason:state.result.reason==='conquest'?'unification':'limit',winnerIds:state.result.winners.map(i=>ids[i]),round:state.result.round,turn:state.result.turns}:null;}
function normalizeRecord(raw,before,after,definition,state,context){
  const {ids,territoryIds}=context,actor=definition.countries[raw.actor],rolls=[];
  const events=raw.events.map((source,index)=>{const {view,...e}=source;const event={...e,index,nationId:ids[e.nation??raw.actor],targetId:ids[e.target]||null};if(Number.isInteger(e.roll)&&Number.isInteger(e.faces)){event.rollIndex=rolls.length;rolls.push({label:e.title,value:e.roll,sides:e.faces,type:e.type,slot:e.slot,attempts:e.attempts||[e.roll],eventIndex:index});}return event;});
  const battles=raw.battles.map(b=>({...b,actorId:ids[b.actor],defenderId:ids[b.target],territoryId:territoryIds[b.cellId],territoryName:definition.territories[b.cellId].name,fromId:territoryIds[b.from],takenTerritoryIds:b.takenCells.map(i=>territoryIds[i]),attackerPersonId:before.people.find(p=>p.countryId===ids[b.actor]&&p.role==='general'&&p.slot===b.slot)?.id,defenderPersonId:b.defenseRole==='king'&&b.defense.generation?`monarch-${ids[b.target]}-${b.defense.generation}`:before.people.find(p=>p.countryId===ids[b.target]&&p.role===(b.defenseRole||'general')&&p.slot===b.defenseSlot)?.id}));
  const changes=battles.flatMap(b=>b.takenCells.map(i=>({territoryId:territoryIds[i],name:definition.territories[i].name,from:ids[b.captureOwner===b.target?b.actor:b.target],to:ids[b.captureOwner??b.actor]})));
  const production=raw.events.filter(e=>e.type==='round_end').flatMap(e=>e.gains.map(g=>({...g,countryId:ids[g.id],name:definition.countries[g.id].name})));
  const eliminatedIds=raw.events.filter(e=>e.type==='elimination').map(e=>ids[e.target]);
  const record={turn:raw.number,round:raw.round,actorId:actor.id,actorName:actor.name,color:actor.color,type:raw.kind,title:`${actor.name} · ${raw.summary}`,detail:raw.summary,action:raw.action,success:raw.kind==='domestic'?raw.success:changes.some(c=>c.to===actor.id),rolls,events,battles,changes,production,eliminatedIds,result:resultFor(state,ids),beforeStats:raw.before,afterStats:raw.after,domesticScore:raw.domesticScore||null,defenderId:ids[raw.target]||null};
  let visible=before;const frames=raw.events.map(e=>{const next=e.view?projectWorld(definition,{...state,...e.view},context):visible;const frame={before:visible,after:next};visible=next;return frame;});
  Object.defineProperty(record,'frames',{value:frames,enumerable:false});Object.defineProperty(record,'finalWorld',{value:after,enumerable:false});
  return record;
}
export function createRun(input,seed=123456){
  const definition=validateWorld(input);
  if(livingCountries(definition).length<2)throw new Error('영토를 가진 국가가 2개 이상 필요합니다.');
  const unowned=definition.territories.filter(t=>t.ownerId===null).length;if(unowned)throw new Error(`원본 v11에는 무주지 점령 규칙이 없습니다. 미배정 영토 ${unowned}개의 소유 국가를 지정해 주세요.`);
  const context=engineFor(definition),number=numericSeed(seed),state=context.engine.createGame({seed:number,roundLimit:definition.rules.roundLimit});
  if(!context.engine.validState(state))throw new Error('초기 장군 배치와 영토 설정을 확인해 주세요.');
  return {engineVersion:ENGINE_VERSION,seed:String(number),rng:state.rng,initialWorld:definition,world:projectWorld(definition,state,context),engineState:state,round:state.round,turn:state.turns,schedule:state.schedule.map(i=>context.ids[i]),scheduleIndex:state.scheduleIndex,history:[],result:null,referenceRecord:null};
}
export function currentActor(run){return run.result?null:run.world.countries.find(c=>c.id===run.schedule[run.scheduleIndex])||null;}
export function nextTurn(input,controls){
  if(input.result)return input;
  if(['armyAssembly','armyFormation','unitSpacing','frontOperations','directArmyRelease'].some(key=>controls?.[key]!==undefined&&typeof controls[key]!=='boolean'))throw Error('집단군 집결 설정이 올바르지 않습니다.');
  const context=engineFor(input.initialWorld),ctl=controls?{...controls}:undefined;
  if(ctl?.targetId!==undefined&&typeof ctl.targetId==='string')ctl.targetId=context.ids.indexOf(ctl.targetId);
  if(ctl?.targetCells)ctl.targetCells=Object.fromEntries(Object.entries(ctl.targetCells).map(([slot,id])=>[slot,typeof id==='string'?context.territoryIds.indexOf(id):id]));
  const prepared=context.engine.prepareTurn(input.engineState,ctl),state={...prepared.state,history:[]};
  const world=projectWorld(input.initialWorld,state,context),record=normalizeRecord(prepared.record,input.world,world,input.initialWorld,state,context);
  record.seasonStart=input.engineState.scheduleIndex===0;
  world.visualCamps=planCommandMovements(record,input.world,world,input.world.visualCamps);if(controls)record.controls=clone(controls);
  return {...input,rng:state.rng,world,engineState:state,round:state.round,turn:state.turns,schedule:state.schedule.map(i=>context.ids[i]),scheduleIndex:state.scheduleIndex,history:[...input.history.map(r=>r.frames?{...r}:r),record],result:resultFor(state,context.ids),referenceRecord:prepared.record};
}
// Removing a time limit is a recorded continuation boundary; earlier history keeps its original rules.
export function removeRunLimit(run){
 if(run.engineState.roundLimit===null||run.result?.reason==='unification')return run;
 const context=engineFor(run.initialWorld),state=clone(run.engineState);
 state.roundLimit=null;
 if(state.result?.reason==='limit'){state.result=null;state.round++;state.schedule=context.engine.aliveIds(state);state.scheduleIndex=0;}
 if(!context.engine.validState(state))throw Error('진행 제한을 해제할 수 없는 경기 상태입니다.');
 const world=projectWorld(run.initialWorld,state,context);if(run.world.visualCamps)world.visualCamps=clone(run.world.visualCamps);
 return {...run,world,engineState:state,round:state.round,schedule:state.schedule.map(i=>context.ids[i]),scheduleIndex:state.scheduleIndex,result:resultFor(state,context.ids),limitRemovedAt:run.turn,referenceRecord:null};
}
export function casualty(own,enemy,rate){const base=rate*100;if(!own||!enemy||!base)return 0;const n=own*base*enemy*2,d=(own+enemy)*100;return Math.min(own,Math.max(1,Math.floor((n*2+d)/(d*2))));}
export function borderTargets(world,id){return world.territories.filter(t=>t.ownerId!==id&&neighbors(world,t).some(n=>n.ownerId===id));}
export function definitionForVersion(initialWorld,engineVersion){
  if(![ENGINE_VERSION,'studio-v11-32','studio-v11-31','studio-v11-30','studio-v11-29','studio-v11-28','studio-v11-27','studio-v11-26','studio-v11-25','studio-v11-24','studio-v11-23','studio-v11-22','studio-v11-21','studio-v11-20','studio-v11-19','studio-v11-18','studio-v11-17','studio-v11-16','studio-v11-15','studio-v11-14','studio-v11-13','studio-v11-12','studio-v11-11'].includes(engineVersion))throw new Error('현재 v11 엔진과 다른 실행 저장입니다.');
  const source=clone(initialWorld),revision=Number(engineVersion.split('-').at(-1));
  if(revision<29&&source?.rules)for(const key of ['seasonRestConfusion','royalCapitalGuard'])source.rules[key]??=false;
  if(revision<28&&source?.rules)source.rules.resetConfusionOnRest??=false;
  if(revision<27&&source?.rules)for(const key of BALANCE_V27_SWITCHES)source.rules[key]??=false;
  if(revision<26&&source?.rules)for(const key of ['recoveryPriority','underdogExperience','frontierReserves'])source.rules[key]??=false;
  if(revision<25&&source?.rules)for(const key of ['continuousCampaign','routDeath','strategicTargets'])source.rules[key]??=false;
  if(revision<24&&source?.rules)source.rules.capitalFallAnnexation??=false;
  if(revision<23&&source?.rules)source.rules.nearbyRetreat??=false;
  if(revision<22&&source?.rules)source.rules.battlefieldRecovery??=false;
  if(revision<21&&source?.rules)source.rules.occupationAdvance??=false;
  if(revision<20&&source?.rules){source.rules.capitalReserveLimit??=null;source.rules.defenderCounterattack??=false;source.rules.counterCaptureThresholds??=[20,40];}
  if(revision<19&&source?.rules){
    source.rules.experienceWinStep??=1;source.rules.experienceCap??=9;
    if(revision<18)Object.assign(source.rules,MAP_SCALE_DEFAULTS);
    if(revision<17){source.rules.commandReform=false;source.rules.casualtyBasis='smaller';}
    if(revision<16)source.rules.retreatMode='blocked';
    if(revision<15)source.rules.advancedCampaign=false;
    if(revision<14){source.rules.fieldCommand=false;source.rules.troopRounding='soldier';}
    if(revision<13)source.rules.battleMode='v11';
    if(revision<12)source.rules.seaSupply=false;
  }
  return validateWorld(source);
}
export function restoreRun(data){
  const definition=definitionForVersion(data.initialWorld,data.engineVersion),context=engineFor(definition),state=clone(data.engineState);
  if(!context.engine.validState(state)||state.seed!==numericSeed(data.seed))throw new Error('저장된 경기의 병력·영토·난수 상태가 올바르지 않습니다.');
  if(!Array.isArray(data.history)||data.history.length!==state.turns)throw new Error('저장된 턴 기록이 경기와 일치하지 않습니다.');
  for(let i=0;i<data.history.length;i++){const r=data.history[i];if(r.turn!==i+1||!context.ids.includes(r.actorId)||!Array.isArray(r.rolls)||!Array.isArray(r.battles)||!Array.isArray(r.events)||!r.rolls.every(d=>Number.isInteger(d.value)&&Number.isInteger(d.sides)&&d.value>=1&&d.value<=d.sides))throw new Error('저장된 판정 기록이 올바르지 않습니다.');}
  if(data.limitRemovedAt!==undefined&&(!Number.isSafeInteger(data.limitRemovedAt)||data.limitRemovedAt<0||data.limitRemovedAt>state.turns||state.roundLimit!==null))throw Error('진행 제한 해제 기록이 올바르지 않습니다.');
  state.history=[];
  const restoredWorld=projectWorld(definition,state,context);restoredWorld.visualCamps=definition.rules.battleMode==='additive30'&&definition.rules.fieldCommand?fieldCamps(restoredWorld):validCamps(restoredWorld,data.history.at(-1)?.campsAfter);
  return {engineVersion:ENGINE_VERSION,seed:String(state.seed),rng:state.rng,initialWorld:definition,world:restoredWorld,engineState:state,round:state.round,turn:state.turns,schedule:state.schedule.map(i=>context.ids[i]),scheduleIndex:state.scheduleIndex,history:clone(data.history),...(data.limitRemovedAt!==undefined?{limitRemovedAt:data.limitRemovedAt}:{}),result:resultFor(state,context.ids),referenceRecord:null};
}
