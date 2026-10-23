import test from 'node:test';
import assert from 'node:assert/strict';
import {blankWorld,validateWorld,clone} from '../src/model/world.js';
import {createContinent160World} from '../src/data/continent160-world.js';
import {createRun,nextTurn,engineFor,projectWorld,restoreRun} from '../src/engine/simulation.js';
import {replayTurn} from '../src/engine/replay.js';
import {counterCaptureLimit} from '../src/engine/counterattack.js';
import {ADDITIVE_COMBAT_DEFAULTS} from '../src/model/combat-rules.js';
import {makeTurnScenes,TurnPlayback} from '../src/ui/playback.js';
import {roundCampaign,sharedFrontPath,completedRoundPresentation} from '../src/ui/round-campaign.js';
import {renderAtlas} from '../src/ui/atlas-view.js';
import {renderJudgmentOverlay} from '../src/ui/judgment-overlay.js';
import {nationFraming} from '../src/ui/camera-focus.js';
import {battleRoute} from '../src/ui/battle-map.js';

function counterFixture(split=4){
 const w=blankWorld({rows:3,cols:4});Object.assign(w.rules,{seaSupply:false,baseCapacity:25,territoryArmyLimit:100,expeditionChances:[100,100,100,100,100,100]});
 w.countries=['a','b'].map((id,i)=>({id,name:id,color:i?'#006bff':'#ff2028',troops:30,recruitment:0,personality:'balanced'}));
 w.people=w.countries.flatMap(c=>[{id:'king-'+c.id,countryId:c.id,name:c.id+'왕',role:'king',ability:0,personality:'balanced'},...Array.from({length:3},(_,slot)=>({id:c.id+slot,countryId:c.id,name:c.id+slot,role:'general',ability:0,personality:'balanced',slot}))]);
 w.territories.forEach((t,i)=>t.ownerId=i<split?'a':'b');
 w.cartography={version:1,style:'classic',opacity:.3,background:null,polygons:{},links:Array.from({length:11},(_,i)=>['tile-'+i,'tile-'+(i+1)])};
 const r=createRun(validateWorld(w),7),s=r.engineState;
 for(const c of s.countries){c.reserve=5;c.generals.forEach(g=>g.troops=g.active?20:0);}
 s.countries[0].generals[0].position=split-1;s.countries[1].generals[0].position=split;
 return sync15(r);
}
function sync15(r){for(const c of r.engineState.countries)c.army=c.reserve+c.generals.reduce((n,g)=>n+g.troops,0);r.world=projectWorld(r.initialWorld,r.engineState);assert(engineFor(r.initialWorld).engine.validState(r.engineState));return r;}
const war15=split=>({targetId:'b',targetCells:{0:'tile-'+split},rolls:{king:10,'expedition:0':1,'attack:0':1,'defense:0':30,'death:0':10,'expedition:1':100}});
const domestic15={rolls:{king:1,minister:1,domestic:10}};

test('new rules round-trip and reject invalid capital caps or reversed counterattack thresholds',()=>{
 const w=counterFixture().initialWorld;assert.equal(validateWorld(JSON.parse(JSON.stringify(w))).rules.capitalReserveLimit,10);
 for(const value of [0,-1,2.5,'10']){const bad=clone(w);bad.rules.capitalReserveLimit=value;assert.throws(()=>validateWorld(bad));}
 for(const value of [[40,20],[20],[20,20]]){const bad=clone(w);bad.rules.counterCaptureThresholds=value;assert.throws(()=>validateWorld(bad));}
 const legacy=clone(w);legacy.rules.capitalReserveLimit=null;legacy.rules.defenderCounterattack=false;assert.equal(validateWorld(legacy).rules.capitalReserveLimit,null);
});

