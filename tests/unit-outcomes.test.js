import { PRE_REFORM_COMBAT } from '../src/model/combat-rules.js';
import { LEGACY_ARMY_BANDS } from '../src/model/combat-rules.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createReferenceWorld } from '../src/data/reference-world.js';
import { createRun,nextTurn } from '../src/engine/simulation.js';
import { renderAtlas,unitMarkers } from '../src/ui/atlas-view.js';
import { mapAnchor } from '../src/model/cartography-geometry.js';
import { unitOutcome } from '../src/ui/unit-outcomes.js';
import { arrangeUnits } from '../src/ui/unit-layout.js';
import { makeTurnScenes,TurnPlayback } from '../src/ui/playback.js';
test('pins are fixed immediately above labels even at edges or when several units share a territory',()=>{
 const a=arrangeUnits([{point:[20,10]},{point:[20,10]}]);assert.deepEqual(a.map(m=>m.point),[[20,-57],[20,-57]]);
 const w=createRun(createReferenceWorld(),1).world;for(const m of unitMarkers(w)){const p=mapAnchor(w,m.territory.id,'label');assert.equal(m.point[0],p[0]);assert.equal(m.point[1]+55,p[1]-12);}
});
test('a king has a crown and a country-color card without an extra gold outline and the ocean belongs to the same SVG background as the land',()=>{
 const w=createRun(createReferenceWorld(),1).world,html=renderAtlas(w);assert.equal((html.match(/class="king-crown"/g)||[]).length,7);assert(!html.includes('king-gold-outline'));assert(html.includes('<g class="unified-map-background"'));assert(html.includes('<image class="ocean-texture"'));assert(!html.includes('<img class="ocean-texture"'));
});
test('recorded real battles trigger winner/loser effects only at result application, without changing engine state',()=>{
 let r=createRun(createReferenceWorld(),123456),before,record;for(let i=0;i<20;i++){before=r.world;r=nextTurn(r);record=r.history.at(-1);if(record.battles.some(b=>!b.automatic&&b.winner!==null))break;}
 const snapshot=JSON.stringify(r),b=record.battles.find(b=>!b.automatic&&b.winner!==null),scene=makeTurnScenes(record,before).find(s=>s.kind==='apply'&&s.event.type==='resolve'&&s.battleIndex===b.index),a=scene.worldBefore.people.find(p=>p.id===b.attackerPersonId),d=scene.worldBefore.people.find(p=>p.id===b.defenderPersonId);
 assert.equal(unitOutcome(scene,record,a),b.winner===b.actor?'victory':'defeat');assert.equal(unitOutcome(scene,record,d),b.winner===b.target?'victory':'defeat');assert.equal(unitOutcome({...scene,kind:'roll'},record,a),'');
 const html=renderAtlas(scene.worldAfter,{presentation:{record,scenes:[scene],index:0,phase:'holding',speed:2,sceneProgress:.5}});assert(html.includes('unit-victory'));assert(html.includes('unit-defeat'));assert(html.includes('--outcome-delay:-0.45s'));assert.equal(JSON.stringify(r),snapshot);
});
test('death retains a temporary red-flashing ghost even when the commander loses their last owned territory, then removes it',()=>{
 const w=createReferenceWorld();Object.assign(w.rules,structuredClone(PRE_REFORM_COMBAT));w.rules.armyBands=structuredClone(LEGACY_ARMY_BANDS);w.rules.retreatMode='blocked';let r=createRun(w,1),before,record,scene;
 for(let i=0;i<200&&!scene&&!r.result;i++){before=r.world;r=nextTurn(r);record=r.history.at(-1);scene=makeTurnScenes(record,before).find(s=>s.kind==='apply'&&s.event.type==='death');}
 assert(scene,'a real death event must occur');const html=renderAtlas(scene.worldAfter,{presentation:{record,scenes:[scene],index:0,phase:'holding',sceneProgress:0}});assert(html.includes('data-ghost="true"'));assert(html.includes('unit-death'));
 const settled=renderAtlas(scene.worldAfter,{presentation:{record,scenes:[scene],index:0,phase:'settled'}});assert(!settled.includes('data-ghost="true"'));
 const p=new TurnPlayback();p.load(record,before,r.world,false);p.finish();assert(!renderAtlas(p.displayWorld,{presentation:p.state}).includes('data-ghost="true"'));
});

test('dispatch probability is recorded internally without a visible die scene',()=>{
 let r=createRun(createReferenceWorld(),123456),before,record;for(let i=0;i<20;i++){before=r.world;r=nextTurn(r);record=r.history.at(-1);if(record.events.some(e=>e.type==='expedition_roll'))break;}
 assert(record.events.some(e=>e.type==='expedition_roll'));const scenes=makeTurnScenes(record,before);assert(!scenes.some(s=>s.event?.type==='expedition_roll'));
 for(const hold of record.events.filter(e=>e.type==='hold'))assert(scenes.some(s=>s.event===hold&&s.kind==='focus'));
});
