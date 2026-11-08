import test from 'node:test';import assert from 'node:assert/strict';
import {IsolatedEvacuation} from '../src/engine/isolated-evacuation.js';
import {nextTurn,restoreRun,engineFor} from '../src/engine/simulation.js';
import {replayTurn} from '../src/engine/replay.js';
import {isolated49Fixture,isolated49Controls} from './isolated-v49-fixture.mjs';
function small({central=false,partial=false,enabled=true,troops=12}={}){
 const owners=[0,1,0,...(partial?[0]:[])],g={slot:0,generation:0,name:'장수',active:true,alive:true,position:2,troops,wins:5},second={...g,slot:1,troops:2};
 const s={isolatedEvacuation:enabled,cells:owners.map((owner,id)=>({id,owner})),countries:[{generals:[g,second],reserve:5,army:troops+7}]};
 const Atlas={cells:owners.map((_,id)=>({neighbors:[id-1,id+1].filter(n=>n>=0&&n<owners.length)}))},events=[];
 const ctx={s,Atlas,rules:{troopRounding:'ten-thousand'},helpers:{capitalCell:()=>central?2:0,syncArmy(c){c.army=c.reserve+c.generals.reduce((n,g)=>n+g.troops,0);}},emit:(type,title,detail,data)=>events.push({type,...data})};
 return {s,g,second,events,e:new IsolatedEvacuation(ctx)};
}
test('isolated evacuation brings one third after battle loss, floors small troops to zero and never transfers losses to reserves',()=>{
 const f=small();f.e.snapshot([0]);f.s.cells[2].owner=1;f.e.finish({index:0});
 assert.equal(f.g.troops,4);assert.equal(f.second.troops,0);assert.equal(f.g.position,0);assert.equal(f.g.wins,5);assert(f.g.alive);assert.equal(f.s.countries[0].reserve,5);assert.equal(f.s.countries[0].army,9);assert.equal(f.events.length,2);
 f.e.finish({index:0});assert.equal(f.g.troops,4);assert.equal(f.events.length,2);
});
test('normal mainland retreat, partial isolated loss and old controls keep their troops',()=>{
 for(const options of [{central:true},{partial:true},{enabled:false}]){const f=small(options);f.e.snapshot([0]);f.s.cells[2].owner=1;f.e.finish({index:0});assert.equal(f.g.troops,12);assert.equal(f.events.length,0);}
 const f=small();f.e.snapshot([0]);f.g.alive=false;f.s.cells[2].owner=1;f.e.finish({index:0});assert.equal(f.g.position,2);assert(!f.events.some(e=>e.slot===0));
});
test('continuous and ordinary engine paths record evacuation after combat; mixed old/new history restores and replays',async()=>{
 for(const continuous of [true,false]){
  const start=isolated49Fixture({continuous}),before=JSON.stringify(start),ctl=isolated49Controls();
  const run=nextTurn(start,ctl),record=run.history.at(-1),events=record.events.filter(e=>e.type==='isolated_return');
  assert.equal(events.length,1);const e=events[0];assert.equal(e.loss.before,4);assert.equal(e.loss.after,1);assert.equal(e.destination,7);
  assert(record.events.findIndex(e=>e.type==='resolve')<e.index);assert.equal(JSON.stringify(start),before);assert(engineFor(run.initialWorld).engine.validState(run.engineState));
  const old=nextTurn(start,{...ctl,isolatedEvacuation:false});assert(!old.history.at(-1).events.some(e=>e.type==='isolated_return'));const oldRecord=old.history.at(-1),retreat=oldRecord.events.find(e=>e.type==='retreat'&&e.nationId==='b'&&e.slot===0);assert.equal(oldRecord.frames[retreat.index].after.people.find(p=>p.id==='b0').troops,4);
  const saved=restoreRun(JSON.parse(JSON.stringify(run)));assert(saved.engineState.isolatedEvacuation);assert.equal((await replayTurn(saved,run.turn)).record.events.find(e=>e.type==='isolated_return').loss.after,1);
  const continued=nextTurn(saved,{rolls:{king:1,minister:1,domestic:1}});assert(continued.engineState.isolatedEvacuation);assert.deepEqual((await replayTurn(continued,1)).record.rolls,start.history[0].rolls);
 }
});
