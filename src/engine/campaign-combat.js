import { expeditionRoute, expeditionChance, fieldPaths } from './field-command.js';
import { campaignDefenders, movementFatigue, retreatPath } from './campaign-logistics.js';
import { chooseFrontier } from './frontier.js';
import { combatBonuses, combatCasualties, roundedTroops } from '../model/combat-rules.js';

// New campaign rules are isolated from the original v11 / v0.8 turn algorithm.
export function resolveCampaign(ctx){
 const {s,Atlas,rules,actor,opponent,ctl,events,battles,emit,die,randomInt,helpers:h}=ctx;
 const me=s.countries[actor],other=s.countries[opponent],recent=[];
 const move=(nation,g,path,kind,moves)=>{
  if(!path||path.length<2)return;
  moves.push({nation,slot:g.slot,generation:g.generation,kind,from:path[0],to:path.at(-1),path:[...path]});
  g.position=path.at(-1);g.stranded=false;
 };
 const retreat=(nation,g,battleIndex)=>{
  if(!g.active||!g.alive||!Number.isInteger(g.position))return;
  const path=retreatPath(s,Atlas,nation,g),moves=[];
  if(path){move(nation,g,path,'retreat',moves);g.stranded=false;}
  else g.stranded=true;
  emit('retreat',g.name+(g.stranded?' 퇴각 불가':' 퇴각'),g.stranded?'자국 땅까지 열린 육지 경로가 없어 현재 위치에 고립됐어.':'도달 가능한 자국 영지로 물러났어.',{nation,slot:g.slot,role:'general',battleIndex,moves,stranded:g.stranded},true);
 };
 const deathCheck=(b,a,d,wave)=>{
  const loser=b.automatic||b.winner===null?null:b.winner===actor?d:a;
  if(!loser||loser.troops!==0)return;
  const nation=b.winner===actor?opponent:actor,value=die('death:'+a.slot+(wave?':'+wave:'')),died=value<=3;
  emit('death_roll',loser.name+' 전사 판정','1~3 전사 / 4~10 생존',{battleIndex:b.index,nation,slot:loser.slot,role:'general',roll:value,faces:10,died});
  if(died){
   const c=s.countries[nation];c.fallen.push({name:loser.name,round:s.round,turn:s.turns+1,slot:loser.slot,generation:loser.generation});c.fallen=c.fallen.slice(-30);
   loser.alive=false;loser.waited=0;loser.position=null;loser.stranded=false;
   emit('death',loser.name+' 전사','자국 3턴 후 필요한 자리에 후임을 임명해.',{nation,slot:loser.slot,battleIndex:b.index},true);
  }else emit('survived',loser.name+' 생존 · 행동 불능','병력 0만명 · 충원 대기',{nation,slot:loser.slot,battleIndex:b.index},true);
 };
 const capture=(b)=>{
  const taken=[b.cellId],limit=h.conquestLimit(b);if(!limit)return [];
  const take=id=>{s.cells[id].owner=actor;s.cells[id].commander=b.slot;};take(b.cellId);
  while(taken.length<limit){
   const options=s.cells.filter(c=>c.owner===opponent&&taken.some(v=>Atlas.cells[v].neighbors.includes(c.id))
    &&!other.generals.some(g=>g.active&&g.alive&&g.position===c.id)).map(c=>c.id);
   if(!options.length)break;
   const next=chooseFrontier(s,Atlas,actor,options,{recent:[...recent,...taken],supply:h.connectedSupply},randomInt);take(next);taken.push(next);
  }
  return taken;
 };
 for(const slot of me.generals.filter(g=>g.active&&g.alive).map(g=>g.slot)){
  if(s.result)break;const a=me.generals[slot],candidates=h.targets(s,actor,slot,opponent);
  if(!a.alive||!a.troops||a.stranded||!candidates.length){emit('skip',a.name+' 공격 건너뜀',!a.troops?'병력 0만명 · 충원 대기':a.stranded?'퇴각 경로가 막혀 원정 불가':'도달 가능한 맞닿은 영지가 없어.',{nation:actor,slot,role:'general'});continue;}
  const routes=new Map(candidates.map(id=>[id,expeditionRoute(s,Atlas,actor,a,id)]));
  let cellId=chooseFrontier(s,Atlas,actor,candidates,{paths:new Map([...routes].map(([id,r])=>[id,r.path])),recent,supply:h.connectedSupply},randomInt);
  if(ctl.targetCells?.[slot]!==undefined){cellId=ctl.targetCells[slot];if(!candidates.includes(cellId))throw Error('인접하지 않은 대상 영지');}
  const route=routes.get(cellId),chance=expeditionChance(route.distance,rules),roll=die('expedition:'+slot,100),accepted=roll<=chance;
  emit('expedition_roll',a.name+' · '+(accepted?'출전 결정':'주둔 유지'),route.distance+'칸 · 출전 확률 '+chance+'% · D100',{nation:actor,slot,role:'general',roll,faces:100,distance:route.distance,chance,accepted,cellId});
  if(!accepted){emit('hold',a.name+' 출전하지 않음','선택한 목표를 포기하고 현재 위치에서 대기해.',{nation:actor,slot,role:'general',cellId});continue;}
  const home=other.generals[s.cells[cellId].commander],defense=campaignDefenders(s,Atlas,opponent,cellId,home,rules.reliefRadius);
  const queue=defense.queue.length?defense.queue:[{general:home,path:null,kind:'absent'}],assaultId=battles.length;
  for(let wave=0;wave<queue.length;wave++){
   const entry=queue[wave],d=entry.general,automatic=!defense.queue.length,index=battles.length,moves=[];
   if(wave===0)move(actor,a,route.path,'outbound',moves);
   if(!automatic)move(opponent,d,entry.path,entry.kind,moves);
   const b={index,assaultId,wave:wave+1,defendersTotal:defense.queue.length,actor,target:opponent,slot,defenseSlot:d.slot,regionSlot:home.slot,returnBlocked:defense.blocked,relief:entry.kind==='relief',cellId,from:route.from,candidates:[...candidates],distance:route.distance,moves,
    attack:{id:actor,slot,name:a.name,ability:a.ability,army:a.troops},defense:{id:opponent,slot:d.slot,name:automatic?'방어 병력 없음':d.name,ability:d.ability,army:automatic?0:d.troops},automatic,winner:null,takenCells:[]};battles.push(b);
   emit('territory',a.name+'의 공격 · '+(automatic?'무방비 영지':`${wave+1}/${queue.length}차 방어`),automatic?'전투 가능한 현지·복귀·구원 지휘관 없음':d.name+' 순차 방어',{nation:actor,slot,role:'general',battleIndex:index,candidates,cellId,pair:{from:route.from,to:cellId},target:opponent},true);
   if(automatic){b.winner=actor;emit('battle_auto','방어 불능 · 자동 점령','해당 영토 1개만 점령해.',{battleIndex:index});}
   else{
    b.sides=rules.combatSides;b.terrain=ctx.terrains?.[cellId]||'plain';
    const suffix=wave?':'+wave:'',av=die('attack:'+slot+suffix,b.sides),dv=die('defense:'+slot+suffix,b.sides);
    Object.assign(b.attack,{raw:av,wins:a.wins,...combatBonuses(a.troops,d.troops,a.ability,a.wins,'plain',rules),movementEdges:route.path.length-1,fatigueBonus:movementFatigue(route.path.length-1,rules)});
    Object.assign(b.defense,{raw:dv,wins:d.wins,...combatBonuses(d.troops,a.troops,d.ability,d.wins,b.terrain,rules),movementEdges:entry.path.length-1,fatigueBonus:movementFatigue(entry.path.length-1,rules)});
    for(const side of [b.attack,b.defense]){side.bonus+=side.fatigueBonus;side.score=side.raw+side.bonus;}
    b.winner=b.attack.score===b.defense.score?null:b.attack.score>b.defense.score?actor:opponent;
    emit('attack_roll',a.name+' 공격 주사위','이동 피로 포함 최종 점수',{battleIndex:index,nation:actor,slot,role:'general',roll:av,faces:b.sides,side:b.attack});
    emit('defense_roll',d.name+' 방어 주사위','이동 피로 포함 최종 점수',{battleIndex:index,nation:opponent,slot:d.slot,role:'general',roll:dv,faces:b.sides,side:b.defense});
    const margin=Math.abs(b.attack.score-b.defense.score);
    b.losses={attack:combatCasualties(a.troops,d.troops,b.winner===actor?'win':b.winner===null?'draw':'loss',margin,rules),defense:combatCasualties(d.troops,a.troops,b.winner===opponent?'win':b.winner===null?'draw':'loss',margin,rules)};
    a.troops=roundedTroops(a.troops-b.losses.attack.amount,rules);d.troops=roundedTroops(d.troops-b.losses.defense.amount,rules);
    if(b.winner!==null){const winner=b.winner===actor?a:d;winner.wins++;b.victorWins=winner.wins;}
   }
   const finalWin=b.winner===actor&&wave===queue.length-1;
   b.captureLimit=finalWin?h.conquestLimit(b):0;
   if(finalWin){b.takenCells=capture(b);b.takenCell=cellId;recent.push(...b.takenCells);}
   h.syncArmy(me);h.syncArmy(other);b.after={attack:a.troops,defense:d.troops};
   b.summary=b.winner===actor?(finalWin?a.name+' 승리 · 영지 '+b.takenCells.length+'개 점령':a.name+' 승리 · 다음 수비대와 계속 전투'):b.winner===opponent?d.name+' 방어 성공 · 영지 유지':'무승부 · 영지 유지';
   emit('resolve',b.summary,automatic?'병력 손실 없음':`공격 ${b.attack.army} → ${a.troops}만 / 방어 ${b.defense.army} → ${d.troops}만`,{battleIndex:index,success:b.winner===actor},true);
   deathCheck(b,a,d,wave);
   if(finalWin){
    // Only physically displaced commanders retreat. A blocked unit never teleports to its new home.
    for(const g of other.generals)if(g.active&&g.alive&&Number.isInteger(g.position)&&s.cells[g.position].owner!==opponent)retreat(opponent,g,index);
    h.ensureStations(s);h.ensureFieldPositions(s);
   }
   if(!finalWin&&b.winner===actor&&d.alive){
    const paths=fieldPaths(s,Atlas,opponent,d.position),homePath=paths.get(d.station);
    if(homePath&&homePath.length>1){const retreatMoves=[];move(opponent,d,homePath,'retreat',retreatMoves);emit('retreat',d.name+' 퇴각','남은 수비대가 이어서 방어해.',{nation:opponent,slot:d.slot,role:'general',battleIndex:index,moves:retreatMoves},true);}
   }
   for(const c of s.countries)if(h.lands(s,c.id)===0&&ctx.livingBefore.has(c.id)){
    ctx.livingBefore.delete(c.id);c.reserve=0;c.generals.forEach(g=>{g.troops=0;g.position=null;g.stranded=false;});h.syncArmy(c);s.capitals[c.id]=null;emit('elimination',c.name+' 멸망','영지를 모두 잃었어.',{target:c.id},true);
   }
   if(h.aliveIds(s).length===1){h.finish(s,'conquest');break;}
   if(b.winner!==actor||!a.troops)break;
  }
 }
}
