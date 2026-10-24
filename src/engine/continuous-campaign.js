import { expeditionRoute,expeditionChance,fieldPaths } from './field-command.js';
import { advanceDefenders,campaignOfficerKey } from './advance-defenders.js';
import { movementFatigue } from './campaign-logistics.js';
import { chooseFrontier } from './frontier.js';
import { combatBonuses,combatCasualties,roundedTroops } from '../model/combat-rules.js';
import { moveToNearbyRetreat,returnEmptyCommanders } from './battlefield-movement.js';
import { campaignDeath } from './campaign-deaths.js';
import { initializeStrategy } from './strategic-targets.js';

// Each directional advance has a finite capture allowance. A counter starts a new
// allowance, but every defeat removes a distinct officer from this operation.
export function resolveContinuousCampaign(ctx){
 const {s,Atlas,rules,actor,opponent,ctl,battles,emit,die,randomInt,helpers:h}=ctx;
 const radius=Math.floor(rules.reliefRadius*(rules.distanceScale||1));
 const live=(nation,g)=>g?.active&&g.alive&&g.troops>0&&!g.stranded&&h.lands(s,nation)>0;
 const move=(nation,g,path,kind,moves,travel)=>{
  if(!path||path.length<2)return;
  moves.push({nation,slot:g.slot,generation:g.generation,kind,from:path[0],to:path.at(-1),path:[...path]});g.position=path.at(-1);g.stranded=false;
  const key=campaignOfficerKey(nation,g);travel.set(key,(travel.get(key)||0)+path.length-1);
 };
 const retreat=(nation,g,b,battlefield=b.cellId)=>{
  if(!g.active||!g.alive||g.troops<=0||!h.lands(s,nation))return;
  const placement=moveToNearbyRetreat(s,Atlas,nation,g,battlefield,nation===b.actor?b.cellId:b.from);
  if(placement)emit('retreat',g.name+' · 전장 인근 후퇴','살아남은 병력과 함께 가까운 자국 영토로 물러났어.',{nation,slot:g.slot,role:'general',battleIndex:b.index,...placement},true);
 };
 const cleanup=(b)=>{
  for(const c of s.countries)if(!h.lands(s,c.id)&&ctx.livingBefore.has(c.id)){
   ctx.livingBefore.delete(c.id);c.reserve=0;c.reorganization=0;c.generals.forEach(g=>{g.troops=0;g.position=null;g.stranded=false;});h.syncArmy(c);s.capitals[c.id]=null;
   emit('elimination',c.name+' 멸망','영지를 모두 잃었어.',{target:c.id,battleIndex:b.index},true);
  }
  for(const nation of [b.actor,b.target])for(const g of s.countries[nation].generals)if(g.active&&g.alive&&Number.isInteger(g.position)&&s.cells[g.position].owner!==nation)retreat(nation,g,b);
  h.ensureStations(s);h.ensureFieldPositions(s);
  if(rules.battlefieldRecovery)returnEmptyCommanders(s,Atlas,h.capitalCell,emit,undefined,b.index);
  for(const c of s.countries)h.syncArmy(c);
  if(h.aliveIds(s).length===1)h.finish(s,'conquest');
 };
 for(const slot of s.countries[actor].generals.filter(g=>g.active&&g.alive).map(g=>g.slot)){
  if(s.result||!h.lands(s,actor))break;
  const initial=s.countries[actor].generals[slot],candidates=h.targets(s,actor,slot,opponent);
  if(!live(actor,initial)||!candidates.length){emit('skip',initial.name+' 공격 건너뜀',!initial.troops?'병력 0만명 · 충원 대기':'도달 가능한 접경 영토 없음',{nation:actor,slot,role:'general'});continue;}
  const routes=new Map(candidates.map(id=>[id,expeditionRoute(s,Atlas,actor,initial,id)]));
  let target=chooseFrontier(s,Atlas,actor,candidates,{paths:new Map([...routes].map(([id,r])=>[id,r.path])),supply:h.connectedSupply},randomInt);
  if(ctl.targetCells?.[slot]!==undefined){target=ctl.targetCells[slot];if(!candidates.includes(target))throw Error('인접하지 않은 대상 영지');}
  const firstRoute=routes.get(target),chance=expeditionChance(firstRoute.distance,rules),roll=die('expedition:'+slot,100);
  emit('expedition_roll',initial.name+' 출전 판정',`목표까지 ${firstRoute.distance}칸 · 출전 확률 ${chance}%`,{nation:actor,slot,role:'general',roll,faces:100,distance:firstRoute.distance,chance,accepted:roll<=chance,cellId:target});
  if(roll>chance){emit('hold',initial.name+' 출전하지 않음','선택한 목표를 포기하고 현재 위치에서 대기해.',{nation:actor,slot,role:'general',cellId:target});continue;}
  const root={id:battles.length,defeated:new Set(),travel:new Map(),capitalFalls:new Set()};
  let task={nation:actor,enemy:opponent,g:initial,target,budget:null,taken:[],special:[],counter:false};
  while(task&&!s.result){
   const {nation,enemy,g}=task;
   if(!live(nation,g)||root.defeated.has(campaignOfficerKey(nation,g))||!h.lands(s,enemy))break;
   const cellId=task.target,route=expeditionRoute(s,Atlas,nation,g,cellId);if(s.cells[cellId]?.owner!==enemy||!route)break;
   const home=s.countries[enemy].generals[s.cells[cellId].commander],defense=advanceDefenders(s,Atlas,enemy,cellId,home,radius,root.defeated);
   const queue=defense.queue.length?defense.queue:[{general:home,path:null,kind:'absent'}];let counter=null,captured=false;
   for(let wave=0;wave<queue.length;wave++){
    if(!live(nation,g))break;
    const entry=queue[wave],d=entry.general,automatic=!defense.queue.length,index=battles.length,moves=[],suffix=index?':chain:'+index:'';
    if(wave===0)move(nation,g,route.path,'outbound',moves,root.travel);
    if(!automatic)move(enemy,d,entry.path,entry.kind,moves,root.travel);
    const b={index,assaultId:root.id,operationId:root.id,continuation:task.counter?'counter':task.taken.length?'advance':'initial',wave:wave+1,defendersTotal:defense.queue.length,actor:nation,target:enemy,slot:g.slot,defenseSlot:d.slot,regionSlot:home.slot,returnBlocked:defense.blocked,relief:entry.kind==='relief',cellId,from:route.from,candidates:[cellId],distance:route.distance,moves,automatic,winner:null,takenCells:[],captureOwner:nation,
     attack:{id:nation,slot:g.slot,name:g.name,ability:g.ability,army:g.troops},defense:{id:enemy,slot:d.slot,name:automatic?'방어 병력 없음':d.name,ability:d.ability,army:automatic?0:d.troops}};
    battles.push(b);
    if(rules.strategicTargets&&cellId===h.capitalCell(s,enemy)){const strategy=initializeStrategy(s,enemy);if(!strategy.capitalAttackers.includes(nation))strategy.capitalAttackers.push(nation);}
    emit('territory',g.name+'의 '+(task.counter?'역공격':task.taken.length?'추가 진격':'공격'),automatic?'수비·복귀·구원 가능한 지휘관 없음':`${wave+1}/${queue.length}차 방어 · ${d.name}`,{nation,slot:g.slot,role:'general',battleIndex:index,candidates:[cellId],cellId,pair:{from:route.from,to:cellId},target:enemy},true);
    if(automatic){b.winner=nation;emit('battle_auto','무방비 영토 진격','추가 영토마다 수비권을 다시 확인해.',{battleIndex:index});}
    else{
     b.sides=rules.combatSides;b.terrain=ctx.terrains?.[cellId]||'plain';
     const av=die('attack:'+g.slot+suffix,b.sides),dv=die('defense:'+g.slot+suffix,b.sides);
     Object.assign(b.attack,{raw:av,wins:g.wins,...combatBonuses(g.troops,d.troops,g.ability,g.wins,'plain',rules),movementEdges:root.travel.get(campaignOfficerKey(nation,g))||0});
     Object.assign(b.defense,{raw:dv,wins:d.wins,...combatBonuses(d.troops,g.troops,d.ability,d.wins,b.terrain,rules),movementEdges:root.travel.get(campaignOfficerKey(enemy,d))||0});
     for(const side of [b.attack,b.defense]){side.fatigueBonus=movementFatigue(side.movementEdges,rules);side.bonus+=side.fatigueBonus;side.score=side.raw+side.bonus;}
     b.winner=b.attack.score===b.defense.score?null:b.attack.score>b.defense.score?nation:enemy;
     emit('attack_roll',g.name+' 공격 주사위','실제 이동의 누적 피로 포함',{battleIndex:index,nation,slot:g.slot,role:'general',roll:av,faces:b.sides,side:b.attack});
     emit('defense_roll',d.name+' 방어 주사위','현지·복귀·구원 수비',{battleIndex:index,nation:enemy,slot:d.slot,role:'general',roll:dv,faces:b.sides,side:b.defense});
     const margin=Math.abs(b.attack.score-b.defense.score);
     b.losses={attack:combatCasualties(g.troops,d.troops,b.winner===nation?'win':b.winner===null?'draw':'loss',margin,rules),defense:combatCasualties(d.troops,g.troops,b.winner===enemy?'win':b.winner===null?'draw':'loss',margin,rules)};
     g.troops=roundedTroops(g.troops-b.losses.attack.amount,rules);d.troops=roundedTroops(d.troops-b.losses.defense.amount,rules);
     if(b.winner!==null){const victor=b.winner===nation?g:d,loser=b.winner===nation?d:g,loserNation=b.winner===nation?enemy:nation;victor.wins++;b.victorWins=victor.wins;root.defeated.add(campaignOfficerKey(loserNation,loser));}
    }
    const finalWin=b.winner===nation&&wave===queue.length-1,falls=[];
    if(finalWin){
     if(task.budget===null)task.budget=automatic?rules.unopposedCaptureLimit:h.conquestLimit(b);
     b.captureLimit=task.budget;
     const take=id=>{
      const capital=h.capitalCell(s,enemy),neighborSnapshot=Atlas.cells[id].neighbors.filter(v=>s.cells[v].owner===enemy);
      s.cells[id].owner=nation;s.cells[id].commander=g.slot;b.takenCells.push(id);task.taken.push(id);
      task.special=task.special.filter(v=>v!==id);if(task.budget>0)task.budget--;
      if(rules.capitalFallAnnexation&&id===capital&&!root.capitalFalls.has(enemy)){
       root.capitalFalls.add(enemy);const adjacent=neighborSnapshot.filter(v=>!task.special.includes(v));task.special.push(...adjacent);const fall={nation:enemy,captor:nation,capital,neighbors:neighborSnapshot,extraCells:[]};falls.push(fall);b.capitalFall=fall;
      }
     };
     take(cellId);
     // Consecutive empty provinces form one recorded advance and one flowing map animation.
     if(automatic)while(task.budget>0||task.special.length){
      const options=s.cells.filter(c=>c.owner===enemy&&b.takenCells.some(id=>Atlas.cells[id].neighbors.includes(c.id))&&(task.budget>0||task.special.includes(c.id))).map(c=>c.id);
      const open=options.filter(id=>!advanceDefenders(s,Atlas,enemy,id,s.countries[enemy].generals[s.cells[id].commander],radius,root.defeated).queue.length);
      if(!open.length)break;const next=chooseFrontier(s,Atlas,nation,open,{recent:task.taken,supply:h.connectedSupply},randomInt);take(next);
     }
     b.takenCell=b.takenCells[0];
    }else b.captureLimit=0;
    b.after={attack:g.troops,defense:d.troops};for(const c of s.countries)h.syncArmy(c);
    b.summary=b.winner===nation?(b.takenCells.length?`${g.name} 승리 · 영토 ${b.takenCells.length}개 점령`:`${g.name} 승리 · 다음 수비대와 계속 전투`):b.winner===enemy?`${d.name} 방어 승리`:'무승부 · 진격 중단';
    if(!automatic&&b.winner===enemy&&rules.defenderCounterattack){const margin=b.defense.score-b.attack.score;b.counterCaptureLimit=margin>=rules.counterCaptureThresholds[1]?2:margin>=rules.counterCaptureThresholds[0]?1:0;if(b.counterCaptureLimit)b.summary+=` · 최대 ${b.counterCaptureLimit}개 역공격`;}else b.counterCaptureLimit=0;
    emit('resolve',b.summary,automatic?'추가 병력 손실·승수 없음':`공격 ${b.attack.army} → ${g.troops}만 / 방어 ${b.defense.army} → ${d.troops}만`,{battleIndex:index,success:b.winner===nation},true);
    if(!automatic&&b.winner!==null){const loser=b.winner===nation?d:g,loserNation=b.winner===nation?enemy:nation;campaignDeath(ctx,b,loser,loserNation,suffix);}
    if(b.winner!==nation)retreat(nation,g,b);if(!automatic&&b.winner===nation)retreat(enemy,d,b);
    if(finalWin){
     captured=true;
     if(rules.occupationAdvance&&live(nation,g)){
      const advance=[],path=fieldPaths(s,Atlas,nation,g.position).get(b.takenCells[0]);move(nation,g,path,'occupation',advance,root.travel);
      if(advance.length)emit('occupation',g.name+' · 점령지 진입','점령 전선이 이어서 전진해.',{nation,slot:g.slot,role:'general',battleIndex:index,moves:advance},true);
     }
     for(const fall of falls)emit('capital_fall',s.countries[enemy].name+' 수도 함락','인접 영토도 수비 지휘관을 확인한 뒤 이어서 진격해.',{...fall,battleIndex:index},false);
     cleanup(b);
    }
    if(!finalWin)cleanup(b);
    if(b.winner!==nation){
     if(b.counterCaptureLimit&&live(enemy,d)){
      const options=Atlas.cells[cellId].neighbors.filter(id=>s.cells[id].owner===nation);
      options.sort((a,b)=>Number(b===battles[index].from)-Number(a===battles[index].from)||a-b);
      if(options.length){counter={nation:enemy,enemy:nation,g:d,target:options[0],budget:b.counterCaptureLimit,taken:[],special:[],counter:true};emit('counteroffensive',d.name+' 역공 개시','상대 영토의 수비대를 확인하고 다시 싸워.',{nation:enemy,slot:d.slot,role:'general',battleIndex:index,target:nation});}
     }
     break;
    }
   }
   if(counter){task=counter;continue;}
   if(!captured||!live(nation,g)||!(task.budget>0||task.special.length)){task=null;continue;}
   const options=s.cells.filter(c=>c.owner===enemy&&(task.budget>0||task.special.includes(c.id))&&Atlas.cells[c.id].neighbors.some(id=>s.cells[id].owner===nation&&task.taken.includes(id))).map(c=>c.id).filter(id=>expeditionRoute(s,Atlas,nation,g,id));
   if(!options.length){task=null;continue;}
   task.target=chooseFrontier(s,Atlas,nation,options,{recent:task.taken,supply:h.connectedSupply},randomInt);
  }
 }
}
