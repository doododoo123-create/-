import test from 'node:test';
import assert from 'node:assert/strict';
import {createContinent160World} from '../src/data/continent160-world.js';
import {createRun,nextTurn} from '../src/engine/simulation.js';
import {TurnPlayback,makeTurnScenes} from '../src/ui/playback.js';
import {applicationSteps,applicationWorld,battleConsequence,observerDuration} from '../src/ui/observer-flow.js';
import {mapEffects} from '../src/ui/map-effects.js';
import {renderAtlas} from '../src/ui/atlas-view.js';
import {observerDetail,observerLandmarks} from '../src/ui/observer-map.js';
import {battleFraming,cameraExtent} from '../src/ui/camera-focus.js';
import {MapCamera} from '../src/ui/map-camera.js';
import {renderObserverScore,renderObserverBonuses} from '../src/ui/combat-view.js';
import {renderDie} from '../src/ui/die-view.js';

function recordedBattle(){let run=createRun(createContinent160World(),777),before,record,battle;for(let i=0;i<100;i++){before=run.world;run=nextTurn(run);record=run.history.at(-1);battle=record.battles.find(b=>!b.automatic&&b.winner===b.actor&&b.takenCells.length&&b.losses.attack.amount+b.losses.defense.amount>0);if(battle)break;}assert(battle);const scenes=makeTurnScenes(record,before),scene=scenes.find(s=>s.kind==='apply'&&s.event.type==='resolve'&&s.battleIndex===battle.index);return {run,before,record,battle,scene};}
const fixture=recordedBattle();
test('recorded victory, losses, ownership and growth have separate display steps without changing the saved run',()=>{
 const {run,record,battle,scene}=fixture,snapshot=JSON.stringify(run),steps=applicationSteps(scene,record);assert.deepEqual(steps.slice(0,3),['outcome','troops','territory']);
 assert.equal(applicationWorld(scene,'outcome'),scene.worldBefore);
 const troops=applicationWorld(scene,'troops');assert.equal(troops.territories,scene.worldBefore.territories);assert.equal(troops.people.find(p=>p.id===battle.attackerPersonId).troops,scene.worldAfter.people.find(p=>p.id===battle.attackerPersonId).troops);
 assert.deepEqual(applicationWorld(scene,'territory').territories,scene.worldAfter.territories);assert.equal(applicationWorld(scene,'growth'),scene.worldAfter);
 assert.equal(mapEffects(scene,'outcome',record).units.length,0);assert.equal(mapEffects(scene,'outcome',record).territories.length,0);
 assert(mapEffects(scene,'troops',record).units.every(e=>e.type==='army'));assert.equal(mapEffects(scene,'troops',record).territories.length,0);
 assert.deepEqual(mapEffects(scene,'territory',record).territories.map(e=>e.territoryId).sort(),[...battle.takenTerritoryIds].sort());assert(mapEffects(scene,'growth',record).units.every(e=>['capacity','experience','recruitment','supply'].includes(e.type)));assert.equal(JSON.stringify(run),snapshot);
});
test('manual steps and a paused accelerated clock retain their exact effect stage and finish on the committed world',()=>{
 const {run,before,record}=fixture;let now=0,task=null,speed=1;const p=new TurnPlayback({now:()=>now,schedule:(fn,delay)=>{task={fn,delay};return 1;},cancel:()=>task=null,speed:()=>speed});p.load(record,before,run.world,false);
 while(p.scene!==null&&!(p.scene.kind==='apply'&&p.scene.event?.type==='resolve'&&p.scene.battleIndex===fixture.battle.index))p.step();assert.equal(p.state.effectStage,'outcome');p.resume();now+=350;p.pause();const left=p.remaining;speed=8;p.resume();assert.equal(task.delay,left/8);assert.equal(p.state.effectStage,'outcome');task.fn();assert.equal(p.state.effectStage,'troops');p.pause();p.step();assert.equal(p.state.effectStage,'territory');p.finish();assert.equal(p.displayWorld,run.world);assert.equal(task,null);
});
test('duel focus and icon roles are shown during rolls, while result and loss labels stay together on the cards',()=>{
 const {record,before,battle,scene}=fixture,roll=makeTurnScenes(record,before).find(s=>s.event?.type==='attack_roll'&&s.battleIndex===battle.index);
 const draw=(s,stage=null)=>renderAtlas(stage?applicationWorld(s,stage):s.worldBefore,{presentation:{record,scenes:[s],index:0,phase:'holding',effectStage:stage}});
 const html=draw(roll);assert.equal((html.match(/unit-engaged/g)||[]).length,2);assert.equal((html.match(/class="unit-combat-role"/g)||[]).length,2);assert(html.includes('data-combat-side="attack"'));assert(html.includes('data-combat-side="defense"'));assert(html.includes('combat-focused'));assert(html.includes('observer-country-labels'));
 assert(draw(scene,'outcome').includes('unit-status-label victory'));assert(!draw(scene,'outcome').includes('data-effect="army"'));assert(draw(scene,'troops').includes('unit-status-label victory'));assert(draw(scene,'troops').includes('unit-loss-label'));assert(!draw(scene,'troops').includes('data-effect="army"'));assert(!draw(scene,'troops').includes('data-territory-effect='));assert(draw(scene,'territory').includes('data-territory-effect='));
});
test('zoom-aware landmarks preserve all map data and expose an explicit all-information mode',()=>{
 const w=fixture.run.world,snapshot=JSON.stringify(w),landmarks=observerLandmarks(w);assert.equal(landmarks.capitals.size,w.countries.length);assert(landmarks.frontier.size);assert.equal(landmarks.countries.length,w.countries.filter(c=>w.territories.some(t=>t.ownerId===c.id)).length);
 assert.equal(observerDetail('auto',1.4,1),'wide');assert.equal(observerDetail('auto',1.3,1.6),'regional');assert.equal(observerDetail('auto',1.8,1.6),'battle');assert.equal(observerDetail('all',.5,.5),'all');assert.equal(JSON.stringify(w),snapshot);
});
test('battle framing adapts to portrait/landscape and does not jump between rolls or waves at the same target',()=>{
 const {scene,record}=fixture;for(const viewport of [{width:1600,height:1000},{width:900,height:600},{width:390,height:844}]){const target=battleFraming(scene,record,viewport);assert(target.zoom>=.5&&target.zoom<=4.2);assert(Number.isFinite(target.x)&&Number.isFinite(target.y));}
 assert.deepEqual(cameraExtent(1200,800),[1200,800]);assert(cameraExtent(390,844)[1]>800);
 const previous=globalThis.document;globalThis.document={querySelector:()=>null,querySelectorAll:()=>[]};try{const camera=new MapCamera(),player={scene,state:{record}};camera.follow(player);const view={...camera.view('simulation')};camera.view('simulation').x+=10;camera.follow({...player,scene:{...scene,event:{...scene.event,index:999}}});assert.equal(camera.view('simulation').x,view.x+10);camera.autoFollow=false;camera.followKey=null;camera.follow(player);assert.equal(camera.view('simulation').x,view.x+10);}finally{globalThis.document=previous;}
});
test('raw die and large final score are distinct, waiting scores stay hidden and zero modifiers are omitted',()=>{
 const side={raw:24,score:30,bonus:6,ability:4,armyBonus:0,experienceBonus:2,terrainBonus:0,fatigueBonus:0};assert(renderDie(24,30,'locked','공격',6,{rawFace:true}).includes('data-die-value="24"'));
 assert(renderObserverScore(side,true).includes('<strong>30</strong>'));assert(!renderObserverScore(side,false).includes('<strong>30</strong>'));assert(renderObserverBonuses(side).includes('장군 +4'));assert(!renderObserverBonuses(side).includes('병력 +0'));
});
test('sequential defense, held territory, automatic capture and important-event timing use recorded consequences',()=>{
 const base={...fixture.battle,takenCells:[],takenTerritoryIds:[],defendersTotal:3,wave:2,winner:fixture.battle.actor};assert.equal(battleConsequence(base),'수비대 2/3 격파 · 전투 계속');assert.equal(battleConsequence({...base,winner:base.target}),'공격 격퇴 · 영토 유지');assert.equal(battleConsequence({...base,winner:null}),'무승부 · 영토 유지');assert.equal(battleConsequence({...base,automatic:true}),'무방비 영토 · 1개 점령');
 assert(observerDuration({...fixture.scene,event:{type:'death'}},fixture.record,'all')>observerDuration({...fixture.scene,event:{type:'resupply'}},fixture.record,'all'));
});
