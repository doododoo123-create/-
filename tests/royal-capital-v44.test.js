import test from 'node:test';
import assert from 'node:assert/strict';
import {createContinentV31World} from '../src/scenarios/continent-v31.js';
import {enableOfficerTraits} from '../src/model/officer-traits.js';
import {createRun,nextTurn,engineFor,restoreRun} from '../src/engine/simulation.js';
import {replayTurn} from '../src/engine/replay.js';
import {runSaveData} from '../src/storage/run-store.js';

const legacy={armyAssembly:true,armyFormation:true,unitSpacing:true,frontOperations:true,directArmyRelease:true};
const corrected={...legacy,royalCapitalSync:true};
function guardState(run){
 const engine=engineFor(run.initialWorld).engine;
 assert(engine.validState(run.engineState));
 for(const c of run.engineState.countries){
  const king=c.royal;
  if(king?.active&&king.alive){
   assert.equal(king.position,engine.capitalCell(run.engineState,c.id));
   assert.equal(king.station,king.position);
  }
 }
}

for(const [seed,beforeFailure] of [[20261017,115],[123456,177]]){
 test(`seed ${seed}: resume the original stopped campaign, retain old replay and cross turns 255/256`,async()=>{
  let run=createRun(enableOfficerTraits(createContinentV31World()),seed);
  while(run.turn<beforeFailure)run=nextTurn(run,legacy);
  const saved=runSaveData(run),past=JSON.stringify(saved),oldState=structuredClone(run.engineState);
  assert.throws(()=>nextTurn(run,legacy),/턴 처리 뒤 규칙 상태가 일치하지 않습니다/);
  run=nextTurn(restoreRun(saved),corrected);
  assert.equal(run.turn,beforeFailure+1);
  guardState(run);
  assert.equal(JSON.stringify(saved),past);
  assert.deepEqual(saved.engineState,oldState);
  assert.equal(JSON.stringify(run.history.slice(0,beforeFailure)),JSON.stringify(saved.history));
  assert.equal(run.history.at(-1).controls.royalCapitalSync,true);
  const returns=run.history.at(-1).events.filter(e=>e.type==='royal_return');
  assert(returns.length>=2,'the relocated capital also needs a recorded royal return');
  for(const event of returns){
   assert.equal(event.role,'king');
   assert.equal(event.moves[0].path.at(-1),event.destination);
  }
  const replay=await replayTurn(run,run.turn,{yieldFrame:()=>Promise.resolve()});
  assert.deepEqual(replay.record.events,run.history.at(-1).events);
  assert.equal(replay.after.countries.find(c=>c.id===returns.at(-1).nationId).capitalId,
   run.world.countries.find(c=>c.id===returns.at(-1).nationId).capitalId);
  const boundaries=[];
  while(run.turn<320&&!run.result){
   run=nextTurn(run,corrected);
   guardState(run);
   if([255,256].includes(run.turn)){
    const restored=restoreRun(runSaveData(run));
    assert.deepEqual(restored.engineState,run.engineState);
    assert.deepEqual(nextTurn(restored,corrected).engineState,nextTurn(run,corrected).engineState);
    boundaries.push(run.turn);
   }
  }
  assert(run.turn>=256||run.result?.reason==='unification');
  if(run.turn>=256)assert.deepEqual(boundaries,[255,256]);
  const restored=restoreRun(runSaveData(run));
  assert.deepEqual(restored.engineState,run.engineState);
  console.log(JSON.stringify({seed,resumedFrom:beforeFailure,finalTurn:run.turn,boundaries,result:run.result}));
 });
}

test('the repair is a validated per-order control and never changes a legacy order',()=>{
 const run=createRun(enableOfficerTraits(createContinentV31World()),20261017);
 assert.throws(()=>nextTurn(run,{...legacy,royalCapitalSync:'true'}),/설정이 올바르지 않습니다/);
 const original=nextTurn(run,legacy),off=nextTurn(run,{...legacy,royalCapitalSync:false});
 assert.deepEqual(off.engineState,original.engineState);
 assert.deepEqual(off.history[0].events,original.history[0].events);
 assert.equal(original.history[0].controls.royalCapitalSync,undefined);
});
