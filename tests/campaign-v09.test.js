import { PRE_REFORM_COMBAT } from '../src/model/combat-rules.js';
import { LEGACY_ARMY_BANDS } from '../src/model/combat-rules.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { blankWorld,validateWorld } from '../src/model/world.js';
import { createReferenceWorld } from '../src/data/reference-world.js';
import { createRun,nextTurn,engineFor,projectWorld,restoreRun } from '../src/engine/simulation.js';
import { movementFatigue,reinforcementRoom,campaignDefenders } from '../src/engine/campaign-logistics.js';
import { frontierScores } from '../src/engine/frontier.js';
import { replayTurn } from '../src/engine/replay.js';
import { stackUnits } from '../src/ui/unit-stack.js';
import { makeTurnScenes } from '../src/ui/playback.js';

function campaign({cols=4,rows=3,split=4,broken=false}={}){
 const w=blankWorld({rows,cols});Object.assign(w.rules,structuredClone(PRE_REFORM_COMBAT));w.rules.baseCapacity=100;w.rules.armyBands=structuredClone(LEGACY_ARMY_BANDS);w.rules.retreatMode='blocked';w.rules.seaSupply=false;w.rules.expeditionChances=[100,100,100,100,100,100];
 w.countries=['a','b'].map((id,i)=>({id,name:id,color:i?'#006bff':'#ff2028',troops:45,recruitment:0,personality:'balanced'}));
 w.people=w.countries.flatMap(c=>Array.from({length:4},(_,slot)=>({id:c.id+slot,countryId:c.id,name:c.id+slot,role:'general',ability:0,personality:'balanced',slot})));
 w.territories.forEach((t,i)=>t.ownerId=i<split?'a':'b');
 w.cartography={version:1,style:'classic',opacity:.3,background:null,polygons:{},links:Array.from({length:rows*cols-1},(_,i)=>[i,i+1]).filter(p=>!broken||p[0]!==split).map(p=>p.map(i=>'tile-'+i))};
 const r=createRun(validateWorld(w),7),s=r.engineState;
 for(const c of s.countries){c.reserve=5;c.generals.forEach(g=>{g.troops=g.active?20:0;g.stranded=false;});c.army=5+c.generals.reduce((v,g)=>v+g.troops,0);}
 const a=s.countries[0].generals[0];a.position=split-1;a.station=split-1;
 const b=s.countries[1].generals;b[0].position=split;b[0].station=split;if(b[1].active){b[1].position=split;b[1].station=split+4;}
 s.cells.forEach(c=>c.commander=c.id<split?Math.floor(c.id/4):Math.floor((c.id-split)/4));
 r.world=projectWorld(r.initialWorld,s);assert(engineFor(r.initialWorld).engine.validState(s));return r;
}
const war=(extra={})=>({targetId:'b',targetCells:{0:'tile-4'},rolls:{king:10,'expedition:0':1,'attack:0':30,'defense:0':1,'attack:0:1':30,'defense:0:1':1,...extra}});
const domestic=(minister=1)=>({rolls:{king:1,minister,domestic:10,supply_gain:2}});

