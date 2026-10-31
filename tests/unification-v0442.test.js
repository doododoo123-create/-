import test from 'node:test';
import assert from 'node:assert/strict';
import {unificationFixture} from './unification-v0442-fixture.mjs';
import {TurnPlayback} from '../src/ui/playback.js';
import {unificationCountry,renderUnificationAnnouncement} from '../src/ui/unification-notice.js';
import {renderJudgmentOverlay} from '../src/ui/judgment-overlay.js';
import {renderArena} from '../src/ui/arena-view.js';
import {renderMapStage} from '../src/ui/map-stage.js';
import {observerDuration} from '../src/ui/observer-flow.js';
import {presentationSoundCues} from '../src/audio/cues.js';
import {SOUND_DEFAULTS} from '../src/audio/settings.js';

function setup(){
 const fixture=unificationFixture(),playback=new TurnPlayback({options:()=>({compactCampaigns:true,armyPresentation:true})});
 playback.load(fixture.record,fixture.start.world,fixture.run.world,false,fixture.run.history);
 return {...fixture,playback};
}
test('all territory ownership and one committed unification winner are required',()=>{
 const {start,run}=unificationFixture();
 assert.equal(unificationCountry(run.world,run.result).id,'a');
 for(const [world,result] of [[start.world,run.result],[run.world,null],[run.world,{...run.result,reason:'limit'}],[run.world,{...run.result,winnerIds:['a','b']}],[run.world,{...run.result,winnerIds:['missing']}],[{...run.world,territories:[]},run.result]])assert.equal(renderUnificationAnnouncement(world,result),'');
 const world=structuredClone(run.world);world.countries[0].name='<img src=x onerror=alert(1)>';
 const html=renderUnificationAnnouncement(world,run.result);assert(html.includes('천하통일'));assert(html.includes('&lt;img'));assert(!html.includes('<img'));
});
test('one global notice follows the last capture and elimination, and never leaks from a pending final result',()=>{
 const {run,record,playback:p}=setup(),scenes=p.state.scenes;
 const indexes=scenes.flatMap((s,i)=>s.kind==='unification'?[i]:[]);assert.equal(indexes.length,1);const at=indexes[0];
 assert(at>scenes.findLastIndex(s=>s.kind==='capture'));assert(at>scenes.findLastIndex(s=>s.kind==='elimination'));assert(at<scenes.findIndex(s=>s.kind==='summary'));
 for(let i=0;i<at;i++){
  p.state.index=i;
  assert(!renderMapStage({world:p.displayWorld,run,playback:p}).includes('data-unification='));
 }
 p.state.index=at;
 assert(renderJudgmentOverlay({world:p.displayWorld,playback:p}).includes('data-unification="a"'));
 assert(renderArena({world:p.displayWorld,run,playback:p}).includes('천하통일'));
 assert.equal(p.scene.event.type,'finish');assert.equal(record.result.reason,'unification');
 const html=renderMapStage({world:p.displayWorld,run,playback:p});assert.equal((html.match(/data-unification=/g)||[]).length,1);assert(!html.includes('campaign-popup'));
});
test('completion, skipped presentation and reopened final saves keep the map notice; old history hides it',()=>{
 const {run,playback:p}=setup();p.finish();
 assert(renderMapStage({world:p.displayWorld,run,playback:p}).includes('data-unification-phase="complete"'));
 assert(renderMapStage({world:run.world,run,playback:new TurnPlayback()}).includes('천하통일'));
 p.load(p.state.record,p.state.before,p.state.after,false,run.history);
 assert(!renderMapStage({world:p.displayWorld,run,playback:p}).includes('data-unification='));
});
test('announcement timing, pause and one existing fanfare at 1/4/8/16x never mutate the campaign',()=>{
 const {run,playback:p}=setup(),snapshot=JSON.stringify(run);p.state.index=p.state.scenes.findIndex(s=>s.kind==='unification');
 assert.equal(observerDuration(p.scene,p.state.record,'holding'),2800/1.2);
 assert.equal(observerDuration(p.scene,p.state.record,'holding',true),700/1.2);
 for(const speed of [1,4,8,16]){
  const cues=presentationSoundCues(p.state,{speed,settings:SOUND_DEFAULTS});
  assert.equal(cues.filter(c=>c.id==='campaign_complete').length,1);
 }
 p.pause();assert.equal(JSON.stringify(run),snapshot);
 p.finish();assert.deepEqual(presentationSoundCues(p.state),[]);assert.equal(JSON.stringify(run),snapshot);
});
