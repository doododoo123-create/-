import test from 'node:test';import assert from 'node:assert/strict';
import {createDemoWorld} from '../src/data/demo-world.js';
import {createRun,nextTurn,projectWorld} from '../src/engine/simulation.js';
import {makeTurnScenes,TurnPlayback} from '../src/ui/playback.js';
import {mapEffects} from '../src/ui/map-effects.js';
import {renderJudgmentOverlay} from '../src/ui/judgment-overlay.js';
import {renderMapStage} from '../src/ui/map-stage.js';
import {renderAtlas} from '../src/ui/atlas-view.js';
function domestic(minister,success=10){const r=createRun(createDemoWorld(),123456),next=nextTurn(r,{rolls:{king:1,minister,domestic:success}});return {before:r.world,run:next,scenes:makeTurnScenes(next.history[0],r.world)};}
const applied=(f,type='resolve')=>f.scenes.find(s=>s.kind==='apply'&&s.event.type===type);
test('recruitment maps each exact recipient and shows no fictitious capital gain',()=>{
 const f=domestic(1),scene=applied(f),effects=mapEffects(scene),army=effects.units.filter(e=>e.type==='army');
 assert.equal(army.reduce((n,e)=>n+e.delta,0),3);assert.ok(army.every(e=>e.role==='general'&&e.delta>0));assert.ok(!effects.units.some(e=>['capacity','recruitment'].includes(e.type)));
 assert.equal(mapEffects(f.scenes.find(s=>s.kind==='result')).units.length,0);
 const html=renderAtlas(scene.worldAfter,{presentation:{record:f.run.history[0],scenes:f.scenes,index:f.scenes.indexOf(scene)}});assert.equal((html.match(/data-effect="army"/g)||[]).length,army.length);
});
test('production and supply upgrades never masquerade as an immediate troop increase',()=>{
 const production=mapEffects(applied(domestic(3)));assert.equal(production.units.filter(e=>e.type==='recruitment')[0].delta,3);assert.ok(!production.units.some(e=>e.type==='army'));
 const supply=mapEffects(applied(domestic(10)));assert.equal(supply.units.filter(e=>e.type==='supply')[0].delta,5);assert.equal(supply.units.filter(e=>e.type==='capacity').length,5);assert.ok(supply.units.filter(e=>e.type==='capacity').every(e=>e.delta===5&&e.label==='한도 +5만'));assert.ok(!supply.units.some(e=>e.type==='army'));
});
test('capital resupply conserves troops and is announced only after the central judgment',()=>{
 let r=createRun(createDemoWorld(),7);r.engineState.countries[0].reserve+=5;r.engineState.countries[0].army+=5;r.world=projectWorld(r.initialWorld,r.engineState);
 const after=nextTurn(r,{rolls:{king:1,minister:1,domestic:1}}),scenes=makeTurnScenes(after.history[0],r.world),focus=scenes.find(s=>s.event?.type==='resupply'&&s.kind!=='apply'),apply=scenes.find(s=>s.event?.type==='resupply'&&s.kind==='apply');
 assert.equal(focus.worldAfter.countries[0].reserve,10);assert.equal(apply.worldAfter.countries[0].reserve,5);assert.equal(mapEffects(focus).units.filter(e=>e.type!=='notice').length,0);
 const army=mapEffects(apply).units.filter(e=>e.type==='army');assert.equal(army.reduce((n,e)=>n+e.delta,0),0);assert.equal(army.find(e=>e.role==='king').delta,-5);assert.equal(army.filter(e=>e.role==='general').reduce((n,e)=>n+e.delta,0),5);
});
test('battle feedback uses the two actual units and only the currently captured territories',()=>{
 const r=createRun(createDemoWorld(),123456),after=nextTurn(r,{rolls:{king:10,'attack:0':10,'defense:0':1},targetId:1});
 const record=after.history[0],b=record.battles[0],scenes=makeTurnScenes(record,r.world),apply=scenes.find(s=>s.kind==='apply'&&s.event.type==='resolve'&&s.battleIndex===0),effects=mapEffects(apply);
 assert.equal(effects.units.find(e=>e.type==='army'&&e.countryId===b.actorId&&e.slot===b.slot).delta,-b.losses.attack.amount);
 assert.equal(effects.units.find(e=>e.type==='army'&&e.countryId===b.defenderId&&e.slot===b.defenseSlot).delta,-b.losses.defense.amount);
 assert.deepEqual(effects.territories.map(e=>e.territoryId).sort(),[...b.takenTerritoryIds].sort());
 const result=scenes.find(s=>s.kind==='result'&&s.battleIndex===0);assert.equal(mapEffects(result).territories.length,0);assert.ok(effects.territories.every(e=>e.countryId===b.actorId));
});
test('round production labels equal the actual net gain, not a declared pre-discard total',()=>{
 let r=createRun(createDemoWorld(),15);for(let i=0;i<7;i++){const before=r.world;r=nextTurn(r,{rolls:{king:1,minister:1,domestic:1}});if(i===6){const scenes=makeTurnScenes(r.history.at(-1),before),apply=scenes.find(s=>s.kind==='apply'&&s.event.type==='round_end'),effects=mapEffects(apply);const net=apply.worldAfter.countries.reduce((n,c)=>n+c.troops,0)-apply.worldBefore.countries.reduce((n,c)=>n+c.troops,0);assert.equal(effects.units.filter(e=>e.type==='army').reduce((n,e)=>n+e.delta,0),net);}}
});
test('failed domestic action has a single zero-change notice and no troop or upgrade labels',()=>{
 const effects=mapEffects(applied(domestic(1,1)));assert.deepEqual(effects.units.map(e=>[e.type,e.delta,e.label]),[['unchanged',0,'+0만 · 변화 없음']]);
});
test('fullscreen contains only the map at rest and after completion; results vanish before effects',()=>{
 const f=domestic(1),player=new TurnPlayback();const ready=renderMapStage({world:f.before,run:null,playback:player});assert.ok(!ready.includes('map-judgment'));assert.ok(!ready.includes('map-stage-sidebar'));assert.ok(!ready.includes('visual-nation-card'));assert.ok(ready.includes('map-play-toggle'));
 player.load(f.run.history[0],f.before,f.run.world,false);while(player.scene.kind!=='result')player.step();assert.equal(renderJudgmentOverlay({world:player.displayWorld,playback:player}),'');assert(mapEffects(player.scene,null,f.run.history[0]).units.some(e=>e.role==='minister'&&e.type==='notice'));
 const old=player.displayWorld;player.step();assert.equal(player.state.phase,'departing');assert.equal(player.displayWorld,old);player.step();assert.equal(player.scene.kind,'apply');assert.equal(renderJudgmentOverlay({world:player.displayWorld,playback:player}),'');assert.ok(mapEffects(player.scene).units.length>0);
 player.finish();assert.equal(renderJudgmentOverlay({world:player.displayWorld,playback:player}),'');
});
test('a fallen general is marked at the previous station after its living troop card disappears',()=>{
 const r=createRun(createDemoWorld(),123456),next=nextTurn(r,{rolls:{king:10,'attack:0':1,'defense:0':10,'death:0':1},targetId:1});
 const record=next.history[0],scenes=makeTurnScenes(record,r.world),scene=scenes.find(s=>s.kind==='apply'&&s.event.type==='death');assert.ok(scene);
 const effect=mapEffects(scene).units.find(e=>e.type==='death');assert.equal(effect.label,'전사');
 assert.ok(!scene.worldAfter.people.find(p=>p.countryId===effect.countryId&&p.slot===effect.slot&&p.alive&&p.active));
 const html=renderAtlas(scene.worldAfter,{presentation:{record,scenes,index:scenes.indexOf(scene),phase:'holding'}});assert.ok(html.includes('data-effect="death"'));
});
test('unallocated isolated production has no invented +troops label',()=>{
 const world=createDemoWorld();world.territories[79].ownerId='nation-0';world.countries[0].troops=1000;
 let r=createRun(world,7);const c=r.engineState.countries[0],isolated=c.generals.find(g=>g.station===79);assert.ok(isolated);isolated.troops=r.world.people.find(p=>p.countryId==='nation-0'&&p.slot===isolated.slot).capacity;c.army+=isolated.troops;r.world=projectWorld(r.initialWorld,r.engineState);
 for(let i=0;i<7;i++){const before=r.world;r=nextTurn(r,{rolls:{king:1,minister:1,domestic:1}});if(i===6){const record=r.history.at(-1),scenes=makeTurnScenes(record,before),scene=scenes.find(s=>s.kind==='apply'&&s.event.type==='round_end'),gain=record.production.find(p=>p.countryId==='nation-0'),effects=mapEffects(scene);assert.equal(gain.discarded,1);const delta=effects.units.filter(e=>e.type==='army'&&e.countryId==='nation-0').reduce((n,e)=>n+e.delta,0);assert.equal(delta,gain.rate-gain.discarded);assert.equal(delta,gain.gain);assert.ok(!effects.units.some(e=>e.type==='army'&&e.countryId==='nation-0'&&e.slot===isolated.slot));}}
});
test('one manual death judgment includes disappearance of the central card and applying death',()=>{
 const r=createRun(createDemoWorld(),123456),next=nextTurn(r,{rolls:{king:10,'attack:0':1,'defense:0':10,'death:0':1},targetId:1});
 const callbacks=[];const player=new TurnPlayback({schedule:fn=>{callbacks.push(fn);return callbacks.length;},cancel:()=>{}});player.load(next.history[0],r.world,next.world,false);
 while(player.scene.event?.type!=='death_roll')player.step();player.playGroup();for(let i=0;i<100&&player.playing;i++){const fn=callbacks.shift();assert.ok(fn);fn();}
 assert.equal(player.playing,false);assert.equal(player.scene.kind,'apply');assert.equal(player.scene.event.type,'death');assert.equal(player.state.phase,'settled');
 const person=player.displayWorld.people.find(p=>p.countryId===player.scene.event.nationId&&p.role==='general'&&p.slot===player.scene.event.slot);assert.equal(person.alive,false);assert.equal(renderJudgmentOverlay({world:player.displayWorld,playback:player}),'');
});
