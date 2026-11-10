import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tacticalStressFixture,tacticalFixture,tacticalPlans} from './tactical-v57-fixture.mjs';
import {massBattlePlan,massBattleAt,massGlobalTime} from '../src/ui/mass-battle-plan.js';
import {tacticalScale} from '../src/ui/tactical-scale.js';
const options=[{countA:1,totalA:1,countB:1,totalB:1},{countA:5,totalA:5,countB:3,totalB:30},{countA:15,totalA:60,countB:1,totalB:1}],plans=options.map(o=>{const f=tacticalStressFixture(o);return massBattlePlan(f.group,f.record);});
const state=(p,t)=>massBattleAt(p,massGlobalTime(p,t));
test('absolute8figures per10k, shared downscale only, never a per-commander minimum',()=>{
 for(const [a,b,expected]of [[1,1,[8,8]],[5,30,[40,240]],[1,60,[8,480]],[60,60,[480,480]],[120,60,[480,240]]]){const s=tacticalScale([{id:'a',side:'attack',startArmy:a},{id:'b',side:'defense',startArmy:b}]);assert.deepEqual([s.allocations.a,s.allocations.b],expected);assert(s.scale<=8);}
 assert.deepEqual(plans.map(p=>p.units.reduce((n,u)=>n+u.figures,0)),[16,280,488]);
});
test('three required armies share one fixed field, role plan, and simultaneous front instead of separate duel scenes',()=>{
 for(const p of plans){assert.equal(p.height,760);assert(p.story.commonArmyPlan);assert(p.story.beats.every(b=>b.start===0));assert(p.story.groups.every(g=>g.footprint&&g.bodyScale<=1));assert(p.story.phases.every(phase=>phase.ids.length===p.units.length));}
 for(const p of plans.slice(1)){let simultaneous=0;for(let t=0;t<p.baseDuration;t+=120)simultaneous=Math.max(simultaneous,new Set(state(p,t).contacts.map(c=>c.edgeKey)).size);assert(simultaneous>=2,`only${simultaneous} fronts`);}
});
test('all occupied troop footprints stay separate during waiting, approach, combat and retreat, including between route ticks',()=>{
 for(const p of plans)for(let t=0;t<p.baseDuration;t+=83){const groups=state(p,t).groups.filter(g=>g.visible&&g.figures>0);for(let i=0;i<groups.length;i++)for(let j=0;j<i;j++){const a=groups[i],b=groups[j],dx=Math.abs(a.x-b.x),dy=Math.abs(a.y-b.y),wx=(a.footprint.width+b.footprint.width)/2,hy=(a.footprint.height+b.footprint.height)/2;assert(dx>=wx-.1||dy>=hy-.1,`${p.units.length}units at${t}: ${a.id}/${b.id}, ${dx}/${dy}, footprint${wx}/${hy}`);}for(const g of groups)assert(g.x>=g.footprint.width/2&&g.x<=p.width-g.footprint.width/2&&g.y>=g.footprint.height/2&&g.y<=p.height-g.footprint.height/2);}
});
test('contact includes coordinated positional pressure and rotations, and ends without artificial duration padding',()=>{
 for(const p of plans){let movingContact=0,lastMove=0;for(const g of p.story.groups)for(const m of g.motions)if(m.from.x!==m.to.x||m.from.y!==m.to.y){lastMove=Math.max(lastMove,m.end);if(p.story.contacts.some(c=>[c.attackGroupId,c.defenseGroupId].includes(g.id)&&c.start<=m.start&&c.end>=m.end))movingContact++;}assert(movingContact>0);const lastResult=Math.max(...p.story.reveals.map(r=>r.end||r.at));assert(p.baseDuration-Math.max(lastMove,lastResult)<=3200);assert(p.baseDuration<100000);}
});
test('actual per-battle losses and final armies remain exact; result notices belong to their own territory',()=>{
 for(const kind of ['normal','death','advance','counter','royal']){const f=tacticalFixture(kind),snapshot=JSON.stringify(f.record);for(const p of tacticalPlans(f)){for(const b of p.story.beats)for(const loss of b.losses){const rows=p.story.reveals.filter(r=>r.kind==='combat'&&r.beatIndex===b.index&&r.id===loss.id);assert.equal(Math.abs(rows.reduce((n,r)=>n+r.delta,0)),loss.quanta);}for(const u of massBattleAt(p,p.duration).units)assert.equal(u.troops,p.after.people.find(q=>q.id===u.id).troops);for(const r of p.story.reveals.filter(r=>r.kind==='result')){const s=state(p,r.at+1);if(s.result)assert.equal(s.currentBeat.territoryId,s.result.territoryId);assert(r.winner===null||r.text.includes('승리')||r.text.includes('진입'));}}assert.equal(JSON.stringify(f.record),snapshot);}
});
test('outside tactical screen, atlas/army/entry restore the exact61(v56) source',()=>{
 const baseline=JSON.parse(readFileSync('tests/tactical-v58-baseline.json'));for(const [file,sha]of Object.entries(baseline.files))assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),sha,file);
});
