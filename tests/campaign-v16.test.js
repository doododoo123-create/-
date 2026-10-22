import test from 'node:test';
import assert from 'node:assert/strict';
import {blankWorld,validateWorld,clone} from '../src/model/world.js';
import {createRun,nextTurn,engineFor,projectWorld,restoreRun} from '../src/engine/simulation.js';
import {replayTurn} from '../src/engine/replay.js';
import {roundCampaign,completedRoundPresentation,campaignHatchDefs,renderRoundRoutes} from '../src/ui/round-campaign.js';
import {geometryFor} from '../src/model/cartography-geometry.js';
import {renderAtlas} from '../src/ui/atlas-view.js';
import {TurnPlayback,makeTurnScenes} from '../src/ui/playback.js';
import {renderJudgmentOverlay} from '../src/ui/judgment-overlay.js';
import {mapUnitScale} from '../src/ui/battle-presentation.js';
import {UNIT_CARD_WIDTH,UNIT_CARD_HEIGHT,UNIT_PIN_OFFSET} from '../src/ui/unit-layout.js';
import {stackUnits} from '../src/ui/unit-stack.js';

function fixture16(){
 const w=blankWorld({rows:3,cols:4});Object.assign(w.rules,{seaSupply:false,baseCapacity:20,territoryArmyLimit:100,expeditionChances:[100,100,100,100,100,100]});
 w.countries=['a','b'].map((id,i)=>({id,name:id,color:i?'#006bff':'#ff2028',troops:45,recruitment:0,personality:'balanced'}));
 w.people=w.countries.flatMap(c=>[{id:'king-'+c.id,countryId:c.id,name:c.id+'왕',role:'king',ability:0,personality:'balanced'},...Array.from({length:3},(_,slot)=>({id:c.id+slot,countryId:c.id,name:c.id+slot,role:'general',ability:0,personality:'balanced',slot}))]);
 w.territories.forEach((t,i)=>t.ownerId=i<4?'a':'b');w.cartography={version:1,style:'classic',opacity:.3,background:null,polygons:{},links:Array.from({length:11},(_,i)=>['tile-'+i,'tile-'+(i+1)])};
 const r=createRun(validateWorld(w),7);r.engineState.countries[0].generals[0].position=3;r.engineState.countries[0].generals[0].station=3;
 for(const c of r.engineState.countries){c.reserve=5;for(const g of c.generals)g.troops=g.active?20:0;}
 r.engineState.countries[1].generals[0].position=4;return sync16(r);
}
function sync16(r){for(const c of r.engineState.countries)c.army=c.reserve+c.generals.reduce((n,g)=>n+g.troops,0);r.world=projectWorld(r.initialWorld,r.engineState);assert(engineFor(r.initialWorld).engine.validState(r.engineState));return r;}
const attack16=(rolls={})=>({targetId:'b',targetCells:{0:'tile-4'},rolls:{king:10,'expedition:0':1,'attack:0':15,'defense:0':1,'death:0':10,...rolls}});

