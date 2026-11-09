import {largeMassFixture} from './mass-battle-v52-fixture.mjs';
import {studio37Fixture,studio37Controls} from './studio-v37-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {fourArmyFixture} from './studio-v41-fixture.mjs';
import {studio36Fixture,studio36Controls} from './studio-v36-fixture.mjs';
import {createRun,nextTurn,restoreRun} from '../src/engine/simulation.js';
import {runSaveData} from '../src/storage/run-store.js';
import {replayFingerprint,replayTurn} from '../src/engine/replay.js';
import {TurnPlayback} from '../src/ui/playback.js';
import {massBattleAt,massBattlePlan,massGlobalTime,MASS_BATTLE_TIMING} from '../src/ui/mass-battle-plan.js';
import {MASS_TACTICS} from '../src/ui/mass-battle-tactics.js';
import {massBattleSoundCues} from '../src/audio/mass-battle-cues.js';
import {renderMassBattle} from '../src/ui/mass-battle-view.js';
const options={armyPresentation:true,compactCampaigns:true,massBattlePresentation:true};
function loaded(f,speed=()=>1){const p=new TurnPlayback({options:()=>options,speed});p.load(f.record,f.start.world,f.run.world,false);return p;}
function plans(p){return [...new Set(p.state.scenes.map(s=>s.massPlan).filter(Boolean))];}
function sampleEnd(plan){return massBattleAt(plan,plan.duration);}
function invariant(plan){
 assert.equal(new Set(plan.units.map(u=>u.id)).size,plan.units.length);
 for(const e of plan.engagements){assert(plan.units.some(u=>u.id===e.attackId));if(!e.automatic)assert(plan.units.some(u=>u.id===e.defenseId));}
 for(const u of plan.units){for(let i=1;i<u.orders.length;i++){assert(u.orders[i].start>=u.orders[i-1].end-1e-6);assert.deepEqual(u.orders[i].from,u.orders[i-1].to);}}
 for(const u of sampleEnd(plan).units){const actual=plan.after.people.find(p=>p.id===u.id);assert.equal(u.troops,actual?.troops??0,u.id);assert.equal(u.alive,actual?.alive!==false,u.id);assert(u.troops>=0);}
 for(const t of [0,1700,plan.duration*.35,plan.duration*.7,plan.duration]){const state=massBattleAt(plan,t);assert.equal(state.units.length,plan.units.length);for(const u of state.units){assert(Number.isFinite(u.x)&&Number.isFinite(u.y));assert(u.troops>=0);assert(u.figures<=16);}}
}
test('real army record produces reusable tactics and preserves identities, all troops and final state without duplicating map duels',()=>{
 const f=fourArmyFixture(),snapshot=JSON.stringify(f.run),before=JSON.stringify(f.start.world),p=loaded(f),all=plans(p);assert(all.length);assert.equal(MASS_TACTICS.length,14);
 for(const plan of all){invariant(plan);assert(plan.baseDuration>=12000&&plan.baseDuration<=18000);const covered=new Set(plan.engagements.map(e=>e.index));assert(!p.state.scenes.some(s=>!s.massRecap&&s.battleIndex!==undefined&&covered.has(s.battleIndex)&&['roll','movement','apply'].includes(s.kind)));assert(plan.tactics.eligible.length>=4);assert(plan.tactics.selected.length>=2);}
 assert.equal(JSON.stringify(f.run),snapshot);assert.equal(JSON.stringify(f.start.world),before);
});
test('same record and visual seed reproduce trajectories; other visual seeds vary paths without varying facts',()=>{
 const f=fourArmyFixture(),p=loaded(f),plan=plans(p)[0],a=massBattlePlan(plan.group,f.record,{seed:12}),b=massBattlePlan(plan.group,f.record,{seed:12}),c=massBattlePlan(plan.group,f.record,{seed:91});
 assert.deepEqual(massBattleAt(a,5000),massBattleAt(b,5000));assert.deepEqual(a.tactics,b.tactics);assert.notDeepEqual(a.tactics,c.tactics);assert.deepEqual(sampleEnd(a).units.map(u=>[u.id,u.troops,u.alive]),sampleEnd(c).units.map(u=>[u.id,u.troops,u.alive]));
});
test('shared commanders keep causal battle order and other troops move or guard concurrently without fake losses',()=>{
 const plan=plans(loaded(fourArmyFixture()))[0];
 for(const id of plan.units.map(u=>u.id)){const fights=plan.engagements.filter(e=>e.attackId===id||e.defenseId===id);for(let i=1;i<fights.length;i++)assert(fights[i].start>=fights[i-1].end-1e-6);}
 for(const u of massBattleAt(plan,1500).units)if(!u.orders.find(o=>1500>=o.start&&1500<o.end))assert.equal(u.flip,u.side==='defense');
 const first=plan.engagements[0],state=massBattleAt(plan,massGlobalTime(plan,first.contact+10));assert(state.units.some(u=>['attack','guard'].includes(u.action)));assert(state.units.some(u=>['walk','guard'].includes(u.action)&&u.id!==first.attackId&&u.id!==first.defenseId));
 const late=plan.units.find(u=>u.firstBattle>first.index);assert(late);const s=state.units.find(u=>u.id===late.id);assert.equal(s.troops,late.startArmy);
});
test('casualty ticks obey original whole-person/ten-thousand precision and do not subtract the same loss twice',()=>{
 const f=fourArmyFixture(),plan=plans(loaded(f))[0];for(const e of plan.engagements){const b=f.record.battles[e.index];for(const side of ['attack','defense']){if(side==='defense'&&b.automatic)continue;const id=side==='attack'?e.attackId:e.defenseId,s=massBattleAt(plan,massGlobalTime(plan,e.resolve)).units.find(u=>u.id===id);assert.equal(s.troops,b.after[side]);}}
 for(let t=0;t<plan.duration;t+=137)for(const u of massBattleAt(plan,t).units)assert(Number.isInteger(u.troops));
});
test('death uses actual death records, including survivors reorganization, and zero troops alone never invent death',()=>{
 const f=fourArmyFixture({deathRaw:1}),p=loaded(f);assert(f.record.events.some(e=>e.type==='death'));
 for(const plan of plans(p)){invariant(plan);for(const hold of plan.holds.filter(h=>h.event.type==='death')){const state=massBattleAt(plan,hold.start+400);assert(state.units.some(u=>u.action==='death'));}}
 const plan=plans(loaded(fourArmyFixture()))[0];for(const u of massBattleAt(plan,plan.duration).units)if(!plan.holds.some(h=>h.event.type==='death'&&h.event.slot===plan.units.find(v=>v.id===u.id)?.person?.slot))assert(u.action!=='death'||u.alive===false);
});
test('genuine one-on-one and unopposed provinces retain simple presentation, with no phantom enemy',()=>{
 for(const config of [{duel:true},{empty:true}]){const start=studio36Fixture(config),run=nextTurn(start,studio36Controls()),p=loaded({start,run,record:run.history[0]});if(config.duel){assert(!plans(p).length);assert(p.state.scenes.some(s=>s.kind==='roll'&&s.event.type==='attack_roll'));}if(config.empty)assert(!p.state.scenes.some(s=>s.massPlan?.units.some(u=>u.side==='defense'&&u.startArmy>0)));}
});
test('pause, speed, critical holds, replay, details and handoff share the existing playback clock',()=>{
 const f=fourArmyFixture({deathRaw:1});let now=0,speed=4;const p=new TurnPlayback({options:()=>options,now:()=>now,speed:()=>speed,schedule:()=>1,cancel:()=>{}});p.load(f.record,f.start.world,f.run.world,false);const index=p.state.scenes.findIndex(s=>s.massPlan);p.state.index=index;p.remaining=p.duration();p.resume();now+=200;const t=p.sceneProgress;p.pause();assert.equal(p.sceneProgress,t);now+=500;assert.equal(p.sceneProgress,t);speed=8;p.resume();assert.equal(p.scheduledSpeed,8);
 p.pause();const critical=p.state.scenes.findIndex(s=>s.massCritical);assert(critical>=0);p.state.index=critical;p.remaining=p.duration();assert.equal(p.effectiveSpeed,1);assert.equal(p.duration(),1600);
 p.groupDone=true;p.groupEnd=critical;p.state.rangeDone=true;p.skipMassBattle();assert(!p.groupDone&&!p.state.rangeDone);assert.equal(p.scene.massPhase,'summary');assert.equal(p.duration(),1000);assert.equal(p.effectiveSpeed,1);const html=renderMassBattle({playback:p});assert(html.includes('상세 기록'));assert(!html.includes('계산된 결과'));assert(!html.includes('다이스 판정'));
 p.showCampaignDetails();assert(p.detailReturn);assert(p.state.scenes.some(s=>s.kind==='roll'));p.returnCampaignDetails();assert.equal(p.scene.massPhase,'summary');p.returnMassMap();assert(p.scene.massRecap||p.scene.massReturn);p.state.index=p.state.scenes.findIndex(s=>s.massReturn);assert.equal(p.displayWorld,p.state.scenes[index].massPlan.after);
});
test('mass sound cues use unique ledger keys and speed-scaled offsets with bounded overlap',()=>{
 const p=loaded(fourArmyFixture());for(const s of p.state.scenes.filter(s=>s.massPlan)){for(const speed of [1,4,16]){const cues=massBattleSoundCues(s,{speed});assert.equal(new Set(cues.map(c=>c.key)).size,cues.length);assert(cues.every(c=>c.at>=0));if(!s.massCritical&&s.massPhase!=='summary')assert(cues.length<(s.massEnd-s.massStart)/speed/100+3);}}
});
test('UI processing preserves next-turn RNG, saved histories and replay across several real initial seeds',async()=>{
 for(const seed of [1,17,81,777]){
  const fixture=fourArmyFixture(),start=createRun(fixture.start.initialWorld,seed),run=nextTurn(start,fixture.record.controls),before=JSON.stringify(run),rng=run.rng,fingerprint=replayFingerprint(run.history[0]);
  const p=loaded({start,run,record:run.history[0]});for(const plan of plans(p))invariant(plan);
  assert.equal(JSON.stringify(run),before);assert.equal(run.rng,rng);assert.equal(replayFingerprint(run.history[0]),fingerprint);
  const restored=restoreRun(runSaveData(run)),replay=await replayTurn(restored,1);assert.equal(replayFingerprint(replay.record),fingerprint);assert.deepEqual(nextTurn(restored,{rolls:{king:1,minister:1,domestic:1}}).engineState,nextTurn(run,{rolls:{king:1,minister:1,domestic:1}}).engineState);
 }
});

