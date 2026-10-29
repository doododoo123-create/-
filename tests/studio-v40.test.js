import test from 'node:test';
import assert from 'node:assert/strict';
import {simulate39} from './studio-v39-fixture.mjs';
import {TurnPlayback} from '../src/ui/playback.js';
import {cohortWinner} from '../src/ui/battle-cohorts.js';
import {atlasGeometry,atlasBorders} from '../src/ui/atlas-cache.js';
import {geometryFor,designedBorders} from '../src/model/cartography-geometry.js';
import {renderAtlas} from '../src/ui/atlas-view.js';
import {renderJudgmentOverlay} from '../src/ui/judgment-overlay.js';
import {renderMapStage} from '../src/ui/map-stage.js';
import {createContinentV31World} from '../src/scenarios/continent-v31.js';
import {runSaveData} from '../src/storage/run-store.js';
import {restoreRun,nextTurn} from '../src/engine/simulation.js';
import {replayTurn} from '../src/engine/replay.js';
import {localImageURL} from '../src/ui/local-image-url.js';
import {applicationSteps,observerDuration} from '../src/ui/observer-flow.js';
function setup(options={}){const x=simulate39(options),p=new TurnPlayback({options:()=>({compactCampaigns:true,armyPresentation:true})});p.load(x.record,x.start.world,x.run.world,false);return {...x,p};}
test('shared local image URLs preserve the exact embedded bytes without rewriting stored data',async()=>{
 const saved=globalThis.document,source='data:image/png;base64,AQIDBAUGBwg=';let url;
 try{globalThis.document={createElement:()=>({})};url=localImageURL(source);assert(url.startsWith('blob:'));assert.equal(localImageURL(source),url);assert.deepEqual(new Uint8Array(await (await fetch(url)).arrayBuffer()),Uint8Array.from([1,2,3,4,5,6,7,8]));assert.equal(localImageURL('https://example.invalid/image.png'),'https://example.invalid/image.png');}
 finally{if(saved===undefined)delete globalThis.document;else globalThis.document=saved;if(url)URL.revokeObjectURL(url);}
});
test('normal atlas reuses geometry and border calculations across display worlds without retaining unlimited ownership states',()=>{
 const w=createContinentV31World(),g=atlasGeometry(w),edges=atlasBorders(w,g);
 assert.equal(atlasGeometry({...w,people:[]}),g);assert.equal(atlasBorders({...w,people:[]},g),edges);
 assert.deepEqual(edges,designedBorders(w,g));
 const change={...w,territories:w.territories.map((t,i)=>i===0?{...t,ownerId:w.countries.find(c=>c.id!==t.ownerId).id}:t)};
 const next=atlasBorders(change,g);assert.notEqual(next,edges);assert.deepEqual(next,designedBorders(change,g));assert.equal(atlasBorders(w,g),edges);
});
test('geometry cache detects in-place coordinates, holes, ordering and undo',()=>{
 const w=createContinentV31World(),id=w.territories[0].id,g=atlasGeometry(w),shape=w.cartography.polygons[id];
 shape.points[0][0]+=3;const next=atlasGeometry(w);assert.notEqual(next,g);assert.deepEqual(next.cells,geometryFor({...w}).cells);
 shape.points[0][0]-=3;assert.deepEqual(atlasGeometry(w),g);
 const old=atlasGeometry(w);shape.holes=[[[1,1],[2,1],[2,2]]];assert.notEqual(atlasGeometry(w),old);
 const ordered=atlasGeometry(w);w.territories.reverse();assert.notEqual(atlasGeometry(w),ordered);
});
test('local offensive banner is disclosed after the final stacked win/loss, before cards disperse',()=>{
 for(const options of [{cohort:true},{multiAttack:true}]){
  const {p}=setup(options),ss=p.state.scenes,final=ss.findIndex(s=>s.cohortComplete&&s.kind==='apply'&&s.event.type==='resolve');assert(final>0);
  for(const s of ss.slice(0,final))assert.equal(cohortWinner(s,{effectStage:'troops'}),null);
  p.state.index=final;p.state.effectStage='outcome';assert.equal(cohortWinner(p.scene,p.state),null);assert(!renderAtlas(p.displayWorld,{presentation:p.state}).includes('data-cohort-winner'));
  p.state.effectStage='troops';const last=p.scene.engagement.battles.at(-1),winner=last.winner===last.actor?last.actorId:last.defenderId;
  assert.equal(cohortWinner(p.scene,p.state),winner);const html=renderAtlas(p.displayWorld,{presentation:p.state});assert.equal((html.match(/data-cohort-winner=/g)||[]).length,1);assert(html.includes(`data-cohort-winner="${winner}"`));assert(html.includes('공세 우세'));
 }
});
test('a held assault uses the actual last duel, rather than awarding a majority of earlier victories',()=>{
 const base={actor:0,target:1,actorId:'a',defenderId:'b'},scene={cohortComplete:true,kind:'apply',event:{type:'resolve'},engagement:{battles:[{...base,winner:0},{...base,winner:0},{...base,winner:1}]}};
 assert.equal(cohortWinner(scene,{effectStage:'troops'}),'b');scene.engagement.battles.at(-1).winner=null;assert.equal(cohortWinner(scene,{effectStage:'troops'}),null);
});
test('whole-unit zero losses still leave enough time to read the local winner at normal speed',()=>{
 const {p,record}=setup({cohort:true}),original=p.state.scenes.find(s=>s.cohortComplete&&s.kind==='apply'&&s.event.type==='resolve'),scene={...original,worldAfter:original.worldBefore},b=record.battles[scene.battleIndex],preview={...record,battles:record.battles.map(x=>x===b?{...x,losses:{attack:{amount:0},defense:{amount:0}}}:x)};
 assert.deepEqual(applicationSteps(scene,preview),['outcome','territory']);assert(observerDuration(scene,preview,'territory')>=399);assert(observerDuration(scene,preview,'territory',true)>=399);assert(cohortWinner(scene,{effectStage:'territory'}));
});
test('map playback has no reflection strip, route selector or spectator options; play, calendar and sound remain',()=>{
 const {p,run}=setup({cohort:true});p.state.index=p.state.scenes.findIndex(s=>s.campaignPhase==='map'&&s.kind==='apply');assert.equal(renderJudgmentOverlay({world:p.displayWorld,playback:p}),'');
 const html=renderMapStage({world:p.displayWorld,run,playback:p,soundButton:'<button data-action="sound-settings">소리</button>'});
 for(const text of ['지도 반영 중','playback-settings','toggle-route-mode','관전 설정','전체 경로','전선 요약'])assert(!html.includes(text),text);
 for(const text of ['map-play-toggle','map-calendar','map-recent-events','sound-settings','toggle-camera-follow'])assert(html.includes(text),text);
});
test('army representative grows only its information box and keeps ordinary cards and portrait content',()=>{
 const {p}=setup();p.state.index=p.state.scenes.findIndex(s=>s.kind==='army-forming');assert(p.state.index>=0);const html=renderAtlas(p.displayWorld,{presentation:p.state});assert(!html.includes('width="38" height="76"'));assert(html.includes('scale(1.7)'));assert(html.includes('width="32" height="58"'));assert(html.includes('token-army-caption'));
});
test('optimized presentation, final banner, save restoration and replay leave combat and future RNG unchanged',async()=>{
 const {p,run,record}=setup({cohort:true}),snapshot=JSON.stringify(run);for(let i=0;i<5000&&!p.complete;i++)p.step();assert(p.complete);assert.equal(JSON.stringify(run),snapshot);
 const restored=restoreRun(runSaveData(run)),replay=await replayTurn(restored,1);assert.deepEqual(replay.record.battles,record.battles);assert.deepEqual(replay.after.people,run.world.people);assert.deepEqual(nextTurn(restored).engineState,nextTurn(run).engineState);
});
