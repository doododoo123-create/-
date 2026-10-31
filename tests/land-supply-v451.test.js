import test from 'node:test';import assert from 'node:assert/strict';
import {createDemoWorld} from '../src/data/demo-world.js';
import {generatedWorld} from '../src/model/free-map.js';
import {validateWorld} from '../src/model/world.js';
import {landSupplyWorld} from '../src/model/land-supply.js';
import {createRun,nextTurn,engineFor,restoreRun} from '../src/engine/simulation.js';
import {runSaveData} from '../src/storage/run-store.js';
import {exportHistoryData,prepareFileImport} from '../src/storage/history-file.js';
import {replayTurn} from '../src/engine/replay.js';
const domestic={rolls:{king:1,minister:1,domestic:1}};
function supplyWorld(){const rect=(x,y)=>({points:[[x,y],[x+200,y],[x+200,y+200],[x,y+200]],center:[x+100,y+100]}),shapes=Array.from({length:15},(_,i)=>rect(100+i%5*200,100+Math.floor(i/5)*200)),links=[];for(let i=0;i<15;i++){if(i%5<4)links.push([i,i+1]);if(i<10)links.push([i,i+5]);}const w=generatedWorld(createDemoWorld(),shapes,links,null);w.rules.seaSupply=true;w.territories.forEach((t,i)=>t.ownerId=[0,2,8,14].includes(i)?'nation-0':'nation-1');w.countries[0].capitalId=w.territories[0].id;return validateWorld(w);}
test('new editor worlds disable sea supply without changing any world content or military maintenance settings',()=>{const w=supplyWorld(),before=JSON.stringify(w),n=landSupplyWorld(w);assert.equal(n.rules.seaSupply,false);assert.equal(JSON.stringify(w),before);assert.deepEqual({...n,rules:w.rules},w);assert.equal(n.rules.territoryArmyLimit,w.rules.territoryArmyLimit);assert.equal(n.rules.desertionRate,w.rules.desertionRate);});
test('existing sea supply ends only at the recorded new order; coasts become local supply and no stored past is rewritten',async()=>{
 let run=createRun(supplyWorld(),123456);run=nextTurn(run,domestic);const past=JSON.stringify(run.history),initial=JSON.stringify(run.initialWorld),e=engineFor(run.initialWorld).engine;assert.deepEqual(e.connectedSupply(run.engineState,0,0).sort((a,b)=>a-b),[0,2,14]);
 const next=nextTurn(run,{...domestic,landSupplyOnly:true});assert.equal(JSON.stringify(next.history.slice(0,1)),past);assert.equal(JSON.stringify(next.initialWorld),initial);assert.equal(next.initialWorld.rules.seaSupply,true);assert.equal(next.world.rules.seaSupply,false);assert.equal(next.engineState.landSupplyOnly,true);assert.deepEqual(e.connectedSupply(next.engineState,0,0),[0]);assert.deepEqual(e.supplyComponents(next.engineState,0).map(p=>p.length).sort(),[1,1,1,1]);
 const replay=await replayTurn(next,1);assert.equal(replay.after.rules.seaSupply,true);const second=await replayTurn(next,2);assert.equal(second.after.rules.seaSupply,false);assert.deepEqual(second.record.battles,next.history[1].battles);
 const restored=restoreRun(runSaveData(next));assert.equal(restored.world.rules.seaSupply,false);assert.deepEqual(nextTurn(restored,domestic).engineState,nextTurn(next,domestic).engineState);const imported=await prepareFileImport(await exportHistoryData(next));assert.deepEqual(imported.run.engineState,next.engineState);
 const unsigned=await exportHistoryData(next);delete unsigned.integrity;assert.deepEqual((await prepareFileImport(unsigned)).run.engineState,next.engineState);
 const continued=nextTurn(next,domestic);assert.equal(continued.world.rules.seaSupply,false);assert.equal(continued.engineState.landSupplyOnly,true);
});
test('35 and earlier orders keep sea connectivity, and malformed supply control/state are rejected',()=>{const r=createRun(supplyWorld(),7),old=nextTurn(r,domestic),restored=restoreRun({...runSaveData(old),engineVersion:'studio-v11-35'});assert.equal(restored.world.rules.seaSupply,true);assert.equal(nextTurn(restored,domestic).engineState.landSupplyOnly,undefined);assert.throws(()=>nextTurn(r,{landSupplyOnly:'false'}));const bad=runSaveData(r);bad.engineState.landSupplyOnly='false';assert.throws(()=>restoreRun(bad));});
