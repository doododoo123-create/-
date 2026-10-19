import test from 'node:test';
import assert from 'node:assert/strict';
import { blankWorld,validateWorld } from '../src/model/world.js';
import { createRun,nextTurn,engineFor,projectWorld,restoreRun } from '../src/engine/simulation.js';
import { createReferenceWorld } from '../src/data/reference-world.js';
import { ADDITIVE_COMBAT_DEFAULTS,combatCasualties } from '../src/model/combat-rules.js';
import { fieldPaths,expeditionChance,fieldDefense } from '../src/engine/field-command.js';
import { replayTurn } from '../src/engine/replay.js';
function setup({relief=false,bridge=false,position=3}={}){
 const w=blankWorld({rows:3,cols:4});w.rules.baseCapacity=100;
 w.countries=['a','b'].map(id=>({id,name:id,color:id==='a'?'#ff0000':'#0000ff',troops:35,recruitment:0,personality:'balanced'}));
 w.people=['a','b','b'].map((id,i)=>({id:'g'+i,countryId:id,name:'장군'+i,role:'general',ability:0,personality:'balanced',slot:i===2?1:0}));
 w.territories.forEach((t,i)=>t.ownerId=i<4?'a':'b');
 w.cartography={version:1,style:'classic',opacity:.3,background:null,polygons:{},links:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[8,9],[9,10],[10,11],...(bridge?[[7,8]]:[])].map(p=>p.map(i=>'tile-'+i))};
 const run=createRun(validateWorld(w),7),s=run.engineState,a=s.countries[0].generals[0],b=s.countries[1].generals;
 a.station=3;a.position=position;b[0].station=4;b[0].position=8;b[1].station=8;b[1].position=relief?5:9;
 s.cells.forEach(c=>c.commander=c.id<8?0:1);run.world=projectWorld(run.initialWorld,s);assert(engineFor(run.initialWorld).engine.validState(s));return run;
}
const controls=(extra={})=>({targetId:'b',targetCells:{0:'tile-4'},rolls:{king:10,'expedition:0':1,'attack:0':30,'defense:0':1,...extra}});
test('blocked home return with no reachable relief gives one unopposed territory, no battle dice/XP or absent-unit losses',()=>{
 const initial=setup(),g=initial.engineState.countries[1].generals[0],r=nextTurn(initial,controls()),b=r.history[0].battles[0];
 assert.equal(b.returnBlocked,true);assert.equal(b.relief,false);assert.equal(b.automatic,true);assert.equal(b.takenCells.length,1);assert.equal(r.engineState.countries[1].generals[0].troops,g.troops);assert.equal(r.engineState.countries[1].generals[0].position,8);assert.equal(r.engineState.countries[0].generals[0].wins,0);assert(!r.history[0].rolls.some(d=>d.label.includes('공격 주사위')));
});
test('a nearby reachable allied commander fights instead and conquest still uses the original defended region',()=>{
 const initial=setup({relief:true}),homeArmy=initial.engineState.countries[1].generals[0].troops,r=nextTurn(initial,controls()),record=r.history[0],b=record.battles[0];
 assert.equal(b.returnBlocked,true);assert.equal(b.relief,true);assert.equal(b.defenseSlot,1);assert.equal(b.regionSlot,0);assert.equal(b.automatic,false);assert.equal(b.defense.army,initial.engineState.countries[1].generals[1].troops);assert.equal(b.takenCells.length,3);assert(b.takenCells.every(i=>i>=4&&i<8));assert.equal(r.engineState.countries[1].generals[0].troops,homeArmy);
 const move=record.movements[0].moves.find(m=>m.kind==='relief');assert.deepEqual(move.path,['tile-5','tile-4']);assert.equal(record.frames[move?record.movements[0].eventIndex:0].after.people.find(p=>p.id==='g2').positionId,'tile-4');
});
test('an intact return route lets the original commander return, without substituting a relief unit',()=>{
 const r=nextTurn(setup({relief:true,bridge:true}),controls()),b=r.history[0].battles[0];assert.equal(b.returnBlocked,false);assert.equal(b.relief,false);assert.equal(b.defenseSlot,0);assert(r.history[0].movements[0].moves.some(m=>m.kind==='return'&&m.path[0]==='tile-8'&&m.toId==='tile-4'));
});
test('distance selects one target and one seeded dispatch roll; refusal leaves the commander in place',()=>{
 const initial=setup({position:0}),r=nextTurn(initial,controls({'expedition:0':56})),e=r.history[0].events.find(e=>e.type==='expedition_roll');assert.equal(e.distance,4);assert.equal(e.chance,55);assert.equal(e.accepted,false);assert.equal(r.history[0].battles.length,0);assert.equal(r.engineState.countries[0].generals[0].position,0);assert.equal(r.history[0].events.filter(e=>e.type==='expedition_roll').length,1);
 const accepted=nextTurn(initial,controls({'expedition:0':55}));assert.equal(accepted.history[0].battles.length,1);assert.deepEqual(accepted.history[0].movements[0].moves.find(m=>m.kind==='outbound').path,['tile-0','tile-1','tile-2','tile-3']);assert.equal(accepted.engineState.countries[0].generals[0].position,3);
 assert.deepEqual([1,2,3,4,5,6,20].map(d=>expeditionChance(d,ADDITIVE_COMBAT_DEFAULTS)),[100,85,70,55,40,25,25]);
});
test('friendly routes cannot cross enemy land or use the separate sea supply network',()=>{
 const r=setup(),{engine}=engineFor(r.initialWorld);assert(!fieldPaths(r.engineState,engine.ATLAS,1,8).has(4));r.engineState.cells[7].owner=0;assert(!fieldPaths(r.engineState,engine.ATLAS,1,8).has(7));
});
test('losses are rounded once to whole ten-thousands including zero, half-up boundaries and a zero-army death judgment',()=>{
 const rules=ADDITIVE_COMBAT_DEFAULTS;assert.equal(combatCasualties(30,1,'win',20,rules).amount,0);assert.equal(combatCasualties(30,10,'win',20,rules).amount,1);assert.equal(combatCasualties(1,30,'loss',20,rules).amount,1);assert.equal(combatCasualties(10,10,'draw',0,rules).amount,2);
});
test('saved new campaigns reconstruct authoritative positions, dispatch decisions, movements and integer armies',async()=>{
 let r=createRun(createReferenceWorld(),123456);const selected={};for(let i=0;i<45&&!r.result;i++){r=nextTurn(r);assert(engineFor(r.initialWorld).engine.validState(r.engineState));assert(r.engineState.countries.every(c=>Number.isInteger(c.army)&&c.generals.every(g=>Number.isInteger(g.troops))));if([2,17,39].includes(r.turn))selected[r.turn]=r.history.at(-1);}
 const saved=JSON.stringify(r),restored=restoreRun(JSON.parse(saved));for(const [turn,record] of Object.entries(selected)){const replay=await replayTurn(restored,Number(turn));assert.deepEqual(replay.record.movements,record.movements);assert.deepEqual(replay.record.frames,record.frames);}assert.equal(JSON.stringify(r),saved);assert.deepEqual(nextTurn(r).engineState,nextTurn(restored).engineState);
});
test('v0.7 saved D30 campaigns keep soldier precision and visual-only camps on restoration and future turns',async()=>{
 const w=createReferenceWorld();w.rules.fieldCommand=false;w.rules.troopRounding='soldier';let r=createRun(w,77);for(let i=0;i<8;i++)r=nextTurn(r);const data=JSON.parse(JSON.stringify(r));data.engineVersion='studio-v11-13';delete data.initialWorld.rules.fieldCommand;delete data.initialWorld.rules.troopRounding;
 const restored=restoreRun(data);assert.equal(restored.initialWorld.rules.fieldCommand,false);assert.equal(restored.initialWorld.rules.troopRounding,'soldier');assert.deepEqual(nextTurn(restored).engineState,nextTurn(r).engineState);await replayTurn(restored,4);
});
test('relief includes exactly three friendly steps and excludes disconnected candidates',()=>{
 const initial=setup({relief:true}),{engine}=engineFor(initial.initialWorld),s=initial.engineState;
 const defender=s.countries[1].generals[0],helper=s.countries[1].generals[1];helper.position=7;
 const exact=engine.prepareTurn(s,{targetId:1,targetCells:{0:4},rolls:controls().rolls}).record.battles[0];assert.equal(exact.relief,true);assert.equal(exact.moves.find(m=>m.kind==='relief').path.length-1,3);
 const copy=structuredClone(s);copy.countries[1].generals[1].position=8;const outside=engine.prepareTurn(copy,{targetId:1,targetCells:{0:4},rolls:controls().rolls}).record.battles[0];assert.equal(outside.relief,false);assert.equal(outside.automatic,true);
 assert.equal(defender.position,8);
});

test('relief excludes four-step routes and selects the nearest helper, breaking ties by slot',()=>{
 const atlas={cells:[{neighbors:[1]},{neighbors:[0,2]},{neighbors:[1,3]},{neighbors:[2,4]},{neighbors:[3]},{neighbors:[]}]};
 const g=(slot,position)=>({slot,position,station:0,active:true,alive:true,troops:1});const home=g(0,5),far=g(1,4),near=g(2,1),tie=g(3,1);
 const state={cells:atlas.cells.map((_,id)=>({id,owner:0})),countries:[{generals:[home,far]}]};assert.equal(fieldDefense(state,atlas,0,home,3).available,false);far.position=3;assert.equal(fieldDefense(state,atlas,0,home,3).general,far);state.countries[0].generals.push(tie,near);assert.equal(fieldDefense(state,atlas,0,home,3).general,near);
});
