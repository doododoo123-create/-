import {fourArmyFixture} from './studio-v41-fixture.mjs';
import {createRun,nextTurn} from '../src/engine/simulation.js';
import {TurnPlayback} from '../src/ui/playback.js';
export function tacticalFixture(kind='normal'){
 const f=fourArmyFixture({deathRaw:kind==='death'?1:10});if(['normal','death'].includes(kind))return f;
 const w=structuredClone(f.start.initialWorld),c=structuredClone(f.record.controls);Object.assign(w.rules,{defenderCounterattack:kind==='counter',warReadiness:false,captureThresholds:[10,20],counterCaptureThresholds:[10,20],royalDefense:kind==='royal',routDeath:false});
 for(const key of Object.keys(c.rolls)){if(key.startsWith('attack:'))c.rolls[key]=kind==='counter'?1:30;if(key.startsWith('defense:'))c.rolls[key]=kind==='counter'?30:1;}
 const start=createRun(w,777),run=nextTurn(start,c);return {start,run,record:run.history[0]};
}
export function tacticalPlayback(f){const p=new TurnPlayback({options:()=>({armyPresentation:true,massBattlePresentation:true}),speed:()=>1});p.load(f.record,f.start.world,f.run.world,false);return p;}
export function tacticalPlans(f){return [...new Set(tacticalPlayback(f).state.scenes.map(s=>s.massPlan).filter(Boolean))];}
// Presentation-only round-trip ownership fixture. This is not a new engine
// outcome or a save offered as a real simulated history.
export function tacticalRoundtripFixture(){
 const f=tacticalFixture(),p=tacticalPlans(f)[0],record={...f.record,events:[...f.record.events],battles:[...f.record.battles],frames:structuredClone(f.record.frames)},group={...p.group,originalScenes:[...p.group.originalScenes],battles:[...p.group.battles]},world=structuredClone(p.after),end=group.originalScenes.at(-1).event.index,index=record.battles.length,territory=p.story.ledger.ownership[0].id,attacker=world.people.find(u=>u.id==='b1'),defender=world.people.find(u=>u.id==='a3');
 const battle={...record.battles.at(-1),index,actor:1,target:0,actorId:'b',defenderId:'a',slot:attacker.slot,defenseSlot:defender.slot,attackerPersonId:attacker.id,defenderPersonId:defender.id,territoryId:territory,territoryName:world.territories.find(t=>t.id===territory).name,continuation:'counter',winner:1,captureOwner:1,attack:{...record.battles.at(-1).attack,name:attacker.name,army:attacker.troops},defense:{...record.battles.at(-1).defense,name:defender.name,army:defender.troops},losses:{attack:{amount:0},defense:{amount:0}},after:{attack:attacker.troops,defense:defender.troops},takenTerritoryIds:[territory]};record.battles.push(battle);group.battles.push(battle);record.events=record.events.filter(e=>e.index<=end);
 for(const [j,type]of ['territory','resolve','occupation'].entries()){const event={index:end+j+1,type,battleIndex:index,nationId:'b',title:'시연용 재탈환'},before=structuredClone(world);if(type==='resolve')world.territories.find(t=>t.id===territory).ownerId='b';const after=structuredClone(world);record.events.push(event);record.frames[event.index]={before,after};group.originalScenes.push({...group.originalScenes.at(-1),id:'demo-roundtrip-'+j,event,battleIndex:index,worldBefore:before,worldAfter:after});}
 return {record,group,territory};
}
export function tacticalStressFixture({countA=5,totalA=5,countB=3,totalB=30,winner='a',quantum=1,lossQuanta=0}={}){
 // Deliberately outside engine capacity in the60만 single-commander tests.
 // These records exercise only the view, never createRun/nextTurn or a save.
 const f=tacticalFixture(),base=tacticalPlans(f)[0],world=structuredClone(base.before),templates=['a','b'].map(id=>world.people.find(p=>p.countryId===id&&p.role==='general'));world.people=[];world.rules.troopRounding=quantum===1?'ten-thousand':'soldier';
 for(const [n,total,side]of [[countA,totalA,0],[countB,totalB,1]])for(let i=0;i<n;i++)world.people.push({...templates[side],id:(side?'b':'a')+i,name:(side?'수비':'공격')+(i+1),slot:i,troops:total/n,active:true,alive:true});
 const before=structuredClone(world),record={turn:1,actorId:'a',events:[],battles:[],frames:{}},group={id:'presentation-stress',actorId:'a',opponentId:'b',frontName:'표시 계층 규모 검증',originalScenes:[],battles:[]};
 const event=(type,battleIndex,apply=()=>{})=>{const e={index:record.events.length,type,battleIndex,nationId:'a',title:'표시 검증'},before=structuredClone(world);apply();const after=structuredClone(world);record.events.push(e);record.frames[e.index]={before,after};group.originalScenes.push({id:'stress-'+e.index,event:e,battleIndex,kind:'apply',worldBefore:before,worldAfter:after,camps:{}});};
 for(let i=0;i<Math.max(countA,countB);i++){const a=world.people.find(p=>p.id==='a'+i%countA),d=world.people.find(p=>p.id==='b'+i%countB);if(a.troops<=0||d.troops<=0)continue;const amountA=Math.min(a.troops,lossQuanta*quantum),amountD=Math.min(d.troops,lossQuanta*quantum),b={...recordBaseBattle(base),index:record.battles.length,actor:0,target:1,actorId:'a',defenderId:'b',slot:a.slot,defenseSlot:d.slot,attackerPersonId:a.id,defenderPersonId:d.id,automatic:false,winner:winner==='draw'?null:winner==='a'?0:1,continuation:i?'followup':'initial',territoryId:'tile-6',territoryName:'검증 영토',attack:{name:a.name,army:a.troops,raw:1,score:1},defense:{name:d.name,army:d.troops,raw:1,score:1},losses:{attack:{amount:amountA},defense:{amount:amountD}},takenTerritoryIds:[],after:{attack:a.troops-amountA,defense:d.troops-amountD}};record.battles.push(b);group.battles.push(b);event('territory',b.index);event('resolve',b.index,()=>{a.troops=Number((a.troops-amountA).toFixed(4));d.troops=Number((d.troops-amountD).toFixed(4));});}
 return {record,group,before,after:world};
}
function recordBaseBattle(plan){return plan.story.beats[0].source;}
