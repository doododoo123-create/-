import test from 'node:test';import assert from 'node:assert/strict';
import {enableOfficerTraits,OFFICER_STYLES,officerAbility,officerFatigue,officerTargetPreference} from '../src/model/officer-traits.js';
import {createContinentV31World} from '../src/scenarios/continent-v31.js';
import {createRun,nextTurn,restoreRun,definitionForVersion} from '../src/engine/simulation.js';
import {runSaveData} from '../src/storage/run-store.js';
import {serializeWorld,parseWorld} from '../src/storage/world-store.js';
import {replayTurn} from '../src/engine/replay.js';
import {simulate39,studio39Controls} from './studio-v39-fixture.mjs';
import {TurnPlayback} from '../src/ui/playback.js';import {renderCampaignOverlay} from '../src/ui/campaign-view.js';
import {fourArmyFixture} from './studio-v41-fixture.mjs';
test('every predefined general receives one of five stable editable profiles without changing armies or deployment',()=>{
 const before=createContinentV31World(),snapshot=JSON.stringify(before),w=enableOfficerTraits(before),again=enableOfficerTraits(w),generals=w.people.filter(p=>p.role==='general');
 assert.equal(JSON.stringify(before),snapshot);assert.deepEqual(w,again);assert.equal(new Set(generals.map(g=>g.combatStyle)).size,5);assert.deepEqual(w.countries,before.countries);assert.deepEqual(w.deployment,before.deployment);assert.deepEqual(w.rules.ministerWeights.producer,[2,6,2]);
 for(const g of generals){assert(Object.hasOwn(OFFICER_STYLES,g.combatStyle));assert(g.attackAbility>=-4&&g.attackAbility<=4);assert(g.defenseAbility>=-4&&g.defenseAbility<=4);assert(g.mobility>=1&&g.mobility<=5);}
 assert.deepEqual(parseWorld(serializeWorld(w)),w);const custom=structuredClone(w);custom.people.find(p=>p.role==='general').mobility=6;assert.throws(()=>parseWorld(serializeWorld(custom)));
});
test('role-specific abilities replace common ability, while mobility never creates a stationary penalty or positive fatigue bonus',()=>{
 const r={officerTraits:true},g={ability:4,attackAbility:3,defenseAbility:-1,mobility:5};assert.equal(officerAbility(g,'attack',r),3);assert.equal(officerAbility(g,'defense',r),-1);assert.equal(officerAbility({...g,role:'king'},'defense',r),4);
 for(let mobility=1;mobility<=5;mobility++){assert.equal(officerFatigue(0,{mobility},r),0);assert.equal(officerFatigue(-4,{mobility},r),-4+mobility-3);}assert.equal(officerFatigue(-2,g,r),0);assert.equal(officerFatigue(-4,g,{officerTraits:false}),-4);
});
test('style preferences distinguish guarded, weak, nearby and capital-adjacent targets',()=>{
 const base={defenders:[],distance:2,nearest:2,nearCapital:false},guarded={...base,defenders:[{troops:10}]};assert(officerTargetPreference('assault',guarded)>officerTargetPreference('assault',base));assert(officerTargetPreference('cautious',base)>officerTargetPreference('cautious',guarded));assert(officerTargetPreference('mobile',base)>officerTargetPreference('mobile',{...base,distance:5}));assert(officerTargetPreference('guardian',{...base,nearCapital:true})>officerTargetPreference('guardian',base));
});
test('actual combat uses both profiles, preserves valid totals and replays with identical future RNG',async()=>{
 const old=simulate39({cohort:true}),w=enableOfficerTraits(old.start.initialWorld),start=createRun(w,777),run=nextTurn(start,studio39Controls({cohort:true}));assert(run.history[0].battles.length);
 for(const b of run.history[0].battles.filter(b=>!b.automatic))for(const side of ['attack','defense']){const p=w.people.find(p=>p.id===b[side==='attack'?'attackerPersonId':'defenderPersonId']);assert.equal(b[side].ability,p[side==='attack'?'attackAbility':'defenseAbility']);assert.equal(b[side].score,b[side].raw+b[side].bonus);}
 const restored=restoreRun(runSaveData(run)),replay=await replayTurn(restored,1);assert.deepEqual(replay.record.battles,run.history[0].battles);assert.deepEqual(nextTurn(restored).engineState,nextTurn(run).engineState);
});
test('archived33 histories and subsequent rules keep their original common ability and minister policy',async()=>{
 const x=simulate39({cohort:true}),data={...runSaveData(x.run),engineVersion:'studio-v11-33'},initial=definitionForVersion(data.initialWorld,data.engineVersion);assert.equal(initial.rules.officerTraits,false);assert.deepEqual(initial.rules.ministerWeights.producer,[2,3,5]);const restored=restoreRun(data),replay=await replayTurn(restored,1);assert.deepEqual(replay.record.battles,x.record.battles);assert.deepEqual(nextTurn(restored).engineState,nextTurn(x.run).engineState);
});
test('completed dice show large local verdicts only after both scores and retain their exact markup on later rows',()=>{
 const {start,run,record}=simulate39({cohort:true}),p=new TurnPlayback({options:()=>({compactCampaigns:true,armyPresentation:true})});p.load(record,start.world,run.world,false);const ss=p.state.scenes;
 p.state.index=ss.findIndex(s=>s.campaignPhase==='dice');p.state.phase='rolling';assert(!renderCampaignOverlay({playback:p}).includes('data-score-verdict'));
 p.state.index=ss.findIndex(s=>s.campaignRow===1&&s.campaignPhase==='dice');p.state.phase='rolling';const first=renderCampaignOverlay({playback:p}),row=first.match(/<article[^>]*data-duel-index="0"[\s\S]*?<\/article>/)[0];assert.equal((row.match(/data-score-verdict=/g)||[]).length,2);
 p.state.phase='merging';p.state.mergeIndex=1;const after=renderCampaignOverlay({playback:p}).match(/<article[^>]*data-duel-index="0"[\s\S]*?<\/article>/)[0];assert.equal(after,row);
});
test('actual four-on-four uses four distinct commanders on each side at one battlefield',()=>{
 const {record}=fourArmyFixture();assert.equal(record.battles.length,7);assert.equal(new Set(record.battles.map(b=>b.attackerPersonId)).size,4);assert.equal(new Set(record.battles.map(b=>b.defenderPersonId)).size,4);assert.equal(new Set(record.battles.map(b=>b.territoryId)).size,1);
});
test('a fallen general successor receives a valid new-life profile and no inherited victories',()=>{
 let {run}=fourArmyFixture({deathRaw:1});const old=run.engineState.countries[0].generals[0];assert.equal(old.alive,false);
 for(let i=0;i<20&&run.engineState.countries[0].generals[0].generation===0&&!run.result;i++)run=nextTurn(run,{rolls:{king:1,minister:1,domestic:1}});
 const g=run.engineState.countries[0].generals[0];assert.equal(g.generation,1);assert(g.alive);assert.equal(g.wins,0);assert(Object.hasOwn(OFFICER_STYLES,g.combatStyle));assert(g.mobility>=1&&g.mobility<=5);assert.equal(restoreRun(runSaveData(run)).turn,run.turn);
});
