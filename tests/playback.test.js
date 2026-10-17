import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoWorld } from '../src/data/demo-world.js';
import { createRun, nextTurn } from '../src/engine/simulation.js';
import { TurnPlayback, makeTurnScenes } from '../src/ui/playback.js';
import { buildMapGeometry } from '../src/ui/map-geometry.js';
import { countryMarkers, renderAtlas } from '../src/ui/atlas-view.js';
import { renderArena } from '../src/ui/arena-view.js';
import { validateWorld } from '../src/model/world.js';
import { serializeWorld, parseWorld } from '../src/storage/world-store.js';

function clock() {
  let now=0, sequence=0; const tasks=new Map();
  return { now:()=>now,schedule:(fn,delay)=>{const id=++sequence;tasks.set(id,{fn,time:now+delay});return id;},cancel:id=>tasks.delete(id),
    tick(ms){const end=now+ms;for(let n=0;n<1000;n++){const ready=[...tasks].filter(([,t])=>t.time<=end).sort((a,b)=>a[1].time-b[1].time)[0];if(!ready)break;tasks.delete(ready[0]);now=ready[1].time;ready[1].fn();}now=end;}, get pending(){return tasks.size;} };
}
function turn(kind='domestic') {
  const initial=createRun(createDemoWorld(),'visual-fixture');let current=initial;
  for(let i=0;i<100;i++){const next=nextTurn(current),record=next.history.at(-1);if(record.type===kind)return {before:current.world,after:next.world,record,run:next};current=next;}
  throw new Error('No matching fixture');
}

test('presentation scenes use actual recorded dice and end with the real result',()=>{
  for(const kind of ['domestic','war']) {
    const fixture=turn(kind), scenes=makeTurnScenes(fixture.record,fixture.before);
    assert.equal(scenes[0].id,'action');assert.equal(scenes.at(-1).title,fixture.record.title);
    const referenced=scenes.flatMap(s=>s.diceIndices||[]);assert.deepEqual(referenced,fixture.record.rolls.map((_,i)=>i));
  }
});
test('rolling, lock, next scene and completion use a separate clock without mutating engine state',()=>{
  const c=clock(), fixture=turn(), snapshot=structuredClone(fixture.run);let finishes=0;
  const player=new TurnPlayback({...c,onFinish:()=>finishes++});
  player.load(fixture.record,fixture.before,fixture.after);
  assert.equal(player.state.phase,'rolling');c.tick(1000);assert.equal(player.state.phase,'locked');
  c.tick(800);assert.equal(player.scene.id,'domestic');assert.equal(player.state.phase,'rolling');
  c.tick(10000);assert.equal(player.complete,true);assert.equal(player.scene.id,'result');assert.equal(finishes,1);
  assert.deepEqual(fixture.run,snapshot);player.finish();player.advance();assert.equal(finishes,1);assert.equal(c.pending,0);
});
test('pause preserves the exact remaining duration and resumes the same die',()=>{
  const c=clock(), f=turn();const player=new TurnPlayback({...c});player.load(f.record,f.before,f.after);
  c.tick(350);player.pause();const phase=player.state.phase,index=player.state.index;c.tick(9000);
  assert.equal(player.state.phase,phase);assert.equal(player.state.index,index);assert.equal(c.pending,0);
  player.resume();c.tick(649);assert.equal(player.state.phase,'rolling');c.tick(1);assert.equal(player.state.phase,'locked');
});
test('manual stepping reveals one stage and skip completes exactly once',()=>{
  const c=clock(),f=turn('war');let finishes=0;const player=new TurnPlayback({...c,onFinish:()=>finishes++});
  player.load(f.record,f.before,f.after,false);player.step();assert.equal(player.state.phase,'locked');assert.equal(player.state.index,0);assert.equal(c.pending,0);
  player.step();assert.equal(player.scene.id,'target');assert.equal(player.playing,false);player.finish();
  assert.equal(player.showingResult,true);assert.equal(player.complete,true);assert.equal(finishes,1);player.finish();assert.equal(finishes,1);
});
test('speed changes affect only remaining presentation time and reset cancels old callbacks',()=>{
  const c=clock(),f=turn();let speed=1;const player=new TurnPlayback({...c,speed:()=>speed});player.load(f.record,f.before,f.after);
  c.tick(400);player.pause();speed=4;player.resume();c.tick(149);assert.equal(player.state.phase,'rolling');c.tick(1);assert.equal(player.state.phase,'locked');
  player.reset();c.tick(10000);assert.equal(player.state,null);assert.equal(c.pending,0);
});
test('reduced motion keeps the same results with a short reveal delay',()=>{
  const c=clock(),f=turn(),player=new TurnPlayback({...c,reducedMotion:()=>true});player.load(f.record,f.before,f.after);
  c.tick(79);assert.equal(player.state.phase,'rolling');c.tick(1);assert.equal(player.state.phase,'locked');assert.equal(player.state.record.rolls[0].value,f.record.rolls[0].value);
});
test('map geometry is reproducible and shares boundaries for every cardinal neighbor',()=>{
  for(const [rows,cols] of [[2,2],[8,10],[20,24]]) {
    const g=buildMapGeometry(rows,cols), other=buildMapGeometry(rows,cols);
    assert.equal(g.cells.length,rows*cols);assert.deepEqual(g.cells,other.cells);assert.equal(g.coastPath,other.coastPath);
    for(const cell of g.cells) {
      assert.ok(!cell.path.includes('NaN'));assert.ok(cell.center[0]>0&&cell.center[0]<1200&&cell.center[1]>0&&cell.center[1]<800);
      if(cell.col+1<cols) {const right=g.cells[cell.row*cols+cell.col+1];assert.equal(cell.vertices[1],right.vertices[0]);assert.equal(cell.vertices[2],right.vertices[3]);}
      if(cell.row+1<rows) {const down=g.cells[(cell.row+1)*cols+cell.col];assert.equal(cell.vertices[2],down.vertices[1]);assert.equal(cell.vertices[3],down.vertices[0]);}
    }
  }
});

