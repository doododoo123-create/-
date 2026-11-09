import {placeMassBattle} from '../src/ui/mass-battle-placement.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {fourArmyFixture} from './studio-v41-fixture.mjs';
import {TurnPlayback} from '../src/ui/playback.js';
import {appointmentFocus} from '../src/ui/appointment-focus.js';
import {MapCamera} from '../src/ui/map-camera.js';
import {mapAnchor} from '../src/model/cartography-geometry.js';
import {chooseMassTactics} from '../src/ui/mass-battle-tactics.js';
import {activeTacticAt} from '../src/ui/tactical-phases.js';
import {ARMY_CARD_SCALE} from '../src/ui/army-presentation.js';
import {commanderTransform} from '../src/ui/troop-layout.js';
import {troopGroups} from '../src/ui/troop-presentation.js';
function setup(){const f=fourArmyFixture(),p=new TurnPlayback({options:()=>({armyPresentation:true,massBattlePresentation:true})});p.load(f.record,f.start.world,f.run.world,false);return {f,p,plan:p.state.scenes.find(s=>s.massPlan).massPlan};}
test('roster appointment and pre-confirmation recruitment follow the actual confirmed officer',()=>{
 const {f}=setup(),before=structuredClone(f.start.world),after=structuredClone(before),old=before.people.find(p=>p.role==='general'),p=after.people.find(p=>p.id===old.id);old.active=false;old.positionId='tile-6';p.positionId=p.stationId='tile-0';
 const c=new MapCamera();c.autoFollow=true;c.update=()=>{};c.viewport=()=>({width:1600,height:1000});c.view('simulation').zoom=2;
 const event={type:'appointment',index:100,nationId:p.countryId,slot:p.slot,personId:p.id,role:p.role},record=f.record;
 c.follow({scene:{kind:'focus',event,worldBefore:before,worldAfter:before},state:{record}});
 c.follow({scene:{kind:'apply',event,worldBefore:before,worldAfter:after},state:{record}});
 assert.deepEqual([c.view('simulation').x,c.view('simulation').y],mapAnchor(after,'tile-0','station'));assert.equal(c.view('simulation').zoom,2);
 assert.deepEqual(appointmentFocus({kind:'apply',event:{type:'roster'},worldBefore:before,worldAfter:after},record),mapAnchor(after,'tile-0','station'));
});
test('small forces omit elaborate tactics; many-to-many enables bounded choices',()=>{
 for(const [a,b,max] of [[1,1,0],[1,2,0],[2,2,0],[1,5,1],[3,3,2],[5,5,3]]){const units=[...Array.from({length:a},(_,i)=>({id:'a'+i,side:'attack'})),...Array.from({length:b},(_,i)=>({id:'b'+i,side:'defense'}))];const facts={id:'test',units,battles:[],winners:units,advancers:[],changes:[],defenseWins:[{}],events:[],defeated:[],actorId:'a'};assert(chooseMassTactics(facts,5).selected.length<=max);}
});
test('only an executing tactic is announced; no future tactical list',()=>{const {plan}=setup();assert.equal(activeTacticAt(plan,-1),null);for(const phase of plan.tacticalPhases){const active=activeTacticAt(plan,phase.at);assert(active&&active.at<=phase.at&&active.end>phase.at);assert(active.ids.every(id=>plan.units.some(u=>u.id===id)));}});
test('recap follows report, preserves actual moves and final state, and never repeats dice',()=>{const {f,p,plan}=setup(),summary=p.state.scenes.findIndex(s=>s.massPhase==='summary'),handoff=p.state.scenes.findIndex(s=>s.massReturn),recap=p.state.scenes.slice(summary+1,handoff);assert(recap.length);assert(recap.every(s=>s.massRecap&&!['roll','result'].includes(s.kind)));assert(recap.some(s=>s.kind==='capture'));for(const s of recap)for(const m of s.moves||[])assert(f.record.movements.some(r=>r.moves.some(v=>v.personId===m.personId&&v.fromId===m.fromId&&v.toId===m.toId)));assert.deepEqual(p.state.scenes[handoff].worldAfter,plan.after);assert.equal(p.state.scenes[summary].worldAfter,plan.before);});
test('ordinary co-located commanders own separate troop blocks; gathering no longer enlarges units',()=>{const {f}=setup(),w=f.start.world,ps=w.people.filter(p=>p.role==='general').slice(0,3),markers=ps.map(person=>({person,country:w.countries[0],territory:w.territories[0]})),groups=troopGroups(markers,null);assert.equal(new Set(ps.map(p=>groups.get(p.id))).size,3);assert.equal(ARMY_CARD_SCALE,1);assert.equal(commanderTransform(),'translate(0,-18) scale(0.75)');});

test('battle panel retains its screen rectangle through pan and DOM patching',()=>{
 const {plan}=setup();let shift=0;const pane={dataset:{},style:{},offsetWidth:500,offsetHeight:400,closest:()=>stage},stage={querySelector:()=>({getScreenCTM:()=>({shift})}),getBoundingClientRect:()=>({width:1000,height:800,left:0,top:0})},root={querySelector:()=>pane};
 const saved=globalThis.DOMPoint;globalThis.DOMPoint=class{constructor(x,y){this.x=x;this.y=y;}matrixTransform(m){return {x:this.x+m.shift,y:this.y};}};try{placeMassBattle({scene:{massPlan:plan}},root);const original={...pane.style};shift=200;pane.style={};placeMassBattle({scene:{massPlan:plan}},root);assert.deepEqual(pane.style,original);}finally{globalThis.DOMPoint=saved;}
});
