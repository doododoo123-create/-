import test from 'node:test';
import assert from 'node:assert/strict';
import {blankWorld,validateWorld,clone} from '../src/model/world.js';
import {calendarAtRound} from '../src/model/calendar.js';
import {createRun,nextTurn,engineFor,projectWorld,restoreRun} from '../src/engine/simulation.js';
import {nearbyRetreatDestination} from '../src/engine/battlefield-movement.js';
import {replayTurn} from '../src/engine/replay.js';
import {TurnPlayback,makeTurnScenes} from '../src/ui/playback.js';
import {roundCampaign,completedRoundPresentation,renderRoundRoutes} from '../src/ui/round-campaign.js';
import {renderAtlas} from '../src/ui/atlas-view.js';
import {geometryFor} from '../src/model/cartography-geometry.js';
import {renderJudgmentOverlay} from '../src/ui/judgment-overlay.js';
import {mapEffects} from '../src/ui/map-effects.js';
import {MapCamera,mapZoomControls} from '../src/ui/map-camera.js';
import {mapUnitScale,duelDirection} from '../src/ui/battle-presentation.js';
function fixture18(split=4){
 const w=blankWorld({rows:3,cols:4});Object.assign(w.rules,{seaSupply:false,baseCapacity:25,territoryArmyLimit:100,expeditionChances:[100,100,100,100,100,100]});
 w.countries=['a','b'].map((id,i)=>({id,name:id,color:i?'#006bff':'#ff2028',troops:45,recruitment:0,personality:'balanced',capitalId:'tile-'+(i?11:0)}));
 w.people=w.countries.flatMap(c=>[{id:'king-'+c.id,countryId:c.id,name:c.id+'왕',role:'king',ability:0,personality:'balanced'},...Array.from({length:3},(_,slot)=>({id:c.id+slot,countryId:c.id,name:c.id+slot,role:'general',ability:0,personality:'balanced',slot}))]);
 w.territories.forEach((t,i)=>t.ownerId=i<split?'a':'b');w.cartography={version:1,style:'classic',opacity:.3,background:null,polygons:{},links:Array.from({length:11},(_,i)=>['tile-'+i,'tile-'+(i+1)])};
 const r=createRun(validateWorld(w),7),s=r.engineState;s.countries[0].generals[0].station=1;s.countries[0].generals[0].position=split-1;s.countries[1].generals[0].station=Math.min(11,split+2);s.countries[1].generals[0].position=split;
 for(const c of s.countries){c.reserve=5;for(const g of c.generals)g.troops=g.active?20:0;}return sync18(r);
}
function sync18(r){for(const c of r.engineState.countries)c.army=c.reserve+c.generals.reduce((n,g)=>n+g.troops,0);r.world=projectWorld(r.initialWorld,r.engineState);assert(engineFor(r.initialWorld).engine.validState(r.engineState));return r;}
const war18=(rolls={})=>({targetId:'b',targetCells:{0:'tile-4'},rolls:{king:10,'expedition:0':1,'attack:0':20,'defense:0':10,'death:0':10,...rolls}});
const domestic18={rolls:{king:1,minister:1,domestic:1}};
test('each full surviving-country cycle advances exactly one season and winter advances the year',()=>{
 assert.equal(calendarAtRound(1).label,'1년차 봄');assert.equal(calendarAtRound(4).label,'1년차 겨울');assert.equal(calendarAtRound(5).label,'2년차 봄');assert.equal(calendarAtRound(14).label,'4년차 여름');
 let r=createRun(fixture18().initialWorld,7);const starts=[];
 for(let i=0;i<10;i++){const before=r.world;r=nextTurn(r,domestic18);const record=r.history.at(-1),scenes=makeTurnScenes(record,before),popup=scenes.find(s=>s.kind==='season');assert.equal(!!popup,i%2===0);if(popup)starts.push(popup.title);}
 assert.deepEqual(starts,['1년차 봄','1년차 여름','1년차 가을','1년차 겨울','2년차 봄']);
});
test('the season popup pauses and resumes its exact remaining time before any first-country action',()=>{
 const initial=fixture18(),n=nextTurn(initial,domestic18),record=n.history[0],saved=JSON.stringify(n);let now=0,pending=null;
 const p=new TurnPlayback({now:()=>now,schedule:(fn,delay)=>{pending={fn,delay};return 1;},cancel:()=>pending=null});p.load(record,initial.world,n.world,true);assert.equal(p.scene.kind,'season');assert.equal(pending.delay,1500);
 now=500;p.pause();assert.equal(p.remaining,1000);now=4000;p.resume();assert.equal(pending.delay,1000);pending.fn();assert.notEqual(p.scene.kind,'season');assert.equal(JSON.stringify(n),saved);p.pause();
});
test('a defeated positive-army defender retreats one province beside the battlefield rather than its assigned home',()=>{
 const r=fixture18(),n=nextTurn(r,war18()),record=n.history[0],g=n.world.people.find(p=>p.id==='b0');assert.equal(g.positionId,'tile-5');assert.notEqual(g.positionId,g.stationId);assert(g.troops>0);
 const move=record.movements.flatMap(m=>m.moves).find(m=>m.personId==='b0'&&m.kind==='retreat');assert.equal(move.fromId,'tile-4');assert.equal(move.toId,'tile-5');assert.equal(move.visualFromId,'tile-4');assert(!record.events.some(e=>e.type==='retreat'&&e.reason==='home'));
});
test('a losing or drawing attacker keeps the adjacent front and records a visible retreat from the fight without inventing an enemy occupation',()=>{
 for(const defense of [20,10]){
  const r=fixture18(),n=nextTurn(r,war18({'attack:0':10,'defense:0':defense})),record=n.history[0],g=n.world.people.find(p=>p.id==='a0');assert.equal(g.positionId,'tile-3');assert.equal(n.world.territories[4].ownerId,'b');
  const m=record.movements.flatMap(m=>m.moves).find(v=>v.personId==='a0'&&v.kind==='retreat');assert(m.presentationOnly);assert.equal(m.fromId,m.toId);assert.equal(m.visualFromId,'tile-4');assert.deepEqual(m.path,['tile-3']);
  const svg=renderRoundRoutes(n.world,geometryFor(n.world),roundCampaign(n.world,completedRoundPresentation(n)));assert(svg.includes('data-retreat-from="tile-4"'));assert(svg.includes('data-retreat-to="tile-3"'));assert(!svg.includes('↩'));assert(svg.includes('campaign-route attack'));
 }
});
test('earlier defeated residents retreat before the next defending wave and can guard the extra-capture frontier',()=>{
 const r=fixture18();r.engineState.countries[1].generals[1].position=4;sync18(r);
 const n=nextTurn(r,war18({'attack:0':30,'defense:0':1,'attack:0:1':30,'defense:0:1':1})),record=n.history[0];assert.equal(record.battles.length,2);assert.equal(record.battles[0].takenCells.length,0);
 assert.deepEqual(record.battles[1].takenCells,[4]);const firstRetreat=record.events.find(e=>e.type==='retreat'&&e.nation===1&&e.slot===0),secondFight=record.events.find(e=>e.type==='territory'&&e.battleIndex===1);assert(firstRetreat.index<secondFight.index);assert.equal(n.world.people.find(p=>p.id==='b0').positionId,'tile-5');assert.equal(n.world.people.find(p=>p.id==='b1').positionId,'tile-5');
});
test('encircled positive survivors choose the nearest friendly territory without favoring a distant personal home',()=>{
 const r=fixture18(),s=r.engineState,g=s.countries[0].generals[0];s.cells[3].owner=1;
 const d=nearbyRetreatDestination(s,engineFor(r.initialWorld).engine.ATLAS,0,g,4,4);assert(d.encircled);assert.equal(d.to,2);assert.notEqual(d.to,g.station);
});
test('a positive commander losing its entire personal district remains near the fight after command reform',()=>{
 const r=fixture18(7),s=r.engineState;s.cells.filter(c=>c.owner===1).forEach(c=>c.commander=c.id===7?1:0);s.countries[1].generals[0].station=10;s.countries[1].generals[0].position=10;s.countries[1].generals[1].station=7;s.countries[1].generals[1].position=7;s.countries[0].generals[1].troops=0;sync18(r);
 const controls=war18();controls.targetCells[0]='tile-7';const n=nextTurn(r,controls),g=n.world.people.find(p=>p.id==='b1');assert.equal(g.territoryIds.length,0);assert(g.troops>0);assert.equal(g.positionId,'tile-8');assert.notEqual(g.positionId,g.stationId);
});
test('zero-army survivors still go to their personal home, and a domestic choice can return positive armies home',()=>{
 const r=fixture18();r.engineState.countries[0].generals[0].troops=1;sync18(r);const n=nextTurn(r,war18({'attack:0':1,'defense:0':30})),g=n.world.people.find(p=>p.id==='a0');assert(g.alive);assert.equal(g.troops,0);assert.equal(g.positionId,'tile-1');
 const initial=fixture18(),domestic=nextTurn(initial,domestic18);assert.equal(domestic.world.people.find(p=>p.id==='a0').positionId,'tile-1');assert(domestic.history[0].events.some(e=>e.type==='home_return'));
});
test('old engine22 histories retain their former retreats while new nearby retreats survive save/replay without mutating live state',async()=>{
 const w=clone(fixture18().initialWorld);w.rules.nearbyRetreat=false;let old=createRun(w,7);old=nextTurn(old,war18());const data=JSON.parse(JSON.stringify(old));data.engineVersion='studio-v11-22';delete data.initialWorld.rules.nearbyRetreat;
 const copy=restoreRun(data);assert.equal(copy.initialWorld.rules.nearbyRetreat,false);assert.deepEqual(nextTurn(copy).engineState,nextTurn(old).engineState);await replayTurn(copy,1);
 let run=createRun(fixture18().initialWorld,777);for(let i=0;i<8&&!run.result;i++)run=nextTurn(run,i%2?domestic18:{rolls:{king:10,'expedition:0':1,'attack:0':30,'defense:0':10,'death:0':10}});const snapshot=JSON.stringify(run),saved=restoreRun(JSON.parse(snapshot));for(const r of run.history){const rebuilt=await replayTurn(saved,r.turn);assert.deepEqual(rebuilt.record.movements,r.movements);assert.equal(rebuilt.record.seasonStart,r.seasonStart);}assert.equal(JSON.stringify(run),snapshot);
});
test('combat sites contain only revealed real battles and persist through other nations until the season boundary',()=>{
 const r=fixture18(),n=nextTurn(r,war18()),record=n.history[0],scenes=makeTurnScenes(record,r.world),start={record,before:r.world,scenes,index:0,phase:'holding',roundRecords:[]};assert.deepEqual(roundCampaign(r.world,start).battleSites,[]);
 const done=roundCampaign(n.world,completedRoundPresentation(n));assert.deepEqual(done.battleSites,[{territoryId:'tile-4',count:1}]);assert(renderAtlas(n.world,{presentation:completedRoundPresentation(n)}).includes('data-battle-site="tile-4"'));
 const after=nextTurn(n,domestic18),p=new TurnPlayback();p.load(after.history[1],n.world,after.world,false,after.history);assert.equal(roundCampaign(n.world,p.state).battleSites.length,1);p.finish();assert.equal(roundCampaign(after.world,p.state).battleSites.length,0);
});
test('battle results and per-general losses are together above cards, while duplicate floating combat-loss boxes are absent',()=>{
 const r=fixture18(),n=nextTurn(r,war18()),record=n.history[0],scene=makeTurnScenes(record,r.world).find(s=>s.kind==='apply'&&s.event.type==='resolve'),snapshot=JSON.stringify(n),html=renderAtlas(scene.worldBefore,{presentation:{record,scenes:[scene],index:0,phase:'holding',effectStage:'outcome'}});
 assert(html.includes('>승리</text>'));assert(html.includes('>패배</text>'));assert.equal((html.match(/class="unit-loss-label"/g)||[]).length,2);assert(html.includes(`data-battle-loss="${record.battles[0].losses.defense.amount}"`));
 assert(!mapEffects(scene,'troops',record).units.some(e=>e.type==='army'&&e.role==='general'));assert.equal(JSON.stringify(n),snapshot);
});
test('king and minister choices use a compact ruler-anchored reel without duplicating their portraits',()=>{
 const r=fixture18(),n=nextTurn(r,domestic18),p=new TurnPlayback();p.load(n.history[0],r.world,n.world,false);
 for(const type of ['king','minister']){p.state.index=p.state.scenes.findIndex(s=>s.event.type===type);p.state.phase='rolling';const html=renderJudgmentOverlay({world:p.scene.worldBefore,playback:p});assert(html.includes('is-royal-choice'));assert(html.includes('data-nation="a"'));assert(!html.includes('judgment-person'));assert(html.includes('data-choice="'+type+'"'));}
});
test('zoom genuinely grows pins and side placement follows the attacking territory rather than fixed left/right roles',()=>{
 const widths=[.25,.5,1,2,3,5].map(s=>32*s*mapUnitScale(s));assert(widths.every(v=>v>=24&&v<=80));assert(widths[3]>widths[2]);assert(widths[5]>widths[3]);
 assert(duelDirection([200,100],[100,100]).x>0);assert(duelDirection([0,100],[100,100]).x<0);assert.equal(duelDirection([100,0],[100,100]).axis,'vertical');assert.equal(duelDirection([100,0],[100,100],true).axis,'diagonal');
});
test('camera following and its checkbox are gone while existing manual view state remains intact',()=>{
 const camera=new MapCamera(),view=camera.view('simulation');Object.assign(view,{x:333,y:222,zoom:2});const before={...view};camera.follow({state:{record:{turn:1}},scene:{}});camera.follow({state:{record:{turn:99}},scene:{}});assert.deepEqual(view,before);assert(!mapZoomControls('simulation').includes('camera-follow'));assert(!mapZoomControls('simulation').includes('국가 중심 고정'));
});
