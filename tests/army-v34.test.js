import test from 'node:test';
import assert from 'node:assert/strict';
import {campaign28Fixture,campaign28Controls} from './campaign-v28-fixture.mjs';
import {createRun,nextTurn,restoreRun} from '../src/engine/simulation.js';
import {replayTurn} from '../src/engine/replay.js';
import {runSaveData} from '../src/storage/run-store.js';
import {exportHistoryData,prepareFileImport} from '../src/storage/history-file.js';
import {movementFatigue} from '../src/engine/campaign-logistics.js';
import {makeTurnScenes,TurnPlayback} from '../src/ui/playback.js';
import {compactCampaignScenes} from '../src/ui/campaign-playback.js';
import {renderAtlas} from '../src/ui/atlas-view.js';
import {renderCampaignOverlay} from '../src/ui/campaign-view.js';
import {roundCampaign} from '../src/ui/round-campaign.js';
import {recentMapEvents} from '../src/ui/recent-map-events.js';
import {MapCamera} from '../src/ui/map-camera.js';
import {mapAnchor} from '../src/model/cartography-geometry.js';
import {armyArrowWidth} from '../src/ui/operation-geometry.js';
export function armyFixture(){const w=structuredClone(campaign28Fixture().initialWorld);w.rules.fatiguePenalty=2;w.rules.warReadiness=false;w.rules.resetConfusionOnRest=false;w.rules.captureThresholds=[40,60];return createRun(w,777);}
export function armyControls(){const c=campaign28Controls();for(const key of Object.keys(c.rolls))if(key.startsWith('attack:'))c.rolls[key]=30;return {...c,armyAssembly:true};}
const initial=armyFixture(),run=nextTurn(initial,armyControls()),r=run.history[0],scenes=compactCampaignScenes(makeTurnScenes(r,initial.world),r);
function player(){const p=new TurnPlayback({options:()=>({compactCampaigns:true})});p.load(r,initial.world,run.world,false);return p;}
function seek(p,condition){for(let i=0;i<2000&&!condition(p.scene,p);i++)p.step();assert(condition(p.scene,p));}
test('assembly changes authoritative positions through friendly legal paths and preserves every soldier',()=>{
 const e=r.events.find(e=>e.type==='army_assembly');assert.equal(e.armyGroup.members.length,3);assert.equal(e.armyGroup.army,60);assert(e.moves.length);
 const frame=r.frames[e.index];assert.equal(frame.before.countries[0].troops,frame.after.countries[0].troops);
 for(const m of r.movements.find(m=>m.eventIndex===e.index).moves){assert.equal(frame.before.people.find(p=>p.id===m.personId).positionId,m.fromId);assert.equal(frame.after.people.find(p=>p.id===m.personId).positionId,m.toId);for(let i=0;i<m.path.length;i++){assert.equal(frame.before.territories.find(t=>t.id===m.path[i]).ownerId,m.countryId);if(i)assert(initial.initialWorld.cartography.links.some(pair=>pair.includes(m.path[i-1])&&pair.includes(m.path[i])));}}
});
test('gathering plus shared column movement count exactly once in fatigue and expedition distance',()=>{
 assert(r.battles.length>=2);assert(r.battles.some(b=>b.attack.fatigueBonus<0));
 for(const b of r.battles){const entry=r.events.find(e=>e.type==='territory'&&e.battleIndex===b.index),p=initial.world.people.find(p=>p.id===b.attackerPersonId);const travelled=r.movements.filter(m=>m.eventIndex<=entry.index).flatMap(m=>m.moves).filter(m=>m.personId===p.id&&['assembly','army-march','outbound'].includes(m.kind)).reduce((n,m)=>n+m.path.length-1,0);assert.equal(b.attack.movementEdges,travelled);assert.equal(b.attack.fatigueBonus,movementFatigue(travelled,initial.initialWorld.rules));const expedition=r.events.find(e=>e.type==='expedition_roll'&&e.slot===b.slot);assert.equal(expedition.distance,b.attack.movementEdges+1);}
});
test('disabled assembly preserves original rules, RNG, battles and old engine29 histories',()=>{
 const oldInitial=campaign28Fixture(),legacy=nextTurn(oldInitial,campaign28Controls()),off=nextTurn(oldInitial,{...campaign28Controls(),armyAssembly:false});assert.deepEqual(off.engineState,legacy.engineState);assert.deepEqual(off.history[0].battles,legacy.history[0].battles);assert(!off.history[0].events.some(e=>e.armyGroup));const saved=runSaveData(legacy);saved.engineVersion='studio-v11-29';const restored=restoreRun(saved);assert.deepEqual(restored.engineState,legacy.engineState);
});
test('actual assembly never teleports an isolated commander across enemy or disconnected land',()=>{
 const w=structuredClone(initial.initialWorld);w.cartography.links=w.cartography.links.filter(pair=>!(pair.includes('tile-2')&&pair.includes('tile-3')));const first=createRun(w,777);const next=nextTurn(first,{...armyControls(),targetCells:{1:'tile-6',2:'tile-7'}}),event=next.history[0].events.find(e=>e.type==='army_assembly');assert(event);assert(!event.armyGroup.members.some(m=>m.slot===0));assert.equal(next.world.people.find(p=>p.id==='a0').positionId,first.world.people.find(p=>p.id==='a0').positionId);
});
test('all dice in one assembled army finish before any column march or battle map result',()=>{
 const dice=scenes.flatMap((s,i)=>s.campaignPhase==='dice'?[i]:[]),maps=scenes.flatMap((s,i)=>s.campaignPhase==='map'?[i]:[]);assert(dice.length>=4);assert(Math.max(...dice)<Math.min(...maps));const raw=makeTurnScenes(r,initial.world),original=raw.filter(s=>scenes.some(q=>q.campaignPhase==='map'&&q.id===s.id));assert.deepEqual(scenes.filter(s=>s.campaignPhase==='map').map(s=>s.id),original.map(s=>s.id));
 const p=player();seek(p,s=>s.campaignPhase==='dice');const frozen=JSON.stringify(p.displayWorld);seek(p,s=>s.campaignPhase==='dice'&&s.campaignRow===1);assert.equal(JSON.stringify(p.displayWorld),frozen);assert.equal(roundCampaign(p.displayWorld,p.state).captures.size,0);assert(!recentMapEvents(run,p,p.displayWorld).some(e=>e.kind==='capture'));const html=renderCampaignOverlay({playback:p});assert.equal((html.match(/data-active-roll="true"/g)||[]).length,1);
});
test('formed army uses one 1.7x total-strength leader with overlapping half-size portraits',()=>{
 const p=player();seek(p,s=>s.campaignPhase==='dice');const html=renderAtlas(p.displayWorld,{presentation:p.state});assert.equal((html.match(/data-army-group=/g)||[]).length,1);assert(html.includes('data-army-total="60"'));assert(html.includes('scale(1.7)"'));assert.equal((html.match(/data-army-companion=/g)||[]).length,2);assert(html.includes('scale(.5)'));assert(html.includes('집단군'));
});
test('shared column is one thick total-strength arrow and detached officers get individual attack routes',()=>{
 const p=player();seek(p,s=>s.event?.type==='army_march'&&s.kind==='movement');const html=renderAtlas(p.displayWorld,{presentation:p.state});assert.equal((html.match(/data-army-route=/g)||[]).length,1);assert(html.includes('data-army-route-total="60"'));assert(armyArrowWidth(60)>armyArrowWidth(20));seek(p,s=>s.kind==='movement'&&s.event?.type==='territory');const split=renderAtlas(p.displayWorld,{presentation:p.state});assert(split.includes('data-route-person="a0"'));assert.equal((split.match(/data-army-companion=/g)||[]).length,1);
});
test('new gathering, costs, controls and outcomes survive export/import and exact historical reconstruction',async()=>{
 const portable=await exportHistoryData(run),restored=await prepareFileImport(portable);const loaded=restored.run||restored;assert.deepEqual(loaded.engineState,run.engineState);const replay=await replayTurn(run,1);assert.deepEqual(replay.record.battles,r.battles);assert.deepEqual(replay.record.movements,r.movements);assert.equal(replay.record.controls.armyAssembly,true);
});
test('follow centers the battlefield exactly and preserves user zoom across battles and country turns',()=>{
 const original=globalThis.document;globalThis.document={querySelector:()=>null,querySelectorAll:()=>[]};try{const p=player();seek(p,s=>s.campaignPhase==='dice');const camera=new MapCamera();camera.autoFollow=true;camera.view('simulation').zoom=2.3;camera.follow(p);assert.equal(camera.view('simulation').zoom,2.3);const point=mapAnchor(p.displayWorld,r.battles[0].territoryId,'battle');assert.equal(camera.view('simulation').x,point[0]);assert.equal(camera.view('simulation').y,point[1]);seek(p,s=>s.campaignPhase==='map'&&s.battleIndex===1);camera.follow(p);assert.equal(camera.view('simulation').zoom,2.3);const next=mapAnchor(p.displayWorld,r.battles[1].territoryId,'battle');assert.equal(camera.view('simulation').y,next[1]);camera.follow({state:{record:{...r,actorId:'b'}},scene:p.scene,displayWorld:p.displayWorld,playing:false});assert.equal(camera.view('simulation').zoom,2.3);assert.equal(camera.view('simulation').y,next[1]);}finally{globalThis.document=original;}
});
test('an existing campaign can enable real assembly on a later command without changing earlier history',async()=>{
 let mixed=nextTurn(campaign28Fixture(),campaign28Controls());for(let i=0;i<2;i++)mixed=nextTurn(mixed,{rolls:{king:1,minister:1,domestic:1}});const earlier=JSON.stringify(mixed.history);const c=armyControls();delete c.targetCells;mixed=nextTurn(mixed,c);assert.equal(JSON.stringify(mixed.history.slice(0,3)),earlier);assert(mixed.history[3].events.some(e=>e.type==='army_assembly'));const replay=await replayTurn(mixed,4);assert.deepEqual(replay.after.people,mixed.world.people);assert.deepEqual(replay.record.battles,mixed.history[3].battles);
});
test('assembly controls reject malformed values and presentation never changes actual costs or RNG',()=>{
 assert.throws(()=>nextTurn(initial,{armyAssembly:'true'}),/집단군/);const snapshot=JSON.stringify(run),p=player();for(let i=0;i<2000&&!p.complete;i++)p.step();assert(p.complete);assert.equal(JSON.stringify(run),snapshot);assert.deepEqual(nextTurn(run).engineState,nextTurn(JSON.parse(snapshot)).engineState);
});
test('actual assembled campaigns retain valid armies and deterministic outcomes over repeated seeded commands',async()=>{
 const {createContinentV31World}=await import('../src/scenarios/continent-v31.js');const {engineFor}=await import('../src/engine/simulation.js');
 for(const seed of [7,17]){let current=createRun(createContinentV31World(),seed);for(let i=0;i<28&&!current.result;i++){current=nextTurn(current,{armyAssembly:true});assert(engineFor(current.initialWorld).engine.validState(current.engineState));assert(current.world.people.filter(p=>p.role==='general').every(p=>Number.isInteger(p.troops)));}const restored=restoreRun(runSaveData(current));assert.deepEqual(nextTurn(current,{armyAssembly:true}).engineState,nextTurn(restored,{armyAssembly:true}).engineState);}
});
