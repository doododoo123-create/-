import test from 'node:test';import assert from 'node:assert/strict';
import {fourArmyFixture}from'./studio-v41-fixture.mjs';import{largeMassFixture}from'./mass-battle-v52-fixture.mjs';import{TurnPlayback}from'../src/ui/playback.js';import{massBattleAt}from'../src/ui/mass-battle-plan.js';import{regionalFieldView}from'../src/ui/regional-field-view.js';
function setup(f=fourArmyFixture()){const p=new TurnPlayback({options:()=>({armyPresentation:true,massBattlePresentation:true})});p.load(f.record,f.start.world,f.run.world,false);return {f,p,plans:[...new Set(p.state.scenes.map(s=>s.massPlan).filter(Boolean))]};}
test('all places keep actual map direction and fixed markers; troops stand nearby',()=>{
 const {f,plans}=setup(),plan=plans[0],field=plan.field,before=JSON.stringify(field.nodes);assert.equal(field.nodes.length,plan.territories.length);assert(field.nodes.length>=3);
 assert.equal(field.polygons.length,plan.before.territories.length);
 for(const a of field.nodes)for(const b of field.nodes){assert.equal(Math.sign(a.cx-b.cx),Math.sign(a.gx-b.gx));assert.equal(Math.sign(a.cy-b.cy),Math.sign(a.gy-b.gy));}
 for(const u of plan.units){assert.equal(u.fieldStart,plan.before.people.find(p=>p.id===u.id)?.positionId);assert(field.byId.has(u.fieldStart));assert(u.home.x>=0&&u.home.x<=field.width&&u.home.y>=0&&u.home.y<=field.height);}
 massBattleAt(plan,plan.duration);assert.equal(JSON.stringify(field.nodes),before);assert.equal(JSON.stringify(f.record),JSON.stringify(f.run.history[0]));
});
test('one body follows continuous inter-region tracks, or explicit endpoint fading; no mid-air relocation',()=>{
 for(const {plans}of [setup(),setup(fourArmyFixture({deathRaw:1})),setup(largeMassFixture())])for(const plan of plans){let crossings=0;for(const u of plan.units){let previous=u.home,end=0;assert(u.home.x>=0&&u.home.x<=plan.width&&u.home.y>=0&&u.home.y<=plan.height);for(const o of u.orders){assert(o.start>=end-1e-6);assert.deepEqual(o.from,previous);assert(Number.isFinite(o.to.x)&&Number.isFinite(o.to.y));if(o.fromRegion!==o.toRegion&&o.fromRegion){crossings++;assert(o.teleport||o.path?.length>=2);if(o.teleport){const state=massBattleAt(plan,(o.start+o.end)/2);assert(state.units.find(v=>v.id===u.id));}}previous=o.to;end=o.end;}assert.equal(new Set(plan.units.map(u=>u.id)).size,plan.units.length);}assert(crossings);}
});
test('internal zoom is scoped to the presentation plan and resettable; final game facts remain authoritative',()=>{
 const {plans}=setup(),p=plans[0],before=JSON.stringify(p.after),v=regionalFieldView(p);assert.equal(v.zoom,1);v.zoom=3;v.x=40;assert.equal(regionalFieldView(p).zoom,3);assert.equal(JSON.stringify(p.after),before);const state=massBattleAt(p,p.duration);for(const u of state.units){const expected=p.after.people.find(v=>v.id===u.id);assert.equal(u.troops,expected?.troops??0);assert.equal(u.alive,expected?.alive!==false);assert.equal(u.territoryId,expected?.positionId);}
});
