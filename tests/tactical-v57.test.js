import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tacticalFixture,tacticalPlans,tacticalPlayback} from './tactical-v57-fixture.mjs';
import {massBattlePlan,massBattleAt,massGlobalTime} from '../src/ui/mass-battle-plan.js';
import {tacticalScale} from '../src/ui/tactical-scale.js';
import {tacticalPosition} from '../src/ui/tactical-sample.js';
import {tacticalRecord} from '../src/ui/tactical-record.js';
import {analyzeMassBattle} from '../src/ui/mass-battle-analysis.js';
import {massBattleSoundCues} from '../src/audio/mass-battle-cues.js';
import {MASS_TACTICS} from '../src/ui/mass-battle-tactics.js';
import {visibleArmyGroups} from '../src/ui/army-presentation.js';
const fixtures=new Map(),fixture=kind=>{if(!fixtures.has(kind))fixtures.set(kind,tacticalFixture(kind));return fixtures.get(kind);};
function freezeTree(x){if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.freeze(x);for(const key of Reflect.ownKeys(x))freezeTree(x[key]);}return x;}
const sample=(p,t)=>massBattleAt(p,massGlobalTime(p,t));
test('one common figure scale preserves extreme troop ratios independently of commander count',()=>{
 for(const [a,b,expected]of [[5,30,[80,480]],[60,1,[480,8]],[1,60,[8,480]],[60,60,[480,480]]]){const scale=tacticalScale([{id:'a',side:'attack',startArmy:a},{id:'b',side:'defense',startArmy:b}]);assert.deepEqual([scale.allocations.a,scale.allocations.b],expected);}
 for(const count of [1,3,15]){const u=[...Array.from({length:count},(_,i)=>({id:'a'+i,side:'attack',startArmy:30/count})),{id:'b',side:'defense',startArmy:30}],s=tacticalScale(u);assert.equal(Object.entries(s.allocations).filter(([id])=>id!=='b').reduce((n,[,v])=>n+v,0),480);for(const p of u)assert(Math.abs(s.groups.filter(g=>g.parentId===p.id).reduce((n,g)=>n+g.weight,0)-1)<1e-8);}
});
test('frozen real records retain exact per-battle quantum losses and causal shared-commander order',()=>{
 for(const kind of ['normal','advance','counter','royal','death']){const f=fixture(kind),snapshot=JSON.stringify(f.record);freezeTree(f.record);for(const initial of tacticalPlans(f)){const p=massBattlePlan(initial.group,f.record);assert(p.baseDuration>=15000);assert.equal(p.story.beats.length,initial.engagements.length);for(const b of p.story.beats){for(const loss of b.losses)assert.equal(Math.abs(p.story.reveals.filter(r=>r.kind==='combat'&&r.beatIndex===b.index&&r.id===loss.id).reduce((n,r)=>n+r.delta,0)),loss.quanta);const earlier=p.story.beats.filter(v=>v.index<b.index&&[v.attackId,v.defenseId].some(id=>id&&[b.attackId,b.defenseId].includes(id)));if(earlier.length)assert(b.start>=earlier.at(-1).end);}
  const end=massBattleAt(p,p.duration);for(const u of end.units){const actual=p.after.people.find(v=>v.id===u.id);assert.equal(u.troops,actual.troops);assert.equal(u.alive,actual.alive!==false);}
  for(const r of p.story.reveals.filter(r=>r.kind==='combat')){const state=sample(p,r.at),c=state.contacts.find(c=>c.id===r.contactId);assert(c,'loss must have its actual opponent contact');assert([c.attackId,c.defenseId].includes(r.id));const a=state.groups.find(g=>g.id===c.attackGroupId),d=state.groups.find(g=>g.id===c.defenseGroupId);assert(Math.hypot(a.x-d.x,a.y-d.y)<150);const phase=(r.at-c.start)%770;assert(Math.min(Math.abs(phase-340),Math.abs(phase-725))<1e-6,'loss on sprite impact');}
  for(let t=0;t<p.baseDuration;t+=211){const s=sample(p,t);for(const u of s.units){assert(Number.isFinite(u.x)&&Number.isFinite(u.y)&&u.troops>=0);if(!u.alive)assert.equal(u.action,'death');}for(const g of s.groups)if(['attack','guard'].includes(g.action)&&g.contactId)assert(s.contacts.some(c=>c.id===g.contactId));}
 }assert.equal(JSON.stringify(f.record),snapshot);}
});
test('all14 policies run through production builder; invalid choices record a fallback',()=>{
 const covered=new Set(),fingerprints=new Map();for(const kind of ['normal','advance','counter','royal']){const f=fixture(kind);for(const p of tacticalPlans(f))for(const t of MASS_TACTICS){const forced=massBattlePlan(p.group,f.record,{forceTactic:t.id});for(const b of forced.story.beats.filter(b=>b.tactic.id===t.id)){covered.add(t.id);assert(b.tactic.eligible.includes(t.id));const g=forced.story.groups.find(g=>g.parentId===b.attackId);fingerprints.set(t.id,JSON.stringify(g.motions.filter(m=>m.beatIndex===b.index).map(m=>[m.kind,m.formation,m.to])));}}}assert.equal(covered.size,14);assert(new Set(fingerprints.values()).size>=12);
 const f=fixture('normal'),p=tacticalPlans(f)[0],bad=massBattlePlan(p.group,f.record,{forceTactic:'breach'});assert(bad.story.beats[0].tactic.fallback==='breach');
});
test('arbitrary-time, pause/seek/replay and visual seeds do not mutate input or final truth',()=>{
 const f=fixture('normal'),p=tacticalPlans(f)[0],snapshot=JSON.stringify(f.run);for(const t of [p.duration,0,5000,1700,p.duration*.7,5000]){assert.deepEqual(massBattleAt(p,t),massBattleAt(massBattlePlan(p.group,f.record),t));}for(const speed of [1,4,8]){const at=p.story.beats[2].resolve;assert.deepEqual(massBattleAt(p,massGlobalTime(p,at)),sample(p,at));assert.deepEqual(massBattleAt(p,p.duration).totals,massBattleAt(massBattlePlan(p.group,f.record,{seed:speed}),p.duration+100000).totals);}assert.equal(JSON.stringify(f.run),snapshot);
});
test('no fake final correction, death is explicit and dead formations stop moving/attacking',()=>{
 const f=fixture('death');for(const p of tacticalPlans(f))for(const u of p.units){assert.equal(u.troops.at(-1).value,u.finalArmy);if(u.deathAt!==undefined){const before=sample(p,u.deathAt+1),after=sample(p,p.baseDuration-1);for(const g of before.groups.filter(g=>g.parentId===u.id)){const end=after.groups.find(v=>v.id===g.id);assert.equal(end.action,'death');assert.equal(end.x,g.x);assert.equal(end.y,g.y);}}}
});
test('grouped map entry retains both armies and recap snapshots are not rewritten',()=>{
 const f=fixture('normal'),p=tacticalPlayback(f),scenes=p.state.scenes,entry=scenes.findIndex(s=>s.entryLocation);assert(entry>=0&&entry<scenes.findIndex(s=>s.massPlan));p.state.index=entry;assert.equal(visibleArmyGroups(p.displayWorld,p.state).length,2);assert.deepEqual(scenes[entry].readySides,['attack','defense']);const original=tacticalPlans(f)[0].group.originalScenes;assert(original.every(s=>!s.entryArmyGroups));for(const s of scenes.filter(s=>s.massRecap))assert(!s.entryArmyGroups);
});
test('protected core, storage, map recap/camera and global sound/playback are byte-identical',()=>{
 const baseline=JSON.parse(readFileSync('tests/tactical-v57-baseline.json'));for(const [file,sha]of Object.entries(baseline.protected))assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),sha,file);
});
test('missing identities, final snapshots and invalid troop data fail instead of inventing death',()=>{
 const f=fixture('normal'),p=tacticalPlans(f)[0];for(const edit of [a=>a.after.people.splice(a.after.people.findIndex(p=>p.id===a.units[0].id),1),a=>a.units[0].startArmy=NaN,a=>delete a.record.frames[a.events[0].index]]){const a=structuredClone(analyzeMassBattle(p.group,f.record));a.record.frames=structuredClone(f.record.frames);edit(a);assert.throws(()=>tacticalRecord(a),/전술 기록/);}
});

