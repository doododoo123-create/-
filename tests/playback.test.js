import test from 'node:test';import assert from 'node:assert/strict';
import {createDemoWorld} from '../src/data/demo-world.js';import {createRun,nextTurn} from '../src/engine/simulation.js';
import {TurnPlayback,makeTurnScenes} from '../src/ui/playback.js';import {unitMarkers,renderAtlas} from '../src/ui/atlas-view.js';import {renderArena} from '../src/ui/arena-view.js';
import {buildMapGeometry} from '../src/ui/map-geometry.js';import {validateWorld} from '../src/model/world.js';import {serializeWorld,parseWorld} from '../src/storage/world-store.js';import {V11_ATLAS} from '../src/data/v11-preset.js';
function clock(){let now=0,id=0;const tasks=new Map();return {now:()=>now,schedule:(fn,delay)=>{tasks.set(++id,{fn,time:now+delay});return id;},cancel:id=>tasks.delete(id),tick(ms){const end=now+ms;for(let n=0;n<10000;n++){const next=[...tasks].filter(([,t])=>t.time<=end).sort((a,b)=>a[1].time-b[1].time)[0];if(!next)break;tasks.delete(next[0]);now=next[1].time;next[1].fn();}now=end;},get pending(){return tasks.size;}};}
function fixture(war=false){const before=createRun(createDemoWorld(),123456),run=nextTurn(before,war?{rolls:{king:10},targetId:1}:undefined);return {before:before.world,after:run.world,record:run.history[0],run};}
test('every source event and die has a presentation, including each sequential battle',()=>{
 for(const war of [false,true]){const f=fixture(war),scenes=makeTurnScenes(f.record,f.before);assert.equal(scenes.at(-1).title,f.record.title);
 for(const event of f.record.events)assert.ok(scenes.some(s=>s.event?.index===event.index));
 for(let i=0;i<f.record.rolls.length;i++)assert.ok(scenes.some(s=>s.diceIndices?.includes(i)));
 assert.equal(scenes.filter(s=>s.kind==='apply').length,f.record.events.filter(e=>e.type==='resolve'||f.record.frames[e.index].after!==f.record.frames[e.index].before).length);
 }
 const f=fixture(true);assert.ok(f.record.battles.length>1);
});
test('presentation clock pauses exactly and consumes no game randomness or mutations',()=>{
 const c=clock(),f=fixture(),snapshot=structuredClone(f.run);let finishes=0;
 const player=new TurnPlayback({...c,onFinish:()=>finishes++});player.load(f.record,f.before,f.after);assert.equal(player.scene.kind,'season');c.tick(1500);c.tick(350);player.pause();c.tick(9000);assert.equal(player.state.phase,'rolling');assert.equal(c.pending,0);
 player.resume();c.tick(549);assert.equal(player.state.phase,'rolling');c.tick(1);assert.equal(player.state.phase,'locked');c.tick(100000);
 assert.equal(player.complete,true);assert.equal(finishes,1);assert.deepEqual(f.run,snapshot);player.finish();assert.equal(finishes,1);
});
test('raw die, modifier merge and final face show recorded scores without clamping',()=>{
 const f=fixture(true),c=clock(),player=new TurnPlayback({...c});player.load(f.record,f.before,f.after,false);
 while(player.scene.event?.type!=='attack_roll'||!player.scene.bonus)player.step();const raw=player.scene.value,bonus=player.scene.bonus;assert.ok(bonus);
 player.step();assert.equal(player.state.phase,'raw');player.step();assert.equal(player.state.phase,'merging');player.step();assert.equal(player.state.phase,'locked');
 const html=renderArena({world:player.displayWorld,run:f.run,playback:player});assert.ok(html.includes(`<span class="die-number">${raw+bonus}</span>`));assert.ok(html.includes(`data-die-locked="true"`));
});
test('battle result is announced before ownership and troop changes are applied',()=>{
 const f=fixture(true),player=new TurnPlayback();player.load(f.record,f.before,f.after,false);
 while(player.scene.event?.type!=='resolve')player.step();assert.equal(player.scene.kind,'result');const old=player.displayWorld;
 assert.deepEqual(old,player.scene.worldBefore);player.step();assert.equal(player.state.phase,'departing');assert.deepEqual(player.displayWorld,old);player.step();assert.equal(player.scene.kind,'apply');assert.equal(player.state.effectStage,'outcome');assert.deepEqual(player.displayWorld,player.scene.worldBefore);while(player.state.effectStage!=='territory')player.step();assert.deepEqual(player.displayWorld.territories,player.scene.worldAfter.territories);
 player.finish();assert.deepEqual(player.displayWorld,f.after);assert.equal(player.showingResult,true);
});
test('speed changes affect only remaining clock time; reset cancels callbacks',()=>{
 const c=clock(),f=fixture();let speed=1;const player=new TurnPlayback({...c,speed:()=>speed});player.load(f.record,f.before,f.after);assert.equal(player.scene.kind,'season');c.tick(1500);c.tick(400);player.pause();speed=4;player.resume();c.tick(124);assert.equal(player.state.phase,'rolling');c.tick(1);assert.equal(player.state.phase,'locked');player.reset();c.tick(10000);assert.equal(player.state,null);assert.equal(c.pending,0);
});
test('map uses original v11 polygons and stations, showing 7 capitals and 22 general units',()=>{
 const f=fixture(),markers=unitMarkers(f.before);assert.equal(markers.filter(m=>m.role==='king').length,7);assert.equal(markers.filter(m=>m.role==='general').length,22);
 for(const m of markers){assert.equal(m.territory.ownerId,m.country.id);if(m.role==='general')assert.equal(m.territory.id,m.person.stationId);}
 const html=renderAtlas(f.before);assert.ok(html.includes(V11_ATLAS.cells[0].path));assert.ok(html.includes('commander-border'));
});
test('custom-grid geometry is reproducible and shares every cardinal boundary',()=>{
 for(const [rows,cols] of [[2,2],[8,10],[20,24]]){const g=buildMapGeometry(rows,cols);assert.deepEqual(g.cells,buildMapGeometry(rows,cols).cells);for(const cell of g.cells){assert.ok(!cell.path.includes('NaN'));if(cell.col+1<cols)assert.equal(cell.vertices[1],g.cells[cell.row*cols+cell.col+1].vertices[0]);if(cell.row+1<rows)assert.equal(cell.vertices[2],g.cells[(cell.row+1)*cols+cell.col].vertices[1]);}}
});
test('portrait choice round trips; external URLs and injected map strings are escaped',()=>{
 const w=createDemoWorld();w.people[0].portraitKey='n3-general';assert.deepEqual(parseWorld(serializeWorld(w)),w);w.people[0].portraitKey='https://example.com/a';assert.throws(()=>validateWorld(w),/초상화/);
 w.territories[0].name='<img onerror=alert(1)>';const html=renderAtlas(w);assert.ok(html.includes('&lt;img onerror=alert(1)&gt;'));assert.ok(!html.includes('<img onerror=alert(1)>'));
});
test('king roll screen hides future opponents, dice and battle results',()=>{
 const f=fixture(true),player=new TurnPlayback();player.load(f.record,f.before,f.after,false);const html=renderArena({world:f.before,run:f.run,playback:player});assert.ok(!html.includes('visual-duel'));assert.ok(!html.includes(f.record.title));assert.ok(!html.includes('data-die-locked="true"'));assert.ok(!renderAtlas(f.before,{presentation:player.state}).includes('class="map-campaign"'));
});

test('manual judgment group plays both attack and defense, applies only that battle, then pauses',()=>{
 const f=fixture(true),c=clock(),player=new TurnPlayback({...c});player.load(f.record,f.before,f.after,false);
 while(player.scene.event?.type!=='territory')player.step();const index=player.scene.battleIndex;
 player.playGroup();c.tick(60000);assert.equal(player.playing,false);assert.equal(player.complete,false);assert.equal(player.scene.kind,'apply');assert.equal(player.scene.battleIndex,index);assert.equal(c.pending,0);
 const previous=player.state.index;player.playGroup();c.tick(60000);assert.ok(player.state.index>previous);assert.ok(player.scene.battleIndex>index||['death','survived'].includes(player.scene.event?.type)||player.scene.kind==='summary');
});
