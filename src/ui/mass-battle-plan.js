import {freeBattlePresentation} from './free-battle-plan.js';
import {analyzeMassBattle} from './mass-battle-analysis.js';
import {massPersonalStreaks} from './mass-battle-choreography.js';
import {chooseMassTactics,massSeed} from './mass-battle-tactics.js';
export const MASS_BATTLE_TIMING=Object.freeze({prepare:1700,min:12000,max:18000,unopposed:3200,critical:1600,report:1000});
const massClamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
export function massBattlePlan(group,record,{seed=null}={}){
 const a=analyzeMassBattle(group,record),visualSeed=seed??massSeed(JSON.stringify([1,record.turn,group.id,a.battles.map(b=>[b.index,b.attack.raw,b.defense.raw,b.winner,b.takenTerritoryIds])])),tactics=chooseMassTactics(a,visualSeed);
 const units=a.units.map(u=>{const result={...u,figures:u.startArmy>=15?16:u.startArmy>=8?12:8};delete result.person;return result;}),count=Math.max(1,...['attack','defense'].map(side=>units.filter(u=>u.side===side).length)),rows=Math.ceil(count/6),width=1260,center=235+rows*105,height=center*2;
 const engagements=a.battles.map(b=>({index:b.index,attackId:b.attackId,defenseId:b.defenseId,automatic:b.automatic,territoryId:b.territoryId,territoryName:b.territoryName,terrain:b.terrain,continuation:b.continuation,captured:!!b.takenTerritoryIds?.length,winner:b.winner===null?null:b.winner===b.actor?b.attackId:b.defenseId,point:{x:width/2,y:center}}));
 const countries=[a.actorId,a.opponentId].map(id=>a.before.countries.find(c=>c.id===id)).filter(Boolean).map(c=>({id:c.id,name:c.name,color:c.color})),gained=a.changes.filter(c=>c.to===a.actorId).length,lost=a.changes.filter(c=>c.from===a.actorId).length;
 const plan={version:5,id:a.id,seed:visualSeed,tactics,units,engagements,countries,width,height,center,changes:a.changes,losses:a.losses,gained,lost,outcome:gained>lost?`${countries[0]?.name||'공격군'} 진격`:lost>gained?`${countries[1]?.name||'수비군'} 반격`:'공세 종료',honors:massPersonalStreaks(engagements,units),before:a.before,after:a.after,group};
 freeBattlePresentation(plan,a);return plan;
}

export function massBattleTime(plan,time){let elapsed=0;for(const hold of plan.holds){if(time<hold.start)break;if(time<=hold.end)return {base:hold.base,hold,holdProgress:massClamp((time-hold.start)/(hold.end-hold.start))};elapsed+=hold.end-hold.start;}return {base:massClamp(time-elapsed,0,plan.baseDuration),hold:null,holdProgress:0};}
export function massGlobalTime(plan,base){return base+plan.holds.filter(h=>h.base<base).reduce((n,h)=>n+h.end-h.start,0);}
function massOrderPosition(order,t){const p=massClamp((t-order.start)/Math.max(1,order.end-order.start)),f=p*p*(3-2*p),bend=Math.sin(p*Math.PI)*order.curve;return {x:order.from.x+(order.to.x-order.from.x)*f+bend,y:order.from.y+(order.to.y-order.from.y)*f+Math.sin(p*Math.PI)*(order.curveY||0)};}
export function massBattleAt(plan,time){
 const clock=massBattleTime(plan,massClamp(time,0,plan.duration)),t=clock.base;
 const units=plan.units.map(u=>{
  const motion=u.orders.find(o=>t>=o.start&&t<o.end),past=u.orders.filter(o=>o.end<=t).at(-1),point=motion?massOrderPosition(motion,t):past?.to||u.home;
  let troops=u.startArmy;for(const step of u.troops){if(step.at>t)break;troops=step.value;}
  let alive=u.initialAlive,confusion=0;for(const step of u.status){if(step.at>t)break;alive=step.alive!==false;confusion=step.confusion??confusion;}
  const dead=u.deathAt!==undefined&&t>=u.deathAt,deathAge=dead?time-massGlobalTime(plan,u.deathAt):0;
  const labels=u.labels.filter(l=>t>=l.at&&t<l.end).sort((a,b)=>a.at-b.at),hit=labels.some(l=>l.kind==='loss'&&t-l.at<600);
  let action=dead?'death':troops<=0?'idle':motion?.kind==='retreat'?'retreat':hit?'hurt':motion?.kind||'idle';
  if(plan.freePresentation&&u.combatant&&motion?.kind==='attack'&&!dead&&troops>0&&!hit){const beat=(t+(u.fightOffset||0))%1500;action=beat<900?'attack':'guard';}
  return {...u,...point,troops,alive,confusion,action,actionTime:dead?deathAge:Math.max(0,t-(hit?labels.filter(l=>l.kind==='loss').at(-1).at:motion?.start||0)),flip:motion&&['walk','retreat'].includes(motion.kind)&&Math.abs(motion.to.x-motion.from.x)>1?(motion.kind==='retreat'?motion.to.x>motion.from.x:motion.to.x<motion.from.x):u.side==='defense',labels:dead?[{text:'전사',kind:'death'}]:labels,visible:!dead||deathAge<1850,withdrawn:u.exitAt!==undefined&&t>=u.exitAt,figures:dead?1:troops>0?Math.max(1,Math.min(u.figures,Math.ceil(u.figures*troops/Math.max(u.visualArmy??u.startArmy,troops,.0001)))):0};
 });
 const contacts=[],seen=new Set();if(plan.freePresentation){for(const u of units){if(!u.combatant||!u.visible||!u.alive||u.troops<=0||!['attack','guard','hurt'].includes(u.action))continue;const other=units.filter(v=>v.side!==u.side&&v.combatant&&v.alive&&v.troops>0&&!v.withdrawn&&['attack','guard','hurt'].includes(v.action)).sort((a,b)=>Math.hypot(a.x-u.x,a.y-u.y)-Math.hypot(b.x-u.x,b.y-u.y))[0];if(!other||Math.hypot(u.x-other.x,u.y-other.y)>280)continue;const key=[u.id,other.id].sort().join('|');if(seen.has(key))continue;seen.add(key);contacts.push({index:massSeed(key)%1000,attackId:u.side==='attack'?u.id:other.id,defenseId:u.side==='defense'?u.id:other.id,automatic:false});}contacts.sort((a,b)=>massSeed(a.index+':'+Math.floor(t/650))-massSeed(b.index+':'+Math.floor(t/650)));}
 const totals={attack:0,defense:0};for(const u of units)totals[u.side]+=u.troops;
 return {time,base:t,hold:clock.hold,units,totals,contacts:plan.freePresentation?contacts:null,engagements:plan.engagements.filter(e=>t>=(e.visualContact??e.contact)&&t<(e.visualEnd??e.end)),complete:t>=plan.baseDuration};
}
