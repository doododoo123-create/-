import {analyzeMassBattle} from './mass-battle-analysis.js';
import {choreographMassArmy,massPersonalStreaks} from './mass-battle-choreography.js';
import {chooseMassTactics,massSeed} from './mass-battle-tactics.js';

export const MASS_BATTLE_TIMING=Object.freeze({prepare:1700,min:12000,max:18000,unopposed:3200,critical:1600,report:1000});
const massClamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const massAmount=n=>Math.max(0,Math.round(n*10000)/10000);
const massImportantEvent=e=>['death','capital_fall','elimination','appointment'].includes(e.type);
export function massBattlePlan(group,record,{seed=null}={}){
 const a=analyzeMassBattle(group,record),derived=massSeed(JSON.stringify([1,record.turn,group.id,a.battles.map(b=>[b.index,b.attack.raw,b.defense.raw,b.winner,b.takenTerritoryIds])])),visualSeed=seed??derived,tactics=chooseMassTactics(a,visualSeed);
 const used=new Set(tactics.selected.map(t=>t.id)),units=a.units.map(u=>({...u,orders:[],troops:[{at:0,value:u.startArmy}],status:[{at:0,alive:u.initialAlive}],labels:[]}));
 const byId=new Map(units.map(u=>[u.id,u])),maxSide=Math.max(1,...['attack','defense'].map(side=>units.filter(u=>u.side===side).length)),columns=Math.min(6,maxSide),rows=Math.ceil(maxSide/columns),width=Math.max(1200,columns*180+180),center=235+rows*105,height=center*2;
 for(const side of ['attack','defense']){
  const list=units.filter(u=>u.side===side);list.forEach((u,i)=>{const col=i%columns,row=Math.floor(i/columns),n=Math.min(columns,list.length-row*columns),step=Math.min(180,(width-200)/Math.max(1,n));u.home={x:width/2-(side==='attack'?1:-1)*(155+row*120),y:center+(col-(n-1)/2)*Math.min(110,step)};u.formationRole=row?'reserve':col===0?'left':col===n-1?'right':'center';if(u.formationRole==='center'&&(used.has('reserves')||used.has('waves'))&&u.firstBattle>a.battles[0].index){u.formationRole='reserve';u.home.x-=(side==='attack'?45:-45);}u.figures=u.startArmy>=15?16:u.startArmy>=8?12:8;});
 }
 // Shared people, the same defended province, follow-on advances, and captures
 // impose dependencies. Independent movements may overlap, outcomes stay ordered.
 const ready=new Map(),territories=new Map(),operations=new Map(),windows=[];let end=0,barrier=0;
 for(const [i,b] of a.battles.entries()){
  const ids=[b.attackId,b.defenseId].filter(Boolean),start=Math.max(i*.13,end-.87,barrier,...ids.map(id=>ready.get(id)||0),territories.get(b.territoryId)||0,b.continuation!=='initial'?operations.get(b.operationId)||0:0),finish=start+1;
  windows.push({battle:b,start,end:finish});ids.forEach(id=>ready.set(id,finish));territories.set(b.territoryId,finish);operations.set(b.operationId,finish);end=finish;
  if(b.takenTerritoryIds?.length||a.events.some(e=>e.battleIndex===b.index&&massImportantEvent(e)))barrier=finish;
 }
 const fighting=a.battles.filter(b=>!b.automatic).length,baseDuration=fighting?Math.min(MASS_BATTLE_TIMING.max,MASS_BATTLE_TIMING.min+Math.max(0,fighting-4)*220):MASS_BATTLE_TIMING.unopposed;
 const prelude=fighting?1400:0,scale=(baseDuration-MASS_BATTLE_TIMING.prepare-650-prelude)/Math.max(1,end);
 const cues=[],engagements=[],lastBattle=new Map();
 for(const b of a.battles)for(const id of [b.attackId,b.defenseId].filter(Boolean))lastBattle.set(id,b.index);
 for(const w of windows){
  const b=w.battle,start=MASS_BATTLE_TIMING.prepare+prelude+w.start*scale,finish=MASS_BATTLE_TIMING.prepare+prelude+w.end*scale,span=finish-start,resolve=start+span*.77,contact=start+span*.25;
  const au=byId.get(b.attackId),du=byId.get(b.defenseId),cx=massClamp(((au?.home.x||width/2)+(du?.home.x||au?.home.x||width/2))/2,110,width-110),point={x:cx,y:center-60};
  engagements.push({index:b.index,start,end:finish,contact,resolve,point,attackId:b.attackId,defenseId:b.defenseId,automatic:b.automatic,territoryId:b.territoryId,territoryName:b.territoryName,terrain:b.terrain,winner:b.winner===null?null:b.winner===b.actor?b.attackId:b.defenseId,continuation:b.continuation,captured:!!b.takenTerritoryIds?.length});
  for(const side of ['attack','defense']){
   const u=side==='attack'?au:du;if(!u)continue;
   const own=b[side],isWinner=b.winner!==null&&(b.winner===b.actor?side==='attack':side==='defense'),isLoser=b.winner!==null&&!isWinner;
   u.troops.push({at:start,value:own.army});
   const final=b.after?.[side]??own.army,total=massAmount(own.army-final),q=a.quantum,parts=Math.min(3,Math.max(1,Math.round(total/q)));
   if(total>0)for(let k=1;k<=parts;k++){
    const loss=Math.min(total,Math.floor(Math.round(total/q)*k/parts)*q),previous=Math.floor(Math.round(total/q)*(k-1)/parts)*q,at=contact+(resolve-contact)*k/parts;
    u.troops.push({at,value:massAmount(own.army-loss)});if(loss>previous)u.labels.push({at,end:at+700,text:`−${massAmount(loss-previous)}만`,kind:'loss'});
   }
   u.troops.push({at:resolve,value:final});
   const finalFight=lastBattle.get(u.id)===b.index;
   if(!b.automatic)u.labels.push({at:resolve,end:resolve+850,text:b.winner===null?'무승부':isWinner?'격퇴!':finalFight?'후퇴':'밀려남',kind:isWinner?'win':'retreat'});
   if(isLoser&&finalFight)u.exitAt=finish;
  }
  if(!b.automatic)cues.push({at:contact,id:'sword_clash',key:'clash:'+b.index},{at:resolve,id:b.winner===null?'battle_draw':'battle_impact',key:'result:'+b.index});
  else cues.push({at:resolve,id:'territory_capture',key:'entry:'+b.index});
 }
 const eventTimes=new Map();
 for(const e of a.events){const w=engagements.find(w=>w.index===e.battleIndex);let at=w?e.type==='territory'?w.start:['attack_roll','defense_roll'].includes(e.type)?w.contact:w.resolve:0;
  if(w&&!['territory','attack_roll','defense_roll','resolve'].includes(e.type)){
   const resolveEvent=a.events.find(v=>v.battleIndex===w.index&&v.type==='resolve');at=Math.min(w.end-1,w.resolve+Math.max(1,e.index-(resolveEvent?.index||0))*Math.min(8,(w.end-w.resolve)/30));
  }
  eventTimes.set(e.index,at);
  const frame=record.frames?.[e.index];if(!frame)continue;
  for(const u of units){const old=frame.before.people.find(p=>p.id===u.id),next=frame.after.people.find(p=>p.id===u.id);if(!next)continue;
   if(next.troops!==old?.troops)u.troops.push({at,value:next.troops});
   if(next.alive!==old?.alive||next.active!==old?.active||next.confusion!==old?.confusion)u.status.push({at,alive:next.alive,active:next.active,confusion:next.confusion||0});
  }
 }
 const important=a.events.filter(massImportantEvent).map(e=>({event:e,base:eventTimes.get(e.index)})).sort((x,y)=>x.base-y.base||x.event.index-y.event.index);
 const holds=important.map((v,i)=>({...v,start:v.base+i*MASS_BATTLE_TIMING.critical,end:v.base+(i+1)*MASS_BATTLE_TIMING.critical}));
 for(const u of units){
  const final=a.after.people.find(p=>p.id===u.id);u.finalArmy=final?.troops??0;u.finalAlive=final?.alive!==false;
  u.troops.push({at:baseDuration,value:u.finalArmy});u.status.push({at:baseDuration,alive:u.finalAlive,active:final?.active!==false});
  u.troops.sort((x,y)=>x.at-y.at);u.status.sort((x,y)=>x.at-y.at);
  const death=a.events.find(e=>e.type==='death'&&record.frames?.[e.index]?.before.people.some(p=>p.id===u.id&&p.countryId===e.nationId&&p.slot===e.slot&&p.role===(e.role||'general')));
  if(death){u.deathAt=eventTimes.get(death.index);u.labels.push({at:u.deathAt,end:u.deathAt+1000,text:'전사',kind:'death'});}
  delete u.person;
 }
 choreographMassArmy(units,engagements,tactics,{width,center,baseDuration,prepare:MASS_BATTLE_TIMING.prepare});
 for(const cue of cues)if(cue.key.startsWith('clash:'))cue.at=engagements.find(e=>cue.key==='clash:'+e.index)?.visualContact??cue.at;
 const honors=massPersonalStreaks(engagements,units);
 const countries=[a.actorId,a.opponentId].map(id=>a.before.countries.find(c=>c.id===id)).filter(Boolean).map(c=>({id:c.id,name:c.name,color:c.color}));
 const gained=a.changes.filter(c=>c.to===a.actorId).length,lost=a.changes.filter(c=>c.from===a.actorId).length;
 const outcome=gained>lost?`${countries[0]?.name||'공격군'} 진격`:lost>gained?`${countries[1]?.name||'수비군'} 반격`:'공세 종료';
 return {version:2,honors,id:a.id,seed:visualSeed,tactics,units,engagements,eventTimes,holds,cues,countries,width,height,center,baseDuration,duration:baseDuration+holds.length*MASS_BATTLE_TIMING.critical,changes:a.changes,losses:a.losses,gained,lost,outcome,before:a.before,after:a.after,group};
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
  const labels=u.labels.filter(l=>t>=l.at&&t<l.end).sort((a,b)=>a.at-b.at),hit=labels.some(l=>l.kind==='loss'&&t-l.at<180);
  const action=dead?'death':troops<=0?'idle':motion?.kind==='retreat'?'retreat':hit?'hurt':motion?.kind||'idle';
  return {...u,...point,troops,alive,confusion,action,actionTime:dead?deathAge:Math.max(0,t-(motion?.start||0)),flip:motion&&['walk','retreat'].includes(motion.kind)&&Math.abs(motion.to.x-motion.from.x)>1?(motion.kind==='retreat'?motion.to.x>motion.from.x:motion.to.x<motion.from.x):u.side==='defense',labels:dead?[{text:'전사',kind:'death'}]:labels,visible:!dead||deathAge<1850,withdrawn:u.exitAt!==undefined&&t>=u.exitAt,figures:dead?1:troops>0?Math.max(1,Math.min(u.figures,Math.ceil(u.figures*troops/Math.max(u.startArmy,troops,.0001)))):0};
 });
 const totals={attack:0,defense:0};for(const u of units)totals[u.side]+=u.troops;
 return {time,base:t,hold:clock.hold,units,totals,engagements:plan.engagements.filter(e=>t>=(e.visualContact??e.contact)&&t<(e.visualEnd??e.end)),complete:t>=plan.baseDuration};
}
