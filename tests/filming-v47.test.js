import test from 'node:test';
import assert from 'node:assert/strict';
import {fourArmyFixture} from './studio-v41-fixture.mjs';
import {TurnPlayback} from '../src/ui/playback.js';
import {filmBattleMetadata,applyFilmStreak,filmingDuration,filmSummaryInfo} from '../src/ui/filming-playback.js';
import {filmSafeTarget,filmCameraAt} from '../src/ui/filming-camera.js';
import {loadFilmingSettings,saveFilmingSettings} from '../src/ui/filming-settings.js';
import {renderFilmingLayer,filmCutout} from '../src/ui/filming-view.js';
import {presentationSoundCues} from '../src/audio/cues.js';

const options=()=>({filming:true,armyPresentation:true,kingChoiceNormalSpeed:true});
function playback(f=fourArmyFixture(),extra={}){const p=new TurnPlayback({options,...extra});p.load(f.record,f.start.world,f.run.world,false);return p;}
const duel=(index=0,extra={})=>({index,actor:0,target:1,actorId:'a',defenderId:'b',attackerPersonId:'hero',defenderPersonId:'enemy-'+index,attack:{army:7,score:30,raw:20,bonus:10},defense:{army:21,score:20,raw:10,bonus:10},winner:0,...extra});

