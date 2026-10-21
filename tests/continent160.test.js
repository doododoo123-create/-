import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {CONTINENT160_CELLS,CONTINENT160_SOURCE_SHA256} from '../src/data/continent160-map.js';
import {CONTINENT160_ART} from '../src/data/continent160-art.js';
import {createContinent160World} from '../src/data/continent160-world.js';
import {createReferenceWorld} from '../src/data/reference-world.js';
import {continent160Layout} from '../src/model/continent160-layout.js';
import {MAP_SCALE_DEFAULTS,CONTINENT160_RULES,scaledProduction,scaledDistance,requiredReserve} from '../src/model/map-scale.js';
import {validateWorld,clone,neighbors,production} from '../src/model/world.js';
import {boundaryLinks} from '../src/model/free-map.js';
import {pointInShape} from '../src/model/cartography.js';
import {createRun,nextTurn,engineFor,restoreRun,projectWorld} from '../src/engine/simulation.js';
import {replayTurn} from '../src/engine/replay.js';
import {expeditionChance} from '../src/engine/field-command.js';
import {movementFatigue} from '../src/engine/campaign-logistics.js';
import {renderAtlas} from '../src/ui/atlas-view.js';
import {continent160MapImage} from '../src/ui/vector-map.js';
import {serializeWorld,parseWorld} from '../src/storage/world-store.js';
function connected(world,country){const own=world.territories.filter(t=>t.ownerId===country.id),seen=new Set([own[0].id]),queue=[own[0]];for(let i=0;i<queue.length;i++)for(const t of neighbors(world,queue[i]))if(t.ownerId===country.id&&!seen.has(t.id)){seen.add(t.id);queue.push(t);}return seen.size===own.length;}
test('uploaded vector source supplies exactly 160 unique provinces, 357 symmetric land links and 21 mountains',()=>{
 const w=createContinent160World();assert.equal(w.territories.length,160);assert.equal(w.cartography.links.length,357);assert.deepEqual(new Set(boundaryLinks(w).map(p=>JSON.stringify(p))),new Set(w.cartography.links.map(p=>JSON.stringify(p))));assert.equal(w.territories.filter(t=>t.terrain==='mountain').length,21);
 assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/maps/continent_160.original.svg',import.meta.url))).digest('hex'),CONTINENT160_SOURCE_SHA256);
 assert.equal(CONTINENT160_CELLS[0].id,'territory-001');assert.equal(CONTINENT160_CELLS.at(-1).id,'territory-160');
 for(const t of w.territories){assert(pointInShape(w.cartography.polygons[t.id].center,w.cartography.polygons[t.id]));assert.deepEqual(neighbors(w,t).map(n=>n.id).sort(),[...CONTINENT160_CELLS.find(c=>c.id===t.id).neighbors].sort());}
});
test('vector artwork remains inert, shares one ocean/land image and keeps exact editing alignment',()=>{
 const source=Buffer.from(CONTINENT160_ART.split(',')[1],'base64').toString();assert(!/<script|foreignObject|\son\w+=|https?:\/\//i.test(source.replace('http://www.w3.org/2000/svg','')));assert(source.includes('viewBox="-1800 -1270 5400 3600"'));
 const image=Buffer.from(continent160MapImage().split(',')[1],'base64').toString();assert(image.includes('viewBox="0 -70 1800 1200"'));const html=renderAtlas(createRun(createContinent160World(),7).world);assert(html.includes('data-vector-plate="continent160" x="-1200" y="-800" width="3600" height="2400"'));assert(!html.includes('ocean-repeat'));assert(!html.includes('class="map-compass"'));
});
test('layout preserves edited countries and people, assigns connected countries, and produces 22 initial districts',()=>{
 const old=createReferenceWorld(),before=JSON.stringify(old);old.people[0].name='테스트왕';old.countries[0].name='새나라';const w=continent160Layout(old);assert.equal(w.countries[0].name,'새나라');assert.deepEqual(w.people,old.people);assert(w.countries.every(c=>connected(w,c)));assert.equal(w.countries.reduce((n,c)=>n+Math.ceil(w.territories.filter(t=>t.ownerId===c.id).length/8),0),22);
 const run=createRun(w,7),{engine}=engineFor(run.initialWorld);assert.equal(run.world.people.filter(p=>p.role==='general'&&p.active).length,22);assert(engine.validState(run.engineState));for(const c of run.engineState.countries)for(const g of c.generals)assert(run.engineState.cells.filter(t=>t.owner===c.id&&t.commander===g.slot).length<=8);
 assert.notEqual(JSON.stringify(old),before);assert.equal(old.territories.length,80);
});
test('160 preset halves national force limits/production, preserves command growth and only lowers capture thresholds',()=>{
 const w=createContinent160World(),run=createRun(w,7),{engine}=engineFor(run.initialWorld);assert.deepEqual(w.rules.captureThresholds,[10,20]);assert.deepEqual(w.rules.lossThresholds,[10,20,40]);assert.deepEqual(w.rules.combatLosses,{narrow:[.15,.2],clear:[.1,.3],major:[.08,.4],rout:[.05,.5],draw:[.15,.15]});assert.equal(w.rules.baseCapacity,7);assert.equal(w.rules.capacityCap,25);assert.equal(w.rules.territoryArmyLimit,5);
 for(const [margin,want]of [[1,1],[9,1],[10,2],[19,2],[20,3],[40,3]])assert.equal(engine.conquestLimit({winner:0,actor:0,attack:{score:margin},defense:{score:0}}),want);
 assert.equal(scaledProduction(40,w.rules),20);assert.equal(scaledProduction(7,w.rules),3);assert.equal(w.countries.reduce((n,c)=>n+production(w,c),0),78);assert.equal(run.world.countries.reduce((n,c)=>n+c.armyLimit,0),800);
});
test('larger provinces use scaled distance only for dispatch/fatigue/relief and never invent movement connections',()=>{
 const w=createContinent160World(),r=w.rules;assert.deepEqual([1,2,3,4,5,6,7,8,9].map(n=>scaledDistance(n,r)),[1,2,2,3,4,4,5,6,6]);assert.deepEqual([1,2,3,4,5,6,7,8,9].map(n=>expeditionChance(n,r)),[100,85,85,70,55,55,40,25,25]);assert.deepEqual([0,4,5,6,11,12].map(n=>movementFatigue(n,r)),[0,0,0,-2,-2,-4]);assert.equal(Math.floor(r.reliefRadius*r.distanceScale),4);
 const old=createReferenceWorld();assert.equal(expeditionChance(4,old.rules),55);assert.equal(movementFatigue(4,old.rules),-2);
});
test('a one-province nation can distribute troops and fight while preserving whole-unit production and the soft limit',()=>{
 const w=createContinent160World();w.territories.forEach(t=>t.ownerId=w.countries[0].id);w.territories.at(-1).ownerId=w.countries[1].id;w.countries[1].troops=5;w.countries[1].capitalId=w.territories.at(-1).id;const r=createRun(w,7),c=r.engineState.countries[1];assert.equal(requiredReserve(r.engineState,1,r.initialWorld.rules),2);assert.equal(c.reserve,2);assert.equal(c.generals[0].troops,3);assert(engineFor(r.initialWorld).engine.targets(r.engineState,1,0).length>0);
});
test('world JSON retains vector plate, 160 boundaries, mountains, editable rules and explicit adjacency',()=>{
 const w=createContinent160World(),parsed=parseWorld(serializeWorld(w));assert.deepEqual(parsed,w);const x=clone(w);x.rules.territoriesPerCommander=6;x.rules.distanceScale=2;x.rules.productionDivisor=3;assert.equal(validateWorld(x).rules.territoriesPerCommander,6);
 for(const mutate of [w=>w.rules.territoriesPerCommander=0,w=>w.rules.productionDivisor=0,w=>w.rules.distanceScale=.5,w=>w.rules.adaptiveReserve='yes']){const bad=clone(w);mutate(bad);assert.throws(()=>validateWorld(bad));}
});
test('80-province saves keep their original scale and 160-province histories replay and continue without changing RNG',async()=>{
 let old=createRun(createReferenceWorld(),7);for(let i=0;i<20;i++)old=nextTurn(old);const save=JSON.parse(JSON.stringify(old));save.engineVersion='studio-v11-17';for(const k of Object.keys(MAP_SCALE_DEFAULTS))delete save.initialWorld.rules[k];const restoredOld=restoreRun(save);assert.equal(restoredOld.initialWorld.rules.territoriesPerCommander,4);assert.deepEqual(nextTurn(old).engineState,nextTurn(restoredOld).engineState);await replayTurn(restoredOld,19);
 let run=createRun(createContinent160World(),777);for(let i=0;i<45&&!run.result;i++){run=nextTurn(run);assert(engineFor(run.initialWorld).engine.validState(run.engineState));assert(run.world.people.filter(p=>p.role==='general'&&p.active).every(p=>p.capacity<=25&&p.territoryIds.length<=8&&Number.isInteger(p.troops)));}
 const saved=JSON.stringify(run),loaded=restoreRun(JSON.parse(saved));assert.deepEqual(nextTurn(loaded).engineState,nextTurn(run).engineState);for(const t of [1,19,40]){const replay=await replayTurn(loaded,t);assert.deepEqual(replay.record.battles,run.history[t-1].battles);assert.deepEqual(replay.record.rolls,run.history[t-1].rolls);}assert.equal(JSON.stringify(run),saved);
});

test('recapturing land may raise the desired capital reserve without invalidating a surviving small army',()=>{
 const w=createContinent160World();w.territories.forEach(t=>t.ownerId=w.countries[0].id);w.territories.at(-1).ownerId=w.countries[1].id;w.countries[1].troops=5;w.countries[1].capitalId=w.territories.at(-1).id;
 const run=createRun(w,7),{engine}=engineFor(run.initialWorld),s=run.engineState,extra=engine.ATLAS.cells.at(-1).neighbors[0];s.cells[extra].owner=1;s.cells[extra].commander=0;engine.reconcile(s);s.scheduleIndex=1;assert.equal(requiredReserve(s,1,run.initialWorld.rules),5);assert.equal(s.countries[1].reserve,2);assert(engine.validState(s));
 run.world=projectWorld(run.initialWorld,s);const next=nextTurn(run,{rolls:{king:1,minister:1,domestic:1}});assert(engine.validState(next.engineState));assert.equal(next.engineState.countries[1].reserve,3);assert.equal(next.engineState.countries[1].generals[0].troops,3);
});
