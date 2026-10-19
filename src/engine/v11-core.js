import { resolveCampaign } from './campaign-combat.js';
import { reinforcementRoom, retreatPath } from './campaign-logistics.js';
import { fieldPaths } from './field-command.js';
import { expeditionRoute, expeditionChance, fieldDefense } from './field-command.js';
import { isModernCombat, roundedTroops, combatBonuses, combatCasualties } from '../model/combat-rules.js';
// Ported directly from the supplied saguk-play (6).html, engine VERSION 11.
// The numerical algorithm, ordering and event frames are retained.
// Configuration hooks adapt editable worlds; default v11 parity is tested against the untouched HTML.
export function createV11Engine(Atlas, config = {}) {
const V11_RULES = { minimumReserve:5,territoryProduction:1,recruitGain:3,productionGain:3,successTarget:6,armyAdvantageBonus:1,lossRates:{win:.3,tie:.4,loss:.5},...(config.rules||{}) };
const VERSION=11,modern=isModernCombat(V11_RULES),field=modern&&V11_RULES.fieldCommand,whole=modern&&V11_RULES.troopRounding==='ten-thousand';
const advanced=field&&V11_RULES.advancedCampaign;
const troopRound=n=>roundedTroops(n,V11_RULES);
const validTroop=n=>Number.isFinite(n)&&n>=0&&(modern&&!whole?Math.abs(n*10000-Math.round(n*10000))<.00001:Number.isSafeInteger(n));
const NUM_NATIONS=config.nations?.length??7;
const BASE_CAPACITY=config.rules?.baseCapacity??20,SUPPLY_GAIN=config.rules?.supplyGain??5;
const ROWS=config.rows??8,COLS=config.cols??10,MAX_GENERALS=config.maxGenerals??20;
const NATIONS=[{id:0,name:'청람국',short:'청람',color:'#6da9ff',kingName:'서윤',ministerName:'한제',king:'balanced',minister:'producer',ministerAbility:2,commandBonus:0,feature:'정연한 관료국가',kingFeature:'내치와 전쟁을 신중하게 병행',ministerFeature:'장기 병력 생산을 중시'}, {id:1,name:'적연국',short:'적연',color:'#ef8179',kingName:'강혁',ministerName:'위탁',king:'warlike',minister:'recruiter',ministerAbility:-2,commandBonus:-1,feature:'기동전 중심 소부대 편제',kingFeature:'장군들을 자주 출전시킴',ministerFeature:'동원에 집착하지만 집행이 서툼'}, {id:2,name:'금휘국',short:'금휘',color:'#eac66b',kingName:'유온',ministerName:'배문',king:'domestic',minister:'supplier',ministerAbility:0,commandBonus:1,feature:'대부대 편제',kingFeature:'군비와 기반을 축적',ministerFeature:'장군의 지휘 규모 확대'}, {id:3,name:'백록국',short:'백록',color:'#6bceb4',kingName:'백린',ministerName:'도겸',king:'balanced',minister:'balanced',ministerAbility:0,commandBonus:0,feature:'유연한 지방군 체계',kingFeature:'상황에 맞춰 공세와 내정 선택',ministerFeature:'세 내정 행동을 고르게 추진'}];
const KINGS={balanced:{name:'균형형',domestic:5,war:5},domestic:{name:'내정형',domestic:7,war:3},warlike:{name:'호전형',domestic:3,war:7}};
const MINISTERS={balanced:{name:'균형형',weights:[3,3,4]},recruiter:{name:'모병형',weights:[5,2,3]},producer:{name:'충원형',weights:[2,3,5]},supplier:{name:'보급형',weights:[2,2,6]}};
const ACTIONS=['모병','충원력 강화','보급 강화'];
const GRADE_NAMES={'-2':'무능','0':'평범','2':'명급'};
const ROSTERS=[[['진우',0,0,'안정적인 균형형'],['문석',0,1,'병사 통솔에 능한 편제형'],['류건',2,-1,'소수 정예 명장'],['정하',0,0,'실전과 통솔이 무난'],['손범',-2,1,'통솔은 좋지만 전술에 약함']], [['강무',2,-1,'소수로 승부하는 돌격 명장'],['염수',0,1,'다수 병력 야전형'],['도찬',2,0,'노련한 전투 지휘'],['허량',-2,1,'과감하지만 전술이 거침'],['장호',0,0,'기본에 충실한 기동 지휘']], [['배준',-2,1,'대부대 운용·전술에 약함'],['금서',0,-1,'소부대의 안정적 통솔'],['서항',2,1,'대부대 운용 명장'],['나원',0,0,'병참에 익숙한 실무형'],['조평',-2,1,'큰 대열·임기응변에 약함']], [['백진',2,1,'넓은 시야의 명장'],['임하',0,-1,'소부대 신중형'],['도윤',0,1,'대부대 실무형'],['설목',-2,-1,'경험 부족 소부대 지휘'],['한솔',2,0,'빠른 상황 판단의 명장']]];
NATIONS.push({id:4,name:'자운국',short:'자운',color:'#be9aeb',kingName:'영소',ministerName:'묵현',king:'domestic',minister:'producer',ministerAbility:0,commandBonus:1,portraitNation:0,feature:'산지의 신중한 편제',kingFeature:'내정을 먼저 다져 기회를 기다림',ministerFeature:'지속적인 충원 기반을 마련'}, {id:5,name:'현해국',short:'현해',color:'#6fd4e6',kingName:'현도',ministerName:'해명',king:'balanced',minister:'supplier',ministerAbility:2,commandBonus:0,portraitNation:3,feature:'보급을 중시하는 해안국',kingFeature:'작은 영토를 바탕으로 기회를 탐색',ministerFeature:'보급 효율과 지휘 규모 확대에 능함'}, {id:6,name:'황사국',short:'황사',color:'#e9a65e',kingName:'사혁',ministerName:'담윤',king:'warlike',minister:'recruiter',ministerAbility:0,commandBonus:-1,portraitNation:1,feature:'소수 정예의 변경국',kingFeature:'작은 나라여도 먼저 승부를 거는 호전형',ministerFeature:'부족한 병력을 신속히 모집'});
ROSTERS.push([['영준',2,0,'산악전에 익숙한 명장'],['묵진',0,1,'보급과 통솔에 능함'],['유경',0,0,'침착한 지역 지휘'],['송겸',-2,1,'편제는 좋지만 전술에 약함'],['하연',0,0,'기본에 충실한 수비형']], [['현우',2,1,'해안 방어의 명장'],['해준',0,0,'보급에 익숙한 지휘'],['임겸',0,1,'대부대 운용형'],['명호',-2,0,'야전 경험이 부족'],['진해',0,0,'차분한 균형형']], [['사준',2,1,'소수 정예를 이끄는 명장'],['담호',0,0,'과감한 돌격형'],['황건',0,1,'병사 통솔형'],['마연',-2,0,'과감하지만 미숙함'],['석진',2,-1,'날렵한 정예 지휘']]);
if(config.nations)NATIONS.splice(0,NATIONS.length,...JSON.parse(JSON.stringify(config.nations)));
if(config.rosters)ROSTERS.splice(0,ROSTERS.length,...JSON.parse(JSON.stringify(config.rosters)));
if(config.rules?.domesticThresholds)for(const [name,key] of [['balanced','balanced'],['domestic','peaceful'],['warlike','aggressive']]){KINGS[name].domestic=config.rules.domesticThresholds[key];KINGS[name].war=10-KINGS[name].domestic;}
if(config.rules?.ministerWeights)for(const key of Object.keys(MINISTERS))MINISTERS[key].weights=config.rules.ministerWeights[key].slice();
const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const copy=x=>JSON.parse(JSON.stringify(x));
const sign=n=>n>=0?'+'+n:'−'+Math.abs(n);
const adjacent=(a,b)=>!!(Atlas.cells[a.id]&&Atlas.cells[a.id].neighbors.includes(b.id));
const lands=(s,id)=>s.cells.filter(c=>c.owner===id).length;
const slotCount=(s,id)=>Math.ceil(lands(s,id)/4);
const reinforcement=(s,id)=>lands(s,id)?lands(s,id)*V11_RULES.territoryProduction+s.countries[id].extraRecruitment:0;
const capacity=(c,g)=>Math.max(1,BASE_CAPACITY+c.commandBonus+g.commandBonus+c.supplyBonus);
const capitalGuard=c=>c.reserve;
const reservePool=c=>0; // All unassigned troops now defend the capital.
const totalArmy=c=>modern?troopRound(c.reserve+c.generals.reduce((n,g)=>n+g.troops,0)):c.reserve+c.generals.reduce((n,g)=>n+g.troops,0);
const aliveIds=s=>s.countries.filter(c=>lands(s,c.id)>0).map(c=>c.id);
const currentActor=s=>s.result?null:s.schedule[s.scheduleIndex];
function syncArmy(c){if(modern){c.reserve=troopRound(c.reserve);c.generals.forEach(g=>g.troops=troopRound(g.troops));}c.army=totalArmy(c);}
function randomInt(s,n){if(!Number.isInteger(n)||n<1)throw Error('추첨 후보가 없습니다');s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return Math.floor(s.rng/4294967296*n);}
const CAPITAL_HOMES=Atlas.capitals;
function capitalCell(s,id){
 const own=s.cells.filter(x=>x.owner===id);if(!own.length)return null;
 const stored=s.capitals&&s.capitals[id];if(Number.isInteger(stored)&&s.cells[stored]&&s.cells[stored].owner===id)return stored;
 const home=s.cells[CAPITAL_HOMES[id]];if(home.owner===id)return home.id;
 return own.sort((a,b)=>own.filter(x=>adjacent(b,x)).length-own.filter(x=>adjacent(a,x)).length||Math.abs(a.row-home.row)+Math.abs(a.col-home.col)-Math.abs(b.row-home.row)-Math.abs(b.col-home.col)||a.id-b.id)[0].id;
}
function landComponents(s,id){
 const left=new Set(s.cells.filter(x=>x.owner===id).map(x=>x.id)),parts=[];
 while(left.size){const first=left.values().next().value,part=[first];left.delete(first);for(let i=0;i<part.length;i++)for(const x of s.cells)if(left.has(x.id)&&adjacent(s.cells[part[i]],x)){left.delete(x.id);part.push(x.id);}parts.push(part);}return parts;
}
function connectedLand(s,id,start){
 if(!Number.isInteger(start)||!s.cells[start]||s.cells[start].owner!==id)return [];
 const seen=new Set([start]),queue=[start];for(let i=0;i<queue.length;i++)for(const next of Atlas.cells[queue[i]].neighbors)if(s.cells[next].owner===id&&!seen.has(next)){seen.add(next);queue.push(next);}return queue;
}
// Supply may cross open water; combat, stations and campaign planning keep the land graph.
const seaPorts=config.seaPorts||[],seaShores=new Map();
if(V11_RULES.seaSupply)seaPorts.forEach((ports,id)=>ports.forEach(body=>{if(!seaShores.has(body))seaShores.set(body,[]);seaShores.get(body).push(id);}));
function connectedSupply(s,id,start){
 if(!V11_RULES.seaSupply)return connectedLand(s,id,start);
 if(!Number.isInteger(start)||!s.cells[start]||s.cells[start].owner!==id)return [];
 const seen=new Set([start]),queue=[start],sailed=new Set();
 const add=next=>{if(s.cells[next].owner===id&&!seen.has(next)){seen.add(next);queue.push(next);}};
 for(let i=0;i<queue.length;i++){for(const next of Atlas.cells[queue[i]].neighbors)add(next);for(const body of seaPorts[queue[i]]||[])if(!sailed.has(body)){sailed.add(body);for(const next of seaShores.get(body)||[])add(next);}}
 return queue;
}
function supplyComponents(s,id){
 if(!V11_RULES.seaSupply)return landComponents(s,id);
 const left=new Set(s.cells.filter(c=>c.owner===id).map(c=>c.id)),parts=[];
 while(left.size){const part=connectedSupply(s,id,left.values().next().value);part.forEach(v=>left.delete(v));parts.push(part);}return parts;
}
// Used once for new units and v10 migration; established stations never follow layout changes.
function initialStations(s){
 const positions=new Map(),placed=[],capitals=s.countries.map(c=>capitalCell(s,c.id)).filter(v=>v!==null);
 const locked=s.countries.flatMap(c=>c.generals.filter(g=>g.active&&g.alive).flatMap(g=>{const r=s.cells.filter(x=>x.owner===c.id&&x.commander===g.slot);return r.length===1?[r[0].id]:[];}));
 const overlap=cell=>{const p=Atlas.cells[cell.id].center;return [...new Set([...capitals,...locked,...placed])].reduce((n,id)=>{if(id===cell.id)return n;const q=Atlas.cells[id].center;return n+Math.max(0,102-Math.abs(p[0]-q[0]))*Math.max(0,69-Math.abs(p[1]-q[1]));},0);};
 for(const c of s.countries){const used=new Set([capitalCell(s,c.id)]);for(const g of c.generals){if(!g.active)continue;const region=s.cells.filter(x=>x.owner===c.id&&x.commander===g.slot);if(!region.length)continue;const row=region.reduce((n,x)=>n+x.row,0)/region.length,col=region.reduce((n,x)=>n+x.col,0)/region.length,candidates=region.filter(x=>!used.has(x.id)),available=candidates.length?candidates:region;
 available.sort((a,b)=>overlap(a)-overlap(b)||s.cells.filter(x=>x.owner!==c.id&&adjacent(b,x)).length-s.cells.filter(x=>x.owner!==c.id&&adjacent(a,x)).length||(a.row-row)**2+(a.col-col)**2-((b.row-row)**2+(b.col-col)**2)||a.id-b.id);
 positions.set(c.id+':'+g.slot,available[0].id);if(g.alive){used.add(available[0].id);placed.push(available[0].id);}
 }}return positions;
}
function stationCell(s,id,slot){const g=s.countries[id].generals[slot];return g&&g.active&&Number.isInteger(g.station)&&s.cells[g.station]&&s.cells[g.station].owner===id?g.station:null;}
function ensureStations(s){
 let defaults;for(const c of s.countries)for(const g of c.generals){if(!g.active||!lands(s,c.id)){g.station=null;continue;}if(stationCell(s,c.id,g.slot)!==null)continue;
 const old=Number.isInteger(g.station)?s.cells[g.station]:null,nearby=old?Atlas.cells[old.id].neighbors.filter(v=>s.cells[v].owner===c.id):[];
 if(nearby.length){nearby.sort((a,b)=>(s.cells[b].commander===g.slot)-(s.cells[a].commander===g.slot)||a-b);g.station=nearby[0];}
 else{if(!defaults)defaults=initialStations(s);g.station=defaults.get(c.id+':'+g.slot)??capitalCell(s,c.id);}
 }
}
function ensureFieldPositions(s){
 for(const c of s.countries)for(const g of c.generals){
  if(!g.active||!g.alive||!lands(s,c.id)){g.position=null;if(advanced)g.stranded=false;continue;}
  if(Number.isInteger(g.position)&&s.cells[g.position]?.owner===c.id){if(advanced)g.stranded=false;continue;}
  if(advanced&&Number.isInteger(g.position)){const path=retreatPath(s,Atlas,c.id,g);if(path){g.position=path.at(-1);g.stranded=false;}else g.stranded=true;continue;}
  const adjacentOwn=Number.isInteger(g.position)?Atlas.cells[g.position].neighbors.filter(v=>s.cells[v].owner===c.id):[];
  g.position=adjacentOwn.sort((a,b)=>a-b)[0]??stationCell(s,c.id,g.slot);
 }
}
const stationLand=(s,id,slot)=>connectedLand(s,id,stationCell(s,id,slot));
const capitalConnected=(s,id,slot)=>connectedSupply(s,id,stationCell(s,id,slot)).includes(capitalCell(s,id));
function allocateLocal(s,id,cells,amount){
 const c=s.countries[id],area=new Set(cells),allocated=Array(c.generals.length).fill(0);let remaining=amount;
 while(remaining>0){const eligible=c.generals.filter(g=>g.active&&g.alive&&(!advanced||!g.stranded)&&g.troops<capacity(c,g)&&area.has(stationCell(s,id,g.slot)));if(!eligible.length)break;const g=eligible[randomInt(s,eligible.length)];const step=modern?troopRound(Math.min(1,remaining,capacity(c,g)-g.troops)):1;g.troops=modern?troopRound(g.troops+step):g.troops+1;allocated[g.slot]+=step;remaining=modern?troopRound(remaining-step):remaining-1;}
 syncArmy(c);return {allocated,discarded:remaining};
}
function produce(s,id){
 if(advanced)return produceLimited(s,id);
 const c=s.countries[id],parts=supplyComponents(s,id),capital=capitalCell(s,id),main=parts.find(p=>p.includes(capital))||[],centralGain=main.length*V11_RULES.territoryProduction+c.extraRecruitment;
 c.reserve+=centralGain;const allocated=distribute(s,id),isolated=[];let discarded=0;
 for(const cells of parts){if(cells.includes(capital))continue;const local=allocateLocal(s,id,cells,cells.length*V11_RULES.territoryProduction);for(let k=0;k<allocated.length;k++)allocated[k]+=local.allocated[k];discarded+=local.discarded;isolated.push({cells,produced:cells.length*V11_RULES.territoryProduction,...local});}
 syncArmy(c);const rate=reinforcement(s,id);return {id,gain:modern?troopRound(rate-discarded):rate-discarded,rate,centralGain,discarded,isolated,allocated,reserve:c.reserve,garrison:capitalGuard(c),pool:0};
}
function produceLimited(s,id){
 const c=s.countries[id],before=totalArmy(c),parts=supplyComponents(s,id),capital=capitalCell(s,id),main=parts.find(p=>p.includes(capital))||[];
 const plannedCentral=main.length*V11_RULES.territoryProduction+c.extraRecruitment,centralGain=Math.min(plannedCentral,reinforcementRoom(s,id,V11_RULES));
 let blocked=plannedCentral-centralGain,discarded=0;c.reserve=troopRound(c.reserve+centralGain);
 const allocated=distribute(s,id),isolated=[];
 for(const cells of parts){if(cells.includes(capital))continue;const produced=cells.length*V11_RULES.territoryProduction,accepted=Math.min(produced,reinforcementRoom(s,id,V11_RULES)),local=allocateLocal(s,id,cells,accepted);
  for(let k=0;k<allocated.length;k++)allocated[k]+=local.allocated[k];blocked+=produced-accepted;discarded+=local.discarded;isolated.push({cells,produced,blocked:produced-accepted,...local});}
 syncArmy(c);return {id,gain:troopRound(totalArmy(c)-before),rate:reinforcement(s,id),centralGain,blocked,discarded,isolated,allocated,reserve:c.reserve,garrison:capitalGuard(c),pool:0,limit:lands(s,id)*V11_RULES.territoryArmyLimit};
}
function connectionPlan(s,id,allowed){
 const parts=landComponents(s,id);if(parts.length<2)return {components:parts.length,distance:null,targets:[]};
 const group=new Map(parts.flatMap((p,k)=>p.map(v=>[v,k]))),neighbors=new Map(s.cells.map(x=>[x.id,s.cells.filter(y=>adjacent(x,y)).map(y=>y.id)]));
 let distance=Infinity,targets=[];
 for(const start of s.cells){if(start.owner===id||(allowed&&!allowed.has(start.id)))continue;
  const sources=new Set(neighbors.get(start.id).filter(v=>s.cells[v].owner===id).map(v=>group.get(v)));if(!sources.size)continue;
  if(sources.size>1){if(distance>1){distance=1;targets=[];}targets.push(start.id);continue;}
  if(distance===1)continue;
  const queue=[[start.id,1]],visited=new Set([start.id]);let found=null;
  for(let i=0;i<queue.length&&found===null;i++){const [cell,d]=queue[i];if(d>distance)break;for(const v of neighbors.get(cell)){
   if(s.cells[v].owner===id){if(!sources.has(group.get(v))){found=d;break;}}
   else if(!visited.has(v)){visited.add(v);queue.push([v,d+1]);}
  }}
  if(found!==null&&found<=distance){if(found<distance){distance=found;targets=[];}targets.push(start.id);}
 }
 return {components:parts.length,distance:Number.isFinite(distance)?distance:null,targets};
}
function attackOptions(s,id,slot,opponent){
 const all=targets(s,id,slot,opponent),plan=connectionPlan(s,id,new Set(all));return {candidates:plan.targets.length?plan.targets:all,connection:plan.targets.length?plan:null};
}
function campaignOptions(s,id){
 if(advanced)return {candidates:[...new Set(s.cells.filter(c=>c.owner!==id&&Atlas.cells[c.id].neighbors.some(v=>s.cells[v].owner===id)).map(c=>c.owner))].sort((a,b)=>a-b),connection:null};
 const all=new Set();for(const g of s.countries[id].generals)if(g.active&&g.alive&&g.troops>0)for(const v of targets(s,id,g.slot))all.add(v);
 const plan=connectionPlan(s,id,all),cells=plan.targets.length?plan.targets:[...all];return {candidates:[...new Set(cells.map(v=>s.cells[v].owner))].sort((a,b)=>a-b),connection:plan.targets.length?plan:null};
}
function conquestLimit(battle){
 if(battle.winner!==battle.actor)return 0;
 if(battle.automatic)return 1;
 const margin=battle.attack.score-battle.defense.score;
 return margin>=(modern?V11_RULES.captureThresholds[1]:7)?3:margin>=(modern?V11_RULES.captureThresholds[0]:4)?2:1;
}
function conquer(s,battle){
 const taken=[battle.cellId],first=s.cells[battle.cellId],wanted=conquestLimit(battle);
 if(!wanted)return [];
 first.owner=battle.actor;first.commander=battle.slot;
 while(taken.length<wanted){
  // Exploit the defeated unit's connected region; other defenders still get their own battle.
  const candidates=s.cells.filter(x=>x.owner===battle.target&&x.commander===(battle.regionSlot??battle.defenseSlot)&&taken.some(v=>adjacent(x,s.cells[v])));
  if(!candidates.length)break;
  const bridge=connectionPlan(s,battle.actor,new Set(candidates.map(x=>x.id))),preferred=bridge.targets.length?candidates.filter(x=>bridge.targets.includes(x.id)):candidates;
  const next=preferred[randomInt(s,preferred.length)];next.owner=battle.actor;next.commander=battle.slot;taken.push(next.id);
 }
 return taken;
}
function casualty(own,enemy,result){
 const base=100*V11_RULES.lossRates[result==='win'?'win':result==='loss'?'loss':'tie'];
 if(!own||!enemy||base===0)return {base,amount:0};
 // Integer arithmetic implements half-up rounding without fractional stored troops.
 const numerator=own*base*enemy*2,denominator=(own+enemy)*100;
 return {base,amount:Math.min(own,Math.max(1,Math.floor((numerator*2+denominator)/(denominator*2))))};
}
function makeGeneral(id,index){const r=ROSTERS[id][index]||[(NATIONS[id].short?.slice(0,1)||'장')+['현','찬','규','겸','율','온','혁','린','준','우','성','건','명','호','진'][(index-5)%15]+'휘',0,0,'균형형 지역 지휘관'];return {slot:index,name:r[0],ability:r[1],commandBonus:r[2],feature:r[3],troops:0,active:false,alive:true,appointed:false,waited:0,generation:0,station:null,...(field?{position:null}:{}),...(advanced?{stranded:false}:{}),...(modern?{wins:0}:{})};}
function assignRegions(s,id){
 const own=s.cells.filter(x=>x.owner===id),n=slotCount(s,id);
 if(!n)return;
 const byId=new Map(own.map(x=>[x.id,x])),neighbors=new Map(own.map(x=>[x.id,own.filter(y=>adjacent(x,y)).map(y=>y.id)]));
 function components(ids){const left=new Set(ids),out=[];while(left.size){const first=left.values().next().value,part=[first];left.delete(first);for(let i=0;i<part.length;i++)for(const v of neighbors.get(part[i]))if(left.delete(v))part.push(v);out.push(part);}return out;}
 const old=Array.from({length:n},(_,k)=>own.filter(x=>x.commander===k).map(x=>x.id));
 // Preserve connected, legal regions instead of moving commanders on every turn.
 if(old.every(a=>a.length>0&&a.length<=4&&components(a).length===1)&&old.reduce((v,a)=>v+a.length,0)===own.length)return;
 const patches=[];
 for(const component of components(own.map(x=>x.id))){
  const left=new Set(component);
  while(left.size){
   const size=Math.min(4,left.size),seen=new Set(),candidates=[];
   function grow(part){const key=part.slice().sort((a,b)=>a-b).join(',');if(seen.has(key))return;seen.add(key);if(part.length===size){candidates.push(part);return;}const frontier=new Set(part.flatMap(v=>neighbors.get(v)).filter(v=>left.has(v)&&!part.includes(v)));for(const v of frontier)grow([...part,v]);}
   // Enumerate small connected patches; prefer ones that do not strand the remaining land.
   for(const seed of left)grow([seed]);
   let best=null,bestScore=Infinity;
   for(const part of candidates){const partSet=new Set(part),rest=components([...left].filter(v=>!partSet.has(v))),cut=part.reduce((v,x)=>v+neighbors.get(x).filter(y=>left.has(y)&&!partSet.has(y)).length,0),rows=part.map(v=>byId.get(v).row),cols=part.map(v=>byId.get(v).col),area=(Math.max(...rows)-Math.min(...rows)+1)*(Math.max(...cols)-Math.min(...cols)+1),score=rest.reduce((v,a)=>v+Math.ceil(a.length/4),0)*10000+rest.length*100+cut*5+area;
    if(score<bestScore){best=part;bestScore=score;}
   }
   // A remainder can be disconnected after an unavoidable cut; handle each piece next.
   if(!best){const part=components([...left]).sort((a,b)=>a.length-b.length||a[0]-b[0])[0];best=part.slice(0,Math.min(4,part.length));}
   patches.push(best);for(const v of best)left.delete(v);
  }
 }
 // Islands can require more connected patches than the land-based commander count allows.
 while(patches.length>n){let pair=null,distance=Infinity;for(let a=0;a<patches.length;a++)for(let b=a+1;b<patches.length;b++)if(patches[a].length+patches[b].length<=4){const d=Math.min(...patches[a].flatMap(x=>patches[b].map(y=>Math.abs(byId.get(x).row-byId.get(y).row)+Math.abs(byId.get(x).col-byId.get(y).col))));if(d<distance){pair=[a,b];distance=d;}}if(!pair)break;patches[pair[0]].push(...patches[pair[1]]);patches.splice(pair[1],1);}
 if(patches.length>n){patches.sort((a,b)=>b.length-a.length||a[0]-b[0]);const extra=patches.splice(n).flat();for(const v of extra){const x=byId.get(v),eligible=patches.filter(p=>p.length<4);eligible.sort((a,b)=>Math.min(...a.map(y=>Math.abs(byId.get(y).row-x.row)+Math.abs(byId.get(y).col-x.col)))-Math.min(...b.map(y=>Math.abs(byId.get(y).row-x.row)+Math.abs(byId.get(y).col-x.col))));eligible[0].push(v);}}
 // Match new patches to existing slots by overlap to limit unnecessary reassignment.
 const slots=new Set(Array.from({length:n},(_,k)=>k)),remaining=new Set(patches.map((_,k)=>k));
 while(remaining.size){let choice=null,score=-1;for(const p of remaining)for(const k of slots){const overlap=patches[p].filter(v=>byId.get(v).commander===k).length;if(overlap>score){score=overlap;choice=[p,k];}}const [p,k]=choice;for(const v of patches[p])byId.get(v).commander=k;remaining.delete(p);slots.delete(k);}
}
function reconcile(s){
 s.mapVersion=Atlas.id;if(!s.capitals)s.capitals=CAPITAL_HOMES.slice();for(const c of s.countries)s.capitals[c.id]=capitalCell(s,c.id);const changes=[],retired=[];
 for(const c of s.countries){const n=slotCount(s,c.id);for(const g of c.generals){const active=g.slot<n;if(g.active&&!active){retired.push({id:c.id,station:advanced&&g.stranded?null:g.station,troops:g.troops,name:g.name});g.troops=0;changes.push(c.short+' '+g.name+' 대기 전환');}if(!g.active&&active&&g.alive){changes.push(c.short+' '+g.name+(g.appointed?' 복귀':' 신설'));g.appointed=true;}g.active=active;}assignRegions(s,c.id);}
 ensureStations(s);if(field)ensureFieldPositions(s);
 for(const r of retired){const c=s.countries[r.id];if(!lands(s,r.id))continue;const area=connectedSupply(s,r.id,r.station);if(area.includes(capitalCell(s,r.id)))c.reserve+=r.troops;else if(area.length){const local=allocateLocal(s,r.id,area,r.troops);if(local.discarded)changes.push(r.name+' 고립 잔여 '+local.discarded+'만명 해산');}}
 for(const c of s.countries)syncArmy(c);return changes;
}
function distribute(s,id,balanced=false){
 const c=s.countries[id],given=Array(c.generals.length).fill(0),main=new Set(connectedSupply(s,id,capitalCell(s,id)));
 while(c.reserve>V11_RULES.minimumReserve){
  const eligible=c.generals.filter(g=>g.active&&g.alive&&(!advanced||!g.stranded)&&g.troops<capacity(c,g)&&main.has(stationCell(s,id,g.slot)));
  if(!eligible.length)break;
  // Initial troops are balanced; later draws give every non-full commander equal odds per unit.
  const g=balanced?eligible.sort((a,b)=>a.troops-b.troops||a.slot-b.slot)[0]:eligible[randomInt(s,eligible.length)];
  const step=modern?troopRound(Math.min(1,c.reserve-V11_RULES.minimumReserve,capacity(c,g)-g.troops)):1;g.troops=modern?troopRound(g.troops+step):g.troops+1;c.reserve=modern?troopRound(c.reserve-step):c.reserve-1;given[g.slot]+=step;
 }
 syncArmy(c);return given;
}
function createGame(options){const o=options||{},v=Number(o.seed===undefined?123456:o.seed),seed=Number.isFinite(v)?v>>>0:123456;
 const countries=NATIONS.map((base,id)=>{const x=(o.countries||[])[id]||{},c=Object.assign({},base,{reserve:10,army:10,extraRecruitment:0,supplyBonus:0,ownTurns:0,generals:Array.from({length:MAX_GENERALS},(_,k)=>makeGeneral(id,k)),fallen:[]});for(const k of ['king','minister'])if(has(k==='king'?KINGS:MINISTERS,x[k]))c[k]=x[k];if([-2,0,2].includes(Number(x.ministerAbility)))c.ministerAbility=Number(x.ministerAbility);if([-2,0,2].includes(Number(x.generalAbility)))c.generals.forEach(g=>g.ability=Number(x.generalAbility));if(config.initials){const initial=config.initials[id];c.reserve=Atlas.cells.some(cell=>cell.owner===id)?initial.troops:0;c.army=c.reserve;c.extraRecruitment=initial.recruitment;c.supplyBonus=initial.supplyBonus||0;}return c;});
 const cells=[];
 if(config.freeform)for(const cell of Atlas.cells)cells.push({id:cells.length,row:cell.row,col:cell.col,owner:cell.owner,commander:null});
 else for(let row=0;row<ROWS;row++)for(let col=0;col<COLS;col++)cells.push({id:cells.length,row,col,owner:Atlas.cells[cells.length].owner,commander:null});
 const s={version:VERSION,seed,rng:seed,countries,cells,mapVersion:Atlas.id,capitals:CAPITAL_HOMES.slice(),round:1,turns:0,roundLimit:Math.max(1,Math.min(100,Math.floor(Number(o.roundLimit)||30))),schedule:NATIONS.map(c=>c.id),scheduleIndex:0,history:[],result:null};reconcile(s);for(const c of countries)distribute(s,c.id,true);s.initialConfig=copy({seed,roundLimit:s.roundLimit,countries:countries.map((c,id)=>{const x=(o.countries||[])[id]||{};return {king:c.king,minister:c.minister,ministerAbility:c.ministerAbility,...([-2,0,2].includes(Number(x.generalAbility))?{generalAbility:Number(x.generalAbility)}:{})};})});return s;
}
function stats(s){return s.countries.map(c=>({id:c.id,lands:lands(s,c.id),army:c.army,reserve:c.reserve,garrison:capitalGuard(c),reservePool:reservePool(c),recruitment:reinforcement(s,c.id),extraRecruitment:c.extraRecruitment,supplyBonus:c.supplyBonus,commanders:c.generals.filter(g=>g.active&&g.alive).length}));}
function snapshot(s){return {countries:copy(s.countries),cells:copy(s.cells),capitals:copy(s.capitals)};}
function targets(s,id,slot,opponent){const g=s.countries[id].generals[slot];if(!g||!g.active||!g.alive)return [];const own=field?connectedLand(s,id,g.position):stationLand(s,id,slot);return s.cells.filter(x=>x.owner!==id&&(opponent===undefined||x.owner===opponent)&&own.some(v=>adjacent(x,s.cells[v]))).map(x=>x.id);}
function warOpponents(s,id){if(advanced)return campaignOptions(s,id).candidates;const ids=new Set();for(const g of s.countries[id].generals)if(g.active&&g.alive&&g.troops>0)for(const cellId of targets(s,id,g.slot))ids.add(s.cells[cellId].owner);return [...ids].sort((a,b)=>a-b);}
function attackable(s,id){return warOpponents(s,id).length>0;}
function initialOptions(s){return copy(s.initialConfig||{seed:s.seed,roundLimit:s.roundLimit});}
function finish(s,reason){let winners=aliveIds(s);if(reason==='limit'){const best=Math.max(...winners.map(id=>lands(s,id)));winners=winners.filter(id=>lands(s,id)===best);const army=Math.max(...winners.map(id=>s.countries[id].army));winners=winners.filter(id=>s.countries[id].army===army);}s.result={reason,winners,round:s.round,turns:s.turns};}
function validState(s,legacy=false){
 try{
 if(!s||s.version!==(legacy?10:VERSION)||s.mapVersion!==Atlas.id||s.countries.length!==NUM_NATIONS||s.cells.length!==(config.freeform?Atlas.cells.length:ROWS*COLS)||!Array.isArray(s.history)||!Array.isArray(s.schedule)||!Array.isArray(s.capitals)||s.capitals.length!==NUM_NATIONS)return false;
 if(!Number.isInteger(s.rng)||s.rng<0||s.rng>4294967295||!Number.isInteger(s.seed)||s.seed<0||s.seed>4294967295)return false;
 if(!Number.isInteger(s.round)||s.round<1||s.round>s.roundLimit||s.roundLimit>100||!Number.isInteger(s.roundLimit)||!Number.isInteger(s.turns)||s.turns<0)return false;
 if(!Number.isInteger(s.scheduleIndex)||s.scheduleIndex<0||s.scheduleIndex>=s.schedule.length||new Set(s.schedule).size!==s.schedule.length||!s.schedule.every(id=>Number.isInteger(id)&&id>=0&&id<NUM_NATIONS))return false;
 const coords=new Set();for(let i=0;i<(config.freeform?Atlas.cells.length:ROWS*COLS);i++){const x=s.cells[i];if(x.id!==i||!Number.isInteger(x.owner)||x.owner<0||x.owner>=NUM_NATIONS||!Number.isInteger(x.row)||!Number.isInteger(x.col)||x.row<0||x.row>=ROWS||x.col<0||x.col>=COLS)return false;coords.add(x.row+','+x.col);if(!Number.isInteger(x.commander)||x.commander<0||x.commander>=slotCount(s,x.owner))return false;}if(!config.freeform&&coords.size!==ROWS*COLS)return false;
 for(let id=0;id<NUM_NATIONS;id++){if(lands(s,id)?(!Number.isInteger(s.capitals[id])||!s.cells[s.capitals[id]]||s.cells[s.capitals[id]].owner!==id):s.capitals[id]!==null)return false;const c=s.countries[id];if(c.id!==id||!has(KINGS,c.king)||!has(MINISTERS,c.minister)||![-2,0,2].includes(c.ministerAbility)||![-1,0,1].includes(c.commandBonus)||c.generals.length!==MAX_GENERALS)return false;for(const k of ['army','reserve','extraRecruitment','supplyBonus','ownTurns'])if((modern&&['army','reserve'].includes(k))?!validTroop(c[k]):(!Number.isSafeInteger(c[k])||c[k]<0))return false;if(c.army!==totalArmy(c)||c.reserve<Math.min(V11_RULES.minimumReserve,c.army))return false;
 for(let k=0;k<MAX_GENERALS;k++){const g=c.generals[k];if(g.slot!==k||g.active!==(k<slotCount(s,id))||!(modern?Number.isInteger(g.ability)&&g.ability>=-4&&g.ability<=4:[-2,0,2].includes(g.ability))||![-1,0,1].includes(g.commandBonus)||!validTroop(g.troops)||g.troops>capacity(c,g)||!Number.isInteger(g.waited)||g.waited<0||g.waited>3||!Number.isInteger(g.generation)||g.generation<0||typeof g.name!=='string'||!g.name||typeof g.alive!=='boolean')return false;if(modern&&(!Number.isInteger(g.wins)||g.wins<0))return false;if(field&&(g.active&&g.alive?(!Number.isInteger(g.position)||!s.cells[g.position]||((!advanced||!g.stranded)&&s.cells[g.position].owner!==id)):(g.position!==null||(advanced&&g.stranded))))return false;if(advanced&&typeof g.stranded!=='boolean')return false;if((!g.alive||!g.active)&&g.troops!==0)return false;if(!legacy&&(g.active?stationCell(s,id,k)===null:g.station!==null))return false;const count=s.cells.filter(x=>x.owner===id&&x.commander===k).length;if(count>4||(g.active&&!count))return false;}
 if(!lands(s,id)&&c.army!==0)return false;}
 if(!s.result&&!lands(s,currentActor(s)))return false;if(s.result&&(!['limit','conquest'].includes(s.result.reason)||!s.result.winners.length||!s.result.winners.every(id=>aliveIds(s).includes(id))))return false;return true;
 }catch(_){return false;}
}
function migrateSave(saved){try{
 if(validState(saved))return copy(saved);
 if(saved&&saved.version===10&&validState(saved,true)){const s=copy(saved);s.version=VERSION;ensureStations(s);for(const r of s.history){r.legacyLogistics=true;for(const e of r.events||[])if(e.view)ensureStations({...s,...e.view});}return validState(s)?s:null;}
 if(saved&&Number.isInteger(saved.version)&&saved.version>=1&&saved.version<10&&Array.isArray(saved.countries)&&saved.countries.length===4&&Array.isArray(saved.cells)&&[20,60].includes(saved.cells.length)&&Number.isInteger(saved.seed)){
  const s=createGame({seed:saved.seed,roundLimit:saved.roundLimit});s.migrationNote='80개 영지·크기가 다른 7개 국가의 새 경기야. 이전 4국 경기는 별도로 백업했어. 설정에서 이전 경기 백업을 내려받을 수 있어.';return s;
 }
 return null;
 }catch(_){return null;}}
function prepareTurn(input,controls){
 if(!validState(input)||input.result)throw Error('경기가 진행 가능한 상태가 아닙니다');
 const s={...input,countries:copy(input.countries),cells:copy(input.cells),capitals:input.capitals.slice(),schedule:input.schedule.slice(),history:input.history.slice()},actor=currentActor(s),me=s.countries[actor],ctl=controls||{},used=new Set(),events=[],battles=[];
 const livingBefore=new Set(aliveIds(s));
 const record={number:s.turns+1,round:s.round,actor,kind:null,action:null,before:stats(input),events,battles,summary:''};
 function die(label,sides=10){const drawn=randomInt(s,sides)+1;if(ctl.rolls&&has(ctl.rolls,label)&&!used.has(label)){used.add(label);const value=ctl.rolls[label];if(!Number.isInteger(value)||value<1||value>sides)throw Error('잘못된 지정 주사위');return value;}return drawn;}
 function emit(type,title,detail,data,frame){const e={type,title,detail:detail||'',actor,...(data||{})};if(frame)e.view=snapshot(s);events.push(e);return e;}
 function appoint(){for(const g of me.generals){if(!g.active||g.alive||g.waited<3)continue;const raw=die('successor:'+g.slot),ability=raw<=2?-2:raw>=9?2:0,commandBonus=raw>=7&&raw<=8?1:0;g.generation++;const family=['서','강','유','백','영','현','사'][actor]||NATIONS[actor].kingName.slice(0,1),given=['연','진','현','윤','우','찬','겸','하','율','원'];g.name=family+given[(g.slot+g.generation*3)%10]+'·'+(g.slot+1)+'대'+g.generation;g.ability=modern?ability*2:ability;if(modern)g.wins=0;g.commandBonus=commandBonus;g.feature=raw<=2?'미숙형':raw<=6?'균형형':raw<=8?'통솔형':'명장형';g.alive=true;g.troops=0;g.waited=0;g.appointed=true;if(field)g.position=g.station;if(advanced)g.stranded=false;emit('appointment',g.name+' 후임 부임','자국 3턴 대기 완료 · 병력 0만명 · 다음 배분부터 충원',{nation:actor,slot:g.slot,role:'general',roll:raw,faces:10},true);}}
 appoint();
 const reserveBefore=me.reserve,allocated=distribute(s,actor),refilled=allocated.reduce((n,v)=>n+v,0);
 if(refilled)emit('resupply','자국 턴 시작 · 수도 병력 보충','수도방위군 '+reserveBefore+' → '+me.reserve+'만명 · 장군에게 '+refilled+'만명 배분 · 수도 최소 5만명 유지',{nation:actor,role:'king',allocated,reserveBefore,reserveAfter:me.reserve,refilled},true);
 record.actionBefore=stats(s);
 const waitingAtStart=me.generals.filter(g=>!g.alive).map(g=>g.slot);
 const kingAttempts=[];let raw,kind;do{raw=die('king');kingAttempts.push(raw);kind=raw<=KINGS[me.king].domestic?'domestic':'war';if(kingAttempts.length>100)throw Error('행동 재추첨 한도 초과');}while(kind==='war'&&!attackable(s,actor));
 record.kind=kind;emit('king',me.kingName+' · '+(kind==='domestic'?'내정':'전쟁')+' 선택','국왕 행동 D10',{nation:actor,role:'king',roll:raw,faces:10,attempts:kingAttempts,kind});
 if(kind==='domestic'){
  raw=die('minister');let sum=0,sub=0;for(let k=0;k<3;k++){sum+=MINISTERS[me.minister].weights[k];if(raw<=sum){sub=k;break;}}
  record.action=ACTIONS[sub];emit('minister',me.ministerName+' · '+record.action+' 선택','승상 내정 선택 D10',{nation:actor,role:'minister',roll:raw,faces:10,sub});
  const value=die('domestic'),score=value+me.ministerAbility,success=score>=V11_RULES.successTarget;record.success=success;record.domesticScore={raw:value,ability:me.ministerAbility,score,success};
  emit('domestic_roll','승상의 실행 판정','6점 이상 성공',{nation:actor,role:'minister',roll:value,faces:10,ability:me.ministerAbility,score,success,sub});
  let acceptedGain=V11_RULES.recruitGain,supplyGain=SUPPLY_GAIN;
  if(success){
   if(sub===0){if(advanced)acceptedGain=Math.min(acceptedGain,reinforcementRoom(s,actor,V11_RULES));me.reserve=troopRound(me.reserve+acceptedGain);distribute(s,actor);}
   if(sub===1)me.extraRecruitment+=V11_RULES.productionGain;
   if(sub===2){if(advanced){const [low,high]=V11_RULES.supplyGainRange,rolled=die('supply_gain',high-low+1);supplyGain=low+rolled-1;emit('supply_roll','지휘한도 증가량','모든 장군에게 +'+supplyGain+'만 · 기존 예비병만 배분',{nation:actor,role:'minister',roll:rolled,faces:high-low+1,gain:supplyGain});}me.supplyBonus+=supplyGain;distribute(s,actor);}
  }
  if(advanced){record.acceptedGain=success&&sub===0?acceptedGain:0;record.blockedGain=success&&sub===0?V11_RULES.recruitGain-acceptedGain:0;record.supplyGain=success&&sub===2?supplyGain:0;}
  record.summary=record.action+(success?' 성공 · '+['병력 +'+acceptedGain+'만명'+(advanced&&acceptedGain<V11_RULES.recruitGain?' · 충원 상한으로 '+(V11_RULES.recruitGain-acceptedGain)+'만 미충원':''),'매 라운드 생산 영구 +'+V11_RULES.productionGain+'만명','모든 장군 지휘한도 영구 +'+supplyGain+'만명'][sub]:' 실패 · 변화 없음');
  emit('resolve',record.summary,success?'효과를 적용했어.':'이번 내정은 효과 없이 끝났어.',{success,changes:stats(s),before:record.actionBefore},true);
 }else{
  record.action='장군별 영지전';const campaign=campaignOptions(s,actor),nationCandidates=campaign.candidates,nationDraw=randomInt(s,nationCandidates.length)+1;
  let opponent=nationCandidates[nationDraw-1];if(ctl.targetId!==undefined){if(!nationCandidates.includes(ctl.targetId))throw Error('인접하지 않거나 공격할 수 없는 국가');opponent=ctl.targetId;}
  record.connectionPriority=campaign.connection;record.target=opponent;record.targetCandidates=nationCandidates;record.targetDraw=nationCandidates.indexOf(opponent)+1;
  emit('war_target',s.countries[opponent].name+' 공격 확정','이번 전쟁의 모든 장군은 이 나라만 공격해.',{nation:actor,role:'king',roll:record.targetDraw,faces:nationCandidates.length,target:opponent,candidates:nationCandidates,connection:campaign.connection});
  const attackers=me.generals.filter(g=>g.active&&g.alive).map(g=>g.slot);
  if(advanced)resolveCampaign({s,Atlas,rules:V11_RULES,terrains:config.terrains,actor,opponent,ctl,events,battles,emit,die,randomInt,livingBefore,helpers:{targets,conquestLimit,connectedSupply,syncArmy,ensureStations,ensureFieldPositions,lands,aliveIds,finish}});
  else for(const slot of attackers){if(s.result)break;const a=me.generals[slot],options=attackOptions(s,actor,slot,opponent),candidates=options.candidates;if(!a.alive||a.troops===0||!candidates.length){emit('skip',a.name+' 공격 건너뜀',!a.alive?'지휘관 공석':!a.troops?'병력 0만명 · 충원 대기':s.countries[opponent].name+'과 맞닿은 주둔지 연결 영지가 없어',{nation:actor,slot,role:'general'});continue;}
   const index=battles.length;let cellId=candidates[randomInt(s,candidates.length)];if(ctl.targetCells&&ctl.targetCells[slot]!==undefined){cellId=ctl.targetCells[slot];if(!candidates.includes(cellId))throw Error('인접하지 않은 대상 영지');}
   const route=field?expeditionRoute(s,Atlas,actor,a,cellId):null;
   if(field){
    if(!route){emit('skip',a.name+' 출전 불가','목표까지 연결된 자국 경로가 없어.',{nation:actor,slot,role:'general',cellId});continue;}
    const chance=expeditionChance(route.distance,V11_RULES),roll=die('expedition:'+slot,100),accepted=roll<=chance;
    emit('expedition_roll',a.name+' · '+(accepted?'출전 결정':'주둔 유지'),route.distance+'칸 · 출전 확률 '+chance+'% · D100이 '+chance+' 이하면 출전',{nation:actor,slot,role:'general',roll,faces:100,distance:route.distance,chance,accepted,cellId});
    if(!accepted){emit('hold',a.name+' 출전하지 않음','선택한 목표를 포기하고 현재 주둔지에서 대기해.',{nation:actor,slot,role:'general',cellId,distance:route.distance});continue;}
   }
   const cell=s.cells[cellId],target=cell.owner,other=s.countries[target],home=other.generals[cell.commander];
   const defense=field?fieldDefense(s,Atlas,target,home,V11_RULES.reliefRadius):null,d=defense?.general||home;
   const from=field?s.cells[route.from]:stationLand(s,actor,slot).map(v=>s.cells[v]).find(x=>adjacent(x,cell));
   const battle={index,actor,target,slot,defenseSlot:d.slot,connection:options.connection,cellId,from:from.id,candidates:candidates.slice(),attack:{id:actor,slot,name:a.name,ability:a.ability,army:a.troops},defense:{id:target,slot:d.slot,name:d.alive?d.name:'지휘관 공석',ability:d.ability,army:field&&!defense.available?0:d.troops},automatic:field?!defense.available:!d.alive||d.troops===0,winner:null};battles.push(battle);
   if(field){
    battle.regionSlot=home.slot;battle.returnBlocked=defense.blocked;battle.relief=defense.relief;battle.distance=route.distance;battle.moves=[];
    const move=(nation,g,path,kind)=>{if(!path||path.length<2)return;battle.moves.push({nation,slot:g.slot,generation:g.generation,kind,from:path[0],to:path.at(-1),path:[...path]});g.position=path.at(-1);};
    if(defense.available)move(target,d,defense.path,defense.relief?'relief':'return');
    move(actor,a,route.path,'outbound');
   }
   emit('territory',a.name+'의 공격 영지 선택',other.short+' 영지 · '+(defense?.relief?d.name+' 구원 방어':defense?.blocked?'담당 지휘관 복귀 차단':d.alive?d.name+' 담당':'지휘관 공석 담당'),{nation:actor,slot,role:'general',battleIndex:index,candidates:candidates.slice(),cellId,pair:{from:from.id,to:cellId},target},field);
   if(battle.automatic){battle.winner=actor;emit('battle_auto','방어 불능 · 자동 점령',defense?.blocked?'복귀 경로가 차단되고 3칸 이내 구원군도 없어.':!d.alive?'지휘관이 공석이야.':'방어 장군 병력이 0만명이야.',{battleIndex:index});}
   else{
    const sides=modern?V11_RULES.combatSides:10,av=die('attack:'+slot,sides),dv=die('defense:'+slot,sides);if(modern)battle.sides=sides;Object.assign(battle.attack,{raw:av,armyBonus:a.troops>d.troops?V11_RULES.armyAdvantageBonus:0});Object.assign(battle.defense,{raw:dv,armyBonus:d.troops>a.troops?V11_RULES.armyAdvantageBonus:0});
    if(modern){Object.assign(battle.attack,{wins:a.wins,...combatBonuses(a.troops,d.troops,a.ability,a.wins,'plain',V11_RULES)});Object.assign(battle.defense,{wins:d.wins,...combatBonuses(d.troops,a.troops,d.ability,d.wins,config.terrains?.[cellId]||'plain',V11_RULES)});battle.terrain=config.terrains?.[cellId]||'plain';}
    for(const side of [battle.attack,battle.defense])side.score=side.raw+side.ability+side.armyBonus+(side.experienceBonus||0)+(side.terrainBonus||0);
    battle.winner=battle.attack.score===battle.defense.score?null:battle.attack.score>battle.defense.score?actor:target;
    emit('attack_roll',a.name+' 공격 주사위','공격 장군의 최종 점수',{battleIndex:index,nation:actor,slot,role:'general',roll:av,faces:sides,side:battle.attack});
    emit('defense_roll',d.name+' 방어 주사위','방어 장군의 최종 점수',{battleIndex:index,nation:target,slot:d.slot,role:'general',roll:dv,faces:sides,side:battle.defense});
    battle.losses={attack:casualty(battle.attack.army,battle.defense.army,battle.winner===actor?'win':battle.winner===null?'draw':'loss'),defense:casualty(battle.defense.army,battle.attack.army,battle.winner===target?'win':battle.winner===null?'draw':'loss')};
    if(modern){const margin=Math.abs(battle.attack.score-battle.defense.score);battle.losses={attack:combatCasualties(battle.attack.army,battle.defense.army,battle.winner===actor?'win':battle.winner===null?'draw':'loss',margin,V11_RULES),defense:combatCasualties(battle.defense.army,battle.attack.army,battle.winner===target?'win':battle.winner===null?'draw':'loss',margin,V11_RULES)};}
    a.troops=modern?troopRound(a.troops-battle.losses.attack.amount):a.troops-battle.losses.attack.amount;d.troops=modern?troopRound(d.troops-battle.losses.defense.amount):d.troops-battle.losses.defense.amount;
    if(modern&&battle.winner!==null){const victor=battle.winner===actor?a:d;victor.wins++;battle.victorWins=victor.wins;}
   }
   battle.captureLimit=conquestLimit(battle);battle.takenCells=conquer(s,battle);
   if(battle.takenCells.length){battle.takenCell=cellId;ensureStations(s);if(field)ensureFieldPositions(s);}
   syncArmy(me);syncArmy(other);
   battle.summary=battle.winner===actor?a.name+' 승리 · '+other.short+' 영지 '+battle.takenCells.length+'개 점령':battle.winner===target?d.name+' 방어 성공 · 영지 유지':'무승부 · 영지 유지';
   battle.after={attack:a.troops,defense:d.troops};
   emit('resolve',battle.summary,battle.automatic?'무방비 영지 · 병력 손실 없음':'공격 '+battle.attack.army+' → '+a.troops+'만명 / 방어 '+battle.defense.army+' → '+d.troops+'만명',{battleIndex:index,success:battle.winner===actor},true);
   const loser=battle.automatic||battle.winner===null?null:battle.winner===actor?d:a;
   if(loser&&loser.troops===0){const deadNation=battle.winner===actor?target:actor,death=die('death:'+slot),died=death<=3;
    emit('death_roll',loser.name+' 전사 판정','1~3 전사 / 4~10 생존',{battleIndex:index,nation:deadNation,slot:loser.slot,role:'general',roll:death,faces:10,died});
    if(died){const deadCountry=s.countries[deadNation];deadCountry.fallen.push({name:loser.name,round:s.round,turn:s.turns+1,slot:loser.slot,generation:loser.generation});deadCountry.fallen=deadCountry.fallen.slice(-30);loser.alive=false;loser.waited=0;if(field)loser.position=null;emit('death',loser.name+' 전사','소속 국가의 온전한 3턴 대기 후, 필요한 자리에 후임을 임명해.',{nation:deadNation,slot:loser.slot,battleIndex:index},true);}else emit('survived',loser.name+' 생존 · 행동 불능','병력 0만명 · 1만명 이상 충원되면 다시 행동할 수 있어.',{nation:deadNation,slot:loser.slot,battleIndex:index},true);
   }
   for(const c of s.countries)if(lands(s,c.id)===0&&livingBefore.has(c.id)){livingBefore.delete(c.id);c.reserve=0;c.generals.forEach(g=>{g.troops=0;if(field)g.position=null;});syncArmy(c);s.capitals[c.id]=null;emit('elimination',c.name+' 멸망','영지를 모두 잃었어.',{target:c.id},true);}
   if(aliveIds(s).length===1){finish(s,'conquest');break;}
  }
  const changes=reconcile(s);if(changes.length||battles.some(b=>b.takenCell!==undefined))emit('roster','지휘 구역 재편',changes.join(' · ')||'현재 영지 수에 맞춰 담당 구역을 정리했어.',{},true);
  const captured=battles.reduce((n,b)=>n+b.takenCells.length,0);record.summary=s.countries[opponent].short+' 원정 · 장군 '+battles.length+'회 공격 · 영지 +'+captured+(battles.some(b=>b.automatic)?' · 자동 점령 포함':'');
 }
 if(advanced&&!battles.some(b=>!b.automatic)){
  const moves=[];for(const g of me.generals){if(!g.active||!g.alive)continue;const path=fieldPaths(s,Atlas,actor,g.position).get(g.station);if(path&&path.length>1){moves.push({nation:actor,slot:g.slot,generation:g.generation,kind:'home',from:g.position,to:g.station,path});g.position=g.station;g.stranded=false;}}
  if(moves.length)emit('home_return','전투 없는 턴 · 담당 주둔지 복귀','열린 자국 육지 경로를 따라 복귀해.',{nation:actor,moves},true);
 }
 record.actionAfter=stats(s);
 me.ownTurns++;for(const slot of waitingAtStart){const g=me.generals[slot];if(!g.alive)g.waited=Math.min(3,g.waited+1);}
 if(waitingAtStart.length)emit('waiting','후임 대기 진행',waitingAtStart.map(k=>me.generals[k]).filter(g=>!g.alive).map(g=>(g.slot+1)+'번 자리 '+g.waited+'/3턴').join(' · '),{},true);
 s.turns++;if(s.result)s.result.turns=s.turns;
 if(!s.result){s.scheduleIndex++;while(s.scheduleIndex<s.schedule.length&&!lands(s,s.schedule[s.scheduleIndex]))s.scheduleIndex++;
  if(s.scheduleIndex>=s.schedule.length){const gains=[];for(const c of s.countries){if(!lands(s,c.id))continue;gains.push(produce(s,c.id));}emit('round_end',s.round+'라운드 종료 · 병력 생산',gains.map(g=>s.countries[g.id].short+' +'+g.gain+'만명'+(g.blocked?' (상한으로 '+g.blocked+'만 미충원)':'')+(g.discarded?' (고립 미배분 '+g.discarded+'만명 소멸)':'')).join(' · '),{gains},true);
   if(s.round>=s.roundLimit){s.scheduleIndex=s.schedule.length-1;finish(s,'limit');}else{s.round++;s.schedule=aliveIds(s);s.scheduleIndex=0;}
  }
 }
 if(s.result)emit('finish',s.result.winners.map(id=>s.countries[id].name).join(' · ')+(s.result.winners.length>1?' 공동 우승':' 우승'),s.result.reason==='conquest'?'천하 통일':s.roundLimit+'라운드 결산 · 영지 → 총병력',{result:s.result});
 record.after=stats(s);s.history.push(record);if(s.history.length>12)s.history.shift();if(!validState(s))throw Error('턴 처리 뒤 규칙 상태가 일치하지 않습니다');return {state:s,record};
}
return {NUM_NATIONS,ATLAS:Atlas,adjacent,CAPITAL_HOMES,capitalCell,landComponents,connectedLand,connectedSupply,supplyComponents,stationCell,stationLand,capitalConnected,ensureStations,ensureFieldPositions,produce,connectionPlan,attackOptions,campaignOptions,conquestLimit,BASE_CAPACITY,SUPPLY_GAIN,casualty,VERSION,ROWS,COLS,MAX_GENERALS,NATIONS,KINGS,MINISTERS,ACTIONS,GRADE_NAMES,ROSTERS,createGame,prepareTurn,lands,slotCount,reinforcement,capacity,capitalGuard,reservePool,totalArmy,aliveIds,currentActor,stats,validState,migrateSave,initialOptions,targets,warOpponents,attackable,reconcile,distribute,sign};
}
