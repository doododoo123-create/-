import test from 'node:test';import assert from 'node:assert/strict';
import {borderFronts,planFrontOperations} from '../src/engine/front-operations.js';
import {studio37Fixture,studio37Controls} from './studio-v37-fixture.mjs';
import {studio36Fixture,studio36Controls} from './studio-v36-fixture.mjs';
import {createRun,engineFor,nextTurn,restoreRun} from '../src/engine/simulation.js';
import {runSaveData} from '../src/storage/run-store.js';
import {replayTurn} from '../src/engine/replay.js';
import {TurnPlayback} from '../src/ui/playback.js';
import {roundCampaign} from '../src/ui/round-campaign.js';
import {portraitConfusion} from '../src/ui/readiness-display.js';
import {renderCampaignOverlay} from '../src/ui/campaign-view.js';
import {renderAtlas} from '../src/ui/atlas-view.js';
import {renderCampaignRouteLayers} from '../src/ui/campaign-routes.js';
import {atlasGeometry} from '../src/ui/atlas-cache.js';
function graph(owners,links){const s={turns:0,cells:owners.map((owner,id)=>({id,owner}))},atlas={cells:owners.map((_,id)=>({id,name:'지역'+id,neighbors:[]}))};for(const [a,b] of links){atlas.cells[a].neighbors.push(b);atlas.cells[b].neighbors.push(a);}return {s,atlas};}
test('friendly interior and enemy interior do not join two separated borders against the same nation',()=>{
 const {s,atlas}=graph([0,0,0,0,1,1,1],[[0,1],[1,2],[2,3],[0,4],[3,6],[4,5],[5,6]]);const fronts=borderFronts(s,atlas,0,1);assert.equal(fronts.length,2);assert.deepEqual(fronts.map(f=>[...f.enemyIds]),[[4],[6]]);
 const generals=[{slot:0,position:0},{slot:1,position:3}],p=planFrontOperations(s,atlas,0,1,generals);assert.notEqual(p.assignments.get(0),p.assignments.get(1));assert.deepEqual(p.targets(0,[4,6]),[4]);assert.deepEqual(p.targets(1,[4,6]),[6]);
 s.cells[4].owner=0;p.advance(0,4);assert.deepEqual(p.targets(0,[5,6]),[5]);s.cells[5].owner=0;p.advance(0,5);assert.deepEqual(p.targets(0,[6]),[]);
});
test('long continuous border is divided into radius2 contact sectors instead of one continent-wide army',()=>{
 const links=[];for(let i=0;i<9;i++){links.push([i,i+9]);if(i<8)links.push([i,i+1],[i+9,i+10]);}const {s,atlas}=graph([...Array(9).fill(0),...Array(9).fill(1)],links),fronts=borderFronts(s,atlas,0,1);assert(fronts.length>=3);assert(fronts.every(f=>f.contacts.length<=3));assert.equal(new Set(fronts.flatMap(f=>f.contacts.map(c=>c.own+':'+c.enemy))).size,9);
});
test('explicit legal target assigns its own front and no reachable target yields an empty operation',()=>{const {s,atlas}=graph([0,0,0,1,1],[[0,1],[1,2],[0,3],[2,4]]),p=planFrontOperations(s,atlas,0,1,[{slot:0,position:0}],{0:4});assert.deepEqual(p.targets(0,[3,4]),[4]);assert.deepEqual(p.targets(1,[3,4]),[]);});
test('same enemy has two real operations, no mixed sector members and no cross-front targets',()=>{
 const r=nextTurn(studio37Fixture({twoFronts:true}),studio37Controls({twoFronts:true})),rec=r.history[0],groups=rec.events.filter(e=>e.type==='army_assembly'&&e.nation===0);assert.equal(groups.length,2);assert.notEqual(groups[0].armyGroup.frontId,groups[1].armyGroup.frontId);assert.deepEqual(groups.map(e=>e.armyGroup.members.map(p=>p.slot).sort()).sort(),[[0,1],[2,3]]);
 for(const b of rec.battles.filter(b=>b.actor===0&&b.continuation!=='counter')){assert(b.frontName);if([0,1].includes(b.slot))assert(b.cellId>=10);else assert(b.cellId<10);}assert(engineFor(r.initialWorld).engine.validState(r.engineState));
 const ids=rec.events.filter(e=>e.type==='army_assembly'&&e.nation===1).flatMap(e=>e.armyGroup.members.map(m=>m.slot));assert.equal(new Set(ids).size,ids.length);
});
test('all members reach one real rally and one real column position before formation; refusal is before rally',()=>{
 const start=studio37Fixture(),c=studio37Controls();const r=nextTurn(start,c),rec=r.history[0];for(const e of rec.events.filter(e=>['army_assembly','army_march'].includes(e.type))){const w=rec.frames[e.index].after;for(const member of e.armyGroup.members){const p=w.people.find(p=>p.countryId===w.countries[e.nation].id&&p.role==='general'&&p.slot===member.slot);assert.equal(p.positionId,w.territories[e.armyGroup.location].id);}}
 const gathering=rec.events.find(e=>e.type==='army_assembly');assert(rec.events.filter(e=>e.type==='expedition_roll').every(e=>e.index<gathering.index));
 const refused=studio37Controls();refused.rolls['expedition:1']=100;const world=structuredClone(start.initialWorld);world.rules.expeditionChances=Array(6).fill(50);const rejected=nextTurn(createRun(world,777),refused).history[0];assert(!rejected.events.some(e=>e.armyGroup?.members.some(m=>e.nation===0&&m.slot===1)));
 assert(gathering.armyGroup.members.length===3);assert(rec.events.some(e=>e.type==='army_release'));assert.equal(typeof portraitConfusion,'function');
});
test('release movement and gathering/march are all charged exactly once into combat fatigue',()=>{
 const r=nextTurn(studio37Fixture(),studio37Controls()),rec=r.history[0],b=rec.battles[0],territory=rec.events.find(e=>e.type==='territory'&&e.battleIndex===b.index);
 for(const [side,id] of [['attack',b.attackerPersonId],['defense',b.defenderPersonId]]){const edges=rec.movements.filter(e=>e.eventIndex<=territory.index).flatMap(e=>e.moves).filter(m=>m.personId===id).reduce((n,m)=>n+m.path.length-1,0);assert.equal(b[side].movementEdges,edges);}
 const counts=new Map();for(const p of r.world.people.filter(p=>(p.role==='general'||p.role==='king')&&p.active&&p.alive&&p.positionId)){const k=p.countryId+':'+p.positionId;counts.set(k,(counts.get(k)||0)+1);}assert([...counts.values()].every(n=>n<=2));
});
test('all dice remain before releases/map application, frozen on the fully assembled front',()=>{
 const start=studio37Fixture(),r=nextTurn(start,studio37Controls()),rec=r.history[0],p=new TurnPlayback({options:()=>({compactCampaigns:true,armyPresentation:true})});p.load(rec,start.world,r.world,false);const ss=p.state.scenes,dice=ss.flatMap((s,i)=>s.campaignPhase==='dice'?[i]:[]),release=ss.findIndex(s=>s.event?.type==='army_release');assert(dice.length>=4);assert(release>Math.max(...dice));p.state.index=dice[0];const html=renderAtlas(p.displayWorld,{presentation:p.state});assert(html.includes('data-army-group'));assert(renderCampaignOverlay({playback:p}).includes('운곡 전선'));assert.equal(new Set(p.displayWorld.people.filter(p=>p.role==='general'&&p.countryId==='a'&&p.active).map(p=>p.positionId)).size,1);
 const finish=ss.findIndex(s=>s.kind==='army-forming');assert(finish>0);assert.equal(ss[finish-1].event.type,'army_assembly');
});
test('old controls and engine31 saves keep their exact previous battle calculations and RNG',async()=>{
 const old=nextTurn(studio36Fixture(),studio36Controls()),data=runSaveData(old);data.engineVersion='studio-v11-31';const restored=restoreRun(data);assert.deepEqual(restored.engineState,old.engineState);const replay=await replayTurn(restored,1);assert.deepEqual(replay.record.battles,old.history[0].battles);assert(!replay.record.events.some(e=>e.type==='army_release'));assert.deepEqual(nextTurn(old).engineState,nextTurn(restored).engineState);
});
test('front controls and exact movements reconstruct from exported records without initial-state patches',async()=>{const r=nextTurn(studio37Fixture({twoFronts:true}),studio37Controls({twoFronts:true})),restored=restoreRun(runSaveData(r)),rebuilt=await replayTurn(restored,1);assert.equal(r.engineVersion,'studio-v11-32');assert.equal(r.history[0].controls.frontOperations,true);assert.deepEqual(rebuilt.record.battles,r.history[0].battles);assert.deepEqual(rebuilt.record.movements,r.history[0].movements);assert.deepEqual(rebuilt.after.people,r.world.people);});
test('new activity removes only that commanders older routes, including stationary defense; hatches/sites stay',()=>{
 const world={territories:[{id:'a',ownerId:'x'},{id:'b',ownerId:'y'}],countries:[],people:[]},person={id:'p',countryId:'x',role:'general',slot:0,positionId:'a'},other={id:'q',countryId:'y',role:'general',slot:0,positionId:'b'},frame={before:{...world,people:[person,other]}};
 const battle={index:0,actorId:'x',defenderId:'y',slot:0,defenseSlot:0,attackerPersonId:'p',defenderPersonId:'q',fromId:'a',territoryId:'b',attack:{army:5},defense:{army:5},winner:null};
 const past={round:1,turn:1,events:[{type:'territory',index:0,battleIndex:0}],battles:[battle],frames:[frame],movements:[{eventIndex:0,moves:[{personId:'q',countryId:'y',kind:'assembly',path:['a','b'],fromId:'a',toId:'b'}]}]},current={...past,turn:2,movements:[],frames:[frame]};
 const scene={kind:'route',event:{index:0},revealedRoutes:['attack','defense']},p={record:current,roundRecords:[past],scenes:[scene],index:0,latestRoutes:true};const out=roundCampaign(world,p);assert(out.routes.every(r=>r.turn===2));assert.equal(out.movements.length,0);assert.equal(out.battleSites[0].count,2);
 p.scenes[0]={kind:'focus',event:{index:-1}};const before=roundCampaign(world,p);assert(before.routes.some(r=>r.turn===1));assert(before.movements.some(m=>m.turn===1));
});
test('portrait confusion uses a separate backed badge and does not inherit map-card scaling',()=>{assert.equal(portraitConfusion({confusion:0}),'');assert(portraitConfusion({confusion:2}).includes('>↓</span>'));assert(portraitConfusion({confusion:4}).includes('>↓↓</span>'));assert(!portraitConfusion({confusion:4}).includes('token-confusion'));assert.equal(portraitConfusion({confusion:6,readiness:{resting:true}}),'');});
test('pending second-front formations remain together through first-front cleanup and release only at their own operation',()=>{
 const r=nextTurn(studio37Fixture({twoFronts:true}),studio37Controls({twoFronts:true})),rec=r.history[0],group=rec.events.filter(e=>e.type==='army_assembly'&&e.nation===0)[1].armyGroup,release=rec.events.find(e=>e.type==='army_release'&&e.armyGroup.id===group.id);
 for(const e of rec.events.filter(e=>e.type==='unit_spacing'&&e.index<release.index))assert(!e.moves.some(m=>m.nation===0&&group.members.some(p=>p.slot===m.slot)));
 const before=rec.frames[release.index].before,positions=group.members.map(m=>before.people.find(p=>p.countryId==='a'&&p.role==='general'&&p.slot===m.slot).positionId);assert.equal(new Set(positions).size,1);
});
test('removing an old shared march participant also removes their strength from the retained arrow',()=>{
 const start=studio37Fixture(),r=nextTurn(start,studio37Controls()),rec=r.history[0],motion=rec.movements.find(m=>m.armyGroup?.nation===0&&m.moves.some(v=>v.kind==='army-march')),m=motion.moves[0],group=motion.armyGroup,army=group.members.find(p=>p.slot===m.slot).troops;
 const campaign={turn:2,movements:[{...m,turn:1,eventIndex:motion.eventIndex,key:'retained',armyGroup:group,army}],routes:[],fronts:[],settled:false},html=renderCampaignRouteLayers(start.world,atlasGeometry(start.world),campaign,{frontPath:()=>''}).arrows;
 assert(html.includes(`data-army-route-total="${army}"`));assert(!html.includes(`data-army-route-total="${group.army}"`));assert(html.includes('individual-column-route'));
});
test('unopposed local advance keeps the existing three-province allowance and records each connected capture',()=>{const r=nextTurn(studio37Fixture({empty:true}),studio37Controls()),rec=r.history[0];assert(rec.battles.every(b=>b.automatic));assert.equal(rec.battles[0].takenCells.length,3);assert.equal(rec.battles[0].captureLimit,3);assert(rec.battles.every(b=>b.takenCells.length<=b.captureLimit));});
