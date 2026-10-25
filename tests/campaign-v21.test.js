import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContinent160World} from '../src/data/continent160-world.js';
import {createRun,nextTurn} from '../src/engine/simulation.js';
import {geometryFor} from '../src/model/cartography-geometry.js';
import {TurnPlayback,makeTurnScenes} from '../src/ui/playback.js';
import {roundCampaign,completedRoundPresentation,renderRoundCaptures} from '../src/ui/round-campaign.js';
import {blankWorld} from '../src/model/world.js';
import {renderAtlas} from '../src/ui/atlas-view.js';
import {groupedOperations,renderCampaignRoutes} from '../src/ui/campaign-routes.js';
import {armyArrowWidth,operationGeometry,polylineAt} from '../src/ui/operation-geometry.js';
import {captureFlow,captureFlowDefs} from '../src/ui/capture-transition.js';
import {cardLabel} from '../src/ui/card-label.js';
import {adjacentDuelPlacement} from '../src/ui/camera-focus.js';
import {commanderBattles,renderCommanderOverview} from '../src/ui/commander-overview.js';
import {renderDie} from '../src/ui/die-view.js';
const definition=createContinent160World();definition.rules.capitalFallAnnexation=false;definition.countries.forEach(c=>c.troops=50);
let run=createRun(definition,777);const frames=[];
for(let i=0;i<14&&!run.result;i++){const before=run.world,rolls={king:10};for(let slot=0;slot<40;slot++){rolls['expedition:'+slot]=1;rolls['attack:'+slot]=30;rolls['defense:'+slot]=1;}run=nextTurn(run,{rolls});frames.push({before,after:run.world,record:run.history.at(-1),history:[...run.history]});}
const f=frames.find(f=>f.record.battles.some(b=>b.takenCells.length&&!b.automatic)),geometry=geometryFor(f.before);
function player(frame=f){const p=new TurnPlayback();p.load(frame.record,frame.before,frame.after,false,frame.history);return p;}
test('approach, formation and defense stay sequential while army movement records and RNG remain byte-for-byte unchanged',()=>{
 const saved=JSON.stringify(run),p=player(),first=p.state.scenes.filter(s=>s.battleIndex===0&&s.event.type==='territory');assert.equal(first[0].kind,'movement');assert.equal(first[0].movementSide,'attack');assert.deepEqual(first[0].readySides,[]);assert.equal(first[1].formationSide,'attack');assert.deepEqual(first[1].readySides,['attack']);
 const defense=first.findIndex(s=>s.movementSide==='defense');if(defense>=0){assert(defense>1);assert.deepEqual(first[defense].readySides,['attack']);assert.equal(first[defense+1].formationSide,'defense');}
 assert.equal(first.filter(s=>s.kind==='route').at(-1).readySides.length,2);for(const s of first){const html=renderAtlas(s.worldBefore,{presentation:{...p.state,index:p.state.scenes.indexOf(s)}});assert(html.includes('battle-emblem'));}
 assert.equal(JSON.stringify(run),saved);
});
test('live arrows and commander pins can sample one length-based route at arbitrary pauses, including repeated points and degenerate paths',()=>{
 const points=[[0,0],[30,0],[30,40]];assert.deepEqual(polylineAt(points,.5).point,[30,5]);assert.deepEqual(polylineAt(points,0).point,[0,0]);assert.deepEqual(polylineAt(points,1).point,[30,40]);assert.deepEqual(polylineAt([[1,1],[1,1]],.5).point,[1,1]);assert.deepEqual(polylineAt([],1).point,[0,0]);
 const p=player(),index=p.state.scenes.findIndex(s=>s.movementSide==='attack');p.state.index=index;const c=roundCampaign(p.scene.worldBefore,p.state),op=groupedOperations(c).find(r=>r.moving);assert(op);assert.equal(op.toId,f.record.battles[0].territoryId);assert(op.path.at(-1)===op.toId);const html=renderCampaignRoutes(p.scene.worldBefore,geometry,c);assert(html.includes('data-live-march="true"'));assert(html.includes('data-route-person='));
});
test('army width has the current minimum and four bounded bands, and different commanders receive distinct shared-edge routes',()=>{
 assert.deepEqual([0,1,7,8,14,15,20,21,25,1000].map(v=>Number(armyArrowWidth(v).toFixed(2))),[3.8,3.8,3.8,6.46,6.46,9.5,9.5,12.54,12.54,12.54]);
 const ids=f.before.territories.slice(0,3).map(t=>t.id),base={side:'attack',countryId:f.before.countries[0].id,path:ids,fromId:ids[0],toId:ids[2],army:20};const routes=[{...base,key:'a',personId:'a'},{...base,key:'b',personId:'b'},{...base,key:'c',personId:'a'}],grouped=groupedOperations({routes});assert.equal(grouped.length,2);assert.equal(grouped[0].count,2);const g=operationGeometry(f.before,geometry,grouped);assert.notDeepEqual(g[0].points,g[1].points);assert.deepEqual(g[0].points[0],g[1].points[0]);assert.deepEqual(g[0].points.at(-1),g[1].points.at(-1));
 const partial=operationGeometry(f.before,geometry,[routes[0],{...routes[1],path:ids.slice(1),fromId:ids[1]}]);assert.notDeepEqual(partial[0].points.slice(-3,-1),partial[1].points.slice(-3,-1));
});
test('combatants render above all ordinary map cards and every outcome or local label owns a background without changing nonparticipants',()=>{
 const p=player();p.state.index=p.state.scenes.findIndex(s=>s.event.type==='attack_roll');const html=renderAtlas(p.scene.worldBefore,{presentation:p.state}),cards=[...html.matchAll(/<g class="map-unit-position[^>]*>/g)].map(v=>v[0]);assert(cards.slice(-2).every(c=>c.includes('data-combat-side=')));assert(cards.slice(0,-2).every(c=>!c.includes('data-combat-side=')));
 p.state.index=p.state.scenes.findIndex(s=>s.kind==='apply'&&s.event.type==='resolve');const result=renderAtlas(p.scene.worldBefore,{presentation:p.state});assert.equal((result.match(/unit-result-label/g)||[]).length,2);assert.equal((result.match(/class="card-label-background"/g)||[]).length>=4,true);assert(cardLabel('<unsafe>',{}).includes('&lt;unsafe&gt;'));assert(!cardLabel('<unsafe>',{}).includes('><unsafe>'));
});
test('capture sweep follows the recorded land entry after arrival, clips borders and hatching to exact territory shapes, and consumes no state',()=>{
 const p=player(),b=f.record.battles.find(b=>b.takenCells.length),arrival=p.state.scenes.findIndex(s=>s.kind==='arrival'&&s.battleIndex===b.index),sweep=p.state.scenes.findIndex(s=>s.kind==='capture'&&s.battleIndex===b.index),saved=JSON.stringify(run);assert(sweep>arrival);
 p.state.index=arrival;assert.equal(roundCampaign(p.scene.worldAfter,p.state).captures.has(b.takenTerritoryIds[0]),false);p.state.index=sweep;const c=roundCampaign(p.scene.worldAfter,p.state),capture=c.captures.get(b.takenTerritoryIds[0]);assert(capture.revealing);assert.equal(capture.fromId,b.fromId);
 const id=f.after.territories.findIndex(t=>t.id===capture.territoryId),flow=captureFlow(f.after,geometry,capture,id);assert(flow.span>0&&flow.height>0);const html=renderAtlas(p.scene.worldAfter,{presentation:p.state});assert(html.includes('capture-border-old'));assert(html.includes('capture-border-new'));assert(html.includes('data-wipe-span='));assert(html.includes(`clip-path="url(#${flow.id})"`));assert.equal(JSON.stringify(run),saved);
});
test('a season announcement preserves the former round, then a timed settlement removes hatching before the first national decision',()=>{
 const p=player(frames.find(f=>f.record.seasonStart&&f.record.round>1));assert.equal(p.scene.kind,'season');const old=roundCampaign(p.scene.worldBefore,p.state);assert(old.captures.size>0);assert(!old.settling);p.step();assert.equal(p.scene.kind,'round-settle');const settling=roundCampaign(p.scene.worldAfter,p.state);assert(settling.settling);assert.deepEqual([...settling.captures.keys()],[...old.captures.keys()]);assert(captureFlowDefs(p.scene.worldAfter,geometry,settling).includes('-remaining'));
 p.step();assert.equal(roundCampaign(p.scene.worldAfter,p.state).captures.size,0);assert.equal(p.scene.event.type,'king');
});
test('recapturing an already hatched province wipes the former occupier away instead of flashing its old base color',()=>{
 const w=blankWorld({rows:2,cols:2});w.countries=[{id:'a',color:'#ff0000'},{id:'b',color:'#0000ff'}];w.people=[];w.territories.forEach((t,i)=>t.ownerId=i?'b':'a');const id=w.territories[1].id;
 const first={turn:1,round:1,actorId:'a',events:[{type:'territory',battleIndex:0,index:0},{type:'resolve',battleIndex:0,index:1}],changes:[{territoryId:id,from:'b',to:'a'}],battles:[{index:0,actorId:'a',defenderId:'b',actor:0,target:1,captureOwner:0,winner:0,fromId:w.territories[0].id,territoryId:id,takenTerritoryIds:[id],automatic:true}]};
 const second={...first,turn:2,actorId:'b',changes:[{territoryId:id,from:'a',to:'b'}],battles:[{...first.battles[0],actorId:'b',defenderId:'a',actor:1,target:0,captureOwner:1,winner:1}]},before={...w,territories:w.territories.map(t=>({...t,ownerId:t.id===id?'a':t.ownerId}))};
 const presentation={record:second,before,roundRecords:[first],scenes:[{kind:'capture',battleIndex:0,event:second.events[1]}],index:0},campaign=roundCampaign(w,presentation),capture=campaign.captures.get(id),html=renderRoundCaptures(w,geometryFor(w),campaign);assert.equal(capture.previousCapture.ownerId,'a');assert.equal(capture.ownerId,'b');assert(html.includes('round-prior-capture'));assert(html.includes('-remaining'));assert(html.includes('clip-path="url(#capture-flow-1)"'));
});
test('sweep and formation clocks pause at the same fraction and resume at a new speed without resetting',()=>{
 let now=0,speed=1,task;const p=new TurnPlayback({now:()=>now,speed:()=>speed,schedule:(fn,delay)=>(task={fn,delay},1),cancel:()=>task=null});p.load(f.record,f.before,f.after,false);p.state.index=p.state.scenes.findIndex(s=>s.kind==='capture');p.remaining=p.duration();const duration=p.duration();p.resume();now=duration/2;p.pause();assert.equal(p.sceneProgress,.5);speed=8;p.resume();assert.equal(task.delay,duration/16);p.pause();assert.equal(p.sceneProgress,.5);
});
test('one manual season group includes settlement and holds its completed wipe instead of jumping back to zero',()=>{
 const frame=frames.find(f=>f.record.seasonStart&&f.record.round>1);let now=0,task;const p=new TurnPlayback({now:()=>now,schedule:(fn,delay)=>(task={fn,delay},1),cancel:()=>task=null});p.load(frame.record,frame.before,frame.after,false,frame.history);p.playGroup();assert.equal(p.scene.kind,'season');now+=task.delay;task.fn();assert.equal(p.scene.kind,'round-settle');now+=task.delay;task.fn();assert(p.groupDone);assert.equal(p.scene.kind,'round-settle');assert.equal(p.sceneProgress,1);assert.equal(p.remaining,0);p.playGroup();assert.equal(p.scene.event.type,'king');p.pause();
});
test('dice pane stays immediately above or below the combat pair despite an unrelated control in the top-right corner',()=>{
 const bounds={left:0,top:0,right:1600,bottom:1000},pair={left:500,right:800,top:400,bottom:550},pane={width:336,height:172},obstacle={left:1500,right:1590,top:10,bottom:45};const p=adjacentDuelPlacement(bounds,pair,pane,obstacle);assert.equal(p.side,'above');assert.equal(pair.top-(p.y+p.height),10);assert.equal(p.x,482);
 const nearTop=adjacentDuelPlacement(bounds,{...pair,top:30,bottom:160},pane,obstacle);assert.equal(nearTop.side,'below');assert.equal(nearTop.y,170);
 const narrow=adjacentDuelPlacement({left:0,top:0,right:390,bottom:390},{left:40,right:350,top:150,bottom:240},pane);assert(narrow.scale<1);assert(narrow.x>=8&&narrow.y>=8);assert(narrow.x+narrow.width<=382&&narrow.y+narrow.height<=382);
});
test('commander overview shows only that exact lifetime and only battles already revealed at the selected historical moment',()=>{
 const b=f.record.battles[0],person=f.after.people.find(p=>p.id===b.attackerPersonId),p=player();p.state.index=p.state.scenes.findIndex(s=>s.event.type==='attack_roll');assert.equal(commanderBattles(person,run.history,p.state).length,0);p.state.index=p.state.scenes.findIndex(s=>s.kind==='apply'&&s.event.type==='resolve');const rows=commanderBattles(person,run.history,p.state);assert.equal(rows.length,1);assert.equal(rows[0].turn,f.record.turn);assert.equal(rows[0].replayable,false);assert.equal(commanderBattles({...person,id:person.id+'-successor'},run.history).length,0);
 const html=renderCommanderOverview({world:f.after,personId:person.id,history:run.history,presentation:p.state,popover:true});for(const label of ['commander-popover','지휘한도','고유 능력','주요 전투','commander-replay'])assert(html.includes(label));assert(!html.includes('undefined'));
});
test('supplied dice animation and combat engine remain unchanged; minister positioning is isolated in v21 CSS',()=>{
 const html=renderDie(10,30,'rolling');assert.equal((html.match(/class="die-art-frame"/g)||[]).length,7);const css=readFileSync('src/ui/studio-v21.css','utf8');assert(css.includes('.is-royal-die .accumulating-die'));assert(!css.includes('studio-die-roll'));assert(!css.includes('attached-die-reel'));
});
