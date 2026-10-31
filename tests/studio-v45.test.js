import test from 'node:test';import assert from 'node:assert/strict';
import {personalAbility,addPersonalBonus,enablePersonalAbilities,enableOfficerTraits} from '../src/model/officer-traits.js';
import {allocateWorldPortraits} from '../src/model/portrait-allocation.js';
import {portraitSource,portraitImage} from '../src/ui/portraits.js';
import {createContinentV31World} from '../src/scenarios/continent-v31.js';
import {createRun,nextTurn,restoreRun} from '../src/engine/simulation.js';
import {runSaveData} from '../src/storage/run-store.js';
import {exportHistoryData,prepareFileImport} from '../src/storage/history-file.js';
import {replayTurn} from '../src/engine/replay.js';
import {validateWorld} from '../src/model/world.js';
import {TurnPlayback} from '../src/ui/playback.js';
import {renderCampaignOverlay} from '../src/ui/campaign-view.js';
import {renderJudgmentOverlay} from '../src/ui/judgment-overlay.js';
import {observerDuration} from '../src/ui/observer-flow.js';
import {criticalScene,animationRate,armyMovementDurationScale} from '../src/ui/presentation-tempo.js';
import {scoreBonusItems} from '../src/ui/score-accumulation.js';
import {fourArmyFixture} from './studio-v41-fixture.mjs';
import {studio36Fixture,studio36Controls} from './studio-v36-fixture.mjs';
const domestic={rolls:{king:1,minister:1,domestic:1}};
const pOptions={compactCampaigns:true,armyPresentation:true,armyResultReport:true};
function battleWithSkills(){const f=fourArmyFixture(),w=enablePersonalAbilities(structuredClone(f.start.initialWorld));w.people.find(p=>p.id==='a0').personalAbility=4;w.people.find(p=>p.id==='b0').personalAbility=-3;const start=createRun(w,777),run=nextTurn(start,{...f.record.controls,personalAbility:true});return {start,run,record:run.history[0]};}
function current(p,index){p.state.index=index;p.state.phase=['roll','reel'].includes(p.scene.kind)?'rolling':'holding';p.state.effectStage=p.scene.kind==='apply'?'all':null;}
test('personal combat ratings are -4..4, deterministic, editable and add once beside the style score; kings are unchanged',()=>{
 for(let n=-4;n<=4;n++){const side={ability:3,bonus:8};addPersonalBonus(side,{personalAbility:n},{personalAbility:true});assert.equal(side.personalAbility,n);assert.equal(side.bonus,8+n);assert.equal(side.ability,3);const items=scoreBonusItems(side);assert.equal(items.filter(i=>i.label==='개인 무장').length,1);}
 const side={ability:4,bonus:4};addPersonalBonus(side,{role:'king',ability:4},{personalAbility:true});assert.deepEqual(side,{ability:4,bonus:4});
 const base=enableOfficerTraits(createContinentV31World()),snapshot=JSON.stringify(base),w=enablePersonalAbilities(base);assert.equal(JSON.stringify(base),snapshot);assert.deepEqual(enablePersonalAbilities(w),w);assert(new Set(w.people.filter(p=>p.role==='general').map(personalAbility)).size>=6);assert.deepEqual(validateWorld(w),w);
 const bad=structuredClone(w);bad.people.find(p=>p.role==='general').personalAbility=5;assert.throws(()=>validateWorld(bad));
});
test('real combat records separate personal and role bonuses in final scores and preserves them through save, replay and history import',async()=>{
 const {start,run,record}=battleWithSkills(),first=record.battles[0];assert.equal(first.attack.personalAbility,4);assert.equal(first.defense.personalAbility,-3);
 for(const b of record.battles.filter(b=>!b.automatic))for(const side of [b.attack,b.defense])assert.equal(side.score,side.raw+side.ability+side.personalAbility+side.armyBonus+side.experienceBonus+side.terrainBonus+side.fatigueBonus+(side.confusionBonus||0));
 const old=nextTurn(start,record.controls?{...record.controls,personalAbility:false}:undefined);assert.equal(old.history[0].battles[0].attack.personalAbility,undefined);
 const restored=restoreRun(runSaveData(run)),replay=await replayTurn(restored,1);assert.deepEqual(replay.record.battles,record.battles);assert.deepEqual(nextTurn(restored,domestic).engineState,nextTurn(run,domestic).engineState);
 const imported=await prepareFileImport(await exportHistoryData(run));assert.deepEqual(imported.run.engineState,run.engineState);assert.deepEqual(imported.run.world.people.map(p=>p.portraitKey),run.world.people.map(p=>p.portraitKey));
});
test('an existing 34 campaign preserves earlier battles and applies personal skills only on recorded new orders',async()=>{
 const {start,run:old}=fourArmyFixture(),legacy=restoreRun({...runSaveData(old),engineVersion:'studio-v11-34'}),before=JSON.stringify(legacy.history),continued=nextTurn(legacy,{...domestic,personalAbility:true});assert.equal(JSON.stringify(continued.history.slice(0,1)),before);assert.deepEqual((await replayTurn(continued,1)).record.battles,old.history[0].battles);assert.deepEqual((await replayTurn(continued,2)).after.countries,continued.world.countries);assert.equal(start.turn,0);
});
test('army movement and local outcomes precede one fully resolved table, without changing recorded map order or game data',()=>{
 const {start,run,record}=battleWithSkills(),snapshot=JSON.stringify(run),p=new TurnPlayback({options:()=>pOptions});p.load(record,start.world,run.world,false);const scenes=p.state.scenes,reports=scenes.filter(s=>s.campaignPhase==='report');assert(reports.length);assert(!scenes.some(s=>s.campaignPhase==='dice'||s.campaignPhase==='approach'));
 for(const report of reports){const end=scenes.indexOf(report),g=report.campaign,maps=scenes.slice(0,end).filter(s=>s.campaign===g&&s.campaignPhase==='map');assert(maps.some(s=>s.kind==='movement'));assert(maps.some(s=>s.kind==='apply'&&s.event.type==='resolve'));assert.equal(report.completedBattles,g.battles.length);assert.equal(report.worldAfter,maps.at(-1).worldAfter);assert.equal(report.worldBefore,report.worldAfter);
  for(const map of maps){current(p,scenes.indexOf(map));assert.equal(renderCampaignOverlay({playback:p}), '');assert.equal(renderCampaignOverlay({playback:p,inline:true}), '');}
  current(p,end);const html=renderCampaignOverlay({playback:p});assert.equal((html.match(/data-duel-complete="true"/g)||[]).length,g.battles.length);assert(!html.includes('data-active-roll="true"'));assert(!html.includes('is-rolling'));assert.equal((html.match(/data-score-verdict=/g)||[]).length,g.battles.filter(b=>!b.automatic).length*2);assert(!html.includes('data-score-phase="rolling"'));assert(!html.includes('<footer>'));
 }
 assert.equal(JSON.stringify(run),snapshot);
});
test('a genuine one-on-one keeps its individual dice presentation',()=>{
 const start=studio36Fixture({duel:true}),run=nextTurn(start,studio36Controls()),p=new TurnPlayback({options:()=>pOptions});p.load(run.history[0],start.world,run.world,false);assert(p.state.scenes.some(s=>s.kind==='roll'&&s.event.type==='attack_roll'));assert(!p.state.scenes.some(s=>s.campaignPhase==='report'));
});
test('critical alerts use actual normal speed for timer and animation, then automatically restore selected speed',()=>{
 const {start,run,record}=fourArmyFixture(),p=new TurnPlayback({speed:()=>16,options:()=>pOptions});p.load(record,start.world,run.world,false);const base=p.scene;
 for(const [type,role,kind] of [['death','general','apply'],['death','king','apply'],['appointment','general','apply'],['capital_fall',undefined,'focus'],['elimination',undefined,'elimination']]){
  const s={...base,kind,event:{type,role},rapidMovement:true};p.state.scenes=[s];p.state.index=0;p.state.phase='holding';p.state.effectStage=null;assert(criticalScene(s));assert.equal(p.effectiveSpeed,1);assert.equal(p.animationSpeed,1);assert(p.duration()>=1600);assert.equal(animationRate(s),1);
 }
 const regular={...base,kind:'movement',event:{type:'army_march'}};p.state.scenes=[regular];assert.equal(p.effectiveSpeed,16);assert(!criticalScene({...regular,kind:'roll',event:{type:'appointment'}}));
 const capital={...regular,kind:'focus',event:{type:'capital_fall',title:'수도 함락',detail:''},campaign:{modern:true},campaignPhase:'map'};p.state.scenes=[capital];assert(renderJudgmentOverlay({world:start.world,playback:p}).includes('data-notice="capital_fall"'));
});
test('army-related motion is precisely 40 percent longer, without slowing reels, individual motion or changing routes',()=>{
 const {record}=fourArmyFixture(),a={kind:'movement',armyGroup:{members:[{},{}]},event:{type:'army_march'},rapidMovement:true},normal={...a,armyGroup:null,event:{type:'home_return'}};
 assert.equal(armyMovementDurationScale(a),1.4);assert(Math.abs(observerDuration(a,record,'holding')/observerDuration(normal,record,'holding')-1.4)<1e-9);assert(Math.abs(animationRate(normal)/animationRate(a)-1.4)<1e-9);
 assert.equal(armyMovementDurationScale({...a,singleOfficer:true}),1);assert.equal(armyMovementDurationScale({...a,kind:'roll'}),1);
});
function portraitWorld(count=80){return {countries:[{id:'a'},{id:'b'}],territories:[{ownerId:'a'},{ownerId:'b'}],people:Array.from({length:count},(_,i)=>({id:'person-'+i,name:'인물'+i,countryId:i%2?'a':'b',role:'general',alive:true,portraitKey:'general-001'}))};}
test('one map receives globally unique actual photos, including former enemy portraits, and existing faces survive a new officer',()=>{
 const source=portraitWorld(),snapshot=JSON.stringify(source),w=allocateWorldPortraits(source),keys=w.people.map(p=>p.portraitKey);assert.equal(new Set(keys).size,80);assert.equal(new Set(w.people.map(p=>portraitSource(p))).size,80);assert.equal(JSON.stringify(source),snapshot);
 const deadView=allocateWorldPortraits({...w,people:w.people.map((p,i)=>i===0?{...p,alive:false}:p)},w);assert.equal(deadView.people[0].portraitKey,w.people[0].portraitKey);
 const born={...source,people:[...w.people,{id:'successor',role:'general',countryId:'a',alive:true}]},next=allocateWorldPortraits(born,w);for(const p of w.people)assert.equal(next.people.find(n=>n.id===p.id).portraitKey,p.portraitKey);assert.equal(new Set(next.people.map(p=>p.portraitKey)).size,81);
 const full=allocateWorldPortraits(portraitWorld(90)),fallen={...full,territories:[{ownerId:'a'}],people:[...full.people,{id:'new-officer',role:'general',countryId:'a',alive:true}]},reuse=allocateWorldPortraits(fallen,full),released=full.people.filter(p=>p.countryId==='b').map(p=>p.portraitKey);assert(released.includes(reuse.people.at(-1).portraitKey));
 for(const p of full.people.filter(p=>p.countryId==='a'))assert.equal(reuse.people.find(n=>n.id===p.id).portraitKey,p.portraitKey);
});
test('custom worlds beyond the supplied 90 unique faces use initials rather than silently duplicate a photo',()=>{
 const w=allocateWorldPortraits(portraitWorld(95)),faces=w.people.filter(p=>!p.portraitMissing);assert.equal(faces.length,90);assert.equal(new Set(faces.map(p=>portraitSource(p))).size,90);for(const p of w.people.filter(p=>p.portraitMissing)){assert(!portraitImage(p).includes('<img'));assert(portraitImage(p).includes('portrait-initials'));}
});

test("successor overview uses that new life's personal score, and a freed photo replaces an overflow placeholder",()=>{
 let f=fourArmyFixture({deathRaw:1}),w=enablePersonalAbilities(f.start.initialWorld),run=nextTurn(createRun(w,777),f.record.controls);
 for(let i=0;i<24&&!run.result&&run.engineState.countries[0].generals[0].generation===0;i++)run=nextTurn(run,{...domestic,personalAbility:true});
 const g=run.engineState.countries[0].generals[0];assert(g.generation>0);const p=run.world.people.find(p=>p.countryId===run.world.countries[0].id&&p.slot===0&&p.role==='general');assert.equal(p.personalAbility,personalAbility(g));assert.equal(g.personalAbility,undefined);
 const crowded=allocateWorldPortraits(portraitWorld(95)),missing=crowded.people.find(p=>p.portraitMissing),oneDown={...crowded,people:crowded.people.filter(p=>p.id!==crowded.people.find(p=>!p.portraitMissing).id)},fixed=allocateWorldPortraits(oneDown,crowded),recovered=fixed.people.find(p=>p.id===missing.id);assert(!recovered.portraitMissing);assert(portraitImage(recovered).includes('<img'));
});