test('existing160-map and4v4 non-tactical scene snapshots exactly match v0.56.0',async()=>{
 const {gunzipSync}=await import('node:zlib'),{prepareFileImport}=await import('../src/storage/history-file.js'),{replayTurn}=await import('../src/engine/replay.js'),{TurnPlayback}=await import('../src/ui/playback.js'),baseline=JSON.parse(readFileSync('tests/tactical-v57-baseline.json'));
 for(const kind of ['v56-campaign','v56-army']){const {run}=await prepareFileImport(JSON.parse(gunzipSync(readFileSync('tests/fixtures/v57/'+kind+'.history.json.gz')))),r=await replayTurn(run,run.turn),p=new TurnPlayback({options:()=>({armyPresentation:true,massBattlePresentation:true})});p.load(r.record,r.before,r.after,false);const snap=p.state.scenes.filter(s=>!s.massPlan&&!s.battleEntry).map(s=>({id:s.id,hash:createHash('sha256').update(JSON.stringify(Object.fromEntries(['id','kind','worldBefore','worldAfter','camps','campsBefore','mapEventIndex','mapReveal','mapAfterReveal','moves','battleIndex','event','captureSteps'].filter(k=>s[k]!==undefined).map(k=>[k,s[k]])))).digest('hex')}));assert.deepEqual(snap,baseline.scenes[kind],kind);}
});
test('ownership round-trip reveals both actual transitions, keeps net zero, and does not leak future owners',async()=>{
 const {tacticalRoundtripFixture}=await import('./tactical-v57-fixture.mjs'),f=tacticalRoundtripFixture(),p=massBattlePlan(f.group,f.record),events=p.story.reveals.filter(r=>r.kind==='territory');assert.equal(events.length,2);assert.equal(p.gained,0);assert.equal(p.lost,0);assert.equal(p.story.process.recaptures,1);for(const r of events){assert.equal(sample(p,r.at-1).owners.get(r.id),r.from);assert.equal(sample(p,r.at+1).owners.get(r.id),r.to);}assert(events[1].at>events[0].at+2000);
});

