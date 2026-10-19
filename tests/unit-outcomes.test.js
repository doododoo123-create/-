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
test('a king has an outer gold pin outline and the ocean belongs to the same SVG background as the land',()=>{
 const w=createRun(createReferenceWorld(),1).world,html=renderAtlas(w);assert.equal((html.match(/class="king-gold-outline"/g)||[]).length,7);assert(html.includes('<g class="unified-map-background"'));assert(html.includes('<image class="ocean-texture"'));assert(!html.includes('<img class="ocean-texture"'));
});
test('recorded real battles trigger winner/loser effects only at result application, without changing engine state',()=>{
 let r=createRun(createReferenceWorld(),123456),before,record;for(let i=0;i<20;i++){before=r.world;r=nextTurn(r);record=r.history.at(-1);if(record.battles.some(b=>!b.automatic&&b.winner!==null))break;}
 const snapshot=JSON.stringify(r),b=record.battles.find(b=>!b.automatic&&b.winner!==null),scene=makeTurnScenes(record,before).find(s=>s.kind==='apply'&&s.event.type==='resolve'&&s.battleIndex===b.index),a=scene.worldBefore.people.find(p=>p.id===b.attackerPersonId),d=scene.worldBefore.people.find(p=>p.id===b.defenderPersonId);
 assert.equal(unitOutcome(scene,record,a),b.winner===b.actor?'victory':'defeat');assert.equal(unitOutcome(scene,record,d),b.winner===b.target?'victory':'defeat');assert.equal(unitOutcome({...scene,kind:'roll'},record,a),'');
 const html=renderAtlas(scene.worldAfter,{presentation:{record,scenes:[scene],index:0,phase:'holding',speed:2,sceneProgress:.5}});assert(html.includes('unit-victory'));assert(html.includes('unit-defeat'));assert(html.includes('--outcome-delay:-0.45s'));assert.equal(JSON.stringify(r),snapshot);
});
test('death retains a temporary red-flashing ghost even when the commander loses their last owned territory, then removes it',()=>{
 let r=createRun(createReferenceWorld(),1),before,record,scene;
 for(let i=0;i<200&&!scene&&!r.result;i++){before=r.world;r=nextTurn(r);record=r.history.at(-1);scene=makeTurnScenes(record,before).find(s=>s.kind==='apply'&&s.event.type==='death');}
 assert(scene,'a real death event must occur');const html=renderAtlas(scene.worldAfter,{presentation:{record,scenes:[scene],index:0,phase:'holding',sceneProgress:0}});assert(html.includes('data-ghost="true"'));assert(html.includes('unit-death'));
 const settled=renderAtlas(scene.worldAfter,{presentation:{record,scenes:[scene],index:0,phase:'settled'}});assert(!settled.includes('data-ghost="true"'));
 const p=new TurnPlayback();p.load(record,before,r.world,false);p.finish();assert(!renderAtlas(p.displayWorld,{presentation:p.state}).includes('data-ghost="true"'));
});

test('the dispatch decision remains hidden until its die locks',()=>{
 let r=createRun(createReferenceWorld(),123456),before,record;for(let i=0;i<20;i++){before=r.world;r=nextTurn(r);record=r.history.at(-1);if(record.events.some(e=>e.type==='expedition_roll'))break;}
 const scene=makeTurnScenes(record,before).find(s=>s.event?.type==='expedition_roll');assert.equal(scene.title,'지휘관의 출전 판정');assert(!scene.detail.includes('D100 '+scene.value));assert(!scene.title.includes('주둔 유지'));assert(scene.lockedTitle.includes('출전 결정')||scene.lockedTitle.includes('주둔 유지'));
});
