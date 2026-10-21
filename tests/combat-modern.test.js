import { PRE_REFORM_COMBAT } from '../src/model/combat-rules.js';
import { LEGACY_ARMY_BANDS } from '../src/model/combat-rules.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { blankWorld,validateWorld } from '../src/model/world.js';
import { ADDITIVE_COMBAT_DEFAULTS,armyRatioBonus,combatBonuses,combatCasualties } from '../src/model/combat-rules.js';
import { createReferenceWorld } from '../src/data/reference-world.js';
import { createDemoWorld } from '../src/data/demo-world.js';
import { createRun,nextTurn,engineFor,restoreRun } from '../src/engine/simulation.js';
import { replayTurn } from '../src/engine/replay.js';
import { makeTurnScenes } from '../src/ui/playback.js';
const rules={...ADDITIVE_COMBAT_DEFAULTS,experienceWinStep:1,experienceCap:9,...structuredClone(PRE_REFORM_COMBAT),armyBands:structuredClone(LEGACY_ARMY_BANDS),fieldCommand:false,troopRounding:'soldier'};
function fixture({cols=2,a=35,b=6,terrain='plain'}={}){
 const w=blankWorld({rows:2,cols});w.rules={...w.rules,...structuredClone(PRE_REFORM_COMBAT),armyBands:structuredClone(LEGACY_ARMY_BANDS),fieldCommand:false,troopRounding:'soldier'};w.rules.baseCapacity=100;w.countries=['a','b'].map((id,i)=>({id,name:id,color:i?'#ef2028':'#006bff',troops:i?b:a,recruitment:0,personality:'balanced'}));
 w.people=w.countries.map(c=>({id:`g-${c.id}`,countryId:c.id,name:c.id,role:'general',ability:0,personality:'balanced',slot:0}));w.territories.forEach((t,i)=>{t.ownerId=i<cols?'a':'b';if(i>=cols)t.terrain=terrain;});return validateWorld(w);
}
test('army ratio boundaries, general/experience/terrain points and the natural 1-in-900 upset use only additive scores',()=>{
 for(const [ratio,score] of [[1,0],[1.249,0],[1.25,4],[1.5,10],[2,16],[3,21],[5,25],[10,27],[20,28],[30,28]])assert.equal(armyRatioBonus(ratio,1,rules),score);
 assert.equal(armyRatioBonus(1,30,rules),0);assert.deepEqual(combatBonuses(10,20,4,100,'mountain',rules),{ability:4,armyBonus:0,experienceBonus:9,terrainBonus:8,bonus:21});
 let wins=0;for(let a=1;a<=30;a++)for(let b=1;b<=30;b++)if(a>b+armyRatioBonus(30,1,rules))wins++;assert.equal(wins,1);
});
test('actual D30 battle lets a 1-man-unit defender defeat 30 units on rolls 30 versus 1 and records exact soldier losses',()=>{
 const initial=createRun(fixture(),1),r=nextTurn(initial,{targetId:'b',targetCells:{0:'tile-2'},rolls:{king:10,'attack:0':1,'defense:0':30}}),battle=r.history[0].battles[0];
 assert.equal(battle.attack.army,30);assert.equal(battle.defense.army,1);assert.equal(battle.sides,30);assert.equal(battle.attack.score,29);assert.equal(battle.defense.score,30);assert.equal(battle.winner,1);assert.equal(battle.losses.attack.amount,.2);assert.equal(battle.losses.defense.amount,.1);assert.equal(r.world.people.find(p=>p.id==='g-b').wins,1);assert.equal(battle.takenCells.length,0);assert(engineFor(r.initialWorld).engine.validState(r.engineState));
});
test('mountain applies to the attacked territory and only the winning living general gains a real victory',()=>{
 for(const terrain of ['plain','mountain']){const r=nextTurn(createRun(fixture({a:15,b:15,terrain}),2),{targetId:'b',targetCells:{0:'tile-2'},rolls:{king:10,'attack:0':12,'defense:0':12}}),b=r.history[0].battles[0];assert.equal(b.defense.terrainBonus,terrain==='mountain'?8:0);assert.equal(b.winner,terrain==='mountain'?1:null);assert.equal(r.world.people.find(p=>p.id==='g-b').wins,terrain==='mountain'?1:0);}
});
test('three connected territories may be captured; unopposed capture does not grant experience',()=>{
 const r=nextTurn(createRun(fixture({cols:4,a:35,b:6}),3),{targetId:'b',targetCells:{0:'tile-4'},rolls:{king:10,'attack:0':30,'defense:0':1}});assert.equal(r.history[0].battles[0].takenCells.length,3);assert.equal(r.world.people.find(p=>p.id==='g-a').wins,1);
 const empty=nextTurn(createRun(fixture({a:15,b:5}),4),{targetId:'b',targetCells:{0:'tile-2'},rolls:{king:10}});assert(empty.history[0].battles[0].automatic);assert.equal(empty.world.people.find(p=>p.id==='g-a').wins,0);
});
test('casualties round to whole soldiers, scale to the smaller force and never fabricate a minimum ten-thousand loss',()=>{
 assert.equal(combatCasualties(30,1,'win',20,rules).amount,.05);assert.equal(combatCasualties(1,30,'loss',20,rules).amount,.6);assert.equal(combatCasualties(.0001,30,'loss',20,rules).amount,.0001);assert.equal(combatCasualties(10,10,'draw',0,rules).amount,1.5);
});
test('a successor starts a separate life with zero wins and a supported new combat ability',()=>{
 const r=createRun(fixture({a:15,b:15}),5),c=r.engineState.countries[0],g=c.generals[0];g.alive=false;g.troops=0;g.waited=3;g.wins=9;c.army=c.reserve;
 const next=nextTurn(r,{rolls:{'successor:0':9,king:1,minister:1,domestic:1}}),replacement=next.engineState.countries[0].generals[0];assert.equal(replacement.wins,0);assert.equal(replacement.ability,4);assert.equal(replacement.generation,1);
});
test('saved modern games replay historical frames and movements exactly without changing the live state',async()=>{
 let run=createRun(createReferenceWorld(),212);const frames={};for(let i=0;i<35;i++){run=nextTurn(run);if([1,14,31].includes(run.turn))frames[run.turn]=run.history.at(-1).frames;}assert.equal(run.history[0].frames,undefined);const live=JSON.stringify(run),restored=restoreRun(JSON.parse(live));
 for(const turn of [1,14,31,14]){const replay=await replayTurn(restored,turn);assert.equal(replay.record.turn,turn);assert.deepEqual(replay.record.rolls,run.history[turn-1].rolls);assert.deepEqual(replay.record.frames,frames[turn]);assert.deepEqual(replay.record.movements,run.history[turn-1].movements);const scenes=makeTurnScenes(replay.record,replay.before);assert.deepEqual(scenes.at(-1).worldAfter,replay.after);}
 assert.equal(JSON.stringify(run),live);assert.deepEqual(nextTurn(restored).engineState,nextTurn(run).engineState);
});
test('legacy campaigns restore and reconstruct the old D10 rules and reject altered historical dice',async()=>{
 let run=createRun(createDemoWorld(),123456);for(let i=0;i<8;i++)run=nextTurn(run);const data=JSON.parse(JSON.stringify(run));data.engineVersion='studio-v11-12';delete data.initialWorld.rules.battleMode;
 const old=restoreRun(data);assert.equal(old.initialWorld.rules.battleMode,'v11');const replay=await replayTurn(old,4);assert.deepEqual(replay.record.rolls,run.history[3].rolls);assert.deepEqual(nextTurn(old).engineState,nextTurn(run).engineState);
 const corrupt=restoreRun(data);corrupt.history[0].rolls[0].value=corrupt.history[0].rolls[0].value===1?2:1;await assert.rejects(replayTurn(corrupt,1),/저장된 판정/);
});
test('rule validation rejects unordered army tiers, invalid dice/terrain/abilities and malformed casualty tables',()=>{
 for(const mutate of [w=>w.rules.armyBands=[[2,5],[1.5,6]],w=>w.rules.combatSides=61,w=>w.rules.captureThresholds=[16,8],w=>w.rules.combatLosses.narrow=[2,.2],w=>w.people[0].ability=5,w=>w.territories[0].terrain='lava']){const w=fixture();mutate(w);assert.throws(()=>validateWorld(w));}
});
