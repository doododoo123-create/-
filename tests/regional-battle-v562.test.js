import {massBattleSoundCues} from '../src/audio/mass-battle-cues.js';
import test from 'node:test';import assert from 'node:assert/strict';
import{fourArmyFixture}from'./studio-v41-fixture.mjs';import{largeMassFixture}from'./mass-battle-v52-fixture.mjs';
import{createRun,nextTurn}from'../src/engine/simulation.js';import{TurnPlayback}from'../src/ui/playback.js';import{massBattleAt,massGlobalTime}from'../src/ui/mass-battle-plan.js';import{regionalVisits}from'../src/ui/regional-battle-plan.js';
function setup(f){const p=new TurnPlayback({options:()=>({armyPresentation:true,massBattlePresentation:true})});p.load(f.record,f.start.world,f.run.world,false);return {f,p,plans:[...new Set(p.state.scenes.map(s=>s.massPlan).filter(Boolean))]};}
function exact(){const f=fourArmyFixture(),w=structuredClone(f.start.initialWorld),original=w.people.find(p=>p.id==='b0');w.people=w.people.filter(p=>!(p.countryId==='b'&&p.role==='general'));w.deployment.generals=w.deployment.generals.filter(p=>!p.personId.startsWith('b'));for(const[i,ids]of [[6],[7],[8,9],[10,11],[12,13],[14]].entries()){w.people.push({...original,id:'b'+i,name:'b'+i,slot:i});w.deployment.generals.push({personId:'b'+i,territoryIds:ids.map(i=>'tile-'+i),stationId:'tile-'+ids[0],positionId:i===5?'tile-8':'tile-6'});}Object.assign(w.rules,{reliefRadius:1,captureThresholds:[10,20],routDeath:false});const start=createRun(w,777),run=nextTurn(start,f.record.controls);return{start,run,record:run.history[0]};}
test('4v5 shares one regional fight, then1v1 and automatic entry; source/engine/RNG remain unchanged',()=>{
 const f=exact(),before=JSON.stringify(f),{plans}=setup(f),p=plans[0];assert(p.regional);assert.equal(p.tactics.selected.length,0);assert.deepEqual(p.regions.map(r=>[r.battles.length,r.attackIds.length,r.defenseIds.length,r.automatic]),[[8,4,5,false],[1,1,1,false],[1,1,0,true]]);assert.equal(JSON.stringify(f),before);
 assert.deepEqual(p.regions.map(r=>r.territoryId),['tile-6','tile-7','tile-8']);assert.equal(new Set(p.units.map(u=>u.id)).size,p.units.length);
 const b=massBattleAt(p,massGlobalTime(p,p.regions[1].start));assert.equal(b.units.find(u=>u.id==='a3').troops,15);assert(b.units.find(u=>u.id==='a0').alive);assert.equal(b.owners.get('tile-6'),'a');assert.equal(b.owners.get('tile-7'),'b');assert.equal(b.owners.get('tile-8'),'b');
});
test('recorded intermediate troops/status are exact at each event cursor and final world matches',()=>{
 for(const f of [exact(),fourArmyFixture({deathRaw:1}),largeMassFixture()])for(const p of setup(f).plans){
  for(const e of p.group.originalScenes.map(s=>s.event).filter(e=>e&&p.eventTimes.has(e.index))){const at=p.eventTimes.get(e.index),state=massBattleAt(p,massGlobalTime(p,at)),frame=f.record.frames[e.index];if(!frame)continue;for(const u of state.units){const expected=frame.after.people.find(v=>v.id===u.id);if(expected){assert.equal(u.troops,expected.troops,`${e.type}:${u.id}`);assert.equal(u.alive,expected.alive!==false,`${e.type}:${u.id}`);}}}
  const end=massBattleAt(p,p.duration);for(const u of end.units){const expected=p.after.people.find(v=>v.id===u.id);assert.equal(u.troops,expected?.troops??0);assert.equal(u.alive,expected?.alive!==false);}for(const t of p.after.territories)if(end.owners.has(t.id))assert.equal(end.owners.get(t.id),t.ownerId);
 }
});
test('revisit/counter/front changes split regions and automatic extra cells stay ordered',()=>{
 const b=(index,extra={})=>({index,frontId:'F',territoryId:'A',actorId:'r',defenderId:'b',...extra});
 assert.equal(regionalVisits([b(0),b(1,{assaultId:2})]).length,1);assert.equal(regionalVisits([b(0),b(1,{territoryId:'B'}),b(2)]).length,3);assert.equal(regionalVisits([b(0),b(1,{actorId:'b',defenderId:'r'})]).length,2);assert.equal(regionalVisits([b(0),b(1,{frontId:'G'})]).length,2);
 assert.deepEqual(regionalVisits([b(0,{automatic:true,takenTerritoryIds:['A','B','C']})]).map(r=>r.territoryId),['A','B','C']);
});
test('large regional defense can return later without clones, invented death or repeated map recap',()=>{
 const {p,plans}=setup(largeMassFixture());assert(plans.some(plan=>plan.regions.some(r=>r.defenseIds.length>=12)));assert(!p.state.scenes.some(s=>s.massRecap));assert(p.state.scenes.some(s=>s.massReturn));
 for(const plan of plans){for(const r of plan.regions){const at=r.contact+10,state=massBattleAt(plan,massGlobalTime(plan,at));for(const u of state.units)if(!r.attackIds.includes(u.id)&&!r.defenseIds.includes(u.id))assert.notEqual(u.action,'attack');}const state=massBattleAt(plan,plan.duration);assert(state.complete);}
});
test('pause sampling is deterministic; regional scenes and critical holds use existing playback speed',()=>{
 const {p,plans}=setup(fourArmyFixture({deathRaw:1})),plan=plans[0];assert.deepEqual(massBattleAt(plan,1234),massBattleAt(plan,1234));assert(plan.holds.every((h,i,a)=>!i||h.start>=a[i-1].end));
 p.state.index=p.state.scenes.findIndex(s=>s.massCritical);assert.equal(p.effectiveSpeed,1);assert.equal(p.duration(),1600);p.state.index=p.state.scenes.findIndex(s=>s.massPhase==='summary');assert.equal(p.duration(),1000);
});

test('automatic regional entry has marching sound and no battle loop or first clash',()=>{const {p,plans}=setup(exact()),plan=plans[0],r=plan.regions.find(r=>r.automatic),scene=p.state.scenes.find(s=>s.massPlan===plan&&s.regionalScene?.automatic&&!s.massCritical);assert(r&&scene);const cues=massBattleSoundCues(scene,{speed:4});assert(cues.some(c=>c.id==='bp_foley_army_march_loop'));assert(!cues.some(c=>c.id==='bp_amb_battle_distant_loop'||c.id==='bp_sfx_first_clash'));});