test('spec E01-E08/E11/E12: extreme view fixtures run real planner, exact losses and contact-slot limits',async()=>{
 const {tacticalStressFixture}=await import('./tactical-v57-fixture.mjs');
 for(const options of [{countA:5,totalA:5,countB:3,totalB:30},{countA:15,totalA:60,countB:1,totalB:1,winner:'a'},{countA:15,totalA:60,countB:1,totalB:1,winner:'b'},{countA:1,totalA:60,countB:15,totalB:15},{countA:1,totalA:30,countB:10,totalB:30},{countA:3,totalA:30,countB:15,totalB:30},{countA:1,totalA:1,countB:1,totalB:1},{countA:1,totalA:1,countB:1,totalB:1,lossQuanta:1},{countA:1,totalA:1,countB:1,totalB:1,quantum:.0001,lossQuanta:1}]){
  const f=tacticalStressFixture(options),p=massBattlePlan(f.group,f.record),final=massBattleAt(p,p.duration);assert(p.story.groups.length>=p.units.length);for(const u of final.units){assert.equal(u.troops,f.after.people.find(x=>x.id===u.id).troops);assert.equal(u.alive,true);}for(const b of p.story.beats){const contacts=p.story.contacts.filter(c=>c.beatIndex===b.index),counts=new Map();for(const c of contacts)for(const id of [c.attackGroupId,c.defenseGroupId])counts.set(id,(counts.get(id)||0)+1);assert([...counts.values()].every(n=>n<=3));}for(const r of p.story.reveals.filter(r=>r.kind==='combat')){assert(sample(p,r.at).contacts.some(c=>c.id===r.contactId));assert(Number.isInteger(r.delta));}
 }
 const empty=tacticalStressFixture({countA:2,totalA:2,countB:1,totalB:1});for(const b of empty.record.battles){b.automatic=true;b.defenseSlot=-1;}const unopposed=massBattlePlan(empty.group,empty.record),cues=massBattleSoundCues({massPlan:unopposed,id:'empty',massStart:0,massEnd:unopposed.duration});assert.equal(unopposed.story.contacts.length,0);assert(!cues.some(c=>c.id==='bp_sfx_first_clash'||c.id==='bp_amb_battle_distant_loop'));
});
