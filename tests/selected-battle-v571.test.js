import test from 'node:test';
import assert from 'node:assert/strict';
import {fourArmyFixture} from './studio-v41-fixture.mjs';
import {TurnPlayback} from '../src/ui/playback.js';
import {selectedBattleOptions,renderSelectedBattleMode} from '../src/ui/selected-battle-mode.js';
import {loadFilmingSettings,saveFilmingSettings} from '../src/ui/filming-settings.js';
function play(f,mapOnly=false){const p=new TurnPlayback({options:()=>({armyPresentation:true,massBattlePresentation:true,massBattleMapOnly:mapOnly})});p.load(f.record,f.start.world,f.run.world,false);return p;}
const mapSnapshot=p=>p.state.scenes.filter(s=>!s.massPlan&&!s.battleEntry);
test('selected recording preference defaults on and persists without changing king-speed setting',()=>{
 let raw=null;const storage={getItem:()=>raw,setItem:(_k,v)=>raw=v};assert.equal(loadFilmingSettings(storage).massBattlePresentation,true);
 const s={...loadFilmingSettings(storage),kingChoiceNormalSpeed:false,massBattlePresentation:false};saveFilmingSettings(storage,s);assert.equal(loadFilmingSettings(storage).massBattlePresentation,false);assert.equal(loadFilmingSettings(storage).kingChoiceNormalSpeed,false);raw='broken';assert.equal(loadFilmingSettings(storage).massBattlePresentation,true);
 assert(renderSelectedBattleMode({}).includes('checked'));assert(!renderSelectedBattleMode({massBattlePresentation:false}).includes('checked'));
});
test('map-only preference applies exclusively to selected-turn recording sessions',()=>{
 for(const session of [null,{}, {film:false,massBattlePresentation:false},{film:true},{film:true,massBattlePresentation:true}])assert.equal(selectedBattleOptions(session).massBattleMapOnly,false);
 assert.equal(selectedBattleOptions({film:true,massBattlePresentation:false}).massBattleMapOnly,true);
});
test('off skips army tactics, summary and VS entry without falling back to individual dice; exact map recap is preserved',()=>{
 for(const deathRaw of [10,1]){const f=fourArmyFixture({deathRaw}),snapshot=JSON.stringify(f.run),on=play(f),off=play(f,true);assert(on.state.scenes.some(s=>s.massPlan));assert(!off.state.scenes.some(s=>s.massPlan||s.entryLocation));assert(off.state.scenes.some(s=>s.massRecap&&s.kind==='capture'));assert(!off.state.scenes.some(s=>['attack_roll','defense_roll'].includes(s.event?.type)));assert.deepEqual(mapSnapshot(off),mapSnapshot(on));assert.deepEqual(off.state.scenes.at(-1).worldAfter,f.run.world);assert.equal(JSON.stringify(f.run),snapshot);}
});
test('switching back on and replaying repeats the same record; returning live does not inherit recording preference',()=>{
 const f=fourArmyFixture(),off=play(f,true),on=play(f),again=play(f);assert.deepEqual(mapSnapshot(off),mapSnapshot(on));assert.deepEqual(on.state.scenes,again.state.scenes);assert.equal(selectedBattleOptions(null).massBattleMapOnly,false);
});