function variedFixture(kind){
 const f=fourArmyFixture(),w=structuredClone(f.start.initialWorld);Object.assign(w.rules,{defenderCounterattack:kind==='counter',warReadiness:false,captureThresholds:[10,20],counterCaptureThresholds:[10,20],royalDefense:kind==='royal',routDeath:false});
 const c=structuredClone(f.record.controls);for(const key of Object.keys(c.rolls)){if(key.startsWith('attack:'))c.rolls[key]=kind==='counter'?1:30;if(key.startsWith('defense:'))c.rolls[key]=kind==='counter'?30:1;}
 const start=createRun(w,777),run=nextTurn(start,c);return {start,run,record:run.history[0]};
}
test('real additional advance, defender counteroffensive and royal defense cover all fourteen eligibility rules',()=>{
 const covered=new Set();for(const kind of ['advance','counter','royal']){
  const f=variedFixture(kind);if(kind==='counter')assert(f.record.battles.some(b=>b.continuation==='counter'));if(kind==='advance')assert(f.record.battles.some(b=>b.continuation==='advance'));if(kind==='royal')assert(f.record.battles.some(b=>b.defenseRole==='king'));
  for(const plan of plans(loaded(f))){invariant(plan);plan.tactics.eligible.forEach(t=>covered.add(t.id));
   for(const u of massBattleAt(plan,plan.duration-1).units)assert.equal(u.troops,u.finalArmy,'no end-of-stage correction jump '+u.id);
   for(const b of f.record.battles){if(!plan.engagements.some(e=>e.index===b.index))continue;const attack=plan.units.find(u=>u.id===b.attackerPersonId);assert.equal(attack.countryId,b.actorId);}
  }
 }
 assert.deepEqual([...covered].sort(),MASS_TACTICS.map(t=>t.id).sort());
});
test('all tactic policies are selectable with separate visual seeds and do not add engagements',()=>{
 const selected=new Set();for(const kind of ['advance','counter']){const f=variedFixture(kind),initial=plans(loaded(f))[0];for(let seed=0;seed<128;seed++){const p=massBattlePlan(initial.group,f.record,{seed});p.tactics.selected.forEach(t=>selected.add(t.id));assert.equal(p.engagements.length,initial.engagements.length);}}
 assert.deepEqual([...selected].sort(),MASS_TACTICS.map(t=>t.id).sort());
});

