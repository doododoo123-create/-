import test from 'node:test';
import assert from 'node:assert/strict';
import {blankWorld,validateWorld,clone} from '../src/model/world.js';
import {ADDITIVE_COMBAT_DEFAULTS,PRE_REFORM_COMBAT,combatGrade,combatCasualties} from '../src/model/combat-rules.js';
import {commandCapacity} from '../src/engine/command-reform.js';
import {createRun,nextTurn,engineFor,projectWorld,restoreRun} from '../src/engine/simulation.js';
import {makeTurnScenes,TurnPlayback} from '../src/ui/playback.js';
import {renderJudgmentOverlay} from '../src/ui/judgment-overlay.js';
import {renderArena} from '../src/ui/arena-view.js';
import {renderAtlas} from '../src/ui/atlas-view.js';
import {replayTurn} from '../src/engine/replay.js';
import {createReferenceWorld} from '../src/data/reference-world.js';
import {rulesFromForm,renderRulesEditor} from '../src/ui/rules-view.js';
function reformWorld({split=4,base=7,dispatch=100}={}){
 const w=blankWorld({rows:3,cols:4});w.rules.baseCapacity=base;w.rules.seaSupply=false;w.rules.expeditionChances.fill(dispatch);
 w.countries=['a','b'].map((id,i)=>({id,name:i?'청국':'적국',color:i?'#006bff':'#ff2028',troops:30,recruitment:0,personality:'balanced'}));
 w.people=w.countries.flatMap(c=>[{id:'king-'+c.id,name:c.id+'왕',countryId:c.id,role:'king',ability:0,personality:'balanced'},...Array.from({length:4},(_,slot)=>({id:c.id+slot,name:c.id+'장수'+slot,countryId:c.id,role:'general',ability:0,personality:'balanced',slot}))]);
 w.territories.forEach((t,i)=>t.ownerId=i<split?'a':'b');w.cartography={version:1,style:'illustrated',opacity:.2,background:null,polygons:{},links:Array.from({length:11},(_,i)=>['tile-'+i,'tile-'+(i+1)])};return validateWorld(w);
}
function syncRun(run){run.engineState.countries.forEach(c=>c.army=c.reserve+c.generals.reduce((n,g)=>n+g.troops,0));run.world=projectWorld(run.initialWorld,run.engineState);assert(engineFor(run.initialWorld).engine.validState(run.engineState));return run;}
const assault={targetId:'b',targetCells:{0:'tile-4'},rolls:{king:10,'expedition:0':1,'attack:0':30,'defense:0':1}};
test('four new loss grades use own starting strength and exact agreed rates with half-up ten-thousand rounding',()=>{
 const r=ADDITIVE_COMBAT_DEFAULTS;
 for(const [margin,grade,win,loss] of [[1,'narrow',.15,.2],[9,'narrow',.15,.2],[10,'clear',.1,.3],[19,'clear',.1,.3],[20,'major',.08,.4],[39,'major',.08,.4],[40,'rout',.05,.5],[100,'rout',.05,.5]]){
  assert.equal(combatGrade(margin,r),grade);assert.equal(combatCasualties(20,1,'win',margin,r).amount,Math.round(20*win));assert.equal(combatCasualties(20,1,'loss',margin,r).amount,Math.round(20*loss));
 }
 assert.equal(combatCasualties(20,1,'draw',0,r).amount,3);assert.equal(combatCasualties(1,20,'loss',40,r).amount,1);assert.equal(combatCasualties(1,20,'win',40,r).amount,0);
 const old={...r,...PRE_REFORM_COMBAT};assert.equal(combatCasualties(20,1,'win',40,old).amount,0);assert.equal(combatGrade(16,old),'rout');
});
test('capture thresholds move to 20 and 40 points, stay capped at three, and automatic capture stays one',()=>{
 const r=createRun(reformWorld(),7),{engine}=engineFor(r.initialWorld);for(const [gap,want]of [[1,1],[9,1],[10,1],[19,1],[20,2],[39,2],[40,3],[100,3]])assert.equal(engine.conquestLimit({winner:0,actor:0,attack:{score:gap},defense:{score:0}}),want);
 assert.equal(engine.conquestLimit({winner:1,actor:0}),0);assert.equal(engine.conquestLimit({winner:0,actor:0,automatic:true}),1);
});
test('capacity starts at seven, gains once per three wins through nine and caps combined traits and policy at 25',()=>{
 const r=ADDITIVE_COMBAT_DEFAULTS,c={commandBonus:0,supplyBonus:0},g={commandBonus:0};
 for(const [wins,want]of [[0,7],[2,7],[3,8],[5,8],[6,9],[8,9],[9,10],[12,10],[100,10]])assert.equal(commandCapacity(c,{...g,wins},r,7),want);
 assert.equal(commandCapacity({...c,commandBonus:1},{...g,commandBonus:1,wins:0},r,7),9);assert.equal(commandCapacity({...c,commandBonus:-1},{...g,commandBonus:-1},r,7),5);
 assert.equal(commandCapacity({...c,supplyBonus:99},{...g,wins:99},r,7),25);
 const run=createRun(reformWorld(),7);assert(run.world.people.filter(p=>p.role==='general'&&p.active).every(g=>g.capacity===7&&g.troops<=7));
});
test('a real third victory grants +1 capacity and combat XP without fabricating troops; succession resets both',()=>{
 let r=createRun(reformWorld(),7),g=r.engineState.countries[0].generals[0];g.wins=2;g.position=3;g.station=3;syncRun(r);
 r=nextTurn(r,assault);g=r.engineState.countries[0].generals[0];assert.equal(g.wins,3);assert.equal(engineFor(r.initialWorld).engine.capacity(r.engineState.countries[0],g),8);assert.equal(r.history[0].battles[0].attack.experienceBonus,2);assert(g.troops<7);
 let dead=createRun(reformWorld(),7),c=dead.engineState.countries[0],officer=c.generals[0];officer.alive=false;officer.waited=3;officer.wins=9;officer.troops=0;officer.position=null;syncRun(dead);
 dead=nextTurn(dead,{rolls:{king:1,minister:1,domestic:1,'successor:0':9}});const replacement=dead.world.people.find(p=>p.countryId==='a'&&p.role==='general'&&p.slot===0);assert.equal(replacement.wins,0);assert.equal(replacement.capacity,7);
});
test('only a king domestic choice triggers ordinary home return; refused war keeps current garrison',()=>{
 for(const domestic of [true,false]){
  const r=createRun(reformWorld({dispatch:0}),7),g=r.engineState.countries[0].generals[0];g.station=3;g.position=0;syncRun(r);
  const n=nextTurn(r,domestic?{rolls:{king:1,minister:1,domestic:1}}:assault);assert.equal(n.engineState.countries[0].generals[0].position,domestic?3:0);assert.equal(n.history[0].events.some(e=>e.type==='home_return'),domestic);
 }
});
test('capital-return veterans get a viable reserve allocation and can attack without owning a personal region',()=>{
 const r=createRun(reformWorld(),7),s=r.engineState,c=s.countries[0],v=c.generals[2];v.active=true;v.appointed=true;v.alive=true;v.station=3;v.position=3;v.troops=0;c.generals[0].troops=0;c.reserve=6;syncRun(r);
 const n=nextTurn(r,{...assault,targetCells:{2:'tile-4'},rolls:{...assault.rolls,'expedition:2':1,'attack:2':30,'defense:2':1}});
 assert.equal(n.history[0].events.find(e=>e.type==='resupply').allocated[2],1);assert(n.history[0].events.some(e=>e.type==='expedition_roll'&&e.slot===2));assert(n.history[0].battles.some(b=>b.slot===2));
});
test('newly recovered land is assigned to a living veteran before a fresh low-numbered candidate',()=>{
 const r=createRun(reformWorld(),7),s=r.engineState,c=s.countries[0],v=c.generals[2];v.active=true;v.appointed=true;v.station=3;v.position=3;v.troops=4;s.cells[4].owner=0;s.cells[4].commander=0;const {engine}=engineFor(r.initialWorld);engine.reconcile(s);syncRun(r);
 assert(s.cells.some(t=>t.owner===0&&t.commander===2));assert(!c.generals[1].active);assert.equal(v.troops,4);assert.equal(v.wins,0);
 const restored=restoreRun(JSON.parse(JSON.stringify(r)));assert.deepEqual(restored.engineState,s);
});
test('choices become deterministic reels, dispatch rolls stay in the log and only refusals show a portrait window',()=>{
 const run=createRun(reformWorld({dispatch:0}),7),n=nextTurn(run,assault),record=n.history[0],saved=JSON.stringify(n),scenes=makeTurnScenes(record,run.world);
 assert(record.rolls.some(r=>r.type==='expedition_roll'&&r.sides===100));assert(!scenes.some(s=>s.event?.type==='expedition_roll'));
 for(const type of ['king','war_target'])assert(scenes.some(s=>s.event?.type===type&&s.kind==='reel'));
 const player=new TurnPlayback();player.load(record,run.world,n.world,false);player.state.index=scenes.findIndex(s=>s.event?.type==='hold');player.state.phase='holding';
 for(const html of [renderJudgmentOverlay({world:run.world,playback:player}),renderArena({world:run.world,run:n,playback:player})]){assert(html.includes('출정 거부'));assert(html.includes('병력'));assert(html.includes('data-portrait-key'));assert(!html.includes('data-die-sides'));}
 const domestic=nextTurn(run,{rolls:{king:1,minister:10,domestic:10,supply_gain:1}});assert(makeTurnScenes(domestic.history[0],run.world).some(s=>s.event?.type==='minister'&&s.kind==='reel'));assert.equal(JSON.stringify(n),saved);
});
test('combat portrait captions use recorded starting troops and stars; route stroke and head match each country',()=>{
 const r=createRun(reformWorld({base:20}),7),g=r.engineState.countries[0].generals[0];g.position=3;g.station=3;g.wins=6;syncRun(r);const n=nextTurn(r,assault),p=new TurnPlayback();p.load(n.history[0],r.world,n.world,false);
 p.state.index=p.state.scenes.findIndex(s=>s.event?.type==='attack_roll');p.state.phase='locked';const html=renderJudgmentOverlay({world:r.world,playback:p});assert(html.includes('★★'));assert(html.includes(`병력 ${n.history[0].battles[0].attack.army}만`));assert(!html.includes('적국 · 장군'));
 const map=renderAtlas(p.scene.worldBefore,{presentation:p.state});assert(map.includes('style="stroke:#ff2028"'));assert(map.includes('fill="#ff2028"'));assert(map.includes('battle-swords-outline'));
});
test('new settings remain editable and reject unordered loss grades or unsupported capacity growth',()=>{
 const w=reformWorld();assert(renderRulesEditor(w.rules).includes('name="capacityCap"'));assert(renderRulesEditor(w.rules).includes('name="combat-loss-major-1"'));
 for(const change of [w=>w.rules.lossThresholds=[10,40,20],w=>w.rules.capacityWinStep=0,w=>w.rules.capacityCap=0,w=>w.rules.combatLosses.major=[.08,2]]){const x=clone(w);change(x);assert.throws(()=>validateWorld(x));}
});
test('new campaigns save, resume and replay recorded choices, losses, capacity and movements exactly',async()=>{
 let r=createRun(createReferenceWorld(),20261020);for(let i=0;i<60&&!r.result;i++){r=nextTurn(r);assert(engineFor(r.initialWorld).engine.validState(r.engineState));assert(r.world.people.filter(p=>p.role==='general'&&p.active).every(g=>g.capacity<=25&&Number.isInteger(g.troops)));}
 const saved=JSON.stringify(r),restored=restoreRun(JSON.parse(saved));assert.deepEqual(nextTurn(restored).engineState,nextTurn(r).engineState);
 for(const turn of [1,19,45]){const replay=await replayTurn(restored,turn);assert.deepEqual(replay.record.rolls,r.history[turn-1].rolls);assert.deepEqual(replay.record.battles,r.history[turn-1].battles);}
 assert.equal(JSON.stringify(r),saved);
});
