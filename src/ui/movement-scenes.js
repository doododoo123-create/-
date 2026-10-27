// Split recorded moves for presentation only. Actual engine position, fatigue and RNG stay fixed.
export function movementScenes(event,frame,motion,initialCamps,battle=null){
 const scenes=[],moves=motion?.moves||[];let camps={...initialCamps};
 const add=(move,side,routes)=>{
  const before={...camps};camps={...camps,[move.personId]:{territoryId:move.toId,homeId:motion?.camps?.[move.personId]?.homeId}};
  scenes.push({id:`move-${event.index}-${move.personId}`,kind:'movement',event,battleIndex:event.battleIndex,movementSide:side,revealedRoutes:[...routes],title:move.kind==='redeploy'?'생존 지휘관 재배치':'지휘관 이동',worldBefore:frame.before,worldAfter:frame.before,campsBefore:before,camps:{...camps},moves:[move]});
 };
 const route=side=>scenes.push({id:`route-${event.index}-${side}`,kind:'route',formationSide:side,event,battleIndex:event.battleIndex,revealedRoutes:side==='attack'?['attack']:['attack','defense'],readySides:side==='attack'?['attack']:['attack','defense'],title:'전장 도착 · 전투 대형 정렬',worldBefore:frame.before,worldAfter:frame.before,camps:{...camps}});
 if(event.type==='territory'){
  const attack=moves.filter(m=>m.kind==='outbound'),defense=moves.filter(m=>m.kind!=='outbound');
  if(!attack.length&&battle){const person=frame.before.people.find(p=>p.id===battle.attackerPersonId)||frame.before.people.find(p=>p.countryId===battle.actorId&&p.role==='general'&&p.slot===battle.slot),fromId=initialCamps[person?.id]?.territoryId||person?.positionId||person?.stationId||battle.fromId;
   if(person&&fromId!==battle.territoryId)attack.push({personId:person.id,countryId:person.countryId,slot:person.slot,kind:'outbound',fromId,toId:fromId,path:[fromId],presentationOnly:true});}
  for(const m of attack){add(m,'attack',[]);scenes.at(-1).readySides=[];}route('attack');
  for(const m of defense){add(m,'defense',['attack']);scenes.at(-1).readySides=['attack'];}
  if(defense.length||battle&&!battle.automatic)route('defense');
 }else if((event.type==='army_march'||event.type==='army_assembly'&&event.formation)&&moves.length){
  const before={...camps};for(const m of moves)camps={...camps,[m.personId]:{territoryId:m.toId,homeId:motion?.camps?.[m.personId]?.homeId}};
  scenes.push({id:`army-move-${event.index}`,kind:'movement',event,title:'집단군 진군',worldBefore:frame.before,worldAfter:frame.before,campsBefore:before,camps:{...camps},moves:[...moves],armyGroup:event.armyGroup});
 }else for(const m of moves)add(m,null,[]);
 if(motion){camps={...camps,...motion.camps};if(moves.some(m=>m.kind==='occupation')){
  scenes.push({id:`arrival-${event.index}`,kind:'arrival',event,battleIndex:event.battleIndex,title:'점령지 도착',worldBefore:frame.before,worldAfter:frame.after,camps:{...camps}});
  scenes.push({id:`capture-${event.index}`,kind:'capture',event,battleIndex:event.battleIndex,title:'점령 전선 전진',worldBefore:frame.before,worldAfter:frame.after,camps:{...camps}});
 }}
 return {scenes,camps};
}
export function captureArrival(record,battle){return record?.events?.find(e=>e.type==='occupation'&&e.battleIndex===battle.index&&record.movements?.some(m=>m.eventIndex===e.index&&m.moves.some(v=>v.kind==='occupation')))||null;}
