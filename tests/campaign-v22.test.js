import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {campaign22Fixture,campaign22Controls} from './campaign-v22-fixture.mjs';
import {createRun,nextTurn,engineFor,restoreRun,projectWorld} from '../src/engine/simulation.js';
import {createContinent160World} from '../src/data/continent160-world.js';
import {enableCampaignV22,CAMPAIGN_V22_DEFAULTS} from '../src/model/campaign-v22.js';
import {validateWorld,clone} from '../src/model/world.js';
import {advanceDefenders} from '../src/engine/advance-defenders.js';
import {initializeStrategy,selectStrategicTarget,strategicScores,finishStrategicTurn,strategicThreats} from '../src/engine/strategic-targets.js';
import {reorganizeSurvivors} from '../src/engine/campaign-survivors.js';
import {replayTurn} from '../src/engine/replay.js';
import {geometryFor} from '../src/model/cartography-geometry.js';
import {buildFrontWave,frontWaveAt,frontSequenceProgress} from '../src/ui/front-wave.js';
import {makeTurnScenes,TurnPlayback} from '../src/ui/playback.js';
import {roundCampaign} from '../src/ui/round-campaign.js';
import {renderAtlas} from '../src/ui/atlas-view.js';
import {renderCommanderOverview} from '../src/ui/commander-overview.js';
import {publicRoyalEvents} from '../src/ui/royal-overview.js';
import {TEXT_BOX_ART} from '../src/data/text-box-art.js';
const war=(fixture=campaign22Fixture(),controls=campaign22Controls())=>nextTurn(fixture,controls);
test('empty provinces expand to three only after checking each next territory; old switch-off games still auto-capture one',()=>{
 const r=campaign22Fixture({empty:true}),n=war(r),b=n.history[0].battles[0];assert(b.automatic);assert.deepEqual(b.takenCells,[4,5,6]);assert.equal(n.world.people.find(p=>p.id==='a0').wins,0);assert.equal(n.history[0].rolls.filter(r=>['attack_roll','defense_roll'].includes(r.type)).length,0);
 const old=clone(r.initialWorld);old.rules.continuousCampaign=false;const prior=createRun(old,777);prior.engineState=clone(r.engineState);prior.world=projectWorld(old,prior.engineState);assert.equal(war(prior).history[0].battles[0].takenCells.length,1);
});
test('additional conquest checks remote home and nearby relief commanders, fights them sequentially and never renews its original allowance',()=>{
 const n=war(),bs=n.history[0].battles.filter(b=>b.operationId===0);assert.deepEqual(bs.flatMap(b=>b.takenCells),[4,5,6]);assert(bs.some(b=>b.cellId===5&&b.defenseSlot===1&&!b.automatic));assert(bs.some(b=>b.cellId===5&&b.defenseSlot===2&&!b.automatic));assert.equal(bs[1].takenCells.length,0);assert(bs.slice(1).every(b=>b.continuation==='advance'));assert(bs.flatMap(b=>b.takenCells).length<=3);
});
test('a different surviving defender can stop an extension after one capture, while a large defensive victory initiates a real counterattack',()=>{
 const c=campaign22Controls();c.rolls['attack:0:chain:1']=1;c.rolls['defense:0:chain:1']=20;const n=war(campaign22Fixture(),c),bs=n.history[0].battles.filter(b=>b.operationId===0);assert.deepEqual(bs[0].takenCells,[4]);assert.equal(bs[1].winner,1);assert.equal(bs[1].takenCells.length,0);if(bs[1].counterCaptureLimit)assert(bs.some(b=>b.continuation==='counter'));
});
test('counterattacks and counter-counterattacks fight new defenders without reusing a defeated officer or creating an infinite chain',()=>{
 const c=campaign22Controls();c.rolls['attack:0:chain:1']=1;c.rolls['defense:0:chain:1']=30;c.rolls['attack:1:chain:2']=1;c.rolls['defense:1:chain:2']=30;const n=war(campaign22Fixture({secondArmy:7}),c),bs=n.history[0].battles.filter(b=>b.operationId===0);assert.deepEqual(bs.slice(0,4).map(b=>b.actor),[0,0,1,0]);assert.equal(bs[2].defenseSlot,1);assert(bs[3].takenCells.length);const defeated=new Set();for(const b of bs){assert(!defeated.has(b.actor+':'+b.slot));if(!b.automatic)assert(!defeated.has(b.target+':'+b.defenseSlot));if(b.winner!==null&&!b.automatic)defeated.add((b.winner===b.actor?b.target:b.actor)+':'+(b.winner===b.actor?b.defenseSlot:b.slot));}assert(bs.length<20);assert(engineFor(n.initialWorld).engine.validState(n.engineState));
});
test('fatigue carries actual travel through an operation without charging the original march again on each defending wave',()=>{
 const n=war(),bs=n.history[0].battles.filter(b=>!b.automatic&&b.operationId===0);assert.equal(bs[0].attack.movementEdges,3);assert.equal(bs[0].attack.fatigueBonus,0);assert.equal(bs[1].attack.movementEdges,4);assert.equal(bs[1].attack.fatigueBonus,-2);assert.equal(bs[2].attack.movementEdges,4);
});
test('rout death is triggered by score margin even if only one territory is captured and further conquest fails',()=>{
 const c=campaign22Controls();c.rolls['death:0']=1;c.rolls['attack:0:chain:1']=1;c.rolls['defense:0:chain:1']=30;const n=war(campaign22Fixture(),c),b=n.history[0].battles[0],roll=n.history[0].events.find(e=>e.type==='death_roll'&&e.battleIndex===0);assert(b.defense.army-b.losses.defense.amount>0);assert.equal(b.takenCells.length,1);assert(b.attack.score-b.defense.score>=20);assert.equal(roll.reason,'rout');assert.equal(roll.faces,10);assert.equal(roll.threshold,1);assert(n.history[0].events.some(e=>e.type==='death'&&e.battleIndex===0));
});
test('the rout-death threshold follows the world three-cell score threshold, not 40-point loss grades or real territory counts',()=>{
 const r=campaign22Fixture(),c=campaign22Controls(20,1);c.rolls['death:0']=1;const n=war(r,c);assert.equal(n.history[0].battles[0].attack.score-n.history[0].battles[0].defense.score,19);assert(!n.history[0].events.some(e=>e.type==='death_roll'&&e.battleIndex===0));
 const high=campaign22Fixture();high.initialWorld=clone(high.initialWorld);high.initialWorld.rules.captureThresholds=[20,40];high.world=projectWorld(high.initialWorld,high.engineState);const m=war(high,campaign22Controls());assert(!m.history[0].events.some(e=>e.type==='death_roll'&&e.battleIndex===0));
});
test('zero-army casualties retain the original 30-percent roll and do not also roll rout death',()=>{
 const r=campaign22Fixture();r.engineState.countries[1].generals[0].troops=1;r.engineState.countries[1].army-=6;r.world=projectWorld(r.initialWorld,r.engineState);const c=campaign22Controls();c.rolls['death:0']=3;const n=war(r,c),rolls=n.history[0].events.filter(e=>e.type==='death_roll'&&e.battleIndex===0);assert.equal(rolls.length,1);assert.equal(rolls[0].reason,'annihilation');assert.equal(rolls[0].threshold,3);assert(rolls[0].died);
});
test('a rout-dead commander transfers remaining soldiers rather than counting them as casualties or leaving troops on a dead card',()=>{
 const c=campaign22Controls();c.rolls['death:0']=1;const n=war(campaign22Fixture(),c),e=n.history[0].events.find(e=>e.type==='death'&&e.battleIndex===0),g=n.engineState.countries[1].generals[0];assert(e.survivors>0);assert.equal(g.troops,0);assert.equal(g.alive,false);assert.equal(e.transfer.transferred+e.transfer.waiting,e.survivors);assert(n.engineState.countries.every(c=>c.reserve<=10));assert(engineFor(n.initialWorld).engine.validState(n.engineState));
});
test('reorganization overflow is preserved outside the ten-unit capital cap and later allocated within personal command limits',()=>{
 const s={countries:[{reserve:10,reorganization:12,generals:[{slot:0,active:true,alive:true,troops:25},{slot:1,active:true,alive:false,troops:0}]}]};let x=reorganizeSurvivors(s,0,{capitalReserveLimit:10},()=>25,5);assert.equal(x.waiting,12);assert.equal(s.countries[0].reserve,10);s.countries[0].generals[0].troops=18;x=reorganizeSurvivors(s,0,{capitalReserveLimit:10},()=>25,5);assert.equal(x.transferred,7);assert.equal(x.waiting,5);
});
function strategyFixture(){const r=campaign22Fixture({secondArmy:7}),s=r.engineState;for(const c of s.countries)initializeStrategy(s,c.id);return {r,s,atlas:engineFor(r.initialWorld).engine.ATLAS,rules:{...r.initialWorld.rules,...CAMPAIGN_V22_DEFAULTS}};}
test('first strategic target is uniformly drawn from eligible neighbors, then persists through minor attacks by other countries',()=>{
 const {s,atlas,rules}=strategyFixture();const first=selectStrategicTarget(s,atlas,0,[1],rules,(_,n)=>{assert.equal(n,1);return 0;});assert.equal(first.primary,1);finishStrategicTurn(s,0,'war',s.cells.map(c=>c.owner),1);const before=s.countries[0].strategy.primary;s.countries[0].strategy.capitalAttackers=[];selectStrategicTarget(s,atlas,0,[1],rules,()=>{throw Error('No reroll while continuing');});assert.equal(s.countries[0].strategy.primary,before);
});
test('finishing preference covers one through seven enemy territories and ends exactly at eight',()=>{
 const {s,atlas,rules}=strategyFixture();let score=strategicScores(s,atlas,0,[1],rules)[0];assert.equal(score.lands,7);assert.equal(score.components.finish,20);s.cells[11].owner=1;score=strategicScores(s,atlas,0,[1],rules)[0];assert.equal(score.lands,8);assert.equal(score.components.finish,0);
});
test('capital emergencies temporarily divert a primary goal without forgetting it or multiplying targets',()=>{
 const {s,atlas,rules}=strategyFixture(),t=s.countries[0].strategy;t.primary=1;s.capitals[0]=3;t.baselineCapital=3;s.cells[11].owner=0;s.cells[11].commander=1; // Give the third nation a real border route near the capital.
 s.cells[2].owner=2;s.countries[2].generals[0].position=2;s.countries[2].generals[0].troops=7;s.countries[2].generals[0].stranded=false;t.capitalAttackers=[2];
 const x=selectStrategicTarget(s,atlas,0,[1,2],rules,()=>0);assert.equal(x.primary,1);assert.equal(x.temporary,2);assert.equal(x.target,2);assert.equal(x.mode,'temporary');
 t.capitalAttackers=[];t.baselineOwners=s.cells.map(c=>c.owner);assert(strategicThreats(s,atlas,0,[1,2],rules).some(v=>v.target===2));
 s.countries[2].generals[0].troops=0;s.cells[2].owner=0;const y=selectStrategicTarget(s,atlas,0,[1],rules,()=>0);assert.equal(y.primary,1);assert.equal(y.temporary,null);assert.equal(y.target,1);
});
test('stagnation penalties increase only for primary war orders, and domestic turns do not consume commitment',()=>{
 const {s,atlas,rules}=strategyFixture(),before=s.cells.map(c=>c.owner);selectStrategicTarget(s,atlas,0,[1],rules,()=>0);const t=s.countries[0].strategy,commit=t.committed;finishStrategicTurn(s,0,'domestic',before,1);assert.equal(t.committed,commit);assert.equal(t.stagnant,0);for(let i=0;i<3;i++)finishStrategicTurn(s,0,'war',before,1);assert.equal(strategicScores(s,atlas,0,[1],rules)[0].components.stagnation,-30);for(let i=0;i<5;i++)finishStrategicTurn(s,0,'war',before,1);assert.equal(strategicScores(s,atlas,0,[1],rules)[0].components.stagnation,-60);
});
test('new settings are editable, validated and leave old definitions opted out',()=>{
 const old=campaign22Fixture().initialWorld,enabled=enableCampaignV22(old);assert.equal(enabled.rules.strategyWeakLands,7);for(const [key,value] of [['unopposedCaptureLimit',4],['routDeathChance',101],['strategyWeakLands',0],['continuousCampaign','yes']])assert.throws(()=>validateWorld({...enabled,rules:{...enabled.rules,[key]:value}}));const historic=clone(enabled);for(const key of Object.keys(CAMPAIGN_V22_DEFAULTS))delete historic.rules[key];assert.equal(validateWorld(historic).rules.continuousCampaign,false);
});
test('curved front and occupied fill are generated at the same threshold from the shared land border',()=>{
 const r=campaign22Fixture({empty:true}),n=war(r),world=n.world,geometry=geometryFor(world),model=buildFrontWave(world,geometry,4,'tile-3');const before=frontWaveAt(model,0),half=frontWaveAt(model,.5),done=frontWaveAt(model,1);assert.equal(before.fill,'');assert(half.fill.includes('Z'));assert(half.front.includes('Q'));assert.notEqual(half.fill,done.fill);assert.equal(done.fill,geometry.cells[4].path);assert.equal(done.front,'');assert(model.distance.every(Number.isFinite));assert.equal(buildFrontWave(world,geometry,4,'tile-3'),model);
});
test('three captured provinces advance sequentially rather than running three independent simultaneous wipes',()=>{
 assert.deepEqual([0,1,2].map(i=>frontSequenceProgress(.2,i,3)),[.6000000000000001,0,0]);assert.deepEqual([0,1,2].map(i=>frontSequenceProgress(.5,i,3)),[1,.5,0]);const r=campaign22Fixture({empty:true}),n=war(r),scenes=makeTurnScenes(n.history[0],r.world),index=scenes.findIndex(s=>s.kind==='capture'),p={record:n.history[0],before:r.world,scenes,index,phase:'holding',roundRecords:[]},campaign=roundCampaign(scenes[index].worldAfter,p),captures=[...campaign.captures.values()];assert.deepEqual(captures.map(c=>c.sequenceIndex),[0,1,2]);const html=renderAtlas(scenes[index].worldAfter,{presentation:p});assert(html.includes('data-front-wave='));assert(html.includes('moving-front-color'));assert(html.includes('stroke-width="2.2"'));
});
test('supplied six textures are exact offline WebP assets and labels use patterns instead of map overlays',()=>{
 assert.equal(Object.keys(TEXT_BOX_ART).length,6);for(const [key,data] of Object.entries(TEXT_BOX_ART))assert.equal(data,'data:image/webp;base64,'+readFileSync('assets/text-boxes/'+key+'.webp').toString('base64'));const r=campaign22Fixture(),n=war(r),s=makeTurnScenes(n.history[0],r.world).find(s=>s.kind==='apply'&&s.event.type==='resolve'),html=renderAtlas(s.worldBefore,{presentation:{record:n.history[0],scenes:[s],index:0,phase:'holding'}});assert(html.includes('text-box-war'));assert(html.includes('style="fill:url(#text-box-war)"'));
});
test('king and minister overviews expose role-appropriate facts and never show unrevealed choices or policy results',()=>{
 const w=enableCampaignV22(createContinent160World()),r=createRun(w,777),n=nextTurn(r,{rolls:{king:1,minister:1,domestic:10}}),p=new TurnPlayback();p.load(n.history[0],r.world,n.world,false,n.history);const king=n.world.people.find(p=>p.role==='king'&&p.countryId===n.history[0].actorId),minister=n.world.people.find(p=>p.role==='minister'&&p.countryId===king.countryId);assert.equal(publicRoyalEvents(king,n.history,p.state).length,0);p.state.index=p.state.scenes.findIndex(s=>s.kind==='apply'&&s.event.type==='resolve');assert.equal(publicRoyalEvents(minister,n.history,p.state).length,1);for(const person of [king,minister]){const html=renderCommanderOverview({world:p.scene.worldAfter,personId:person.id,history:n.history,presentation:p.state,popover:true});assert(html.includes(`data-person-role="${person.role}"`));assert(!html.includes('undefined'));assert(html.includes(person.role==='king'?'주공 목표':'정책 성향'));}
});
test('new campaigns preserve strategy, positive-troop death transfers, chained battles and RNG through save and historical replay',async()=>{
 let r=createRun(enableCampaignV22(createContinent160World()),777);for(let i=0;i<40&&!r.result;i++)r=nextTurn(r);assert(r.history.some(x=>x.battles.some(b=>b.continuation==='counter')));assert(r.history.some(x=>x.events.some(e=>e.type==='death'&&e.survivors>0)));const saved=JSON.stringify(r),restored=restoreRun(JSON.parse(saved));assert.deepEqual(nextTurn(r).engineState,nextTurn(restored).engineState);for(const turn of [1,17,38]){const replay=await replayTurn(restored,turn);assert.deepEqual(replay.record.battles,r.history[turn-1].battles);assert.deepEqual(replay.record.rolls,r.history[turn-1].rolls);}assert.equal(JSON.stringify(r),saved);
});
test('capital-adjacent bonus territory is checked and defended instead of annexing its available commander automatically',()=>{
 const r=campaign22Fixture();r.initialWorld=clone(r.initialWorld);r.initialWorld.rules.capitalFallAnnexation=true;r.engineState.capitals[1]=4;r.world=projectWorld(r.initialWorld,r.engineState);const c=campaign22Controls();c.rolls['attack:0:chain:1']=1;c.rolls['defense:0:chain:1']=30;const n=war(r,c),bs=n.history[0].battles;assert.deepEqual(bs[0].takenCells,[4]);assert.equal(bs[0].capitalFall.capital,4);assert.deepEqual(bs[0].capitalFall.neighbors,[5]);assert(bs.some(b=>b.cellId===5&&!b.automatic));assert.equal(bs.find(b=>b.cellId===5).winner,1);assert.equal(n.engineState.cells[5].owner,1);assert(engineFor(n.initialWorld).engine.validState(n.engineState));
});
test('an attacker with remaining soldiers can die from a three-cell-grade defeat even when the original battle captures no territory',()=>{
 const r=campaign22Fixture({secondArmy:7}),c=campaign22Controls(1,30);c.rolls['death:0']=1;const n=war(r,c),b=n.history[0].battles[0],roll=n.history[0].events.find(e=>e.type==='death_roll'&&e.battleIndex===0);assert.equal(b.winner,1);assert.deepEqual(b.takenCells,[]);assert(b.after.attack>0);assert.equal(roll.nation,0);assert.equal(roll.reason,'rout');assert(roll.died);assert.equal(n.engineState.countries[0].generals[0].alive,false);
});