test('eight initial seeds keep the same game over multiple turns with the new presentation enabled',t=>{
 let viewed=0,turns=0;const world=fourArmyFixture().start.initialWorld;
 for(const seed of [1,7,17,81,123,777,2048,918273]){
  let baseline=createRun(world,seed),run=createRun(world,seed);
  for(let i=0;i<12&&!run.result;i++){
   const before=run.world,c=i%3===0?{rolls:{king:10,war_target:1}}:{rolls:{king:1,minister:1,domestic:1}};
   baseline=nextTurn(baseline,c);run=nextTurn(run,c);const record=run.history.at(-1),snapshot=JSON.stringify(run.engineState);
   const p=loaded({start:{world:before},run,record});for(const plan of plans(p)){invariant(plan);massBattleAt(plan,plan.duration*.61);viewed++;}
   assert.equal(JSON.stringify(run.engineState),snapshot);assert.deepEqual(run.engineState,baseline.engineState);assert.deepEqual(run.world,baseline.world);assert.equal(replayFingerprint(record),replayFingerprint(baseline.history.at(-1)));turns++;
  }
 }
 assert(viewed>0&&turns>=64);t.diagnostic(`${turns} country turns, ${viewed} army stages across8seeds matched original RNG/world/results`);
});

test('one attacker against several defenders, and several attackers against one, keep every actual identity',()=>{
 for(const single of ['a','b']){
  const f=fourArmyFixture(),w=structuredClone(f.start.initialWorld);w.rules.warReadiness=false;w.rules.routDeath=false;w.rules.captureThresholds=[10,20];
  const keep=single+'0',owned=w.territories.filter(t=>t.ownerId===single).map(t=>t.id);w.people=w.people.filter(p=>p.countryId!==single||p.role!=='general'||p.id===keep);w.deployment.generals=w.deployment.generals.filter(e=>!e.personId.startsWith(single));w.deployment.generals.push({personId:keep,territoryIds:owned,stationId:owned[0],positionId:single==='a'?'tile-5':'tile-6'});
  const controls=structuredClone(f.record.controls);if(single==='a'){controls.targetCells={0:'tile-6'};for(const k of Object.keys(controls.rolls)){if(k.startsWith('attack:'))controls.rolls[k]=30;if(k.startsWith('defense:'))controls.rolls[k]=1;}}
  const start=createRun(w,777),run=nextTurn(start,controls),p=loaded({start,run,record:run.history[0]});assert(plans(p).length);
  for(const plan of plans(p)){invariant(plan);assert.equal(plan.units.filter(u=>u.countryId===single&&u.role==='general').length,1);assert(plan.units.filter(u=>u.countryId!==single&&u.role==='general').length>=2);}
 }
});