test('portrait selection is optional, survives file round trip and rejects external URLs',()=>{
  const old=createDemoWorld();assert.deepEqual(parseWorld(serializeWorld(old)),old);
  old.people[0].portraitKey='n3-general';assert.equal(parseWorld(serializeWorld(old)).people[0].portraitKey,'n3-general');
  old.people[0].portraitKey='https://example.com/image.png';assert.throws(()=>validateWorld(old),/초상화/);
});
test('rendered map is based on current ownership and text is escaped',()=>{
  const world=createDemoWorld();world.territories[0].name='<img onerror=alert(1)>';
  const original=structuredClone(world);const markers=countryMarkers(world);assert.equal(markers.length,7);
  for(const marker of markers)assert.equal(marker.territory.ownerId,marker.country.id);
  const html=renderAtlas(world);assert.ok(html.includes('&lt;img onerror=alert(1)&gt;'));assert.ok(!html.includes('<img onerror=alert(1)>'));
  assert.deepEqual(world,original);
});
test('action-roll screen does not reveal the future battle, dice values or result',()=>{
  const f=turn('war'), player=new TurnPlayback();player.load(f.record,f.before,f.after,false);
  const html=renderArena({world:f.before,run:f.run,playback:player});
  assert.ok(!html.includes('visual-duel'));assert.ok(!html.includes(f.record.title));assert.ok(!html.includes('공격 점수 확정'));
  assert.ok(html.includes('data-die-locked="false"'));assert.ok(!html.includes('data-die-locked="true"'));
  assert.ok(!renderAtlas(f.before,{presentation:player.state}).includes('class="map-campaign"'));
  player.finish();const result=renderArena({world:f.after,run:f.run,playback:player});
  assert.ok(result.includes(f.record.title));assert.ok(result.includes('battle-losses'));assert.ok(result.includes('data-die-locked="true"'));
});
