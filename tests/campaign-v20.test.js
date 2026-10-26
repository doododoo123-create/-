import test from 'node:test';import assert from 'node:assert/strict';
import {blankWorld,validateWorld,clone} from '../src/model/world.js';
import {createRun,nextTurn,projectWorld,engineFor,restoreRun} from '../src/engine/simulation.js';
import {replayTurn} from '../src/engine/replay.js';
import {makeTurnScenes,TurnPlayback} from '../src/ui/playback.js';
import {applicationWorld} from '../src/ui/observer-flow.js';
import {roundCampaign,completedRoundPresentation,renderRoundRoutes} from '../src/ui/round-campaign.js';
import {geometryFor} from '../src/model/cartography-geometry.js';
import {renderAtlas} from '../src/ui/atlas-view.js';
import {renderJudgmentOverlay} from '../src/ui/judgment-overlay.js';
import {renderMapStage} from '../src/ui/map-stage.js';
import {mapEffects} from '../src/ui/map-effects.js';
import {scoreBonusItems,accumulatedScore,renderAccumulatingDie} from '../src/ui/score-accumulation.js';
import {GENERAL_PORTRAITS} from '../src/data/general-portraits.js';
import {LEADER_PORTRAITS} from '../src/data/studio-art.js';
import {portraitSource,portraitChoices} from '../src/ui/portraits.js';
import {readFileSync} from 'node:fs';
function fixture20({annex=true,resident=false,capital=0}={}){
 const w=blankWorld({rows:2,cols:6});Object.assign(w.rules,{seaSupply:false,capitalFallAnnexation:annex,baseCapacity:25,territoryArmyLimit:100,territoriesPerCommander:2,expeditionChances:[100,100,100,100,100,100]});
 w.countries=['a','b','c'].map((id,i)=>({id,name:id+'국',color:['#ff2030','#007bff','#00dd50'][i],troops:60,recruitment:0,personality:'balanced',capitalId:'tile-'+[capital,4,11][i]}));
 w.people=w.countries.flatMap(c=>[{id:'king-'+c.id,countryId:c.id,name:c.id+'왕',role:'king',ability:0,personality:'balanced'},{id:'minister-'+c.id,countryId:c.id,name:c.id+'승상',role:'minister',personality:'balanced',ability:2,ministerStyle:'balanced'},...Array.from({length:5},(_,slot)=>({id:c.id+slot,countryId:c.id,name:c.id+slot,role:'general',ability:0,personality:'balanced',slot}))]);
 w.territories.forEach((t,i)=>t.ownerId=i<4?'a':i<11?'b':'c');
 w.cartography={version:1,style:'classic',opacity:.3,background:null,polygons:{},links:[[0,1],[1,2],[2,3],[1,3],[3,4],[4,5],[4,6],[4,11],[5,7],[6,8],[7,9],[8,10],[10,11]].map(p=>p.map(i=>'tile-'+i))};
 const r=createRun(validateWorld(w),777),s=r.engineState;const assigned=[0,0,1,1,0,1,2,0,2,1,3,0];s.cells.forEach((t,i)=>t.commander=assigned[i]);for(const c of s.countries){c.reserve=5;for(const g of c.generals)g.troops=g.active?6:0;}
 const a=s.countries[0].generals[0];a.position=0;a.station=0;a.troops=20;s.countries[0].generals[1].troops=0;s.countries[0].generals[1].position=2;
 const d=s.countries[1].generals;d[0].position=resident?4:7;d[0].station=4;d[0].troops=12;d[1].position=5;d[2].position=6;d[3].position=10;s.cells[4].commander=0;
 for(const c of s.countries)c.army=c.reserve+c.generals.reduce((n,g)=>n+g.troops,0);r.world=projectWorld(r.initialWorld,s);assert(engineFor(r.initialWorld).engine.validState(s));return r;
}
const war20={targetId:'b',targetCells:{0:'tile-4'},rolls:{king:10,'expedition:0':1,'attack:0':30,'defense:0':1,'death:0':10}};
function present20(r,n){const record=n.history[0],scenes=makeTurnScenes(record,r.world);return {record,scenes,before:r.world,index:0,phase:'holding',roundRecords:[]};}
test('capital fall annexes exactly the former owner immediate ring, overrides resident garrisons, preserves survivors and excludes third nations and second ring',()=>{
 const r=fixture20(),n=nextTurn(r,war20),b=n.history[0].battles[0];assert(b.capitalFall);assert.deepEqual([...b.capitalFall.extraCells].sort(),[5,6]);assert.deepEqual([...b.takenCells].sort(),[4,5,6]);
 for(const i of [4,5,6])assert.equal(n.world.territories[i].ownerId,'a');for(const i of [7,8,9,10])assert.equal(n.world.territories[i].ownerId,'b');assert.equal(n.world.territories[11].ownerId,'c');
 for(const slot of [0,1,2]){const g=n.world.people.find(p=>p.countryId==='b'&&p.role==='general'&&p.slot===slot);assert(g.alive&&g.troops>0);assert.equal(n.world.territories.find(t=>t.id===g.positionId).ownerId,'b');}
 assert.equal(n.world.people.find(p=>p.id==='a0').wins,1);assert.equal(n.history[0].events.filter(e=>e.type==='capital_fall').length,1);assert(engineFor(n.initialWorld).engine.validState(n.engineState));
 assert(n.history[0].events.findIndex(e=>e.type==='occupation')<n.history[0].events.findIndex(e=>e.type==='capital_fall'));
});
test('disabling capital annexation retains regular capture and consumes the same battle dice without a free extra victory or casualty',()=>{
 const a=nextTurn(fixture20(),war20),b=nextTurn(fixture20({annex:false}),war20);assert.deepEqual(b.history[0].battles[0].takenCells,[4]);assert.deepEqual(a.history[0].rolls,b.history[0].rolls);assert.deepEqual(a.history[0].battles[0].losses,b.history[0].battles[0].losses);assert.equal(a.rng,b.rng);
});
test('defensive counterattack also triggers the old attacking capital ring exactly once and does not spread to its relocated capital',()=>{
 const r=fixture20({capital:3}),controls=clone(war20);controls.rolls['attack:0']=1;controls.rolls['defense:0']=30;const n=nextTurn(r,controls),b=n.history[0].battles[0];assert.equal(b.winner,b.target);assert.equal(b.capitalFall.nation,0);assert.equal(b.capitalFall.capital,3);for(const i of [1,2,3])assert.equal(n.world.territories[i].ownerId,'b');assert.equal(n.world.territories[0].ownerId,'a');assert.equal(n.world.countries[0].capitalId,'tile-0');assert.equal(n.history[0].events.filter(e=>e.type==='capital_fall').length,1);
});
test('attack movement and formation precede defense movement and formation, with a live arrow for each march',()=>{
 const r=fixture20(),n=nextTurn(r,war20),p=present20(r,n),stages=p.scenes.filter(s=>s.event?.type==='territory'&&s.battleIndex===0),kinds=stages.map(s=>s.kind+':'+(s.movementSide||s.revealedRoutes?.join('+')||''));assert.deepEqual(kinds.slice(0,4),['movement:attack','route:attack','movement:defense','route:attack+defense']);
 const a=stages[0],d=stages[2];assert.equal(a.moves.length,1);assert.equal(a.moves[0].countryId,'a');assert(!a.camps.b0||a.camps.b0.territoryId==='tile-7');assert.equal(d.moves[0].countryId,'b');assert.equal(d.camps.a0.territoryId,'tile-3');
 for(const [i,want] of [[0,['attack']],[1,['attack']],[2,['attack','defense']],[3,['attack','defense']]]){p.index=p.scenes.indexOf(stages[i]);assert.deepEqual(roundCampaign(stages[i].worldBefore,p).routes.map(v=>v.side),want);}
});
test('a resident defender has neither an invented movement nor a stationary defense arrow',()=>{
 const r=fixture20({resident:true}),n=nextTurn(r,war20),p=present20(r,n);assert(!p.scenes.some(s=>s.event?.type==='territory'&&s.movementSide==='defense'));assert(!roundCampaign(n.world,completedRoundPresentation(n)).routes.some(v=>v.side==='defense'&&!v.counterattack));
});
test('occupation hatching waits until the recorded winning commander finishes entering, with old color preserved during transit',()=>{
 const r=fixture20(),n=nextTurn(r,war20),p=present20(r,n),arrival=p.scenes.findIndex(s=>s.kind==='arrival'&&s.battleIndex===0);assert(arrival>0);
 for(let index=0;index<arrival;index++){p.index=index;const s=p.scenes[index],world=s.kind==='apply'?applicationWorld(s,'territory'):s.worldAfter,c=roundCampaign(world,{...p,effectStage:'territory'});assert(!c.captures.has('tile-4'),s.id);if(c.pendingCaptures.has('tile-4'))assert.equal(c.pendingCaptures.get('tile-4').ownerId,'b');}
 p.index=arrival;assert.equal(p.scenes[arrival].camps.a0.territoryId,'tile-4');assert.equal(roundCampaign(p.scenes[arrival].worldAfter,p).captures.size,0);p.index=arrival+1;assert.equal(p.scenes[p.index].kind,'capture');assert.deepEqual([...roundCampaign(p.scenes[p.index].worldAfter,p).captures.keys()].sort(),['tile-4','tile-5','tile-6']);
});
test('the complete attack path starts at the commander real departure and uses one solid style through the frontier to the enemy',()=>{
 const r=fixture20(),n=nextTurn(r,war20),c=roundCampaign(n.world,completedRoundPresentation(n)),route=c.routes.find(r=>r.side==='attack');assert.equal(route.fromId,'tile-0');assert.equal(route.path.at(-1),'tile-4');assert(route.path.includes('tile-3'));const svg=renderRoundRoutes(n.world,geometryFor(n.world),c);assert(svg.includes('data-operation-from="tile-0"'));assert(svg.includes('campaign-route attack'));assert(!svg.includes('class="round-march outbound'));
});
test('only seasons, capital falls and eliminations use public notices; ordinary results and refusals attach to cards',()=>{
 const r=fixture20(),n=nextTurn(r,war20),player=new TurnPlayback();player.load(n.history[0],r.world,n.world,false);for(let i=0;i<player.state.scenes.length;i++){
  player.state.index=i;player.state.phase='holding';const s=player.scene,overlay=renderJudgmentOverlay({world:s.worldBefore,playback:player});
  if(['focus','apply','movement','route','arrival','summary'].includes(s.kind)&&!['elimination','capital_fall'].includes(s.event?.type))assert.equal(overlay,'',s.id);
  assert.equal(mapEffects(s,null,n.history[0]).announcement,'');
 }
 // Force a genuine refusal using a zero-chance world.
 const w=clone(r.initialWorld);w.rules.expeditionChances=[0,0,0,0,0,0];const start=createRun(w,1),held=nextTurn(start,war20),p=present20(start,held),idx=p.scenes.findIndex(s=>s.event.type==='hold');assert(idx>=0);p.index=idx;const html=renderAtlas(p.scenes[idx].worldBefore,{presentation:p});assert(html.includes('is-refusal'));assert(html.includes('출정 거부'));assert(!html.includes('map-event-announcement'));
});
test('the role badge uses each actual nation color and the fullscreen play button reflects exact playing state',()=>{
 const r=fixture20(),n=nextTurn(r,war20),p=present20(r,n);p.index=p.scenes.findIndex(s=>s.event.type==='attack_roll');const html=renderAtlas(p.scenes[p.index].worldBefore,{presentation:p});assert.equal((html.match(/class="unit-role-background"/g)||[]).length,2);assert(html.includes('style="fill:#ff2030"'));assert(html.includes('style="fill:#007bff"'));
 const player=new TurnPlayback();player.load(n.history[0],r.world,n.world,false);assert(renderMapStage({world:r.world,run:n,playback:player}).includes('aria-label="재생"'));player.state.playing=true;assert(renderMapStage({world:r.world,run:n,playback:player}).includes('aria-label="일시정지"'));player.pause();
});
test('each signed modifier accumulates in the same die location, with exact negative and canceling sums and no standalone final-score column',()=>{
 const items=scoreBonusItems({ability:4,armyBonus:2,experienceBonus:1,terrainBonus:8,fatigueBonus:-2});assert.deepEqual(items.map(i=>i.value),[4,2,1,8,-2]);assert.deepEqual(items.map((_,i)=>accumulatedScore(10,items,'merging',i).after),[14,16,17,25,23]);assert.equal(accumulatedScore(10,items,'locked').after,23);assert.equal(accumulatedScore(10,[{label:'장군',value:4},{label:'피로',value:-4}],'locked').after,10);assert(renderAccumulatingDie(30,30,'locked','수비',[{label:'총 보정',value:35}]).includes('data-die-value="65"'));
 const html=renderAccumulatingDie(10,30,'merging','공격',items,{mergeIndex:4,progress:.4,speed:8});assert(html.includes('data-score-before="25"'));assert(html.includes('data-score-after="23"'));assert(html.includes('피로 -2'));assert(!html.includes('observer-score'));assert(!renderAccumulatingDie(null,30,'waiting','수비',items).includes('data-score-visible="true"'));
 const r=fixture20(),n=nextTurn(r,war20),p=new TurnPlayback();p.load(n.history[0],r.world,n.world,false);p.state.index=p.state.scenes.findIndex(s=>s.event.type==='attack_roll');p.state.phase='rolling';assert(!renderJudgmentOverlay({world:p.scene.worldBefore,playback:p}).includes('observer-score'));
});
test('the accumulating-dice clock pauses halfway through a specific bonus and resumes at 8x without changing live data',()=>{
 const r=fixture20(),n=nextTurn(r,war20),saved=JSON.stringify(n);let now=0,task=null,speed=1;const p=new TurnPlayback({now:()=>now,speed:()=>speed,schedule:(fn,delay)=>{task={fn,delay};return 1;},cancel:()=>task=null});p.load(n.history[0],r.world,n.world,false);p.state.index=p.state.scenes.findIndex(s=>s.event.type==='attack_roll');p.state.phase='raw';p.step();assert.equal(p.state.phase,'merging');const duration=p.duration();p.resume();now=duration*.4;p.pause();assert(Math.abs(p.remaining-duration*.6)<1e-8);speed=8;p.resume();assert(Math.abs(task.delay-duration*.6/8)<1e-8);p.pause();assert.equal(p.state.mergeIndex,0);assert.equal(JSON.stringify(n),saved);
});
test('ninety supplied color portraits are embedded as exact JPEGs, keep selected identities and expose all seventy generals',()=>{
 assert.equal(portraitChoices().length,90);assert.equal(Object.keys(GENERAL_PORTRAITS).length,70);assert.equal(Object.keys(LEADER_PORTRAITS).length,20);
 for(const [key,file] of [['general-001','assets/portraits/general_001.jpg'],['general-070','assets/portraits/general_070.jpg'],['king-001','assets/leaders/king_001.jpg'],['minister-010','assets/leaders/chancellor_010.jpg']])assert.equal(portraitSource({portraitKey:key}),`data:image/jpeg;base64,${readFileSync(file).toString('base64')}`);
 const w=clone(fixture20().initialWorld);w.people[0].portraitKey='general-070';assert.equal(validateWorld(JSON.parse(JSON.stringify(w))).people[0].portraitKey,'general-070');
});
test('engine23 saves pin the former capital rule while engine24 saves replay new capital events, ownership, positions and RNG exactly',async()=>{
 const w=clone(fixture20().initialWorld);w.rules.capitalFallAnnexation=false;let r=createRun(w,777);for(let i=0;i<6&&!r.result;i++)r=nextTurn(r,{rolls:{king:i%2?1:10}});const data=JSON.parse(JSON.stringify(r));data.engineVersion='studio-v11-23';delete data.initialWorld.rules.capitalFallAnnexation;const old=restoreRun(data);assert.equal(old.initialWorld.rules.capitalFallAnnexation,false);assert.deepEqual(nextTurn(old).engineState,nextTurn(r).engineState);await replayTurn(old,1);
 let modern=createRun(fixture20().initialWorld,777);for(let i=0;i<8&&!modern.result;i++)modern=nextTurn(modern,{rolls:{king:i%3?10:1}});const saved=JSON.stringify(modern),restored=restoreRun(JSON.parse(saved));for(const h of modern.history){const replay=await replayTurn(restored,h.turn);assert.deepEqual(replay.record.battles,h.battles);assert.deepEqual(replay.record.movements,h.movements);}assert.equal(JSON.stringify(modern),saved);
});