test('a real draw shows no false victor or capture, while another battle may continue',()=>{
 const f=fourArmyFixture(),b=f.record.battles[0],c=structuredClone(f.record.controls);c.rolls['attack:0']=15;c.rolls['defense:0']=15+b.attack.bonus-b.defense.bonus;
 const run=nextTurn(f.start,c),p=loaded({...f,run,record:run.history[0]});assert.equal(run.history[0].battles[0].winner,null);
 for(const plan of plans(p)){invariant(plan);const e=plan.engagements.find(e=>e.index===0);if(e){assert.equal(e.winner,null);const state=massBattleAt(plan,massGlobalTime(plan,e.resolve)+1);assert(state.units.some(u=>u.labels.some(l=>l.text==='무승부')));}}
});

test('two fronts against the same country remain two separate stages',()=>{
 const start=studio37Fixture({twoFronts:true}),run=nextTurn(start,studio37Controls({twoFronts:true})),all=plans(loaded({start,run,record:run.history[0]}));assert.equal(all.length,2);assert.notEqual(all[0].group.frontId,all[1].group.frontId);for(const p of all)invariant(p);
});
test('a real32commander campaign preserves every participant and all512 initial figures',()=>{
 const f=largeMassFixture(),p=loaded(f),all=plans(p);assert.equal(all.length,1);const plan=all[0];assert.equal(plan.units.length,32);assert.equal(plan.units.reduce((n,u)=>n+u.figures,0),512);invariant(plan);
 p.state.index=p.state.scenes.findIndex(s=>s.massPlan);p.remaining=p.duration();const html=renderMassBattle({playback:p});assert.equal((html.match(/data-mass-unit=/g)||[]).length,32);
});