test('every resident defends separately; attacker carries losses and a later defender can prevent capture',()=>{
 const r=nextTurn(campaign(),war({'attack:0:1':1,'defense:0:1':30})),b=r.history[0].battles;
 assert.equal(b.length,2);assert.equal(b[0].winner,0);assert.equal(b[1].winner,1);assert.equal(b[1].attack.army,b[0].after.attack);
 assert.deepEqual(b.map(v=>v.defenseSlot),[0,1]);assert(b.every(v=>!v.takenCells.length));assert.equal(r.engineState.cells[4].owner,1);
 assert.equal(b[1].defendersTotal,2);assert.equal(b[1].wave,2);
});
test('all defenders must fall before the original 1–3 connected capture budget applies',()=>{
 const r=nextTurn(campaign(),war()),b=r.history[0].battles;assert.equal(b[0].takenCells.length,0);assert.equal(b[1].takenCells.length,3);
 assert.deepEqual(b[1].takenCells,[4,5,6]);assert.equal(b[1].captureLimit,3);assert(b[1].takenCells.every(id=>r.engineState.cells[id].owner===0));
});
test('an additional province with any living enemy commander, including zero troops, blocks automatic expansion',()=>{
 const initial=campaign(),s=initial.engineState,g=s.countries[1].generals[1];g.position=5;g.troops=0;s.countries[1].army=25;initial.world=projectWorld(initial.initialWorld,s);
 const r=nextTurn(initial,war()),b=r.history[0].battles[0];assert.equal(b.captureLimit,3);assert.deepEqual(b.takenCells,[4]);assert.equal(r.engineState.cells[6].owner,1);
});
test('zero-army attackers skip and zero-army residents do not roll a defense duel',()=>{
 const initial=campaign(),s=initial.engineState,a=s.countries[0];a.generals[0].troops=0;a.reserve=5;a.army=5;initial.world=projectWorld(initial.initialWorld,s);
 const r=nextTurn(initial,war());assert.equal(r.history[0].battles.length,0);assert(r.history[0].events.some(e=>e.type==='skip'&&e.detail.includes('0만')));
 const zero=campaign();zero.engineState.countries[1].generals.forEach(g=>g.troops=0);zero.engineState.countries[1].army=5;zero.world=projectWorld(zero.initialWorld,zero.engineState);
 const empty=nextTurn(zero,war()).history[0].battles[0];assert(empty.automatic);assert.deepEqual(empty.takenCells,[4]);
});
test('fatigue is -2 per four movement edges, including returning defenders; it does not stack across defense waves',()=>{
 const r=campaign({rows:2,cols:8,split:8}),s=r.engineState;s.countries[0].generals[0].position=0;s.countries[0].generals[1].troops=0;s.countries[0].army=25;
 s.countries[1].generals[0].position=12;s.countries[1].generals[0].station=8;s.countries[1].generals[1].position=8;r.world=projectWorld(r.initialWorld,s);
 const result=nextTurn(r,{targetId:'b',targetCells:{0:'tile-8'},rolls:{king:10,'expedition:0':1,'attack:0':30,'defense:0':1,'attack:0:1':30,'defense:0:1':1}}),b=result.history[0].battles;
 assert.equal(b.length,2);assert.equal(b[0].attack.movementEdges,7);assert.equal(b[0].attack.fatigueBonus,-2);assert.equal(b[1].attack.fatigueBonus,-2);
 assert.equal(b[1].defense.movementEdges,4);assert.equal(b[1].defense.fatigueBonus,-2);assert.equal(b[1].defense.score,b[1].defense.raw+b[1].defense.bonus);
 assert.deepEqual([0,3,4,7,8,11,12].map(n=>movementFatigue(n,r.initialWorld.rules)),[0,0,-2,-2,-4,-4,-6]);
});
test('defeated defenders retreat over a real route; an enclosed survivor stays stranded instead of teleporting',()=>{
 for(const broken of [false,true]){
  const initial=campaign({broken}),s=initial.engineState;s.countries[1].generals[1].position=8;initial.world=projectWorld(initial.initialWorld,s);
  const r=nextTurn(initial,war({'attack:0':15,'defense:0':10})),g=r.engineState.countries[1].generals[0];assert(g.alive);assert(g.troops>0);
  if(broken){assert(g.stranded);assert.equal(g.position,4);assert.notEqual(g.station,4);assert.equal(r.world.people.find(p=>p.id==='b0').connected,false);}
  else{assert(!g.stranded);assert.equal(r.engineState.cells[g.position].owner,1);assert(r.history[0].movements.some(batch=>batch.moves.some(m=>m.kind==='retreat'&&m.path[0]==='tile-4')));}
  assert(engineFor(r.initialWorld).engine.validState(r.engineState));assert.deepEqual(restoreRun(JSON.parse(JSON.stringify(r))).engineState,r.engineState);
 }
});
test('a no-battle domestic or refused-war turn returns only the acting country along reachable land',()=>{
 for(const controls of [domestic(),war({'expedition:0':100})]){
  const initial=campaign();if(controls.rolls.king===10){initial.initialWorld.rules.expeditionChances.fill(0);}
  const s=initial.engineState;s.countries[0].generals[0].position=0;initial.world=projectWorld(initial.initialWorld,s);
  const r=nextTurn(initial,controls);assert.equal(r.engineState.countries[0].generals[0].position,3);assert.equal(r.engineState.countries[1].generals[1].position,4);
  assert(r.history[0].events.some(e=>e.type==='home_return'));assert(r.history[0].movements.some(m=>m.moves.some(v=>v.kind==='home')));
 }
});
test('recruitment and round production share the national cap including reserves; existing overflow is retained',()=>{
 const initial=campaign(),{engine}=engineFor(initial.initialWorld),s=initial.engineState,c=s.countries[0];c.reserve=19;c.army=39;
 assert.equal(reinforcementRoom(s,0,initial.initialWorld.rules),1);initial.world=projectWorld(initial.initialWorld,s);
 const r=nextTurn(initial,domestic());assert.equal(r.engineState.countries[0].army,40);assert(r.history[0].title.includes('2만 미충원'));
 c.reserve=25;c.army=45;const before=structuredClone(c);const gain=engine.produce(s,0);assert.equal(gain.gain,0);assert.equal(gain.blocked,4);assert.equal(c.army,before.army);
 c.generals[0].troops=20;c.reserve=18;c.army=38;const partial=engine.produce(s,0);assert.equal(partial.gain,2);assert.equal(partial.blocked,2);assert.equal(c.army,40);
});
test('a successful supply policy raises every general limit by 1–3, transferring existing reserves only',()=>{
 for(const value of [1,2,3]){
  const initial=campaign();const r=nextTurn(initial,{rolls:{king:1,minister:10,domestic:10,supply_gain:value}});
  assert.equal(r.engineState.countries[0].supplyBonus,value);assert.equal(r.engineState.countries[0].army,initial.engineState.countries[0].army);
  assert.equal(r.history[0].rolls.find(d=>d.type==='supply_roll').value,value);assert(r.history[0].title.includes('+'+value+'만'));
 }
});
test('residents are unique, then a reachable home commander, with relief used only when home return is blocked',()=>{
 const r=campaign(),s=r.engineState,{engine}=engineFor(r.initialWorld),home=s.countries[1].generals[0];
 home.position=7;const result=campaignDefenders(s,engine.ATLAS,1,4,home,3);assert.deepEqual(result.queue.map(v=>v.general.slot),[1,0]);assert.equal(result.queue[1].path.length-1,3);
});
test('frontier preference fills a nearby concavity before extending a thin spearhead',()=>{
 const cells=Array.from({length:15},(_,id)=>({id,owner:id%5<2||id===7?0:1}));
 const atlas={cells:cells.map(c=>({neighbors:[c.id-5,c.id+5,...(c.id%5?[c.id-1]:[]),...(c.id%5<4?[c.id+1]:[])].filter(i=>i>=0&&i<15)}))};
 const s={cells,countries:[{generals:[]},{generals:[]}]};const scores=frontierScores(s,atlas,0,[2,8,12]);assert.equal(scores.at(-1).id,8);assert(scores[0].own>=2);
});
test('all directly bordering nations remain eligible regardless of connection plans',()=>{
 const w=blankWorld({rows:2,cols:3});w.countries=['a','b','c'].map(id=>({id,name:id,color:'#ff0000',troops:5,recruitment:0,personality:'balanced'}));w.territories.forEach((t,i)=>t.ownerId=['a','b','c','c','a','c'][i]);
 const r=createRun(w,12),{engine}=engineFor(r.initialWorld);assert.deepEqual(engine.campaignOptions(r.engineState,0).candidates,[1,2]);assert.deepEqual(engine.warOpponents(r.engineState,0),[1,2]);
});
test('card stacks expose narrow side strips, keep front tip fixed, cycle and promote the active commander',()=>{
 const markers=Array.from({length:3},(_,slot)=>({territory:{id:'t'},person:{id:'g'+slot,slot},country:{id:'a'},role:'general',point:[100,200]}));
 const stack=stackUnits(markers,{focus:{t:'g1'}});assert.equal(stack.at(-1).person.id,'g1');assert.equal(stack.at(-1).stackOffset,0);assert.deepEqual(stack.at(-1).point,[100,200]);assert.deepEqual(stack.map(v=>v.stackOffset),[48,24,0]);
 assert.equal(stackUnits(markers,{focus:{t:'g1'},battle:{actorId:'a',slot:2}}).at(-1).person.id,'g2');
});
test('new campaigns preserve fatigue, defense waves, retreat/home movements and exact history after save/replay',async()=>{
 let r=createRun(createReferenceWorld(),20261019);const selected=new Map();for(let i=0;i<65&&!r.result;i++){r=nextTurn(r);if([2,19,38,63].includes(r.turn))selected.set(r.turn,r.history.at(-1));}
 const restored=restoreRun(JSON.parse(JSON.stringify(r))),saved=JSON.stringify(restored);
 for(const [turn,record] of selected){const rebuilt=await replayTurn(restored,turn);assert.deepEqual(rebuilt.record.frames,record.frames);assert.deepEqual(rebuilt.record.movements,record.movements);assert.deepEqual(rebuilt.record.battles,record.battles);assert(makeTurnScenes(rebuilt.record,rebuilt.before).length>1);}
 assert.equal(JSON.stringify(restored),saved);assert.deepEqual(nextTurn(restored).engineState,nextTurn(r).engineState);
});
test('v0.8 saved games pin their original rules and replay without advanced campaign changes',async()=>{
 const w=createReferenceWorld();Object.assign(w.rules,structuredClone(PRE_REFORM_COMBAT));w.rules.advancedCampaign=false;let r=createRun(w,135);for(let i=0;i<20;i++)r=nextTurn(r);
 const data=JSON.parse(JSON.stringify(r));data.engineVersion='studio-v11-14';for(const key of ['advancedCampaign','territoryArmyLimit','fatigueStep','fatiguePenalty','supplyGainRange'])delete data.initialWorld.rules[key];
 const restored=restoreRun(data);assert.equal(restored.initialWorld.rules.advancedCampaign,false);assert.equal(restored.initialWorld.rules.fieldCommand,true);assert.deepEqual(nextTurn(restored).engineState,nextTurn(r).engineState);await replayTurn(restored,17);
});
test('small pocket penalties respect sea supply rather than treating every disconnected coastline as enclosed',()=>{
 const s={cells:Array.from({length:6},(_,id)=>({id,owner:id===0?0:1})),countries:[{generals:[]},{generals:[]}]};
 const atlas={cells:[{neighbors:[2,4]},{neighbors:[2]},{neighbors:[0,1,3]},{neighbors:[2,4]},{neighbors:[0,3,5]},{neighbors:[4]}]};
 const supply=(state,owner,start)=>{const queue=[start],seen=new Set(queue);for(let i=0;i<queue.length;i++)for(const v of atlas.cells[queue[i]].neighbors)if(state.cells[v].owner===owner&&!seen.has(v)){seen.add(v);queue.push(v);}return queue;};
 const ranked=frontierScores(s,atlas,0,[2,4],{supply});assert(ranked.every(v=>v.cutPenalty>0));
 const bySea=frontierScores(s,atlas,0,[2,4],{supply:(state,owner)=>state.cells.filter(c=>c.owner===owner).map(c=>c.id)});assert(bySea.every(v=>v.cutPenalty===0));
});
test('national limits also bound isolated production; unused capacity is discarded and not stored',()=>{
 const initial=campaign({broken:true}),{engine}=engineFor(initial.initialWorld),s=initial.engineState,c=s.countries[1];
 c.reserve=37;c.generals[0].troops=20;c.generals[1].troops=20;c.army=77;
 const gain=engine.produce(s,1);assert.equal(c.army,80);assert.equal(gain.gain,3);assert.equal(gain.blocked+gain.discarded,5);assert(gain.isolated.length>0);
 const again=engine.produce(s,1);assert.equal(again.gain,0);assert.equal(c.army,80);
});
test('return-home animation has an explicit destination even when its final camp equals its assigned home',()=>{
 const initial=campaign();initial.engineState.countries[0].generals[0].position=0;initial.world=projectWorld(initial.initialWorld,initial.engineState);
 const r=nextTurn(initial,domestic()),record=r.history[0],batch=record.movements.find(m=>m.moves.some(v=>v.kind==='home'));
 assert.equal(batch.camps.a0.territoryId,'tile-3');assert.equal(batch.camps.a0.homeId,'tile-3');assert.equal(record.campsAfter.a0,undefined);
});