test('occupying attacker physically enters the first captured province, keeping personal home and using a recorded adjacent move',()=>{
 const r=fixture16(),n=nextTurn(r,attack16()),record=n.history[0],b=record.battles[0],g=n.world.people.find(p=>p.id==='a0');
 assert.deepEqual(b.takenTerritoryIds,['tile-4']);assert.equal(g.positionId,'tile-4');assert.notEqual(g.stationId,g.positionId);
 const motion=record.movements.find(m=>m.moves.some(v=>v.kind==='occupation'));assert(motion);assert.deepEqual(motion.moves[0].path,['tile-3','tile-4']);assert.equal(record.events[motion.eventIndex].type,'occupation');
 assert(!record.movements.filter(m=>m.eventIndex>motion.eventIndex).some(m=>m.moves.some(v=>v.personId==='a0'&&v.toId!=='tile-4')));assert(engineFor(n.initialWorld).engine.validState(n.engineState));
});
test('a stationary resident creates no defense arrow, while a returning defender retains a genuine incoming route',()=>{
 let r=fixture16(),n=nextTurn(r,attack16()),c=roundCampaign(n.world,completedRoundPresentation(n));assert(c.routes.some(v=>v.side==='attack'));assert(!c.routes.some(v=>v.side==='defense'));
 r=fixture16();r.engineState.countries[1].generals[0].position=8;sync16(r);n=nextTurn(r,attack16());c=roundCampaign(n.world,completedRoundPresentation(n));assert(c.routes.some(v=>v.side==='defense'&&v.fromId==='tile-8'&&v.toId==='tile-4'));
});
test('surviving defenders leave a directed path from the lost province to their recorded destination, including route-free relocation',()=>{
 for(const strong of [false,true]){
  const r=fixture16(),n=nextTurn(r,attack16(strong?{'attack:0':30}:{})),record=n.history[0],move=record.movements.flatMap(m=>m.moves).find(m=>m.personId==='b0'&&['retreat','redeploy'].includes(m.kind));assert(move);assert.equal(move.fromId,'tile-4');assert.notEqual(move.toId,move.fromId);
  const c=roundCampaign(n.world,completedRoundPresentation(n)),html=renderRoundRoutes(n.world,geometryFor(n.world),c);assert(html.includes(`data-retreat-from="tile-4" data-retreat-to="${move.toId}"`));assert(html.includes('marker-end="url(#retreat-'));if(move.kind==='redeploy')assert(html.includes('round-retreat relocation'));
 }
});
test('retreat arrows become visible at the start of their movement without showing later routes',()=>{
 const r=fixture16(),n=nextTurn(r,attack16()),record=n.history[0],scenes=makeTurnScenes(record,r.world),index=scenes.findIndex(s=>s.kind==='movement'&&s.event.type==='retreat');assert(index>=0);
 const state={record,before:r.world,scenes,index,phase:'holding',roundRecords:[]},c=roundCampaign(scenes[index].worldBefore,state);assert(c.movements.some(m=>m.personId==='b0'&&m.fromId==='tile-4'));assert(!c.movements.some(m=>m.kind==='occupation'));
});
test('the conquering defender also occupies its counter-captured frontier and unopposed captures do not award wins',()=>{
 let r=fixture16();r.engineState.countries[0].generals[0].troops=2;sync16(r);let n=nextTurn(r,attack16({'attack:0':1,'defense:0':30})),b=n.history[0].battles[0];assert.equal(b.winner,b.target);assert.equal(n.world.people.find(p=>p.id==='b0').positionId,b.takenTerritoryIds[0]);
 r=fixture16();r.engineState.countries[1].generals[0].troops=0;sync16(r);n=nextTurn(r,attack16());b=n.history[0].battles[0];assert(b.automatic);assert.equal(n.world.people.find(p=>p.id==='a0').positionId,'tile-4');assert.equal(n.world.people.find(p=>p.id==='a0').wins,0);
});
test('a commander advances only after the last defending wave falls, never between defenders',()=>{
 const r=fixture16();r.engineState.countries[1].generals[1].position=4;sync16(r);const n=nextTurn(r,attack16({'attack:0':30,'attack:0:1':30,'defense:0:1':1})),record=n.history[0];assert.equal(record.battles.length,2);assert.equal(record.battles[0].takenCells.length,0);
 const advance=record.events.filter(e=>e.type==='occupation');assert.equal(advance.length,1);assert.equal(advance[0].battleIndex,1);assert.equal(n.world.people.find(p=>p.id==='a0').positionId,'tile-4');
});
test('old engine20 preserves its former stationing and resumes/replays identically; new occupation moves survive save/replay',async()=>{
 const w=clone(fixture16().initialWorld);w.rules.occupationAdvance=false;let old=createRun(w,7);old=nextTurn(old,attack16());const data=JSON.parse(JSON.stringify(old));data.engineVersion='studio-v11-20';delete data.initialWorld.rules.occupationAdvance;
 const restored=restoreRun(data);assert.equal(restored.initialWorld.rules.occupationAdvance,false);assert.deepEqual(nextTurn(restored).engineState,nextTurn(old).engineState);await replayTurn(restored,1);
 w.rules.occupationAdvance=true;let n=createRun(w,7);n=nextTurn(n,attack16());const snapshot=JSON.stringify(n),replay=await replayTurn(restoreRun(JSON.parse(snapshot)),1);assert.deepEqual(replay.record.movements,n.history[0].movements);assert.deepEqual(replay.after.people,n.world.people);assert.equal(JSON.stringify(n),snapshot);
});
test('small map pins have bounded screen size at all zoom levels and combatants do not stack together at the battle site',()=>{
 assert.equal(UNIT_CARD_WIDTH,32);assert.equal(UNIT_CARD_HEIGHT,54);assert.equal(UNIT_PIN_OFFSET,35);
 for(const scale of [.1,.25,.5,1,1.5,3,8]){const width=UNIT_CARD_WIDTH*scale*mapUnitScale(scale);assert(width>=24-.001&&width<=36+.001);}
 const m=(id,combatSide)=>({territory:{id:'same'},person:{id},country:{id},role:'general',combatSide}),stack=stackUnits([m('a','attack'),m('b','defense'),m('c',null)]);assert(stack.every(v=>v.stackCount===1&&v.stackOffset===0));
});
test('battle presentation uses the original two map cards and no circular duplicate faces; all modifiers including zeros are visible',()=>{
 const r=fixture16(),n=nextTurn(r,attack16()),p=new TurnPlayback();p.load(n.history[0],r.world,n.world,false);p.state.index=p.state.scenes.findIndex(s=>s.event.type==='attack_roll');const snapshot=JSON.stringify(n),map=renderAtlas(p.scene.worldBefore,{presentation:p.state}),pane=renderJudgmentOverlay({world:p.scene.worldBefore,playback:p});
 assert.equal((map.match(/data-combat-side=/g)||[]).length,2);assert(!map.includes('battle-side-token'));assert(map.includes('data-camp="tile-3"'));assert(map.includes('data-camp="tile-4"'));assert(!pane.includes('<details'));assert(!pane.includes('judgment-person'));
 for(const label of ['장군 +0','병력 +0','전적 +0','지형 +0','피로 +0','보정 합계'])assert(pane.includes(label));assert(!pane.includes('data-score-visible="true"'));assert.equal(JSON.stringify(n),snapshot);
});
test('occupation hatching uses dense parallel oblique lines without horizontal crosshatching',()=>{
 const html=campaignHatchDefs(fixture16().world);assert(html.includes('width="4" height="4"'));assert(html.includes('patternTransform="rotate(28)"'));assert(!html.includes('H8'));assert(!/d="[^"]*H/.test(html));
});
