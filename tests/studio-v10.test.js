import { PRE_REFORM_COMBAT } from '../src/model/combat-rules.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {blankWorld,validateWorld}from '../src/model/world.js';
import {ADDITIVE_COMBAT_DEFAULTS,armyRatioBonus,LEGACY_ARMY_BANDS}from '../src/model/combat-rules.js';
import {createRun,nextTurn,engineFor,projectWorld,restoreRun}from '../src/engine/simulation.js';
import {homeRetreatDestination}from '../src/engine/retreat-home.js';
import {createReferenceWorld}from '../src/data/reference-world.js';
import {replayTurn}from '../src/engine/replay.js';
import {makeTurnScenes}from '../src/ui/playback.js';
import {renderAtlas}from '../src/ui/atlas-view.js';
import {unitOutcome}from '../src/ui/unit-outcomes.js';
import {stackUnits}from '../src/ui/unit-stack.js';
function fixture({split=4,broken=true,old=false}={}){
 const w=blankWorld({rows:3,cols:4});Object.assign(w.rules,structuredClone(PRE_REFORM_COMBAT));w.rules.baseCapacity=100;w.rules.seaSupply=false;w.rules.expeditionChances=[100,100,100,100,100,100];if(old){Object.assign(w.rules,structuredClone(PRE_REFORM_COMBAT));w.rules.retreatMode='blocked';w.rules.armyBands=structuredClone(LEGACY_ARMY_BANDS);}
 w.countries=['a','b'].map(id=>({id,name:id,color:id==='a'?'#ff0000':'#006bff',troops:45,recruitment:0,personality:'balanced'}));
 w.people=w.countries.flatMap(c=>Array.from({length:3},(_,slot)=>({id:c.id+slot,name:c.id+slot,countryId:c.id,role:'general',ability:0,personality:'balanced',slot})));
 w.territories.forEach((t,i)=>t.ownerId=i<split?'a':'b');w.cartography={version:1,style:'classic',opacity:.2,background:null,polygons:{},links:Array.from({length:11},(_,i)=>[i,i+1]).filter(([i])=>!broken||i!==split).map(p=>p.map(i=>'tile-'+i))};
 const r=createRun(validateWorld(w),7),s=r.engineState;
 for(const c of s.countries){c.reserve=5;c.generals.forEach(g=>g.troops=g.active?20:0);c.army=5+c.generals.reduce((n,g)=>n+g.troops,0);}
 const a=s.countries[0];a.generals[0].station=split-1;a.generals[0].position=split-1;for(const g of a.generals.slice(1)){g.troops=0;}a.army=25;
 const b=s.countries[1];b.generals[0].position=split;b.generals[0].station=split;if(b.generals[1].active){b.generals[1].position=split+2;b.generals[1].station=split+2;}
 r.world=projectWorld(r.initialWorld,s);assert(engineFor(r.initialWorld).engine.validState(s));return r;
}
const attack=target=>({targetId:'b',targetCells:{0:'tile-'+target},rolls:{king:10,'expedition:0':1,'attack:0':15,'defense:0':10}});
test('new army bands soften small gaps, cap at twenty and preserve ordinary D30 reversals',()=>{
 const r=ADDITIVE_COMBAT_DEFAULTS;for(const [ratio,bonus]of [[1,0],[1.49,0],[1.5,1],[1.99,1],[2,3],[3,5],[4,7],[5,9],[7,12],[10,15],[15,18],[20,20],[30,20],[1000,20]])assert.equal(armyRatioBonus(ratio,1,r),bonus);
 assert(18>12+armyRatioBonus(20,10,r));assert(30>9+armyRatioBonus(30,1,r));assert.equal(armyRatioBonus(1,30,r),0);assert.equal(armyRatioBonus(30,0,r),0);
 const w=blankWorld();assert.equal(validateWorld(w).rules.armyBands[0][0],1);
});
test('a blocked surviving defender returns to an owned personal province with troops and wins preserved',()=>{
 const initial=fixture(),r=nextTurn(initial,attack(4)),record=r.history[0],g=r.engineState.countries[1].generals[0],b=record.battles[0];
 assert(g.alive&&g.active&&!g.stranded);assert.equal(g.troops,b.after.defense);assert.equal(g.wins,0);assert.equal(g.position,5);assert.equal(g.station,5);
 const e=record.events.find(e=>e.type==='retreat'&&e.slot===0);assert.equal(e.reason,'home');assert(e.relocation);assert.equal(e.moves[0].kind,'redeploy');assert.deepEqual(e.moves[0].path,[4,5]);assert.equal(r.world.people.find(p=>p.id==='b0').positionId,'tile-5');assert(engineFor(r.initialWorld).engine.validState(r.engineState));
 const result=record.events.find(e=>e.type==='resolve'),shown=record.frames[result.index].after.people.find(p=>p.id==='b0');assert(shown.displaced);assert(!shown.stranded);
});
test('a survivor with no personal land stays active near the capital after region reduction, without losing troops or wins',()=>{
 const initial=fixture({split:7,broken:false}),s=initial.engineState,c=s.countries[1];s.cells.filter(t=>t.owner===1).forEach(t=>t.commander=t.id===7?1:0);c.generals[0].position=9;c.generals[0].station=9;c.generals[1].position=7;c.generals[1].station=7;c.generals[1].wins=6;initial.world=projectWorld(initial.initialWorld,s);
 const controls=attack(7);controls.rolls['attack:0']=22;const r=nextTurn(initial,controls),g=r.engineState.countries[1].generals[1],p=r.world.people.find(p=>p.id==='b1'),{engine}=engineFor(r.initialWorld),capital=engine.capitalCell(r.engineState,1),b=r.history[0].battles[0];
 assert(g.active&&g.alive&&!g.stranded);assert.equal(g.wins,6);assert.equal(g.troops,b.after.defense);assert.equal(p.territoryIds.length,0);assert.equal(r.engineState.cells[g.position].owner,1);assert(engine.ATLAS.cells[capital].neighbors.includes(g.position)||capital===g.position);
 assert.equal(r.engineState.countries[1].army,45-b.losses.defense.amount);assert.equal(r.engineState.countries[1].generals.filter(g=>g.active&&g.alive).length,2);assert(engine.validState(r.engineState));assert.deepEqual(restoreRun(JSON.parse(JSON.stringify(r))).engineState,r.engineState);
});
test('retreat prioritizes a personal assigned home and uses only friendly capital neighbors when no region remains',()=>{
 const r=fixture(),s=r.engineState,{engine}=engineFor(r.initialWorld),g=s.countries[1].generals[0];g.station=7;
 assert.equal(homeRetreatDestination(s,engine.ATLAS,1,g,8).to,7);s.cells.filter(c=>c.owner===1).forEach(c=>c.commander=1);g.station=0;
 const fallback=homeRetreatDestination(s,engine.ATLAS,1,g,8);assert.equal(fallback.reason,'capital');assert(engine.ATLAS.cells[8].neighbors.includes(fallback.to));assert.equal(s.cells[fallback.to].owner,1);
 s.cells.forEach(c=>c.owner=0);assert.equal(homeRetreatDestination(s,engine.ATLAS,1,g,8),null);
});
test('route-free placement has its own replay motion without drawing a road through enemy territory',()=>{
 const initial=fixture(),r=nextTurn(initial,attack(4)),record=r.history[0],scene=makeTurnScenes(record,initial.world).find(s=>s.kind==='movement'&&s.moves.some(m=>m.kind==='redeploy'));
 assert(scene);assert.equal(scene.title,'생존 지휘관 재배치');const html=renderAtlas(scene.worldAfter,{presentation:{record,scenes:[scene],index:0,phase:'holding',movementProgress:.5}});assert(html.includes('unit-redeploy'));assert(!html.includes('<path class="redeploy"'));assert(html.includes('재배치'));
});
test('kings use crown and gold name markup; every stacked card exposes a wider side strip',()=>{
 const r=createRun(createReferenceWorld(),3),html=renderAtlas(r.world);assert.equal((html.match(/class="king-crown"/g)||[]).length,7);assert(!html.includes('king-gold-outline'));
 const group=Array.from({length:6},(_,slot)=>({territory:{id:'t'},point:[100,200],role:'general',person:{id:'p'+slot,slot},country:{id:'a'}}));const stack=stackUnits(group);assert.deepEqual(stack.map(m=>m.stackOffset),[120,96,72,48,24,0]);assert.deepEqual(stack.at(-1).point,[100,200]);
});
test('a successor and a newly activated commander both receive gold appointment effect and a green badge only at application',()=>{
 const initial=fixture(),c=initial.engineState.countries[0],g=c.generals[0];g.alive=false;g.troops=0;g.position=null;g.waited=3;c.army=c.reserve;initial.world=projectWorld(initial.initialWorld,initial.engineState);
 const r=nextTurn(initial,{rolls:{'successor:0':9,king:1,minister:1,domestic:1}}),record=r.history[0],scene=makeTurnScenes(record,initial.world).find(s=>s.kind==='apply'&&s.event.type==='appointment'),person=scene.worldAfter.people.find(p=>p.countryId==='a'&&p.slot===0&&p.role==='general');
 assert.equal(unitOutcome(scene,record,person),'appointment');const html=renderAtlas(scene.worldAfter,{presentation:{record,scenes:[scene],index:0,phase:'holding'}});assert(html.includes('unit-appointment'));assert(html.includes('unit-status-wash appointment'));assert(html.includes('>임관</text>'));assert(!renderAtlas(scene.worldAfter,{presentation:{record,scenes:[scene],index:0,phase:'settled'}}).includes('>임관</text>'));
 const newScene={...scene,event:{type:'roster'},worldBefore:{...scene.worldBefore,people:scene.worldBefore.people.filter(p=>p.id!==person.id)}};assert.equal(unitOutcome(newScene,record,person),'appointment');
});
test('old v0.9 stored histories retain stronger original bands and blocked retreat on replay and continuation',async()=>{
 const w=createReferenceWorld();Object.assign(w.rules,structuredClone(PRE_REFORM_COMBAT));w.rules.retreatMode='blocked';w.rules.armyBands=structuredClone(LEGACY_ARMY_BANDS);let r=createRun(w,23);for(let i=0;i<22;i++)r=nextTurn(r);
 const data=JSON.parse(JSON.stringify(r));data.engineVersion='studio-v11-15';delete data.initialWorld.rules.retreatMode;const restored=restoreRun(data);assert.equal(restored.initialWorld.rules.retreatMode,'blocked');assert.deepEqual(restored.initialWorld.rules.armyBands,LEGACY_ARMY_BANDS);assert.deepEqual(nextTurn(restored).engineState,nextTurn(r).engineState);await replayTurn(restored,20);
});
test('new rule runs save and replay personal/capital relocations and survivor rosters exactly',async()=>{
 let r=createRun(createReferenceWorld(),20261019),selected;for(let i=0;i<55&&!r.result;i++){r=nextTurn(r);assert(!r.engineState.countries.some(c=>c.generals.some(g=>g.stranded)));if(!selected&&r.history.at(-1).events.some(e=>e.type==='retreat'&&e.relocation))selected=r.history.at(-1);}
 assert(selected);const restored=restoreRun(JSON.parse(JSON.stringify(r))),replay=await replayTurn(restored,selected.turn);assert.deepEqual(replay.record.frames,selected.frames);assert.deepEqual(replay.record.movements,selected.movements);assert.deepEqual(nextTurn(restored).engineState,nextTurn(r).engineState);
});