test('defensive capture thresholds are exactly 20/40, independent of attacking capture grades',()=>{
 for(const [margin,want] of [[0,0],[19,0],[20,1],[39,1],[40,2],[68,2],[200,2]]){
  const b={actor:0,target:1,winner:1,attack:{score:1},defense:{score:1+margin}};
  assert.equal(counterCaptureLimit(b,ADDITIVE_COMBAT_DEFAULTS),want);
  assert.equal(counterCaptureLimit({...b,winner:0},ADDITIVE_COMBAT_DEFAULTS),0);
  assert.equal(counterCaptureLimit({...b,winner:null},ADDITIVE_COMBAT_DEFAULTS),0);
  assert.equal(counterCaptureLimit(b,{...ADDITIVE_COMBAT_DEFAULTS,defenderCounterattack:false}),0);
 }
});
test('a defensive major victory captures the actual launch province, records the correct owner and relocates its surviving attacker',()=>{
 const r=counterFixture(),next=nextTurn(r,war15(4)),b=next.history[0].battles[0];
 assert.equal(b.winner,b.target);assert.equal(b.counterCaptureLimit,1);assert.deepEqual(b.takenTerritoryIds,['tile-3']);
 assert.equal(next.world.territories[3].ownerId,'b');assert.equal(next.history[0].changes[0].from,'a');assert.equal(next.history[0].changes[0].to,'b');assert.equal(next.history[0].success,false);
 const attacker=next.world.people.find(p=>p.id==='a0');assert(attacker.alive);assert(next.world.territories.find(t=>t.id===attacker.positionId).ownerId==='a');assert.equal(attacker.wins,0);
 assert(next.history[0].movements.some(m=>m.moves.some(v=>v.personId==='a0'&&['retreat','redeploy'].includes(v.kind))));assert(next.history[0].detail.includes('역점령 −1'));
});
test('a 40+ defensive victory can take two contiguous provinces but cannot bypass another living enemy commander',()=>{
 let r=counterFixture();r.engineState.countries[0].generals[0].troops=2;sync15(r);let n=nextTurn(r,war15(4));assert.deepEqual(n.history[0].battles[0].takenTerritoryIds,['tile-3','tile-2']);
 r=counterFixture(8);r.engineState.countries[0].generals[0].troops=2;r.engineState.countries[0].generals[1].position=7;r.engineState.countries[0].generals[1].troops=0;sync15(r);
 n=nextTurn(r,war15(8));const b=n.history[0].battles[0];assert.equal(b.counterCaptureLimit,2);assert.deepEqual(b.takenCells,[]);assert.equal(n.world.territories[7].ownerId,'a');
});
test('counter-capturing the last enemy province ends the campaign and clears its armies without invalid positions',()=>{
 const r=counterFixture(1),controls=war15(1),n=nextTurn(r,controls);assert.equal(n.result.reason,'unification');assert.deepEqual(n.result.winnerIds,['b']);assert.equal(n.world.countries[0].troops,0);assert(n.world.people.filter(p=>p.countryId==='a'&&p.role==='general').every(p=>!p.positionId));assert(engineFor(n.initialWorld).engine.validState(n.engineState));
 const display=roundCampaign(n.world,completedRoundPresentation(n));assert.equal(display.captures.size,1);assert(display.routes.length>0);
});
test('capital cap blocks new recruitment/production only after eligible generals receive troops; personal armies remain separate',()=>{
 let r=counterFixture();for(const c of r.engineState.countries){c.reserve=10;c.extraRecruitment=50;for(const g of c.generals)if(g.active)g.troops=25;}sync15(r);
 r=nextTurn(r,domestic15);assert.equal(r.referenceRecord.acceptedGain,0);assert.equal(r.referenceRecord.blockedGain,3);
 r=nextTurn(r,domestic15);assert(r.world.countries.every(c=>c.reserve<=10));assert(r.world.people.filter(p=>p.role==='general'&&p.active).every(p=>p.troops===25));assert(r.history.at(-1).production.every(p=>p.blocked>0));
 let open=counterFixture();open.engineState.countries[0].reserve=10;open.engineState.countries[0].generals[0].troops=0;sync15(open);open=nextTurn(open,domestic15);
 assert.equal(open.referenceRecord.acceptedGain,3);assert.equal(open.world.people.find(p=>p.id==='a0').troops,8);assert.equal(open.world.countries[0].reserve,5);
});
test('new initial over-allocation is explicit, while a real v19 save preserves unlimited reserves and its old next turn',async()=>{
 const w=counterFixture().initialWorld;w.countries.forEach(c=>c.troops=150);const fresh=createRun(w,7);assert(fresh.world.countries.every(c=>c.reserve===10&&c.initialUnassigned>0));
 const legacy=clone(w);legacy.rules.capitalReserveLimit=null;legacy.rules.defenderCounterattack=false;let old=createRun(legacy,7);old=nextTurn(old,domestic15);
 const data=JSON.parse(JSON.stringify(old));data.engineVersion='studio-v11-19';for(const k of ['capitalReserveLimit','defenderCounterattack','counterCaptureThresholds'])delete data.initialWorld.rules[k];
 const restored=restoreRun(data);assert.equal(restored.initialWorld.rules.capitalReserveLimit,null);assert.equal(restored.initialWorld.rules.defenderCounterattack,false);assert.deepEqual(nextTurn(restored).engineState,nextTurn(old).engineState);await replayTurn(restored,1);
});
test('counterattack losses, captures, retreat and RNG survive save/replay without changing the live history',async()=>{
 let r=counterFixture();r.engineState.countries[0].generals[0].troops=2;sync15(r);
 // A replayable definition, rather than an unrecorded administrator edit.
 const w=clone(r.initialWorld);w.countries.forEach(c=>c.troops=40);r=createRun(w,77);
 for(let i=0;i<12&&!r.result;i++)r=nextTurn(r,i%2?domestic15:{rolls:{king:10,'expedition:0':1,'attack:0':1,'defense:0':30}});
 const saved=JSON.stringify(r),restored=restoreRun(JSON.parse(saved));for(const record of r.history){const rebuilt=await replayTurn(restored,record.turn);assert.deepEqual(rebuilt.record.changes,record.changes);assert.deepEqual(rebuilt.record.battles,record.battles);}assert.equal(JSON.stringify(r),saved);
});
test('capture hatch appears only at the territory step and persists into the next nation through round production',()=>{
 const before=counterFixture(),r=nextTurn(before,war15(4)),record=r.history[0],scenes=makeTurnScenes(record,before.world),index=scenes.findIndex(s=>s.kind==='apply'&&s.event.type==='resolve'),snapshot=JSON.stringify(r);
 const state={record,before:before.world,scenes,index,phase:'holding',effectStage:'outcome',roundRecords:[]};assert.equal(roundCampaign(scenes[index].worldBefore,state).captures.size,0);
 state.effectStage='troops';assert.equal(roundCampaign(scenes[index].worldBefore,state).captures.size,0);
 state.effectStage='territory';const campaign=roundCampaign(scenes[index].worldAfter,state);assert.equal(campaign.captures.get('tile-3').ownerId,'b');assert.equal(campaign.baseOwners.get('tile-3'),'a');
 const later={turn:2,round:record.round,actorId:'b',events:[],battles:[],changes:[]},next={record:later,before:r.world,scenes:[{kind:'focus',event:{index:0,type:'king'}}],index:0,roundRecords:[record]};
 assert.equal(roundCampaign(r.world,next).captures.size,1);assert(roundCampaign(r.world,next).routes.length>=2);
 later.events=[{type:'round_end',index:1}];next.scenes=[{kind:'round-settle',event:{index:.5,type:'round_settle'}}];assert.equal(roundCampaign(r.world,next).captures.size,1);
 next.scenes=[{kind:'focus',event:later.events[0]}];assert.equal(roundCampaign(r.world,next).captures.size,1);next.record={...later,round:later.round+1};next.scenes=[{kind:'season',event:{index:-1,type:'season'}}];assert.equal(roundCampaign(r.world,next).captures.size,0);
 assert.equal(roundCampaign(r.world,completedRoundPresentation(r)).captures.size,1);assert.equal(JSON.stringify(r),snapshot);
});
test('round overlays never reveal a future battle, and repeated routes have separate stable curves and national arrowheads',()=>{
 const r0=counterFixture(),r=nextTurn(r0,war15(4)),record=r.history[0],scenes=makeTurnScenes(record,r0.world),initial={record,before:r0.world,scenes,index:0,phase:'holding',roundRecords:[]};
 assert.equal(roundCampaign(r0.world,initial).routes.length,0);assert.equal(roundCampaign(r0.world,initial).captures.size,0);
 const a=battleRoute([100,100],[200,200],'attack','#ff0000',{id:'1-0-attack',lane:0}),b=battleRoute([100,100],[200,200],'attack','#ff0000',{id:'1-1-attack',lane:1});
 assert.notEqual(a.match(/class="campaign-route-shadow" d="([^"]+)"/)[1],b.match(/class="campaign-route-shadow" d="([^"]+)"/)[1]);assert(a.includes('fill="#ff0000"'));assert.equal(a,battleRoute([100,100],[200,200],'attack','#ff0000',{id:'1-0-attack',lane:0}));
  assert.notEqual(a.match(/class="campaign-route-shadow" d="([^"]+)"/)[1].split(' ').at(-1),b.match(/class="campaign-route-shadow" d="([^"]+)"/)[1].split(' ').at(-1));
});
test('draw front follows only the shared edge, including mismatched polygon subdivisions, never the territory perimeter',()=>{
 const a={id:0,points:[[0,0],[10,0],[10,10],[0,10]]},b={id:1,points:[[10,2],[20,2],[20,8],[10,8],[10,5]]},geometry={cells:[a,b]};
 const path=sharedFrontPath(geometry,a,b);assert(path);assert(!path.includes('Z'));for(const match of path.matchAll(/(?:M|L)([\d.]+),([\d.]+)/g)){assert.equal(Number(match[1]),10);assert(Number(match[2])>=2&&Number(match[2])<=8);}assert.equal(sharedFrontPath(geometry,a,{id:2,points:[[20,20],[30,20],[30,30]]}), '');
});
test('an actual drawn assault keeps just its launch/target frontier until the round ends',()=>{
 const r=counterFixture(),w=clone(r.initialWorld);w.cartography.polygons=Object.fromEntries(w.territories.map((t,i)=>[t.id,{points:[[20+i*90,300],[110+i*90,300],[110+i*90,390],[20+i*90,390]],center:[65+i*90,345]}]));r.initialWorld=validateWorld(w);sync15(r);const controls=war15(4);controls.rolls['attack:0']=10;controls.rolls['defense:0']=10;const next=nextTurn(r,controls),state=completedRoundPresentation(next),c=roundCampaign(next.world,state);assert.equal(next.history[0].battles[0].winner,null);assert.deepEqual(c.fronts,[{fromId:'tile-3',toId:'tile-4'}]);assert.equal(c.captures.size,0);
 const html=renderAtlas(next.world,{presentation:state});assert(html.includes('class="round-stalemate"'));assert(html.includes('data-front-from="tile-3" data-front-to="tile-4"'));
});
test('camera framing uses the acting nation and all visible borders without future-target leakage; compact dice keep unseen scores hidden',()=>{
 const r0=counterFixture(),r=nextTurn(r0,war15(4)),record=r.history[0],scenes=makeTurnScenes(record,r0.world),index=scenes.findIndex(s=>s.event.type==='attack_roll'),scene=scenes[index];
 for(const v of [{width:1600,height:1000},{width:390,height:844},{width:844,height:390}]){const f=nationFraming(r0.world,'a',v);assert(f.zoom>=.5&&f.zoom<=3.2);assert(Number.isFinite(f.x)&&Number.isFinite(f.y));}
 const p=new TurnPlayback();p.load(record,r0.world,r.world,false);p.state.index=index;
 const html=renderJudgmentOverlay({world:scene.worldBefore,playback:p});assert(html.includes('is-compact-duel'));assert(!html.includes('judgment-side-label'));assert(!html.includes(`data-score-visible="true"`));
 const map=renderAtlas(scene.worldBefore,{presentation:{...p.state,effectStage:null}});assert(!map.includes('전투 발생'));assert(map.includes('unit-combat-role'));assert(map.includes('>공격</text>'));assert(map.includes('>수비</text>'));assert(map.includes('data-combat-side="attack"'));
 p.state.index=scenes.findIndex(s=>s.kind==='apply'&&s.event.type==='resolve');p.state.effectStage='territory';assert(renderAtlas(r.world,{presentation:p.state}).includes('data-round-capture="tile-3"'));
});
test('an actual seven-country round retains earlier captures in a later nation and clears when the next season starts',()=>{
 const w=createContinent160World();w.countries.forEach(c=>c.troops=50);let r=createRun(w,123),captured=false,seen=false;
 for(let i=0;i<7;i++){
  const before=r.world;r=nextTurn(r,{rolls:{king:10,'expedition:0':1,'attack:0':30,'defense:0':1}});const record=r.history.at(-1),p=new TurnPlayback();p.load(record,before,r.world,false,r.history);
  if(captured){assert(roundCampaign(before,p.state).captures.size>0);seen=true;}
  if(record.changes.length)captured=true;
  if(record.events.some(e=>e.type==='round_end')){p.finish();assert(roundCampaign(r.world,p.state).captures.size>0);const start=r.world;r=nextTurn(r,domestic15);p.load(r.history.at(-1),start,r.world,false,r.history);assert.equal(p.scene.kind,'season');assert.equal(roundCampaign(start,p.state).captures.size,0);break;}
 }
 assert(seen);
});
