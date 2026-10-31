import test from 'node:test';
import assert from 'node:assert/strict';
import {nextTurn} from '../src/engine/simulation.js';
import {TurnPlayback} from '../src/ui/playback.js';
import {MapCamera} from '../src/ui/map-camera.js';
import {sceneFocus} from '../src/ui/camera-focus.js';
import {mapAnchor} from '../src/model/cartography-geometry.js';
import {renderAtlas} from '../src/ui/atlas-view.js';
import {presentationSoundCues} from '../src/audio/cues.js';
import {SOUND_DEFAULTS} from '../src/audio/settings.js';
import {studio36Fixture,studio36Controls} from './studio-v36-fixture.mjs';

const options=()=>({compactCampaigns:true,armyPresentation:true,armyResultReport:true});
function setup(config={}){
 const start=studio36Fixture({defense:true}),run=nextTurn(start,studio36Controls());
 const p=new TurnPlayback({options,...config});p.load(run.history[0],start.world,run.world,false);
 return {p,run};
}
test('both sides hold the single rally point for all arrivals and formation, then follow the march without changing zoom or engine data',()=>{
 const {p,run}=setup(),snapshot=JSON.stringify(run),previous=globalThis.document;
 globalThis.document={querySelector:()=>null,querySelectorAll:()=>[]};
 try{
  const camera=new MapCamera();camera.autoFollow=true;camera.view('simulation').zoom=2.5;
  const assemblies=p.state.scenes.filter(s=>s.event?.type==='army_assembly'&&s.event.armyGroup?.members.length>=2);
  assert(new Set(assemblies.map(s=>s.event.armyGroup.nation)).size>=2);
  for(const s of assemblies){
   const world=s.worldAfter,group=s.event.armyGroup,expected=mapAnchor(world,world.territories[group.location].id,'station');
   assert.deepEqual(sceneFocus(s,p.state.record),expected);
   // Historical sequential arrivals may point at a dispersed member's cell.
   const legacy={...s,kind:'movement',moves:[{toId:world.territories.find(t=>t.id!==world.territories[group.location].id).id}]};
   assert.deepEqual(sceneFocus(legacy,p.state.record),expected);
   p.state.index=p.state.scenes.indexOf(s);camera.follow(p);
   assert.deepEqual(camera.view('simulation'),{zoom:2.5,x:expected[0],y:expected[1]});
  }
  const march=p.state.scenes.find(s=>s.kind==='movement'&&s.event?.type==='army_march'&&s.moves.length);
  assert(march);p.state.index=p.state.scenes.indexOf(march);camera.follow(p);
  const target=mapAnchor(march.worldAfter,march.moves[0].toId,'station');
  assert.deepEqual(camera.view('simulation'),{zoom:2.5,x:target[0],y:target[1]});
  camera.setFollowing(false,p);const manual={...camera.view('simulation')};
  p.state.index=p.state.scenes.indexOf(assemblies[0]);camera.follow(p);assert.deepEqual(camera.view('simulation'),manual);
 }finally{globalThis.document=previous;}
 assert.equal(JSON.stringify(run),snapshot);
});
test('formed view is exactly 300ms at every speed, keeps completed cards and does not replay the formation cue',()=>{
 for(const speed of [.5,1,2,4,8,16])for(const reduced of [false,true]){
  const {p}=setup({speed:()=>speed,reducedMotion:()=>reduced});
  const formed=p.state.scenes.flatMap((s,i)=>s.kind==='army-forming'?[i]:[]);assert(formed.length>=2);
  for(const i of formed){
   const hold=p.state.scenes[i+1];assert.equal(hold.kind,'army-formed-hold');assert.equal(hold.formationGroup,p.state.scenes[i].formationGroup);
   p.state.index=i+1;assert.equal(p.duration(),300);assert.equal(p.effectiveSpeed,1);
   const html=renderAtlas(p.displayWorld,{presentation:p.state});assert(html.includes('is-army-group'));assert(!html.includes('data-army-forming="true"'));
   assert.equal(presentationSoundCues(p.state,{settings:SOUND_DEFAULTS,duration:p.duration()}).length,0);
   p.step();assert.equal(p.effectiveSpeed,speed);
  }
 }
});
test('the 300ms completed view preserves pause time and ignores speed changes until departure',()=>{
 let now=0,selected=16,pending,delay;
 const {p}=setup({speed:()=>selected,now:()=>now,schedule:(fn,ms)=>{pending=fn;delay=ms;return 1;},cancel:()=>{pending=null;}});
 p.state.index=p.state.scenes.findIndex(s=>s.kind==='army-formed-hold');p.remaining=p.duration();p.resume();assert.equal(delay,300);
 now=120;p.pause();assert.equal(p.remaining,180);now+=5000;selected=.5;p.resume();assert.equal(delay,180);
 now+=180;pending();assert.notEqual(p.scene.kind,'army-formed-hold');assert.equal(p.effectiveSpeed,.5);p.pause();
});
test('one-on-one does not gain a formation stop',()=>{
 const start=studio36Fixture({duel:true}),run=nextTurn(start,studio36Controls()),p=new TurnPlayback({options});
 p.load(run.history[0],start.world,run.world,false);assert(!p.state.scenes.some(s=>s.kind==='army-formed-hold'));
});
