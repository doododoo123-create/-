import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoWorld } from '../src/data/demo-world.js';
import { createReferenceWorld, referenceLayout } from '../src/data/reference-world.js';
import { validateWorld, neighbors } from '../src/model/world.js';
import { freeMapFrom, addFreeTerritory, removeFreeTerritory, moveFreeTerritory, sharedBoundary, boundaryLinks } from '../src/model/free-map.js';
import { geometryFor, cellPoints, territoryCell } from '../src/ui/cartography-geometry.js';
import { serializeWorld, parseWorld } from '../src/storage/world-store.js';
import { createRun, nextTurn, engineFor, restoreRun } from '../src/engine/simulation.js';
import { makeTurnScenes } from '../src/ui/playback.js';
import { validCamps } from '../src/engine/command-movement.js';

test('reference coast has 80 independently positioned provinces, explicit shared-boundary graph and no grid coordinates',()=>{
 const w=createReferenceWorld();assert.equal(w.mapKind,'free');assert.equal(w.territories.length,80);assert(w.territories.every(t=>t.row===undefined&&t.col===undefined));
 assert(w.cartography.links.length>130);assert.deepEqual(w.cartography.links,boundaryLinks(w));
 const g=geometryFor(w);assert.equal(g.cells.length,80);const reversed={...w,territories:[...w.territories].reverse()};assert.deepEqual(territoryCell(reversed,geometryFor(reversed),w.territories[7]).points,g.cells[7].points);assert.deepEqual(territoryCell(reversed,geometryFor(reversed),w.territories[7]).center,g.cells[7].center);
});
test('convert preserves every existing ID, ownership, person and adjacency; original source remains intact',()=>{
 const w=createDemoWorld(),saved=structuredClone(w),g=geometryFor(w),free=validateWorld(freeMapFrom(w,g.cells.map(c=>({...c,points:cellPoints(c)}))));assert.deepEqual(w,saved);assert.deepEqual(free.people,w.people);
 for(const t of w.territories)assert.deepEqual(neighbors(free,free.territories.find(n=>n.id===t.id)).map(n=>n.id),neighbors(w,t).map(n=>n.id));
});
test('free map can grow to 81 and shrink to 79 provinces; deletion cleans capital, graph and polygon references',()=>{
 let w=createReferenceWorld();const added=addFreeTerritory(w,[[40,700],[90,700],[80,740]],'nation-0');w=added.world;assert.equal(w.territories.length,81);assert.equal(geometryFor(w).cells.length,81);
 w.countries[0].capitalId=added.id;w.cartography.links.push([added.id,'tile-0']);w=removeFreeTerritory(w,added.id);w=removeFreeTerritory(w,'tile-79');assert.equal(w.territories.length,79);assert(!w.cartography.links.some(p=>p.includes('tile-79')));assert.equal(w.cartography.polygons['tile-79'],undefined);assert.notEqual(w.countries[0].capitalId,added.id);
 let r=createRun(w,100);for(let i=0;i<15&&!r.result;i++)r=nextTurn(r);assert(engineFor(r.initialWorld).engine.validState(r.engineState));assert.equal(r.engineState.cells.length,79);
});
test('whole-province move preserves shape, owner and links; invalid moves and missing free geometry fail safely',()=>{
 const w=createReferenceWorld(),id='tile-0',shape=w.cartography.polygons[id],moved=moveFreeTerritory(w,id,[shape.center[0]+2,shape.center[1]+2]);assert.equal(moved.territories[0].ownerId,w.territories[0].ownerId);assert.deepEqual(moved.cartography.links,w.cartography.links);assert(Math.abs(moved.cartography.polygons[id].points[0][0]-shape.points[0][0]-2)<.002);
 assert.throws(()=>moveFreeTerritory(w,id,[-1000,-1000]),/범위/);const bad=structuredClone(w);delete bad.cartography.polygons[id];assert.throws(()=>validateWorld(bad),/모든 영토/);
 assert.deepEqual(parseWorld(serializeWorld(moved)),moved);
});
test('adjacency recognizes a common partial border but excludes corner contact and separated sea',()=>{
 const a=[[0,0],[20,0],[20,20],[0,20]];assert(sharedBoundary(a,[[20,5],[30,5],[30,10],[20,10]]));assert(!sharedBoundary(a,[[20,20],[30,20],[30,30],[20,30]]));assert(!sharedBoundary(a,[[21,0],[30,0],[30,20],[21,20]]));
});
test('reference layout keeps edited countries, portraits, territory names and rules',()=>{const w=createDemoWorld();w.people[0].portraitKey='general-050';w.territories[0].name='내 항구';w.rules.recruitGain=9;const next=referenceLayout(w);assert.deepEqual(next.people,w.people);assert.deepEqual(next.countries,w.countries);assert.equal(next.territories[0].name,'내 항구');assert.deepEqual(next.rules,w.rules);});
test('recorded forward camps and returns use friendly connected land without modifying battle state or RNG',()=>{
 const w=createReferenceWorld();w.rules.advancedCampaign=false;let r=createRun(w,123456),outbound=0,returns=0;
 for(let i=0;i<80&&!r.result;i++){
  const before=r,context=engineFor(r.initialWorld),expected=context.engine.prepareTurn(r.engineState);r=nextTurn(r);assert.deepEqual(r.engineState,{...expected.state,history:[]});assert.equal(r.rng,expected.state.rng);
  const record=r.history.at(-1),scenes=makeTurnScenes(record,before.world);
  for(const batch of record.movements){const frame=record.frames[batch.eventIndex];assert(scenes.some(s=>s.kind==='movement'&&s.event.index===batch.eventIndex));for(const m of batch.moves){
   const p=frame.before.people.find(p=>p.id===m.personId);assert(p);assert(m.path.every(id=>frame.before.territories.some(t=>t.id===id&&t.ownerId===p.countryId)));
   for(let j=1;j<m.path.length;j++)assert(neighbors(frame.before,frame.before.territories.find(t=>t.id===m.path[j-1])).some(t=>t.id===m.path[j]));
   assert.equal(m.path[0],m.fromId);assert.equal(m.path.at(-1),m.toId);
   if(m.kind==='return'){returns++;assert.equal(m.toId,p.stationId);}else if(m.kind==='relief'){const b=record.battles[batch.battleIndex],home=frame.before.people.find(g=>g.role==='general'&&g.countryId===b.defenderId&&g.slot===b.regionSlot);assert.equal(m.toId,home.stationId);assert(m.path.length-1<=before.initialWorld.rules.reliefRadius);}else{outbound++;const target=record.battles[batch.battleIndex].territoryId;assert(neighbors(frame.before,frame.before.territories.find(t=>t.id===target)).some(t=>t.id===m.toId));}
  }}
  assert.deepEqual(scenes.at(-1).camps,r.world.visualCamps);
 }
 assert(outbound>10);assert(returns>0);
 const restored=restoreRun(JSON.parse(JSON.stringify(r)));assert.deepEqual(restored.world.visualCamps,r.world.visualCamps);assert.deepEqual(restored.engineState,r.engineState);
 const next=nextTurn(r),nextRestored=nextTurn(restored);assert.deepEqual(nextRestored.world.visualCamps,next.world.visualCamps);assert.deepEqual(nextRestored.engineState,next.engineState);
});
test('dead, inactive and enemy-occupied camps are discarded without changing the source',()=>{const r=createRun(createReferenceWorld());const p=r.world.people.find(p=>p.role==='general'&&p.active);const enemy=r.world.territories.find(t=>t.ownerId!==p.countryId);const camps={[p.id]:{territoryId:enemy.id,homeId:p.stationId}};assert.deepEqual(validCamps(r.world,camps),{});assert.equal(camps[p.id].territoryId,enemy.id);assert.deepEqual(validCamps(r.world,null),{});p.id='__proto__';const safe=JSON.parse('{"__proto__":{"territoryId":"'+p.stationId+'"}}');assert(Object.hasOwn(validCamps(r.world,safe),'__proto__'));});
