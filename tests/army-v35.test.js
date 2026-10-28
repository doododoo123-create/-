import test from 'node:test';import assert from 'node:assert/strict';
import {army35Fixture,army35Controls} from './army-v35-fixture.mjs';
import {createRun,nextTurn,engineFor,restoreRun} from '../src/engine/simulation.js';
import {replayTurn} from '../src/engine/replay.js';
import {runSaveData} from '../src/storage/run-store.js';
import {exportHistoryData,prepareFileImport} from '../src/storage/history-file.js';
import {movementFatigue} from '../src/engine/campaign-logistics.js';
import {centralRally,formationPositions,placementCounts,spreadCommanders} from '../src/engine/unit-spacing.js';
import {TurnPlayback} from '../src/ui/playback.js';
import {observerDuration} from '../src/ui/observer-flow.js';
import {animationRate} from '../src/ui/presentation-tempo.js';
import {renderAtlas} from '../src/ui/atlas-view.js';
import {campaignAdvantage,renderCampaignOverlay} from '../src/ui/campaign-view.js';
const initial=army35Fixture(),run=nextTurn(initial,army35Controls()),r=run.history[0];
function player(record=r,before=initial.world,after=run.world){const p=new TurnPlayback({options:()=>({compactCampaigns:true,armyPresentation:true})});p.load(record,before,after,false);return p;}
function seek(p,fn){for(let i=0;i<3000&&!fn(p.scene,p);i++)p.step();assert(fn(p.scene,p));}
test('all expedition decisions happen before gathering and refused officers never join or move with a formation',()=>{
 const start=army35Fixture({chance:50}),c=army35Controls();c.rolls['expedition:1']=100;const next=nextTurn(start,c),events=next.history[0].events,assembly=events.find(e=>e.type==='army_assembly');assert(assembly);assert(events.filter(e=>e.type==='expedition_roll').every(e=>e.index<assembly.index));assert(events.find(e=>e.type==='hold'&&e.slot===1).index<assembly.index);assert(!assembly.armyGroup.members.some(m=>m.slot===1));assert(!events.some(e=>e.moves?.some(m=>m.nation===0&&m.slot===1&&['assembly','army-march'].includes(m.kind))));assert.equal(events.filter(e=>e.type==='expedition_roll'&&e.slot===1).length,1);
});
test('gathering uses a reachable central tile and distributed preparation never exceeds two officers where room exists',()=>{
 const assembly=r.events.find(e=>e.type==='army_assembly'&&e.nation===0);assert.equal(assembly.armyGroup.location,3);assert.notEqual(assembly.armyGroup.location,initial.engineState.countries[0].generals[0].position);
 for(const e of r.events.filter(e=>['army_assembly','army_march'].includes(e.type))){const w=r.frames[e.index].after,counts=new Map();for(const p of w.people.filter(p=>(p.role==='general'||p.role==='king'&&p.slot===-1)&&p.active&&p.alive&&p.positionId)){const key=p.countryId+':'+p.positionId;counts.set(key,(counts.get(key)||0)+1);}assert([...counts.values()].every(n=>n<=2));}
});
test('both sides deploy to the front before any D30, and all D30 precede a single complete breakup',()=>{
 const events=r.events,first=events.find(e=>e.type==='attack_roll').index,prep=events.filter(e=>e.armyGroup&&['army_assembly','army_march'].includes(e.type));assert(prep.some(e=>e.nation===0));assert(prep.some(e=>e.nation===1));assert(prep.every(e=>e.index<first));
 const p=player(),scenes=p.state.scenes,dice=scenes.flatMap((s,i)=>s.campaignPhase==='dice'?[i]:[]),dissolve=scenes.findIndex(s=>s.event?.type==='army_dissolve');assert(dissolve>Math.max(...dice));assert(scenes.slice(0,Math.min(...dice)).some(s=>s.kind==='movement'&&s.event.type==='army_march'));assert(!scenes.some(s=>s.campaignPhase==='summary'));assert(scenes.filter(s=>s.campaignPhase==='map').every(s=>s.dissolveArmies));seek(p,s=>s.campaignPhase==='dice');assert(renderAtlas(p.displayWorld,{presentation:p.state}).includes('data-army-group'));seek(p,s=>s.event?.type==='army_dissolve');assert(!renderAtlas(p.displayWorld,{presentation:p.state}).includes('data-army-group'));
});
test('eligible defensive commanders assemble and move on friendly land, without pulling the king out of capital duty',()=>{
 const start=army35Fixture({defense:true}),next=nextTurn(start,army35Controls()),record=next.history[0];const defense=record.events.find(e=>e.type==='army_assembly'&&e.nation===1);assert(defense.armyGroup.members.length>=2);assert(defense.armyGroup.members.every(m=>m.slot>=0));for(const m of record.movements.filter(m=>m.eventIndex===defense.index).flatMap(m=>m.moves))assert(m.path.every(id=>record.frames[defense.index].before.territories.find(t=>t.id===id).ownerId==='b'));const first=record.battles[0],entry=record.events.find(e=>e.type==='territory'&&e.battleIndex===first.index),edges=record.movements.filter(m=>m.eventIndex<=entry.index).flatMap(m=>m.moves).filter(m=>m.personId===first.defenderPersonId&&['assembly','army-march','return','relief'].includes(m.kind)).reduce((n,m)=>n+m.path.length-1,0);assert(edges>0);assert.equal(first.defense.movementEdges,edges);assert(engineFor(next.initialWorld).engine.validState(next.engineState));
});
test('actual central and forward travel is counted once in fatigue; acceptance uses the original pre-gather distance once',()=>{
 for(const b of r.battles){const territory=r.events.find(e=>e.type==='territory'&&e.battleIndex===b.index),moves=r.movements.filter(m=>m.eventIndex<=territory.index).flatMap(m=>m.moves).filter(m=>m.personId===b.attackerPersonId&&['assembly','army-march','outbound','spacing'].includes(m.kind)),edges=moves.reduce((n,m)=>n+m.path.length-1,0);assert.equal(b.attack.movementEdges,edges);assert.equal(b.attack.fatigueBonus,movementFatigue(edges,initial.initialWorld.rules));}assert.equal(r.events.filter(e=>e.type==='expedition_roll').length,3);
});
test('spacing preserves the king, uses other reachable friendly tiles, and overflows only when every such tile is full',()=>{
 const start=army35Fixture(),state=structuredClone(start.engineState),atlas=engineFor(start.initialWorld).engine.atlas;
 // Use the model graph from the same fixture for a small direct assignment test.
 const graph={cells:state.cells.map((c,i)=>({id:i,center:[i,0],neighbors:[i-1,i+1].filter(v=>v>=0&&v<state.cells.length)}))};const generals=state.countries[0].generals.filter(g=>g.active);generals.forEach(g=>g.position=0);const messages=[];spreadCommanders(state,graph,(...e)=>messages.push(e));assert([...placementCounts(state,0).values()].every(n=>n<=2));assert.equal(state.countries[0].royal.position,0);assert(messages.length);
 const tiny={countries:[{id:0,royal:null,generals:Array.from({length:3},(_,slot)=>({slot,generation:0,active:true,alive:true,position:0}))}],cells:[{id:0,owner:0}]},one={cells:[{id:0,center:[0,0],neighbors:[]}]};spreadCommanders(tiny,one,()=>{});assert.equal(placementCounts(tiny,0).get(0),3);
});
test('movement, VS, result and occupation are 1.5x faster, while all dice phases keep exactly the old durations',()=>{
 const settling={kind:'round-settle',event:{},rapidMovement:true,settlementCount:3};assert(Math.abs(observerDuration({...settling,rapidMovement:false},r,'holding')/observerDuration(settling,r,'holding')-1.5)<1e-8);const p=player();for(const scene of p.state.scenes){const plain={...scene,rapidMovement:false};if(['roll','reel'].includes(scene.kind)){for(const phase of ['rolling','raw','merging','locked'])assert.equal(observerDuration(scene,r,phase),observerDuration(plain,r,phase));assert.equal(animationRate(scene),animationRate(plain));}else if(['movement','route','capture'].includes(scene.kind)){assert(Math.abs(observerDuration(plain,r,'holding')/observerDuration(scene,r,'holding')-1.5)<1e-8);assert(Math.abs(animationRate(scene)/animationRate(plain)-1.5)<1e-8);}}
});
test('compact table has no tutorial filler or final popup, and advantage only uses locked results',()=>{
 const p=player();seek(p,s=>s.campaignPhase==='dice');let html=renderCampaignOverlay({playback:p});assert(html.includes('판정 대기'));assert(!html.includes('campaign-next-duel'));assert(!html.includes('campaign-table-hint'));seek(p,(s,q)=>s.event.type==='defense_roll'&&q.state.phase==='locked');assert.equal(campaignAdvantage(p.scene,1).id,'a');html=renderCampaignOverlay({playback:p});assert(html.includes('a국 우세'));assert(!p.state.scenes.some(s=>s.campaignPhase==='summary'));
});
test('new preparation commands survive full export/import and history reconstruction without altering engine30 histories',async()=>{
 const data=await exportHistoryData(run),restored=(await prepareFileImport(data)).run;assert.deepEqual(restored.engineState,run.engineState);const replay=await replayTurn(run,1);assert.deepEqual(replay.record.movements,r.movements);assert.deepEqual(replay.record.battles,r.battles);const saved=runSaveData(initial);saved.engineVersion='studio-v11-30';assert.deepEqual(restoreRun(saved).engineState,initial.engineState);
});
test('real preparation remains valid across repeated seeded commands and portable continuation',async()=>{
 const {createContinentV31World}=await import('../src/scenarios/continent-v31.js');for(const seed of [7,17]){let current=createRun(createContinentV31World(),seed);for(let i=0;i<28&&!current.result;i++){current=nextTurn(current,{armyAssembly:true,armyFormation:true,unitSpacing:true});assert(engineFor(current.initialWorld).engine.validState(current.engineState));}const again=restoreRun(runSaveData(current));assert.deepEqual(nextTurn(current,{armyAssembly:true,armyFormation:true,unitSpacing:true}).engineState,nextTurn(again,{armyAssembly:true,armyFormation:true,unitSpacing:true}).engineState);}
});
test('a counterattack into an earlier captured province never recruits the other country as its defender',()=>{
 const c=army35Controls();c.rolls['attack:1:chain:1']=1;c.rolls['defense:1:chain:1']=30;const next=nextTurn(initial,c),record=next.history[0];assert(record.battles.some(b=>b.continuation==='counter'));for(const b of record.battles.filter(b=>!b.automatic)){const before=record.frames[record.events.find(e=>e.type==='territory'&&e.battleIndex===b.index).index].before,defender=before.people.find(p=>p.id===b.defenderPersonId);assert(defender);assert.equal(defender.countryId,b.defenderId);assert.equal(b.defense.name,defender.name);assert.notEqual(b.actorId,b.defenderId);}assert(engineFor(next.initialWorld).engine.validState(next.engineState));
});
