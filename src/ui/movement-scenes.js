// Split recorded moves for presentation only. Actual engine position, fatigue and RNG stay fixed.
export function movementScenes(event,frame,motion,initialCamps){
 const scenes=[],moves=motion?.moves||[];let camps={...initialCamps};
 const add=(move,side,routes)=>{
  const before={...camps};camps={...camps,[move.personId]:{territoryId:move.toId,homeId:motion.camps?.[move.personId]?.homeId}};
  scenes.push({id:`move-${event.index}-${move.personId}`,kind:'movement',event,battleIndex:event.battleIndex,movementSide:side,revealedRoutes:[...routes],title:move.kind==='redeploy'?'생존 지휘관 재배치':'지휘관 이동',worldBefore:frame.before,worldAfter:frame.before,campsBefore:before,camps:{...camps},moves:[move]});
 };
 const route=side=>scenes.push({id:`route-${event.index}-${side}`,kind:'route',event,battleIndex:event.battleIndex,revealedRoutes:side==='attack'?['attack']:['attack','defense'],title:'이동 경로 표시',worldBefore:frame.before,worldAfter:frame.before,camps:{...camps}});
 if(event.type==='territory'){
  const attack=moves.filter(m=>m.kind==='outbound'),defense=moves.filter(m=>m.kind!=='outbound');
  for(const m of attack)add(m,'attack',[]);route('attack');
  for(const m of defense)add(m,'defense',['attack']);if(defense.length)route('defense');
 }else for(const m of moves)add(m,null,[]);
 if(motion){camps={...camps,...motion.camps};if(moves.some(m=>m.kind==='occupation'))scenes.push({id:`arrival-${event.index}`,kind:'arrival',event,battleIndex:event.battleIndex,title:'점령지 도착',worldBefore:frame.before,worldAfter:frame.after,camps:{...camps}});}
 return {scenes,camps};
}
export function captureArrival(record,battle){return record?.events?.find(e=>e.type==='occupation'&&e.battleIndex===battle.index&&record.movements?.some(m=>m.eventIndex===e.index&&m.moves.some(v=>v.kind==='occupation')))||null;}
