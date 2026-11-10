import test from 'node:test';
import assert from 'node:assert/strict';
import {tacticalFixture,tacticalPlans,tacticalStressFixture} from './tactical-v57-fixture.mjs';
import {massBattlePlan,massBattleAt,massGlobalTime} from '../src/ui/mass-battle-plan.js';
import {tacticalCombatClock,prepareTacticalMotion,tacticalPoint} from '../src/ui/tactical-motion.js';
import {assignTacticalRoles} from '../src/ui/tactical-roles.js';
import {troopFrame} from '../src/ui/troop-animation.js';
import {renderMassBattle} from '../src/ui/mass-battle-view.js';
const real=tacticalFixture(),plan=tacticalPlans(real)[0],at=(p,t)=>massBattleAt(p,massGlobalTime(p,t));
test('walking crosses cell boundaries on one900ms clock; both combat actions expose all10 original frames',()=>{
 const g={id:'g',home:{x:0,y:0},footprint:{width:2,height:2},motions:Array.from({length:5},(_,i)=>({start:i*240,end:(i+1)*240,from:{x:i*10,y:0},to:{x:(i+1)*10,y:0},kind:'walk'}))};prepareTacticalMotion([g],[]);
 assert(g.motions.every(m=>m.animationAt===0));assert.equal(tacticalPoint(g,850).motion.animationAt,0);assert.equal(troopFrame('walk',850,{repeat:true}).frame,9);
 for(const offset of [0,770]){const frames={attack:new Set(),guard:new Set()};for(let t=0;t<1600;t++){const c=tacticalCombatClock({combatAt:0,combatOffset:offset},t);frames[c.action].add(troopFrame(c.action,c.time,{repeat:true}).frame);}assert.equal(frames.attack.size,10);assert.equal(frames.guard.size,10);}
});
test('role assignment uses authored commander traits and preserves the input people and actual armies',()=>{
 const people=[{id:'a',combatStyle:'mobile'},{id:'b',combatStyle:'guardian'},{id:'c',combatStyle:'cautious'}],p={before:{people},units:people.map((p,i)=>({id:p.id,side:'attack',startArmy:10+i,battleIds:[0]}))},groups=people.map(p=>({id:p.id+'s',parentId:p.id})),before=JSON.stringify(people);assignTacticalRoles(p,groups);assert.deepEqual(p.units.map(u=>u.tacticalRole),['flank','guard','reserve']);assert.deepEqual(groups.map(g=>g.unitNumber),[1,2,3]);assert.equal(JSON.stringify(people),before);assert.deepEqual(p.units.map(u=>u.startArmy),[10,11,12]);
});
test('each command change has a recorded trigger, readable explanation and different attack/defense orders',()=>{
 assert(plan.story.eventDriven);assert.equal(plan.story.phases[0].trigger,'approach');
 for(const phase of plan.story.phases){assert(phase.end>phase.at);assert(['approach','contact','result','capture','reserve','consolidate'].includes(phase.trigger));assert(phase.name&&phase.reason&&phase.stage);assert.notEqual(phase.commands.attack.text,phase.commands.defense.text);assert.notEqual(phase.commands.attack.id,phase.commands.defense.id);if(['result','capture','consolidate'].includes(phase.trigger))assert(plan.story.beats.some(b=>b.resolve<phase.at));if(phase.trigger==='contact')assert(plan.story.contacts.some(c=>c.start<phase.at));}
 const html=renderMassBattle({playback:{scene:{massPlan:plan},playing:false},inline:true});for(const marker of ['data-current-tactic','data-tactic-reason','data-tactic-change','data-command-label','공격군 명령','수비군 명령','mass-unit-number'])assert(html.includes(marker));
});
test('all original losses occur on the real striker impact and produce a matching hurt response, never extra casualties',()=>{
 for(const kind of ['normal','advance','counter','royal','death'])for(const p of tacticalPlans(tacticalFixture(kind))){for(const r of p.story.reveals.filter(r=>r.kind==='combat')){const s=at(p,r.at),g=s.groups.find(g=>g.id===r.strikerGroupId),c=tacticalCombatClock(g,r.at);assert.equal(c.action,'attack');assert.equal(c.time,340);assert(s.contacts.some(c=>c.id===r.contactId));const hurt=at(p,r.at+50).groups.filter(g=>g.parentId===r.id&&g.alive&&g.figures);assert(hurt.every(g=>g.action==='hurt'));}for(const u of at(p,p.baseDuration).units)assert.equal(u.troops,p.after.people.find(q=>q.id===u.id).troops);}
});
test('labels attach to a real numbered block rather than the average point between separated blocks',()=>{
 for(let t=0;t<plan.baseDuration;t+=177){const s=at(plan,t);for(const u of s.units){const g=s.groups.find(g=>g.id===u.labelGroupId);assert(g);assert.equal(u.labelX,g.x);assert.equal(u.labelY,g.y);assert(s.groups.filter(g=>g.parentId===u.id).every(g=>g.unitNumber===u.unitNumber));}}
});
test('compact field keeps all body footprints separate through curved approaches, pressure and joint withdrawal',()=>{
 for(let t=0;t<plan.baseDuration;t+=47){const gs=at(plan,t).groups.filter(g=>g.visible&&g.figures>0);for(let i=0;i<gs.length;i++)for(let j=0;j<i;j++){const a=gs[i],b=gs[j];assert(Math.abs(a.x-b.x)>=(a.footprint.width+b.footprint.width)/2-.1||Math.abs(a.y-b.y)>=(a.footprint.height+b.footprint.height)/2-.1,`${t}:${a.id}/${b.id}`);}}
 assert(plan.story.groups.some(g=>g.motions.some(m=>m.control)),'safe approach corners should actually be rounded');
});
test('small battles keep simple policies; final victorious blocks keep their positions while defeated blocks withdraw',()=>{
 const f=tacticalStressFixture({countA:1,totalA:1,countB:2,totalB:2}),p=massBattlePlan(f.group,f.record);assert(p.story.small);assert(p.story.phases.every(phase=>!['pincer','hook','waves','reserves','oblique'].includes(phase.id)));
 const last=Math.max(...plan.story.beats.map(b=>b.resolve)),end=at(plan,plan.baseDuration),start=at(plan,last+240);for(const u of plan.units){const b=plan.story.beats.findLast(b=>[b.attackId,b.defenseId].includes(u.id));if(b?.winner===u.id)for(const g of end.groups.filter(g=>g.parentId===u.id&&g.alive)){const before=start.groups.find(a=>a.id===g.id);assert.equal(g.x,before.x);assert.equal(g.y,before.y);}}
});
