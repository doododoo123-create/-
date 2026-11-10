import {studio36Fixture,studio36Controls} from './studio-v36-fixture.mjs';
import {nextTurn} from '../src/engine/simulation.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fourArmyFixture} from './studio-v41-fixture.mjs';
import {largeMassFixture} from './mass-battle-v52-fixture.mjs';
import {TurnPlayback} from '../src/ui/playback.js';
import {massBattleAt,massGlobalTime,massBattlePlan} from '../src/ui/mass-battle-plan.js';
import {massPersonalStreaks} from '../src/ui/mass-battle-choreography.js';
import {massPanelPlacement} from '../src/ui/mass-battle-placement.js';
import {renderMassBattle} from '../src/ui/mass-battle-view.js';
import {troopCenterOffset,TROOP_VISUAL_BOUNDS} from '../src/ui/troop-layout.js';
import {sceneFocus} from '../src/ui/camera-focus.js';
import {MapCamera} from '../src/ui/map-camera.js';
import {mapAnchor} from '../src/model/cartography-geometry.js';
function v53Loaded(f){const p=new TurnPlayback({options:()=>({armyPresentation:true,massBattlePresentation:true})});p.load(f.record,f.start.world,f.run.world,false);return p;}
test('simultaneous contact pairs all come from recorded opponents; waiting armies remain visible',()=>{
 const f=fourArmyFixture(),snapshot=JSON.stringify(f.run),p=v53Loaded(f),plan=p.state.scenes.find(s=>s.massPlan).massPlan;
 for(const beat of plan.story.beats){const state=massBattleAt(plan,massGlobalTime(plan,beat.contact+100));assert.equal(state.units.length,8);assert(state.contacts.length);for(const c of state.contacts){assert(plan.story.beats.some(b=>b.attackId===c.attackId&&b.defenseId===c.defenseId));}assert(state.units.every(u=>u.troops>=0));}assert.equal(JSON.stringify(f.run),snapshot);
});
test('flank and wave routes are distinct while parent commanders and statistics remain unique',()=>{
 const f=fourArmyFixture(),p=v53Loaded(f),initial=p.state.scenes.find(s=>s.massPlan).massPlan,a=massBattlePlan(initial.group,f.record,{forceTactic:'hook'}),b=massBattlePlan(initial.group,f.record,{forceTactic:'waves'});
 assert.notDeepEqual(a.story.groups.map(g=>g.motions),b.story.groups.map(g=>g.motions));assert.equal(new Set(a.units.map(u=>u.id)).size,a.units.length);for(const g of a.story.groups)for(let i=1;i<g.motions.length;i++)assert.deepEqual(g.motions[i].from,g.motions[i-1].to);
});
test('personal highest streak is scoped to this group; loss and draw break, automatic capture does not add wins',()=>{
 const units=[{id:'a',name:'가',color:'#f00'},{id:'b',name:'나',color:'#00f'}],fight=(winner,automatic=false)=>({attackId:'a',defenseId:'b',winner,automatic});
 const list=[...Array.from({length:5},()=>fight('a')),fight('b'),...Array.from({length:3},()=>fight('a')),fight('a',true)];
 assert.deepEqual(massPersonalStreaks(list,units).map(h=>[h.id,h.count]),[['a',5]]);
 assert.deepEqual(massPersonalStreaks(Array.from({length:4},()=>fight('a')),units),[]);
 assert.deepEqual(massPersonalStreaks([...Array.from({length:3},()=>fight('a')),fight(null),...Array.from({length:3},()=>fight('a'))],units),[]);
 assert.deepEqual(massPersonalStreaks(Array.from({length:7},()=>fight('a')),units).map(h=>h.count),[7]);
});
test('real long campaign shows group honors once at the end, never the mid-battle lifetime celebration',()=>{
 const p=v53Loaded(largeMassFixture()),first=p.state.scenes.findIndex(s=>s.massPlan),plan=p.state.scenes[first].massPlan;
 assert(plan.honors.length);assert(plan.honors.every(h=>h.count>=5));assert(!plan.units.some(u=>u.labels.some(l=>l.text.includes('연승'))));
 p.state.index=first;p.remaining=p.duration();assert(!renderMassBattle({playback:p}).includes('이번 집단전 최고'));
 p.state.index=p.state.scenes.findIndex(s=>s.massPlan&&s.massPhase==='summary');p.remaining=p.duration();const html=renderMassBattle({playback:p});assert(html.includes('이번 집단전 최고'));assert.equal((html.match(/이번 집단전 최고/g)||[]).length,plan.honors.length);
});
test('quarter-screen panel centers on the territory, and stays within the map near edges',()=>{
 assert.deepEqual(massPanelPlacement({width:1920,height:1080},{x:960,y:540},{width:960,height:540}),{left:480,top:270});
 const size={width:960,height:540};for(const anchor of [{x:-500,y:-500},{x:2500,y:2000},{x:960,y:540}]){const r=massPanelPlacement({width:1920,height:1080},anchor,size);assert(r.left>=8&&r.top>=8);assert(r.left+size.width<=1912);assert(r.top+size.height<=1072);}
});
test('one figure and compact multi-figure formations are centered on a stable all-frame union',()=>{
 for(const n of [1,3,4,5,8,12,16]){const rows=Math.ceil(n/4),body=50,offset=troopCenterOffset(n,body,18),top=offset-(rows-1)*18+(TROOP_VISUAL_BOUNDS.top-292)*body/224,bottom=offset+(TROOP_VISUAL_BOUNDS.bottom-292)*body/224;assert(Math.abs((top+bottom)/2)<1e-8);}
});
test('confirmed appointment follows the new officer, ahead of stale battle focus, retaining zoom',()=>{
 const f=fourArmyFixture(),world=structuredClone(f.start.world),p=world.people.find(p=>p.role==='general');p.positionId='tile-0';
 const event={type:'appointment',index:100,nationId:p.countryId,slot:p.slot,role:'general'},scene={kind:'apply',event,worldBefore:f.start.world,worldAfter:world,battleIndex:0},record={actorId:p.countryId,turn:1,battles:f.record.battles};
 const expected=mapAnchor(world,'tile-0','station');assert.deepEqual(sceneFocus(scene,record),expected);
 const camera=new MapCamera();camera.autoFollow=true;camera.viewport=()=>({width:1600,height:1000});camera.update=()=>{};camera.view('simulation').zoom=2.5;camera.follow({scene,state:{record},displayWorld:world});
 assert.equal(camera.view('simulation').zoom,2.5);assert.deepEqual([camera.view('simulation').x,camera.view('simulation').y],expected);
});

test('the normal solo viewer no longer celebrates a fifth lifetime win from previous army engagements',()=>{
 const start=studio36Fixture({duel:true}),run=nextTurn(start,studio36Controls()),record={...run.history[0],turn:5};assert(record.battles.some(b=>!b.automatic&&b.winner!==null));
 const history=Array.from({length:4},(_,i)=>({...record,turn:i+1})),snapshot=JSON.stringify(record);
 const modern=new TurnPlayback({options:()=>({armyPresentation:true,massBattlePresentation:true})});modern.load(record,start.world,run.world,false,history);
 assert(!modern.state.scenes.some(s=>s.victoryMeta?.streak));assert(!modern.state.scenes.some(s=>s.massPlan));
 const old=new TurnPlayback({options:()=>({armyPresentation:true})});old.load(record,start.world,run.world,false,history);assert(old.state.scenes.some(s=>s.victoryMeta?.streak),'fixture actually reaches the old lifetime threshold');assert.equal(JSON.stringify(record),snapshot);
});
