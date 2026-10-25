import { createRun, nextTurn, removeRunLimit } from './simulation.js';
const replayCaches=new WeakMap();
const replayFingerprint=r=>JSON.stringify({actor:r.actorId,rolls:r.rolls.map(d=>[d.value,d.sides,d.attempts]),battles:r.battles.map(b=>[b.actorId,b.defenderId,b.territoryId,b.winner,b.attack.raw,b.attack.score,b.defense.raw,b.defense.score,b.losses?.attack.amount,b.losses?.defense.amount,b.takenTerritoryIds]),changes:r.changes,movements:r.events.filter(e=>e.moves).map(e=>[e.type,e.moves,e.stranded]),field:r.battles.map(b=>[b.regionSlot,b.returnBlocked,b.relief,b.moves,b.wave,b.defendersTotal,b.attack.fatigueBonus,b.defense.fatigueBonus])});
// Rebuild a separate campaign with its original rules/seed. Never advance or save the live campaign.
export async function replayTurn(run,turn,{yieldFrame=()=>new Promise(r=>setTimeout(r,0)),cancelled=()=>false}={}){
 if(!Number.isInteger(turn)||turn<1||turn>run.history.length)throw new Error('재생할 턴을 확인해 주세요.');
 if(!replayCaches.has(run.initialWorld))replayCaches.set(run.initialWorld,new Map());const cache=replayCaches.get(run.initialWorld);
 const key=`${run.seed}:${turn}`;if(cache.has(key))return cache.get(key);
 let rebuilt=createRun(run.initialWorld,run.seed);
 for(const [k,value] of cache)if(typeof k==='string'&&k.startsWith(`${run.seed}:checkpoint:`)&&value.turn<turn&&value.turn>rebuilt.turn)rebuilt=value;
 let result;
 while(rebuilt.turn<turn){
  if(cancelled())throw new Error('기록 재생을 취소했습니다.');
  if(run.limitRemovedAt===rebuilt.turn)rebuilt=removeRunLimit(rebuilt);
  const before=rebuilt.world,next=nextTurn(rebuilt,run.history[rebuilt.turn]?.controls),record=next.history.at(-1);
  if(replayFingerprint(record)!==replayFingerprint(run.history[rebuilt.turn]))throw new Error(`${next.turn}턴의 저장된 판정과 복원 결과가 다릅니다. 현재 경기는 그대로 보존했습니다.`);
  result={before,after:next.world,record};rebuilt={...next,history:[],referenceRecord:null};
  if(rebuilt.turn%20===0){cache.set(`${run.seed}:checkpoint:${rebuilt.turn}`,rebuilt);await yieldFrame();}
 }
 if(cancelled())throw new Error('기록 재생을 취소했습니다.');cache.set(key,result);
 // Bound transient frame caches; lightweight periodic checkpoints are retained.
 const views=[...cache.keys()].filter(k=>!k.includes(':checkpoint:'));if(views.length>8)cache.delete(views[0]);
 return result;
}
