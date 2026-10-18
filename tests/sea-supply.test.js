import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoWorld } from '../src/data/demo-world.js';
import { createReferenceWorld } from '../src/data/reference-world.js';
import { validateWorld, neighbors } from '../src/model/world.js';
import { generatedWorld } from '../src/model/free-map.js';
import { seaSupplyPorts } from '../src/model/sea-supply.js';
import { geometryFor, designedBorders } from '../src/model/cartography-geometry.js';
import { createRun, nextTurn, engineFor, restoreRun } from '../src/engine/simulation.js';
const rect=(x,y,w,h)=>({points:[[x,y],[x+w,y],[x+w,y+h],[x,y+h]],center:[x+w/2,y+h/2]});
function supplyFixture(enabled=true){
 const shapes=Array.from({length:15},(_,i)=>rect(100+i%5*200,100+Math.floor(i/5)*200,200,200)),links=[];
 for(let i=0;i<15;i++){if(i%5<4)links.push([i,i+1]);if(i<10)links.push([i,i+5]);}
 const w=generatedWorld(createDemoWorld(),shapes,links,null);w.rules.seaSupply=enabled;w.territories.forEach((t,i)=>t.ownerId=[0,2,8,14].includes(i)?'nation-0':'nation-1');w.countries[0].capitalId=w.territories[0].id;return validateWorld(w);
}
test('open sea supplies disconnected coasts; an enemy-surrounded inland enclave stays isolated',()=>{
 const w=supplyFixture(),run=createRun(w,123456),{engine}=engineFor(run.initialWorld),s=run.engineState,ports=seaSupplyPorts(w);
 assert.deepEqual(ports[0],ports[2]);assert(ports[14].length);assert.deepEqual(ports[8],[]);
 assert.deepEqual(engine.connectedSupply(s,0,0).sort((a,b)=>a-b),[0,2,14]);assert.deepEqual(engine.connectedLand(s,0,0),[0]);
 const g=s.countries[0].generals[0];g.station=2;assert(engine.capitalConnected(s,0,0));g.station=8;assert(!engine.capitalConnected(s,0,0));
});
test('sea route changes real capital production, reinforcement distribution and discarded isolated output',()=>{
 for(const enabled of [false,true]){
  const run=createRun(supplyFixture(enabled),123456),{engine}=engineFor(run.initialWorld),s=run.engineState,c=s.countries[0];c.generals.forEach(g=>g.troops=0);c.generals[0].station=2;c.reserve=5;c.extraRecruitment=2;
  const gain=engine.produce(s,0);assert.equal(gain.centralGain,enabled?5:3);assert.equal(c.generals[0].troops,enabled?5:1);assert.equal(gain.discarded,enabled?1:2);assert.equal(c.reserve,enabled?5:8);
 }
});
test('supply never adds attack neighbors or moves a commander across water',()=>{
 const w=supplyFixture(),old=supplyFixture(false),a=createRun(w,12),b=createRun(old,12),ea=engineFor(a.initialWorld).engine,eb=engineFor(b.initialWorld).engine;
 a.engineState.countries[0].generals[0].station=0;b.engineState.countries[0].generals[0].station=0;
 assert.deepEqual(ea.targets(a.engineState,0,0),eb.targets(b.engineState,0,0));assert.deepEqual(ea.targets(a.engineState,0,0),[1,5]);
 for(const t of w.territories)assert.deepEqual(neighbors(w,t),neighbors(old,t));
});
test('closed inland lake gives no sea passage; separate seas remain separate',()=>{
 const lake=generatedWorld(createDemoWorld(),[{...rect(100,100,1000,600),center:[150,150],holes:[rect(300,250,600,300).points]},rect(400,350,100,100)],[],null);
 const ports=seaSupplyPorts(lake);assert(ports[0].length);assert.deepEqual(ports[1],[]);
 const divided=generatedWorld(createDemoWorld(),[rect(590,0,20,800),rect(100,300,200,200),rect(900,300,200,200)],[],null),p=seaSupplyPorts(divided);assert(p[1].length&&p[2].length);assert(!p[1].some(id=>p[2].includes(id)));
});
test('conquest changes supply reach without changing water geometry',()=>{
 const run=createRun(supplyFixture(),99),{engine}=engineFor(run.initialWorld),s=run.engineState;assert(!engine.connectedSupply(s,0,0).includes(8));s.cells[2].owner=1;assert(!engine.connectedSupply(s,0,0).includes(2));s.cells[2].owner=0;s.cells[3].owner=0;assert(engine.connectedSupply(s,0,0).includes(8));
});
test('new reference campaigns use sea supply and remain deterministic after restore; legacy runs stay land-only',()=>{
 const world=createReferenceWorld();assert(world.rules.seaSupply);assert.equal(createDemoWorld().rules.seaSupply,false);
 let run=createRun(world,9123);for(let i=0;i<10;i++)run=nextTurn(run);const restored=restoreRun(JSON.parse(JSON.stringify(run)));assert.deepEqual(nextTurn(restored).engineState,nextTurn(run).engineState);
 let old=createRun(createDemoWorld(),123456);for(let i=0;i<3;i++)old=nextTurn(old);const saved=JSON.parse(JSON.stringify(old));saved.engineVersion='studio-v11-11';delete saved.initialWorld.rules.seaSupply;
 const legacy=restoreRun(saved);assert.equal(legacy.initialWorld.rules.seaSupply,false);assert.deepEqual(nextTurn(legacy).engineState,nextTurn(old).engineState);
 const invalid=structuredClone(world);invalid.rules.seaSupply='true';assert.throws(()=>validateWorld(invalid),/해상 보급/);
});
test('shared border includes both owners while internal same-country seams disappear',()=>{
 const w=supplyFixture(),edges=designedBorders(w,geometryFor(w)),on=edges.filter(e=>e.path==='M300,100 L300,300'||e.path==='M300,300 L300,100');assert.equal(on.length,2);assert.deepEqual(new Set(on.map(e=>e.ownerId)),new Set(['nation-0','nation-1']));
 const neutral=structuredClone(w);neutral.territories.forEach(t=>t.ownerId=null);assert(!designedBorders(neutral,geometryFor(neutral)).some(e=>e.path==='M300,100 L300,300'||e.path==='M300,300 L300,100'));
});

test('an inland capital uses a friendly coast and loses sea supply if that corridor falls',()=>{
 const w=supplyFixture();w.territories[3].ownerId='nation-0';w.countries[0].capitalId=w.territories[8].id;
 const run=createRun(w,17),{engine}=engineFor(run.initialWorld),s=run.engineState;assert(engine.connectedSupply(s,0,8).includes(14));s.cells[3].owner=1;assert.deepEqual(engine.connectedSupply(s,0,8),[8]);
});
test('a retired commander on a supplied island returns remaining troops to the capital reserve',()=>{
 for(const enabled of [false,true]){const run=createRun(supplyFixture(enabled),23),{engine}=engineFor(run.initialWorld),s=run.engineState,c=s.countries[0],g=c.generals[1],before=c.reserve;g.active=true;g.alive=true;g.station=14;g.troops=7;engine.reconcile(s);assert.equal(c.reserve,before+(enabled?7:0));assert.equal(g.troops,0);assert.equal(g.active,false);}
});
