import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoWorld} from '../src/data/demo-world.js';
import {createRun,nextTurn} from '../src/engine/simulation.js';
import {TurnPlayback,makeTurnScenes} from '../src/ui/playback.js';
import {compactCampaignScenes,campaignSummary} from '../src/ui/campaign-playback.js';
import {renderCampaignOverlay} from '../src/ui/campaign-view.js';
import {PLAYBACK_SPEEDS,loadPlaybackSettings,savePlaybackSettings} from '../src/ui/playback-settings.js';
import {presentationSoundCues} from '../src/audio/cues.js';
import {normalizeSoundSettings} from '../src/audio/settings.js';
import {fakeSoundRig,audioState,fakeAudioPlayback,audioFlush} from './audio-v24-fixture.mjs';
import {SoundDirector} from '../src/audio/director.js';
function campaignFixture(){const initial=createRun(createDemoWorld(),123456),run=nextTurn(initial,{rolls:{king:10},targetId:1});return {record:run.history[0],before:initial.world,after:run.world,run};}
function timing(){let id=0,now=0;const jobs=new Map();return {jobs,now:()=>now,schedule:(fn,ms)=>{jobs.set(++id,{fn,ms});return id;},cancel:n=>jobs.delete(n),advance(ms){now+=ms;}};}
test('compact groups preserve the engine and reveal only completed battles',()=>{
 const f=campaignFixture(),snapshot=JSON.stringify(f.run),raw=makeTurnScenes(f.record,f.before),compact=compactCampaignScenes(raw,f.record),groups=compact.filter(s=>s.kind==='campaign');
 assert(groups.length>0);assert.equal(compact.filter(s=>s.kind==='movement').length,raw.filter(s=>s.kind==='movement').length);assert.equal(compact.filter(s=>s.kind==='capture').length,raw.filter(s=>s.kind==='capture').length);
 for(const s of groups){
  const info=campaignSummary(s);
  assert.equal(info.completed,s.completedBattles);
  assert.equal(info.combats+info.automatic,s.completedBattles);
  if(s.campaignPhase==='approach'){assert.equal(info.ownLoss,0);assert.equal(info.combats,0);assert.equal(info.net,0);}
  if(s.campaignPhase==='combat')assert.equal(info.combats+info.automatic,s.completedBattles);
 }
 assert.equal(JSON.stringify(f.run),snapshot);
 assert.deepEqual(nextTurn(f.run).engineState,nextTurn(JSON.parse(snapshot)).engineState);
});
test('summary uses distinct participants and snapshot net ownership rather than adding repeated captures',()=>{
 const f=campaignFixture(),scene=compactCampaignScenes(makeTurnScenes(f.record,f.before),f.record).find(s=>s.campaignPhase==='summary'),info=campaignSummary(scene);
 assert.equal(new Set(info.actor.map(p=>p.id)).size,info.actor.length);
 const before=new Set(scene.worldBefore.territories.filter(t=>t.ownerId===scene.campaign.actorId).map(t=>t.id));
 const after=new Set(scene.worldAfter.territories.filter(t=>t.ownerId===scene.campaign.actorId).map(t=>t.id));
 assert.equal(info.net,after.size-before.size);
 assert.equal(info.ownLoss+info.enemyLoss,scene.campaign.battles.reduce((n,b)=>n+(b.losses?.attack?.amount||0)+(b.losses?.defense?.amount||0),0));
});
test('king action can run at one-times speed while target selection and later stages run at sixteen',()=>{
 const f=campaignFixture(),c=timing();let on=true;
 const p=new TurnPlayback({...c,speed:()=>16,options:()=>({kingChoiceNormalSpeed:on})});
 p.load(f.record,f.before,f.after,false);
 while(p.scene.event?.type!=='king')p.step();
 assert.equal(p.effectiveSpeed,1);assert.equal(p.animationSpeed,1);
 p.resume();assert.equal([...c.jobs.values()][0].ms,p.duration());p.pause();
 on=false;p.resume();assert.equal([...c.jobs.values()][0].ms,p.remaining/16);p.pause();
 while(p.scene.event?.type==='king')p.step();
 assert.equal(p.effectiveSpeed,16);
});
test('detail view replays existing scenes and returns without completing or mutating the live turn',()=>{
 const f=campaignFixture(),snapshot=JSON.stringify(f.run),p=new TurnPlayback({options:()=>({compactCampaigns:true})});let finishes=0;p.onFinish=()=>finishes++;
 p.load(f.record,f.before,f.after,false);while(p.scene.campaignPhase!=='summary')p.step();
 const state=p.state,index=state.index;p.showCampaignDetails();
 assert(p.detailReturn);assert(p.state.campaignDetail);assert.equal(p.playing,false);
 for(let i=0;i<2000&&p.detailReturn;i++)p.step();
 assert.equal(p.detailReturn,null);assert.equal(p.state,state);assert.equal(p.state.index,index);
 assert.equal(finishes,0);assert.equal(JSON.stringify(f.run),snapshot);
 const html=renderCampaignOverlay({playback:p});assert(html.includes('상세 보기'));assert(html.includes('영토 순증'));
});
test('viewer preferences persist separately, default to compact and normal king choices, and include sixteen',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 assert.deepEqual(PLAYBACK_SPEEDS,[.5,1,2,4,8,16]);
 assert.deepEqual(loadPlaybackSettings(storage),{compactCampaigns:true,kingChoiceNormalSpeed:true});
 savePlaybackSettings(storage,{compactCampaigns:false,kingChoiceNormalSpeed:false});
 assert.deepEqual(loadPlaybackSettings(storage),{compactCampaigns:false,kingChoiceNormalSpeed:false});assert.equal(map.size,1);
});
test('4x, 8x and 16x retain result and capture sounds without repeated rolling sounds',()=>{
 const battle={actor:0,target:1,actorId:'a',defenderId:'b',winner:0,automatic:false,index:0,losses:{attack:{grade:'major'}},takenTerritoryIds:['x']};
 for(const speed of [4,8,16]){
  const state=audioState({kind:'apply',event:{type:'resolve',index:1},battleIndex:0},{battles:[battle]});state.effectStage='outcome';
  assert(presentationSoundCues(state,{speed,settings:normalizeSoundSettings()}).some(c=>c.id==='battle_victory'));
  state.scenes[0].kind='capture';assert(presentationSoundCues(state,{speed,settings:normalizeSoundSettings()}).some(c=>c.id==='territory_capture'));
 }
});
test('fast one-shot tails survive the next record, while pause still stops every gameplay sound',async()=>{
 const rig=fakeSoundRig();await rig.mixer.unlock();const director=new SoundDirector(rig.mixer),p=fakeAudioPlayback(audioState({kind:'season',event:{type:'season',index:0,seasonIndex:0}}));
 p.rate=16;director.sync(p);await audioFlush();assert(rig.mixer.voices.size>0);
 p.state=audioState({kind:'focus',event:{type:'territory',index:1}},{turn:2});director.sync(p);await audioFlush();
 assert(rig.mixer.voices.size>0);director.pause();assert.equal(rig.mixer.voices.size,0);
});
