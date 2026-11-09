import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {fourArmyFixture} from './studio-v41-fixture.mjs';
import {TurnPlayback} from '../src/ui/playback.js';import {roundCampaign} from '../src/ui/round-campaign.js';import {MapCamera} from '../src/ui/map-camera.js';
import {stableUnitGround} from '../src/ui/stable-unit-placement.js';import {batchMovementPins} from '../src/ui/batched-movement.js';import {landMovementPath} from '../src/ui/land-movement.js';import {polylineAt} from '../src/ui/operation-geometry.js';
import {pointInShape} from '../src/model/cartography.js';import {nextOfficerName} from '../src/engine/officer-names.js';import {OFFICER_NAMES} from '../src/data/officer-names.js';
import {nextTurn,restoreRun} from '../src/engine/simulation.js';import {runSaveData} from '../src/storage/run-store.js';import {replayTurn,replayFingerprint} from '../src/engine/replay.js';
import {BATTLE_SOUND_PACK} from '../src/data/battle-sound-art.js';import {massBattleSoundCues} from '../src/audio/mass-battle-cues.js';import {SoundDirector} from '../src/audio/director.js';import {fakeSoundRig,audioState,fakeAudioPlayback,audioFlush} from './audio-v24-fixture.mjs';
function setup(){const f=fourArmyFixture(),p=new TurnPlayback({options:()=>({armyPresentation:true,massBattlePresentation:true}),speed:()=>2});p.load(f.record,f.start.world,f.run.world,false);return {f,p};}
test('212% camera stays at occupation through hold, roster and administrative settlement',()=>{
 const {f}=setup(),c=new MapCamera();c.autoFollow=true;c.update=()=>{};c.viewport=()=>({width:1600,height:1000});c.view('simulation').zoom=2.12;
 const before=f.start.world,after=f.run.world,record=f.record;
 c.follow({scene:{kind:'capture',event:{type:'occupation',index:47},battleIndex:6,worldBefore:before,worldAfter:after},state:{record}});const frozen={...c.view('simulation')};
 for(const type of ['hold','roster','war_recovery','season_recovery','desertion','production_settlement'])for(const kind of ['focus','apply'])c.follow({scene:{kind,event:{type,index:100,slot:0,nationId:'b'},worldBefore:after,worldAfter:after},state:{record}});
 assert.deepEqual(c.view('simulation'),frozen);assert.equal(frozen.zoom,2.12);
});
test('map recap carries positions, owners and route visibility forward without a future snapshot',()=>{
 const {f,p}=setup(),ss=p.state.scenes,recap=ss.filter(s=>s.massRecap);assert(recap.some(s=>s.batchRetreat));assert(recap.some(s=>s.kind==='capture'));
 for(let i=0;i<recap.length;i++){
  const s=recap[i];if(i){assert.deepEqual(s.campsBefore,recap[i-1].camps);assert.deepEqual(s.worldBefore.territories,recap[i-1].worldAfter.territories);}
  p.state.index=ss.indexOf(s);const campaign=roundCampaign(p.displayWorld,p.state);
  for(const route of campaign.routes)assert(s.mapReveal.battles.includes(Number(route.key.split('-')[1]))||route.turn<f.record.turn);
  if(s.kind==='movement'&&s.moves.some(m=>m.kind==='occupation')){const m=s.moves.find(m=>m.kind==='occupation');assert.equal(s.worldBefore.territories.find(t=>t.id===m.toId).ownerId,'b');assert.equal(s.worldAfter.territories.find(t=>t.id===m.toId).ownerId,'b');assert(!campaign.captures.has(m.toId));}
  if(s.kind==='capture')assert(campaign.captures.has(f.record.battles[s.battleIndex].takenTerritoryIds[0]));
 }
 const last=ss.find(s=>s.massReturn);assert.deepEqual(last.worldAfter,ss.find(s=>s.massPlan).massPlan.after);assert.deepEqual(ss.at(-1).worldAfter,f.run.world);assert.deepEqual(last.mapReveal,recap.at(-1).mapAfterReveal);
});
test('coastal placement stays inside land and never changes when unrelated units arrive',()=>{
 const {f}=setup(),w=structuredClone(f.start.world),shape={points:[[0,0],[100,0],[100,30],[30,30],[30,100],[0,100]],center:[15,50]};w.cartography.polygons['tile-5']=shape;
 const people=w.people.filter(p=>p.role==='general');for(const person of people){const p=stableUnitGround(w,person,'tile-5');assert(pointInShape(p,{...shape,holes:[]}));const copy={...w,people:[...w.people].reverse()};assert.deepEqual(p,stableUnitGround(copy,person,'tile-5'));}
});
test('land movement is continuous around a coastal inlet and uses matching fixed endpoints',()=>{
 const {f}=setup(),w=structuredClone(f.start.world),shape={points:[[0,0],[100,0],[100,30],[30,30],[30,100],[0,100]],center:[15,50]};w.cartography.polygons['tile-5']=shape;
 const route=landMovementPath(w,['tile-5'],[80,15],[15,80]);assert(route&&route.length>2);let previous;
 for(let i=0;i<=100;i++){const p=polylineAt(route,i/100).point;assert(pointInShape(p,{...shape,holes:[]}));if(previous)assert(Math.hypot(p[0]-previous[0],p[1]-previous[1])<3);previous=p;}
 const moves=w.people.filter(p=>p.role==='general').slice(0,7).map(p=>({personId:p.id,fromId:'tile-5',toId:'tile-6',path:['tile-5','tile-6']}));for(const m of moves)for(const t of [0,.49,.5,.51,1])assert.deepEqual(batchMovementPins([m],w,t)[0],batchMovementPins(moves,w,t).find(p=>p.id===m.personId));
});
test('200 appointment names are unique, skip current names and do not consume game RNG',()=>{
 assert.equal(OFFICER_NAMES.length,200);assert.equal(new Set(OFFICER_NAMES).size,200);const {f}=setup(),state=structuredClone(f.run.engineState),rng=state.rng,used=new Set();
 for(let slot=0;slot<200;slot++){const name=nextOfficerName(state,0,slot,1);assert(!used.has(name));used.add(name);state.countries[0].generals.push({name,appointed:true});}assert.equal(state.rng,rng);
});
test('new successors use the pool while legacy histories and all combat rolls remain reproducible',async()=>{
 let {run}=fourArmyFixture({deathRaw:1}),old=run;for(let i=0;i<20&&run.engineState.countries[0].generals[0].generation===0&&!run.result;i++){
  const control={rolls:{king:1,minister:1,domestic:1}};run=nextTurn(run,{...control,officerNames:true});old=nextTurn(old,control);assert.equal(run.rng,old.rng);assert.equal(replayFingerprint(run.history.at(-1)),replayFingerprint(old.history.at(-1)));
 }
 const g=run.engineState.countries[0].generals[0];assert.equal(g.generation,1);assert(OFFICER_NAMES.includes(g.name));assert.notEqual(g.name,old.engineState.countries[0].generals[0].name);
 const restored=restoreRun(runSaveData(run)),rebuilt=await replayTurn(restored,run.turn);assert.equal(rebuilt.after.people.find(p=>p.slot===0&&p.countryId==='a'&&p.role==='general').name,g.name);assert.deepEqual(nextTurn(restored).engineState,nextTurn(run).engineState);
});
test('13 supplied OGGs match the manifest and combat cues avoid double first-clash and death sounds',()=>{
 const manifest=JSON.parse(readFileSync('assets/battle-pack-v1/manifest.json'));assert.equal(BATTLE_SOUND_PACK.length,13);for(const s of BATTLE_SOUND_PACK){const path='audio/ogg/'+s.id.replace(/^bp_/,'')+'.ogg',b=readFileSync('assets/battle-pack-v1/'+path);assert.equal(createHash('sha256').update(b).digest('hex'),manifest.files.find(f=>f.path===path).sha256);assert.equal(s.data,'data:audio/ogg;base64,'+b.toString('base64'));}
 const {p}=setup(),scene=p.state.scenes.find(s=>s.massPlan),cues=massBattleSoundCues(scene,{speed:4});assert.equal(cues.filter(c=>c.id==='bp_sfx_first_clash').length,1);assert(cues.some(c=>c.loop&&c.id==='bp_amb_battle_distant_loop'));assert(!cues.some(c=>c.id==='sword_clash'));assert.deepEqual(massBattleSoundCues({...scene,massCritical:true,event:{type:'death',index:100}},{speed:4}).map(c=>c.id),['bp_sfx_general_fallen']);
});
test('real buffer loops stay within four voices, keep pitch, resume offsets and stop on pause/mute',async()=>{
 const r=fakeSoundRig();await r.mixer.unlock();const s=audioState({kind:'movement',entryMarch:true}),p=fakeAudioPlayback(s);p.ms=20000;r.mixer.sounds.set('bp_foley_army_march_loop',{...r.mixer.sounds.get('army_march'),id:'bp_foley_army_march_loop'});const d=new SoundDirector(r.mixer);d.sync(p);await audioFlush();assert(r.sources.at(-1).loop);assert.equal(r.sources.at(-1).started.length,2);assert.equal(r.sources.at(-1).playbackRate,undefined);
 d.sync(p);await audioFlush();assert.equal(r.played.length,1);r.clock.ms=3000;p.progress=.15;p.state.playing=false;d.sync(p);assert.equal(r.mixer.voices.size,0);p.state.playing=true;d.sync(p);await audioFlush();assert(r.played.at(-1).offset>=3);assert(r.sources.at(-1).loop);r.mixer.update({...r.mixer.settings,enabled:false});d.sync(p);assert.equal(r.mixer.voices.size,0);
 r.mixer.update({...r.mixer.settings,enabled:true});d.sync(p);await audioFlush();assert.equal(r.mixer.voices.size,1);for(const id of ['ui_click','dice_land','sword_clash','battle_impact'])await r.mixer.play({id,group:'battle',priority:35});assert(r.mixer.voices.size<=4);d.reset();assert.equal(r.mixer.voices.size,0);
});
