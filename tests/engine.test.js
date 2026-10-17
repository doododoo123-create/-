import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoWorld } from '../src/data/demo-world.js';
import { blankWorld,clone } from '../src/model/world.js';
import { createRun,nextTurn,engineFor,currentActor,casualty } from '../src/engine/simulation.js';
import { referenceEngine,plain } from './reference-helper.js';
const G=referenceEngine();
function comparable(state){return {...plain(state),history:[]};}
let comparedTurns=0;
for(const seed of [0,1,123456,20261017,4294967295])test(`unchanged HTML parity: seed ${seed}, complete 100-round campaign`,()=>{
  const world=createDemoWorld();world.rules.roundLimit=100;
  let actual=createRun(world,seed),expected=G.createGame({seed,roundLimit:100});
  assert.deepEqual(plain(actual.engineState),plain(expected));
  for(let i=0;i<700&&!expected.result;i++){
    const ref=G.prepareTurn(expected);actual=nextTurn(actual);expected=ref.state;
    assert.deepEqual(plain(actual.referenceRecord),plain(ref.record),`raw events/dice/battles turn ${i+1}`);
    assert.deepEqual(comparable(actual.engineState),comparable(expected),`armies/regions/stations/capitals/RNG turn ${i+1}`);
    assert.ok(engineFor(actual.initialWorld).engine.validState(actual.engineState));comparedTurns++;
  }
  assert.ok(expected.result);assert.ok(actual.result);
  assert.deepEqual(actual.result.winnerIds,plain(expected.result.winners).map(i=>world.countries[i].id));
});
test('forced choices preserve reference RNG, three domestic actions and all general attacks',()=>{
  for(const controls of [
    {rolls:{king:1,minister:1,domestic:10}},
    {rolls:{king:1,minister:5,domestic:10}},
    {rolls:{king:1,minister:10,domestic:10}},
    {rolls:{king:10,'attack:0':10,'defense:0':1,'death:0':1},targetId:1},
  ]){
    let actual=createRun(createDemoWorld(),123456),expected=G.createGame({seed:123456,roundLimit:30});
    const ref=G.prepareTurn(expected,controls);actual=nextTurn(actual,controls);
    assert.deepEqual(plain(actual.referenceRecord),plain(ref.record));
    assert.deepEqual(comparable(actual.engineState),comparable(ref.state));
  }
});
test('initial forces are capital reserves plus separate capped garrisons and reserve candidates',()=>{
  const r=createRun(createDemoWorld(),123456),e=engineFor(r.initialWorld).engine;
  assert.equal(r.world.people.filter(p=>p.role==='general'&&p.active).length,22);
  assert.equal(r.world.people.filter(p=>p.role==='general'&&!p.active).length,13);
  for(const c of r.engineState.countries){assert.equal(c.reserve,5);assert.equal(e.totalArmy(c),10);for(const g of c.generals){assert.ok(g.troops<=e.capacity(c,g));assert.ok(r.engineState.cells.filter(t=>t.owner===c.id&&t.commander===g.slot).length<=4);}}
});
test('three-turn successor delay, disconnected production and resupply match original routines',()=>{
  const original=G.createGame({seed:19,roundLimit:30});
  // Remove one dead active officer and age it to the exact appointment boundary.
  const actor=G.currentActor(original),g=original.countries[actor].generals[0];g.alive=false;g.troops=0;g.waited=2;original.countries[actor].army=G.totalArmy(original.countries[actor]);
  let run=createRun(createDemoWorld(),19);run.engineState=plain(original);
  for(let i=0;i<9;i++){const a=G.prepareTurn(original);run=nextTurn(run);Object.assign(original,a.state);assert.deepEqual(plain(run.referenceRecord),plain(a.record));assert.deepEqual(comparable(run.engineState),comparable(original));}
  const core=engineFor(run.initialWorld).engine;
  for(let id=0;id<7;id++){
    const a=plain(original),b=plain(original);assert.deepEqual(plain(core.produce(a,id)),plain(G.produce(b,id)));assert.deepEqual(a,b);
  }
});
function smallWorld(){const w=blankWorld({rows:2,cols:2});w.countries=['a','b'].map((id,i)=>({id,name:id,color:i?'#445566':'#112233',troops:10,recruitment:0,personality:'balanced'}));w.territories.forEach((t,i)=>t.ownerId=i<2?'a':'b');return w;}
test('editable grid worlds use the same unit system and preserve caller state',()=>{
  const w=smallWorld(),r=createRun(w,7),snapshot=clone(r),before=clone(w),n=nextTurn(r);
  assert.deepEqual(r,snapshot);assert.deepEqual(w,before);assert.equal(n.turn,1);assert.ok(currentActor(n)||n.result);
  assert.equal(n.engineState.countries.length,2);
});
test('unassigned land and invalid numeric seeds are reported rather than inventing rules',()=>{
  const w=smallWorld();w.territories[0].ownerId=null;assert.throws(()=>createRun(w),/미배정 영토/);
  for(const seed of ['abc',-1,4294967296,1.5])assert.throws(()=>createRun(smallWorld(),seed),/시드/);
  w.territories.forEach(t=>t.ownerId='a');assert.throws(()=>createRun(w),/2개 이상/);
});
test('loss calculation uses half-up rounding, minimum one and simultaneous unit strength',()=>{
  for(const [own,enemy] of [[1,1],[20,12],[12,20],[1,1000000],[0,10]])for(const [result,rate] of [['win',.3],['draw',.4],['loss',.5]])assert.equal(casualty(own,enemy,rate),G.casualty(own,enemy,result).amount);
});
test.after(()=>console.log(`Original HTML compared turn by turn: ${comparedTurns} completed turns across 5 full campaigns.`));

test('isolated region produces locally, discards overflow and cannot borrow capital reserve',()=>{
 const s=G.createGame({seed:19});s.cells[79].owner=0;G.reconcile(s);
 const core=engineFor(createRun(createDemoWorld(),19).initialWorld).engine;
 const parts=G.landComponents(s,0);assert.equal(parts.length,2);
 const slot=s.cells[79].commander,g=s.countries[0].generals[slot];assert.equal(g.station,79);g.troops=G.capacity(s.countries[0],g);s.countries[0].army=G.totalArmy(s.countries[0]);
 const a=plain(s),b=plain(s),actual=core.produce(a,0),expected=G.produce(b,0);assert.deepEqual(plain(actual),plain(expected));assert.deepEqual(a,b);assert.equal(actual.discarded,1);assert.equal(actual.isolated[0].produced,1);
 const old=a.countries[0].generals[slot].troops;core.distribute(a,0);assert.equal(a.countries[0].generals[slot].troops,old);
});
test('round limit produces before ranking, without a conquest event',()=>{
 let r=createRun({...createDemoWorld(),rules:{...createDemoWorld().rules,roundLimit:1}},123456),s=G.createGame({seed:123456,roundLimit:1});
 for(let i=0;i<7;i++){const ctl={rolls:{king:1,minister:1,domestic:1}},ref=G.prepareTurn(s,ctl);r=nextTurn(r,ctl);s=ref.state;assert.deepEqual(plain(r.referenceRecord),plain(ref.record));assert.deepEqual(comparable(r.engineState),comparable(s));}
 assert.equal(r.result.reason,'limit');const events=r.history.at(-1).events;assert.ok(events.findIndex(e=>e.type==='round_end')<events.findIndex(e=>e.type==='finish'));assert.deepEqual(r.result.winnerIds,['nation-0']);
});
