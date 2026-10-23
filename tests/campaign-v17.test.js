import test from 'node:test';
import assert from 'node:assert/strict';
import {blankWorld,validateWorld,clone} from '../src/model/world.js';
import {createRun,nextTurn,projectWorld,engineFor,restoreRun} from '../src/engine/simulation.js';
import {emptyCommanderDestination,returnEmptyCommanders} from '../src/engine/battlefield-movement.js';
import {replayTurn} from '../src/engine/replay.js';
import {roundCampaign,completedRoundPresentation,renderRoundRoutes} from '../src/ui/round-campaign.js';
import {groupedOperations,renderCampaignRoutes,renderOperationalFront} from '../src/ui/campaign-routes.js';
import {geometryFor} from '../src/model/cartography-geometry.js';
import {battleRoute} from '../src/ui/battle-map.js';
import {makeTurnScenes} from '../src/ui/playback.js';
import {renderAtlas} from '../src/ui/atlas-view.js';
function fixture17(extraLinks=[]){
 const w=blankWorld({rows:3,cols:4});Object.assign(w.rules,{seaSupply:false,baseCapacity:25,territoryArmyLimit:100,expeditionChances:[100,100,100,100,100,100]});
 w.countries=['a','b'].map((id,i)=>({id,name:id,color:i?'#006bff':'#ff2028',troops:45,recruitment:0,personality:'balanced',capitalId:'tile-'+(i?11:0)}));
 w.people=w.countries.flatMap(c=>[{id:'king-'+c.id,countryId:c.id,name:c.id+'왕',role:'king',ability:0,personality:'balanced'},...Array.from({length:3},(_,slot)=>({id:c.id+slot,countryId:c.id,name:c.id+slot,role:'general',ability:0,personality:'balanced',slot}))]);
 w.territories.forEach((t,i)=>t.ownerId=i<4?'a':'b');w.cartography={version:1,style:'classic',opacity:.3,background:null,polygons:{},links:[...Array.from({length:11},(_,i)=>[i,i+1]),...extraLinks].map(p=>p.map(i=>'tile-'+i))};
 const r=createRun(validateWorld(w),7),s=r.engineState;s.countries[0].generals[0].station=1;s.countries[0].generals[0].position=3;s.countries[1].generals[0].station=6;s.countries[1].generals[0].position=4;
 for(const c of s.countries){c.reserve=5;for(const g of c.generals)g.troops=g.active?20:0;}return sync17(r);
}
function sync17(r){for(const c of r.engineState.countries)c.army=c.reserve+c.generals.reduce((n,g)=>n+g.troops,0);r.world=projectWorld(r.initialWorld,r.engineState);assert(engineFor(r.initialWorld).engine.validState(r.engineState));return r;}
const war17=(rolls={})=>({targetId:'b',targetCells:{0:'tile-4'},rolls:{king:10,'expedition:0':1,'attack:0':10,'defense:0':10,'death:0':10,...rolls}});
test('a losing or drawing attacker stays immediately beside the fought province, while a conqueror enters its first gain',()=>{
 for(const [attack,defense,winner]of [[1,10,1],[10,10,null],[30,1,0]]){
  const r=fixture17(),n=nextTurn(r,war17({'attack:0':attack,'defense:0':defense})),b=n.history[0].battles[0],g=n.world.people.find(p=>p.id==='a0');assert.equal(b.winner,winner);
  if(winner===0)assert.equal(g.positionId,b.takenTerritoryIds[0]);else{assert.equal(g.positionId,'tile-3');assert(engineFor(n.initialWorld).engine.ATLAS.cells[4].neighbors.includes(Number(g.positionId.split('-')[1])));}
 }
});
test('a counterattack-displaced surviving attacker chooses another reachable province beside the battlefield before returning home',()=>{
 const r=fixture17([[2,4]]),n=nextTurn(r,war17({'attack:0':1,'defense:0':30})),b=n.history[0].battles[0];assert.deepEqual(b.takenCells,[3]);assert.equal(n.world.people.find(p=>p.id==='a0').positionId,'tile-2');assert(n.history[0].movements.some(m=>m.moves.some(v=>v.personId==='a0'&&v.kind==='retreat'&&v.toId==='tile-2')));
});
test('a returning defender actually reaches the attacked province before rolling its defense',()=>{
 const r=fixture17();r.engineState.countries[1].generals[0].position=7;sync17(r);const n=nextTurn(r,war17()),record=n.history[0],event=record.events.find(e=>e.type==='territory');
 assert(record.movements.some(m=>m.moves.some(v=>v.personId==='b0'&&v.kind==='return'&&v.toId==='tile-4')));assert.equal(record.frames[event.index].after.people.find(p=>p.id==='b0').positionId,'tile-4');assert.equal(n.world.people.find(p=>p.id==='b0').positionId,'tile-4');
});
test('a surviving zero-army attacker returns to its personal home, even without a land route; a dead commander never returns',()=>{
 for(const death of [10,1]){
  const r=fixture17();r.engineState.countries[0].generals[0].troops=1;sync17(r);const n=nextTurn(r,war17({'attack:0':1,'defense:0':30,'death:0':death})),g=n.world.people.find(p=>p.id==='a0'),events=n.history[0].events;
  if(death===1){assert(!g.alive);assert.equal(g.positionId,null);assert(!events.some(e=>e.type==='empty_return'&&e.nation===0&&e.slot===0));}
  else{assert(g.alive);assert.equal(g.troops,0);assert.equal(g.positionId,'tile-1');const e=events.find(e=>e.type==='empty_return'&&e.nation===0&&e.slot===0);assert.equal(e.reason,'home');assert.equal(e.moves[0].kind,'redeploy');}
 }
});
test('a zero-army surviving defender returns to its own home rather than the capital after losing the defended province',()=>{
 const r=fixture17(),s=r.engineState;s.countries[1].generals[0].troops=1;s.countries[1].generals[1].position=5;sync17(r);
 const n=nextTurn(r,war17({'attack:0':30,'defense:0':1})),g=n.world.people.find(p=>p.id==='b0');assert.equal(g.troops,0);assert(g.alive);assert.equal(g.positionId,'tile-6');assert.notEqual(g.positionId,n.world.countries[1].capitalId);assert(n.history[0].events.some(e=>e.type==='empty_return'&&e.nation===1&&e.reason==='home'));
});
test('a commander with no personal province goes to the capital itself, keeps wins and gets no invented troops or casualty',()=>{
 const r=fixture17(),s=r.engineState,g=s.countries[1].generals[1],events=[];g.troops=0;g.wins=6;g.position=8;s.cells.forEach(c=>{if(c.owner===1)c.commander=0;});
 assert.deepEqual(emptyCommanderDestination(s,1,g,11),{to:11,reason:'capital'});const army=s.countries[1].army;
 returnEmptyCommanders(s,engineFor(r.initialWorld).engine.ATLAS,()=>11,(...args)=>events.push(args),[1]);assert.equal(g.position,11);assert.equal(g.wins,6);assert.equal(g.troops,0);assert.equal(s.countries[1].army,army);assert.equal(events[0][3].reason,'capital');
});
test('zero-army return does not make a refusing war into a routine home-return turn for other commanders',()=>{
 const r=fixture17();r.initialWorld.rules.expeditionChances.fill(0);const n=nextTurn(r,war17({'expedition:0':100}));assert.equal(n.world.people.find(p=>p.id==='a0').positionId,'tile-3');assert(!n.history[0].events.some(e=>e.type==='home_return'));
});
test('old engine21 saves pin the former movement rules; new movement events replay and resume exactly',async()=>{
 const w=clone(fixture17().initialWorld);w.rules.battlefieldRecovery=false;let old=createRun(w,7);old=nextTurn(old,war17());const data=JSON.parse(JSON.stringify(old));data.engineVersion='studio-v11-21';delete data.initialWorld.rules.battlefieldRecovery;
 const restored=restoreRun(data);assert.equal(restored.initialWorld.rules.battlefieldRecovery,false);assert.deepEqual(nextTurn(restored).engineState,nextTurn(old).engineState);await replayTurn(restored,1);
 let run=createRun(fixture17().initialWorld,7);for(let i=0;i<8&&!run.result;i++)run=nextTurn(run,{rolls:{king:10,'expedition:0':1,'attack:0':1,'defense:0':30,'death:0':10}});const saved=JSON.stringify(run),copy=restoreRun(JSON.parse(saved));for(const r of run.history){const v=await replayTurn(copy,r.turn);assert.deepEqual(v.record.movements,r.movements);}assert.equal(JSON.stringify(run),saved);
});
test('operations start at the actual frontier, merge repeated assaults and never create a stationary defense arrow or short-distance loop',()=>{
 const routes=[0,1,2].map(i=>({key:String(i),side:'attack',countryId:'a',fromId:'tile-0',frontId:'tile-3',toId:'tile-4',personId:'a0',active:i===2}));routes.push({side:'defense',countryId:'b',fromId:'tile-4',toId:'tile-4'});
 const groups=groupedOperations({routes});assert.equal(groups.length,1);assert.equal(groups[0].fromId,'tile-0');assert.equal(groups[0].count,3);assert(groups[0].active);
 const svg=battleRoute([100,100],[110,100],'attack','#ff0000',{id:'near'}),d=svg.match(/class="campaign-route-shadow" d="([^"]+)"/)[1];assert(!d.includes('C'));const numbers=[...d.matchAll(/-?\d+(?:\.\d+)?/g)].map(v=>Number(v[0]));assert(numbers.every(v=>v>=98&&v<=111));
});
test('ordinary marches are visible only while moving or selected, and route-free redeployment has endpoints without an enemy-crossing line',()=>{
 const r=fixture17(),world=r.world,geometry=geometryFor(world),m={key:'march',personId:'a0',countryId:'a',kind:'home',fromId:'tile-1',toId:'tile-3',path:['tile-1','tile-2','tile-3']},c={routes:[],fronts:[],movements:[m]},o={frontPath:()=>''};
 assert(!renderCampaignRoutes(world,geometry,c,o).includes('data-round-move'));
 assert(renderCampaignRoutes(world,geometry,c,{...o,selectedPersonId:'a0'}).includes('is-selected'));
 const live=renderCampaignRoutes(world,geometry,c,{...o,scene:{kind:'movement',moves:[m]},progress:.5});assert(live.includes('march-progress-dot'));assert.equal((live.match(/data-round-move/g)||[]).length,1);assert(!live.includes('marker-end'));
 const redeploy=renderCampaignRoutes(world,geometry,{...c,movements:[{...m,kind:'redeploy'}]},o);assert(redeploy.includes('data-relocation-from'));assert(!redeploy.includes('<path'));assert.equal((redeploy.match(/<circle/g)||[]).length,2);
});
test('operation grouping and selected routes use revealed history only and never mutate the run',()=>{
 const r=fixture17(),n=nextTurn(r,war17({'attack:0':30,'defense:0':1})),record=n.history[0],scenes=makeTurnScenes(record,r.world),state={record,before:r.world,scenes,index:0,phase:'holding',roundRecords:[]},snapshot=JSON.stringify(n);
 assert.equal(groupedOperations(roundCampaign(r.world,state)).length,0);assert(!renderOperationalFront(r.world,geometryFor(r.world),roundCampaign(r.world,state),()=> 'M0,0L1,1'));
 const c=roundCampaign(n.world,completedRoundPresentation(n)),svg=renderRoundRoutes(n.world,geometryFor(n.world),c);assert(svg.includes('data-operation-from="tile-3"'));assert(!svg.includes('campaign-route defense'));
 const map=renderAtlas(n.world,{presentation:completedRoundPresentation(n),focusedPerson:'a0'});assert(map.includes('data-action="focus-unit"'));assert(map.includes('data-selected="true"'));assert.equal(JSON.stringify(n),snapshot);
});
