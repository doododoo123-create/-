import {PRESENTATION_RATE,movementRate} from './presentation-tempo.js';
import { combatBonuses } from '../model/combat-rules.js';
// Recorded results become a sequence of readable display steps. These previews never enter the engine.
const observerWorlds=new WeakMap();
export const observedExperience=(person,rules)=>rules.battleMode==='additive30'?combatBonuses(1,1,0,person?.wins||0,'plain',rules,person?.underdogWins||0).experienceBonus:0;
export function observerBattle(scene,record){return record?.battles?.[scene?.battleIndex]||null;}
export function battleConsequence(battle){
 if(!battle)return '';
 if(battle.automatic)return '무방비 영토 · 1개 점령';
 if(battle.winner===null)return '무승부 · 영토 유지';
 if(battle.winner===battle.target)return battle.takenCells.length?`방어 대승 · 역점령 ${battle.takenCells.length}개`:'공격 격퇴 · 영토 유지';
 if(battle.takenCells.length)return `공격 성공 · 영토 ${battle.takenCells.length}개 점령`;
 if(battle.defendersTotal>1&&battle.wave<battle.defendersTotal)return `수비대 ${battle.wave}/${battle.defendersTotal} 격파 · 전투 계속`;
 return '대결 승리 · 점령 없음';
}
export function applicationSteps(scene,record){
 const b=observerBattle(scene,record);
 if(scene?.kind!=='apply'||scene.event?.type!=='resolve'||!b)return ['all'];
 const steps=['outcome'];
 if(!b.automatic&&((b.losses?.attack.amount||0)+(b.losses?.defense.amount||0)>0))steps.push('troops');
 steps.push('territory');
 const old=new Map(scene.worldBefore.people.map(p=>[p.id,p]));
 if(scene.worldAfter.people.some(p=>old.has(p.id)&&((p.capacity||0)>(old.get(p.id).capacity||0)||observedExperience(p,scene.worldAfter.rules)>observedExperience(old.get(p.id),scene.worldBefore.rules))))steps.push('growth');
 return steps;
}
export function applicationWorld(scene,step){
 if(!step||step==='all'||step==='growth')return scene.worldAfter;
 if(step==='outcome')return scene.worldBefore;
 if(!observerWorlds.has(scene))observerWorlds.set(scene,new Map());const cache=observerWorlds.get(scene);if(cache.has(step))return cache.get(step);
 const before=scene.worldBefore,after=scene.worldAfter,old=new Map(before.people.map(p=>[p.id,p])),next=new Map(after.people.map(p=>[p.id,p]));
 const world=step==='troops'?{...before,countries:before.countries.map(c=>{const n=after.countries.find(n=>n.id===c.id);return {...c,troops:n?.troops??c.troops,reserve:n?.reserve??c.reserve,...(n?.royalTroops!==undefined?{royalTroops:n.royalTroops}:{})};}),people:before.people.map(p=>({...p,troops:next.get(p.id)?.troops??p.troops}))}:{...after,people:after.people.map(p=>({...p,capacity:old.get(p.id)?.capacity??p.capacity,wins:old.get(p.id)?.wins??p.wins,...(p.underdogWins!==undefined?{underdogWins:old.get(p.id)?.underdogWins??p.underdogWins}:{})}))};
 cache.set(step,world);return world;
}
export function applicationNotice(scene,record,step){
 const b=observerBattle(scene,record);if(!b||scene?.kind!=='apply')return '';
 if(step==='outcome')return b.automatic?'무방비 영토 진입':b.winner===null?'무승부':`${b.winner===b.actor?b.attack.name:b.defense.name} 승리`;
 if(step==='troops')return `병력 손실 · 공격 −${b.losses.attack.amount}만명 / 수비 −${b.losses.defense.amount}만명`;
 if(step==='territory')return battleConsequence(b);
 if(step==='growth')return '전투 경험 · 지휘관 성장';
 return '';
}
function baseDuration(scene,record,phase,reduced=false){
 if(phase==='departing')return 0;
 if(scene.kind==='season')return reduced?500:1500;
 if(scene.kind==='round-settle')return reduced?200:1000+Math.min(6000,(scene.settlementCount||1)*350);
 if(scene.kind==='capture')return reduced?100:900+Math.max(0,(record.battles?.[scene.battleIndex]?.takenTerritoryIds?.length||1)-1)*500;
 if(scene.kind==='route')return reduced?80:600;
 if(scene.kind==='arrival')return 0;
 if(scene.kind==='movement')return reduced?100:1600;
 if(phase==='rolling')return reduced?80:900;
 if(phase==='raw')return reduced?40:120;
 if(phase==='merging')return 500;
 if(phase==='locked')return scene.kind==='reel'?160:180;
 const b=observerBattle(scene,record),capital=b?.takenTerritoryIds?.some(id=>scene.worldBefore.countries.some(c=>c.capitalId===id));
 if(scene.kind==='apply'){
  if(['war_recovery','season_recovery'].includes(scene.event?.type))return reduced?50:250;
  if(['desertion','production_settlement'].includes(scene.event?.type))return reduced?80:650;
  if(scene.event?.type==='death'||scene.event?.type==='elimination')return reduced?140:2800;
  if(phase==='outcome')return b?.automatic?100:capital?500:300;
  if(phase==='troops')return 650;
  if(phase==='territory')return 80;
  if(phase==='growth')return 350;
  return ['resupply','round_end'].includes(scene.event?.type)?600:650;
 }
 if(scene.kind==='summary')return 0;
 if(scene.kind==='result')return 0;
 if(['death','elimination','finish'].includes(scene.event?.type))return 1600;
 if(['territory','occupation'].includes(scene.event?.type))return 0;
 return 150;
}

export function observerDuration(scene,record,phase,reduced=false){const duration=baseDuration(scene,record,phase,reduced);return scene.kind==='reel'?duration:duration/PRESENTATION_RATE/movementRate(scene);}