test('film plan reads real frames without mutating worlds, controls, RNG, or the saved record',()=>{
 const f=fourArmyFixture(),before=JSON.stringify(f),p=playback(f);let steps=0;while(!p.complete&&steps++<1000)p.step();assert(p.complete);assert.equal(JSON.stringify(f),before);assert(p.state.scenes.some(s=>s.filmRepeat));assert(p.state.scenes.some(s=>s.filmPhase==='judgment'));
 const report=p.state.scenes.find(s=>s.filmSummary),info=filmSummaryInfo(report.filmSummary,report.worldAfter);assert.equal(info.combats,7);assert.equal(info.wins,4);assert.equal(info.losses,3);assert.equal(info.net,1);
});
test('ordinary four-phase battle is 2000ms at1x; fast playback retains readable result and map minima',()=>{
 const p=playback(),core=p.state.scenes.filter(s=>s.battleIndex===0&&s.filmAtomic&&s.kind!=='film-camera');assert.deepEqual([...new Set(core.map(s=>s.filmPhase))],['situation','judgment','result','map']);assert.equal(core.reduce((ms,s)=>ms+filmingDuration(s,p.state.record,'holding',1),0),2000);
 const result=core.find(s=>s.filmPhase==='result'),map=core.find(s=>s.filmPhase==='map');for(const speed of [4,8,16]){assert(filmingDuration(result,p.state.record,'all',speed)>=450);assert(filmingDuration(map,p.state.record,'all',speed)>=350);}
});
test('losses and growth are available together while result ownership stays at the pre-map frame',()=>{
 const p=playback(),result=p.state.scenes.find(s=>s.filmPhase==='result'),record=p.state.record,raw=record.frames[result.event.index];
 assert.deepEqual(result.worldAfter.territories,raw.before.territories);assert.deepEqual(result.worldAfter.people.map(p=>p.positionId),raw.before.people.map(p=>p.positionId));
 for(const before of raw.before.people){const after=raw.after.people.find(p=>p.id===before.id),shown=result.worldAfter.people.find(p=>p.id===before.id);assert.equal(shown.troops,after.troops);assert.equal(shown.wins,after.wins);assert.equal(shown.alive,before.alive);}
 assert.equal(result.mapEventIndex,result.event.index-1);
});
test('streaks use personal identity and actual consecutive wins rather than cumulative experience counters',()=>{
 const history=[{turn:1,battles:Array.from({length:5},(_,i)=>duel(i))}],current={turn:2,events:[],battles:[duel(0,{actorId:'new-country',slot:4,attack:{army:7,wins:100}}),duel(1,{attackerPersonId:'successor'})]};
 const meta=filmBattleMetadata(current,history);assert.equal(meta.get(0).start.attack,5);assert.equal(meta.get(0).end.attack,6);assert.equal(meta.get(1).start.attack,0);
 const s=new Map([['hero',5]]);applyFilmStreak(s,duel(0,{automatic:true}));assert.equal(s.get('hero'),5);applyFilmStreak(s,duel(0,{winner:null}));assert.equal(s.get('hero'),0);applyFilmStreak(s,duel());applyFilmStreak(s,duel(1,{winner:1}));assert.equal(s.get('hero'),0);
});
test('3x upset uses pre-battle troop ratio for attacker or defender; zero, draws, and automatic occupations do not qualify',()=>{
 const record={turn:1,events:[],battles:[duel(),duel(1,{winner:1,attack:{army:21},defense:{army:7}}),duel(2,{attack:{army:0}}),duel(3,{winner:null}),duel(4,{automatic:true})]},m=filmBattleMetadata(record);
 assert(m.get(0).upset);assert(m.get(1).upset);assert(m.get(0).challenging);assert(m.get(0).highlightBefore);assert(m.get(0).highlightResult);for(const i of [2,3,4])assert(!m.get(i).upset);
});
test('HUD does not disclose unrolled scores, future campaign totals, or post-battle honor before results',()=>{
 const p=playback(),at=p.state.scenes.findIndex(s=>s.filmPhase==='situation'&&s.filmAtomic);p.seekFilm(at);const scene=p.scene;scene.filmMeta={...scene.filmMeta,upset:true,streak:true,end:{attack:5,defense:0},winnerSide:'attack',highlightResult:true};
 const html=renderFilmingLayer({world:p.displayWorld,playback:p,settings:{infoScale:1,cardScale:1},cameraBox:[0,0,1200,800]});assert(!html.includes('film-highlight '));assert(!html.includes('5연승'));assert(!html.includes('4승 3패'));assert(!html.includes(`= ${scene.filmBattle.defense.score}`));assert(html.includes('교전 전 병력'));
 p.seekFilm(p.state.scenes.findIndex(s=>s.battleIndex===scene.battleIndex&&s.filmPhase==='result'));const shown=renderFilmingLayer({world:p.displayWorld,playback:p,settings:{infoScale:1,cardScale:1}});assert(shown.includes('손실 −'));assert(shown.includes(`= ${p.scene.filmBattle.defense.score}`));
});
test('a death breaks a compressed segment before the death notice; reports only include already resolved duels',()=>{
 const p=playback(fourArmyFixture({deathRaw:1})),scenes=p.state.scenes,death=scenes.findIndex(s=>s.kind==='apply'&&s.event?.type==='death');assert.equal(scenes[death-1].kind,'film-summary');assert(scenes.filter(s=>s.filmSummary).length>1);
 for(const scene of scenes.filter(s=>s.filmSummary))for(const b of scene.filmSummary.battles){const resolve=p.state.record.events.find(e=>e.battleIndex===b.index&&e.type==='resolve');if(resolve)assert(resolve.index<=scene.mapEventIndex);}
 const last=scenes.filter(s=>s.filmSummary).at(-1);assert(last.filmSummary.final);assert.equal(last.filmSummary.battles.length,p.state.record.battles.length);
});
test('a retake ends on its selected boundary without finishing/saving/generating the live turn; audio gets a fresh state',()=>{
 let finished=0;const p=playback(undefined,{onFinish:()=>finished++});p.seekFilm(p.state.scenes.findIndex(s=>s.filmPhase==='result'));assert.equal(p.state.scenes[p.filmRange('campaign').end].kind,'film-summary');const original=p.state,range=p.filmRange('battle');assert(range.start<range.end);p.seekFilm(range.start,{end:range.end});assert.notEqual(p.state,original);let steps=0;while(!p.state.rangeDone&&steps++<1000)p.step();assert.equal(p.state.index,range.end);assert(!p.state.finished);assert(!p.playing);assert.equal(finished,0);
 const report=p.state.scenes.findIndex(s=>s.filmSummary);p.seekFilm(report);const campaign=p.filmRange('campaign');assert(campaign.start<report);assert.equal(campaign.end,report);
});
test('speed changes keep current phase progress, pause remaining wall time, and do not divide the film clock twice',()=>{
 let now=0,speed=1,timer;const p=playback(undefined,{speed:()=>speed,now:()=>now,schedule:(fn,delay)=>(timer={fn,delay},1),cancel:()=>{}});p.seekFilm(p.state.scenes.findIndex(s=>s.filmPhase==='result'));p.resume();assert.equal(timer.delay,700);now=350;const progress=p.sceneProgress;p.pause();assert.equal(progress,.5);speed=16;p.retime(progress);assert.equal(p.effectiveSpeed,1);assert.equal(p.sceneProgress,.5);assert.equal(p.remaining,225);now=9000;p.resume();assert.equal(timer.delay,225);now+=225;timer.fn();assert.equal(p.scene.filmPhase,'map');
});
test('first king choice uses its normal clock by default and can use the selected16x clock when disabled',()=>{
 let normal=true;const p=playback(undefined,{speed:()=>16,options:()=>({...options(),kingChoiceNormalSpeed:normal})});const at=p.state.scenes.findIndex(s=>s.kind==='reel'&&s.event.type==='king');p.seekFilm(at);assert.equal(p.duration(),900);assert.equal(p.animationSpeed,1);normal=false;assert.equal(p.duration(),900/16);assert.equal(p.animationSpeed,16);
});
test('front camera keeps in-frame battles still, pans minimally without zooming, and can be paused at a shared progress',()=>{
 const view={x:600,y:400,zoom:2},box=[300,200,600,400],viewport={width:1200,height:800};const inside=filmSafeTarget(view,box,viewport,[600,400],{bottom:250});assert(!inside.needed);assert.deepEqual(inside.to,view);
 const edge=filmSafeTarget(view,box,viewport,[890,400],{bottom:250});assert(edge.needed);assert.equal(edge.to.zoom,2);assert(edge.to.x>600&&edge.to.x<750);assert.deepEqual(filmCameraAt(edge,0),{x:view.x,y:view.y});assert.deepEqual(filmCameraAt(edge,1),{x:edge.to.x,y:edge.to.y});assert.deepEqual(filmCameraAt(edge,.5),filmCameraAt(edge,.5));
});
test('film judgment and result sound cues survive4/8/16x with physical stage duration',()=>{
 const p=playback();for(const speed of [1,4,8,16]){p.state.selectedSpeed=speed;for(const phase of ['judgment','result']){p.seekFilm(p.state.scenes.findIndex(s=>s.filmPhase===phase));const cues=presentationSoundCues(p.state,{speed:p.effectiveSpeed,duration:p.duration()});assert(cues.length>0);assert(cues.every(c=>c.at>=0));}}
});
test('cutout selection follows the original portrait key, and viewer settings are separate, validated storage',()=>{
 assert(filmCutout({id:'x',role:'general',portraitKey:'general-070'},{id:'a'}).cutout);assert(!filmCutout({id:'x',role:'king',portraitKey:'king-001'},{id:'a'}).cutout);
 let saved;const storage={getItem:()=>saved,setItem:(_key,value)=>saved=value};assert(!loadFilmingSettings(storage).enabled);saveFilmingSettings(storage,{enabled:true,infoScale:1.5,cardScale:1.25,kingChoiceNormalSpeed:false,clean:true});const s=loadFilmingSettings(storage);assert(s.enabled);assert.equal(s.infoScale,1.5);assert.equal(s.clean,false);assert.equal(s.kingChoiceNormalSpeed,false);saved='{"infoScale":99}';assert.equal(loadFilmingSettings(storage).infoScale,1);
});
