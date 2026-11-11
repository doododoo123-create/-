import {spatialBattlefield} from './regional-field-motion.js';
// Presentation only: ordered territorial visits, one shared body per commander.
// All casualties/status/owners come from recorded frames; no tactics or game RNG.
export function regionalVisits(battles){
 const visits=[];
 for(const b of battles){
  if(b.automatic){for(const territoryId of b.takenTerritoryIds?.length?b.takenTerritoryIds:[b.territoryId])visits.push({key:'entry:'+b.index+':'+territoryId,territoryId,actorId:b.actorId,defenderId:b.defenderId,automatic:true,battles:[b]});continue;}
  const key=[b.frontId||b.armyGroupId||'',b.territoryId,b.actorId,b.defenderId].join('|'),last=visits.at(-1);
  if(last&&!last.automatic&&last.key===key)last.battles.push(b);else visits.push({key,territoryId:b.territoryId,actorId:b.actorId,defenderId:b.defenderId,automatic:false,battles:[b]});
 }
 return visits;
}
const point=u=>u.orders.at(-1)?.to||u.home;
function order(u,kind,start,end,to,extra={}){const previous=u.orders.at(-1),from=point(u);if(previous&&previous.end<start)u.orders.push({kind:'guard',start:previous.end,end:start,from:{...from},to:{...from},curve:0,curveY:0});if(end>start)u.orders.push({kind,start,end,from:{...from},to:{...to},curve:0,curveY:0,...extra});}
export function regionalBattlePresentation(plan,a){
 const byId=new Map(plan.units.map(u=>[u.id,u])),regions=regionalVisits(a.battles),byBattle=new Map();let cursor=0;
 for(const [i,r]of regions.entries()){
  r.index=i;r.name=a.before.territories.find(t=>t.id===r.territoryId)?.name||r.territoryId;
  r.attackIds=[...new Set(r.battles.map(b=>b.attackId))];r.defenseIds=r.automatic?[]:[...new Set(r.battles.map(b=>b.defenseId).filter(Boolean))];
  r.start=cursor;r.duration=r.automatic?1400:Math.min(6000,3200+(r.attackIds.length+r.defenseIds.length)*100);r.end=cursor+=r.duration;r.contact=r.start+r.duration*.23;
  for(const b of r.battles)byBattle.set(b.index,r);
 }
 plan.regional=true;plan.regions=regions;plan.baseDuration=Math.max(1,cursor);plan.tacticalPhases=[];plan.freePresentation=false;plan.eventTimes=new Map();plan.cues=[];
 for(const side of ['attack','defense']){
  const list=plan.units.filter(u=>u.side===side),sign=side==='attack'?1:-1;
  list.forEach((u,i)=>{u.home={x:plan.width/2-sign*(370+Math.floor(i/6)*95),y:plan.center+((i%6)-Math.min(5,list.length-1)/2)*105};u.orders=[];u.troops=[{at:0,value:u.startArmy}];u.status=[{at:0,alive:u.initialAlive,withdrawn:false}];u.labels=[];u.combatant=false;u.visualArmy=u.startArmy;u.fightOffset=i*137;u.regionSteps=[{at:0,territoryId:a.before.people.find(p=>p.id===u.id)?.positionId||u.personPosition}];});
 }
 // Events without a battle belong to the previous visit (post-combat repair).
 let current=regions[0];const assigned=new Map(regions.map(r=>[r,[]]));
 for(const e of a.events){const target=byBattle.get(e.battleIndex);if(target)current=e.type==='territory'&&target.automatic?regions.find(r=>r.battles[0].index===e.battleIndex):target;if(current)assigned.get(current).push(e);}
 for(const r of regions){const events=assigned.get(r);events.forEach((e,i)=>plan.eventTimes.set(e.index,r.start+r.duration*(.27+.59*(i+1)/Math.max(1,events.length))));}
 // Ensure even multi-cell automatic captures reveal each owner only on arrival.
 plan.ownerSteps=[];
 for(const e of a.events){const f=a.record.frames?.[e.index],at=plan.eventTimes.get(e.index)??0;if(!f)continue;
  const oldTerritories=new Map(f.before.territories.map(t=>[t.id,t])),oldPeople=new Map(f.before.people.map(p=>[p.id,p])),newPeople=new Map(f.after.people.map(p=>[p.id,p]));
  for(const territory of f.after.territories){const old=oldTerritories.get(territory.id);if(old?.ownerId!==territory.ownerId){const visit=regions.find(r=>r.battles.some(b=>b.index===e.battleIndex)&&r.territoryId===territory.id);plan.ownerSteps.push({at:visit?(visit.automatic?visit.start+visit.duration*.83:Math.max(at,visit.start+visit.duration*.83)):at,id:territory.id,ownerId:territory.ownerId});}}
  for(const u of plan.units){const before=oldPeople.get(u.id),after=newPeople.get(u.id);if(!after)continue;
   if(before?.troops!==after.troops){u.troops.push({at,value:after.troops});const delta=Math.round(((after.troops||0)-(before?.troops||0))*10000)/10000;if(delta)u.labels.push({at,end:at+700,text:e.type==='isolated_return'?`철수 −${Math.abs(delta)}만`:delta>0?`재편 +${delta}만`:`−${Math.abs(delta)}만`,kind:delta>0?'win':'loss'});}
   if(before?.alive!==after.alive||before?.confusion!==after.confusion)u.status.push({at,alive:after.alive!==false,confusion:after.confusion||0});
   if(before?.positionId!==after.positionId)u.regionSteps.push({at,territoryId:after.positionId});
   if(before?.alive!==false&&after.alive===false)u.deathAt=at;
   if(e.type==='retreat'&&e.nationId===u.countryId&&(e.moves||[]).some(m=>m.personId===u.id||m.nation===e.nation&&m.slot===u.personSlot))u.status.push({at,withdrawn:true});
  }
 }
 for(const r of regions){
  for(const [side,ids]of [['attack',r.attackIds],['defense',r.defenseIds]])ids.forEach((id,i)=>{
   const u=byId.get(id);if(!u)return;const sign=side==='attack'?1:-1,n=Math.min(6,ids.length-Math.floor(i/6)*6),line={x:plan.width/2-sign*(52+Math.floor(i/6)*95),y:plan.center+(i%6-(n-1)/2)*105};
   u.status.push({at:r.start,withdrawn:false});u.combatant||=!r.automatic;u.visualContact??=r.contact;
   order(u,'walk',r.start,r.contact,line);u.regionSteps.push({at:r.contact,territoryId:r.territoryId});
   const rounds=r.battles.filter(b=>b.attackId===id||b.defenseId===id),last=rounds.at(-1),won=last.winner!==null&&(last.winner===last.actor?last.attackId:last.defenseId)===id;
   const exit=plan.eventTimes.get(a.events.find(e=>e.type==='retreat'&&e.battleIndex===last.index&&(e.nationId===u.countryId&&e.slot===u.personSlot))?.index);
   const fightEnd=Math.max(r.contact,Math.min(r.start+r.duration*.86,u.deathAt??Infinity,exit??Infinity));
   order(u,r.automatic?'walk':u.role==='king'||side==='defense'?'guard':'attack',r.contact,fightEnd,{...line,x:line.x+(won?sign*20:0)},{combat:!r.automatic});
   order(u,won?'walk':'retreat',fightEnd,r.end,won?{x:plan.width/2+sign*100,y:line.y}:u.home);
   if(!won)u.status.push({at:fightEnd,withdrawn:true});
  });
  for(const b of r.battles){const e=plan.engagements.find(e=>e.index===b.index);if(e&&!e.regionalAssigned){Object.assign(e,{start:r.start,contact:r.contact,visualContact:r.contact,resolve:plan.eventTimes.get(a.events.find(v=>v.type==='resolve'&&v.battleIndex===b.index)?.index)??r.end*.85,end:r.end,visualEnd:r.end,regionalAssigned:true});}}
  const captured=r.battles.find(b=>b.takenTerritoryIds?.includes(r.territoryId)),last=r.battles.at(-1);r.outcome=captured?(r.automatic?'무방비 진입 · 점령':'수비 돌파 · 점령'):last.winner===null?'무승부 · 점령 없음':last.winner===last.actor?'교전 승리 · 점령 없음':'공격 저지 · 점령 없음';
  if(!r.automatic)for(let at=r.contact;at<r.end-400;at+=700)plan.cues.push({at,id:'sword_clash',key:'region:'+r.index+':'+at});
 }
 for(const u of plan.units){const final=a.after.people.find(p=>p.id===u.id);u.finalArmy=final?.troops??0;u.finalAlive=final?.alive!==false;u.troops.push({at:cursor,value:u.finalArmy});u.status.push({at:cursor,alive:u.finalAlive});u.troops.sort((a,b)=>a.at-b.at);u.status.sort((a,b)=>a.at-b.at);u.regionSteps.sort((a,b)=>a.at-b.at);u.visualArmy=Math.max(u.startArmy,...u.troops.map(s=>s.value));order(u,'guard',u.orders.at(-1)?.end||0,cursor,point(u));}
 const important=a.events.filter(e=>['death','capital_fall','elimination','appointment','isolated_return'].includes(e.type));
 plan.holds=important.map(e=>({event:e,base:plan.eventTimes.get(e.index)??cursor})).sort((x,y)=>x.base-y.base||x.event.index-y.event.index).map((h,i)=>({...h,start:h.base+i*1600,end:h.base+(i+1)*1600}));plan.duration=cursor+plan.holds.length*1600;
 const ids=new Set([...regions.flatMap(r=>[r.territoryId,...r.battles.map(b=>b.fromId)]),...plan.units.flatMap(u=>u.regionSteps.map(s=>s.territoryId))].filter(Boolean));
 plan.territories=a.before.territories.filter(t=>ids.has(t.id)).map(t=>({id:t.id,name:t.name,ownerId:t.ownerId}));
 spatialBattlefield(plan,a);
}
