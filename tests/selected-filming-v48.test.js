import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {selectedTurnQueue,nextReplayTurn} from '../src/ui/selected-turns.js';
import {renderFilmingLayer} from '../src/ui/selected-film-view.js';
import {TurnPlayback} from '../src/ui/playback.js';
import {replayTurn} from '../src/engine/replay.js';
import {nextTurn} from '../src/engine/simulation.js';
import {fourArmyFixture} from './studio-v41-fixture.mjs';
const source=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const extract=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const line=name=>source.split('\n').find(s=>s.startsWith('function '+name+'('));

test('selection filters pending/missing turns, deduplicates and orders across history pages',()=>{
 const history=Array.from({length:300},(_,i)=>({turn:i+1}));
 assert.deepEqual(selectedTurnQueue([130,120,124,120,300,999],history,300),[120,124,130]);
 assert.equal(nextReplayTurn({queue:[120,124,130],turn:120}),124);
 assert.equal(nextReplayTurn({queue:[120,124,130],turn:130}),null);
 assert.equal(nextReplayTurn({turn:120,endTurn:122}),121);
});

test('actual app restores only selected turns, stops at end, keeps pause on speed change, and restores live presentation',async()=>{
 const f=fourArmyFixture();let run=f.run;for(let i=0;i<4;i++)run=nextTurn(run);
 const original=JSON.stringify(run),loaded=[],scheduled=[];
 const p=new TurnPlayback({options:()=>({armyPresentation:true,compactCampaigns:true}),schedule:()=>1,cancel(){}});
 p.load(run.history.at(-1),run.world,run.world,false);p.finish();const live=p.state;
 const ctx=vm.createContext({run,playback:p,replaySession:null,replayToken:0,auto:false,timer:null,selectedFilmTurns:new Set([3,1]),selectedTurnQueue,nextReplayTurn,
 ui:{speed:1,replayLoading:false,mapFullscreen:false},soundDirector:{pause(){},reset(){}},
 mapCamera:{views:new Map(),followKey:'live',followRecord:live.record,autoFollow:false,view:()=>({x:600,y:400,zoom:2}),resetFollow(){},cancelMotion(){},setFollowing(value){this.autoFollow=value;}},
 render(){},notify(message){throw Error(message);},openMapFullscreen(){ctx.ui.mapFullscreen=true;},
 replayTurn:async(...args)=>{loaded.push(args[1]);return replayTurn(...args);},
 setTimeout(fn){scheduled.push(fn);return scheduled.length;},clearTimeout(){scheduled.length=0;},Date,
 document:{fullscreenElement:null},$:()=>({}),ensureRun(){throw Error('Must never create a live turn');}});
 vm.runInContext([line('stop'),line('setPlaybackSpeed'),line('startAuto'),extract('function beginTurn(','function step()'),extract('function returnFromReplay(){','async function showHistoryTurn'),extract('async function startSelectedFilm(){','const actions = {')].join('\n'),ctx);
 const finish=extract('  onFinish: async () => {','  speed: () =>').trim().replace(/^onFinish: /,'').replace(/,$/,'');
 vm.runInContext('globalThis.finishCallback = '+finish,ctx);p.onFinish=()=>ctx.finishCallback();
 await ctx.startSelectedFilm();assert.deepEqual(loaded,[1]);assert.equal(p.state.record.turn,1);assert.equal(ctx.mapCamera.autoFollow,true);
 p.finish();assert.equal(scheduled.length,1);await scheduled.shift()();await new Promise(r=>setImmediate(r));
 assert.deepEqual(loaded,[1,3]);assert.equal(p.state.record.turn,3);
 p.finish();assert.equal(ctx.replaySession.playing,false);assert.equal(scheduled.length,0);
 ctx.setPlaybackSpeed(16);assert.equal(p.playing,false);assert.deepEqual(loaded,[1,3]);
 ctx.moveSelectedFilm(-1);await new Promise(r=>setImmediate(r));assert.equal(p.state.record.turn,1);
 ctx.returnFromReplay();assert.equal(p.state,live);assert.equal(p.playing,false);assert.equal(ctx.mapCamera.autoFollow,false);assert.equal(ctx.ui.mapFullscreen,false);assert.equal(ctx.replaySession,null);
 assert.equal(JSON.stringify(run),original);
});

test('single selected turn has no successor and controls omit removed filming tools',()=>{
 assert.equal(nextReplayTurn({queue:[12],turn:12}),null);
 const html=renderFilmingLayer({playback:{complete:true,playing:false,speed:()=>16},session:{queue:[12],turn:12},cameraFollow:true});
 assert.match(html,/재생 완료/);assert.match(html,/시점 고정 켜짐/);
 assert.doesNotMatch(html,/film-retake|film-hold|film-save-camera|film-mark|film-seek|미니맵|컷아웃/);
});
