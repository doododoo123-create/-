import { ADDITIVE_COMBAT_DEFAULTS, isModernCombat } from './combat-rules.js';
import { V11_ATLAS, V11_NATIONS, V11_ROSTERS } from '../data/v11-preset.js';
import { validateCartography } from './cartography.js';
export const SCHEMA_VERSION = 2;
export const PERSONALITIES = { balanced:'균형형', peaceful:'내정형', aggressive:'호전형' };
export const MINISTER_STYLES = { balanced:'균형형', recruiter:'모병형', producer:'충원형', supplier:'보급형' };
export const ROLES = { king:'국왕', minister:'승상', general:'장군' };
export const DEFAULT_RULES = Object.freeze({
  mode:'v11', diceSides:10, seaSupply:true, ...structuredClone(ADDITIVE_COMBAT_DEFAULTS), domesticThresholds:{balanced:5,peaceful:7,aggressive:3},
  ministerWeights:{balanced:[3,3,4],recruiter:[5,2,3],producer:[2,3,5],supplier:[2,2,6]},
  successTarget:6,recruitGain:3,productionGain:3,supplyGain:5,baseCapacity:20,minimumReserve:5,
  territoryProduction:1,armyAdvantageBonus:1,lossRates:{win:.3,tie:.4,loss:.5},roundLimit:30,
});
export const clone = value => structuredClone(value);
export const newId = prefix => `${prefix}-${globalThis.crypto.randomUUID()}`;
export const landCount = (world,id) => world.territories.filter(t=>t.ownerId===id).length;
export const findCountry = (world,id) => world.countries.find(c=>c.id===id);
export const countryPeople = (world,id) => world.people.filter(p=>p.countryId===id);
export const totalTroops = world => world.countries.reduce((n,c)=>n+c.troops,0);
export const production = (world,c) => landCount(world,c.id)*world.rules.territoryProduction+c.recruitment;
export function neighbors(world,t) {
  if(!t)return [];
  if(world.cartography?.links!==null&&world.cartography?.links!==undefined){const ids=new Set(world.cartography.links.filter(pair=>pair.includes(t.id)).flat());ids.delete(t.id);return world.territories.filter(n=>ids.has(n.id));}
  if(world.mapKind==='free')return [];
  if(world.mapKind==='v11')return V11_ATLAS.cells[t.row*world.cols+t.col].neighbors.map(i=>world.territories[i]);
  return world.territories.filter(n=>Math.abs(n.row-t.row)+Math.abs(n.col-t.col)===1);
}
export function blankWorld({name='이름 없는 세계',rows=8,cols=10}={}) {
  return {schemaVersion:SCHEMA_VERSION,id:newId('world'),name,description:'나만의 역사를 시작할 새로운 세계',rows,cols,mapKind:'grid',countries:[],people:[],rules:clone(DEFAULT_RULES),territories:Array.from({length:rows*cols},(_,i)=>({id:`tile-${i}`,row:Math.floor(i/cols),col:i%cols,name:`영토 ${i+1}`,ownerId:null}))};
}
export function upgradeWorld(input) {
  if(input?.schemaVersion!==1)return input;
  const w=clone(input),builtin=w.id==='seven-realms-grid-demo'&&w.rows===8&&w.cols===10;
  w.schemaVersion=2;w.mapKind=builtin?'v11':'grid';w.rules={...clone(DEFAULT_RULES),roundLimit:Math.min(100,Math.max(1,Number(w.rules?.roundLimit)||30))};
  const counts=new Map();
  w.countries=w.countries.map(c=>{const i=/^nation-([0-6])$/.exec(c.id),base=builtin&&i?V11_NATIONS[Number(i[1])]:null;return {...c,commandBonus:base?.commandBonus||0,feature:base?.feature||'',capitalId:base?`tile-${V11_ATLAS.capitals[base.id]}`:null};});
  w.people=w.people.map(p=>{
    const slotMatch=builtin&&p.role==='general'?/^general-\d+-(\d+)$/.exec(p.id):null;
    const slot=p.role==='general'?(slotMatch?Number(slotMatch[1]):counts.get(p.countryId)||0):undefined;
    if(p.role==='general')counts.set(p.countryId,Math.max(counts.get(p.countryId)||0,slot+1));
    const match=/^nation-([0-6])$/.exec(p.countryId||''),idx=match?Number(match[1]):-1,base=builtin&&idx>=0?V11_NATIONS[idx]:null,r=base&&slot!==undefined?V11_ROSTERS[idx][slot]:null;
    return {...p,ability:p.ability>0?2:p.ability<0?-2:0,feature:r?.[3]||base?.[p.role==='king'?'kingFeature':'ministerFeature']||'',...(p.role==='minister'?{ministerStyle:base?.minister||'balanced'}:{}),...(p.role==='general'?{slot,commandBonus:r?.[2]||0}:{})};
  });
  if(builtin)for(const c of w.countries){const match=/^nation-([0-6])$/.exec(c.id);if(!match)continue;const i=Number(match[1]),first=Math.ceil(V11_ATLAS.startSizes[i]/4);for(let slot=first;slot<5;slot++)if(!w.people.some(p=>p.countryId===c.id&&p.role==='general'&&p.slot===slot)){const r=V11_ROSTERS[i][slot];w.people.push({id:`general-${i}-${slot}`,name:r[0],countryId:c.id,role:'general',ability:r[1],commandBonus:r[2],feature:r[3],slot,personality:'balanced'});}}
  return w;
}
export function validateWorld(source) {
  const input=upgradeWorld(source);
  const fail=m=>{throw new Error(m);};
  const object=(v,l)=>{if(!v||typeof v!=='object'||Array.isArray(v))fail(`${l} 형식이 올바르지 않습니다.`);return v;};
  const text=(v,l,max=80)=>{if(typeof v!=='string'||!v.trim()||v.length>max)fail(`${l}: 1~${max}자로 입력해 주세요.`);return v.trim();};
  const optionalText=(v,max=150)=>typeof v==='string'?v.slice(0,max):'';
  const number=(v,l,min,max,integer=true)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isInteger(v)))fail(`${l}: ${min}~${max} 범위의 ${integer?'정수':'숫자'}가 필요합니다.`);return v;};
  const array=(v,l,max)=>{if(!Array.isArray(v)||v.length>max)fail(`${l} 형식 또는 개수를 확인해 주세요.`);return v;};
  const unique=(v,l)=>{if(new Set(v).size!==v.length)fail(`${l}가 중복되었습니다.`);};
  object(input,'세계');if(input.schemaVersion!==2)fail('지원하지 않는 세계 파일 버전입니다. Studio 세계 JSON 파일을 선택해 주세요.');
  const rows=number(input.rows,'지도 세로',2,20),cols=number(input.cols,'지도 가로',2,24),mapKind=input.mapKind||'grid';
  if(!['v11','grid','free'].includes(mapKind)||(mapKind==='v11'&&(rows!==8||cols!==10)))fail('원본 v11 지도는 10×8, 80개 영토여야 합니다.');
  const countries=array(input.countries,'국가 목록',100).map(c=>{object(c,'국가');if(!/^#[0-9a-f]{6}$/i.test(c.color))fail('국가 색은 #RRGGBB 형식이어야 합니다.');if(!Object.hasOwn(PERSONALITIES,c.personality))fail('국가 성향이 올바르지 않습니다.');return {id:text(c.id,'국가 ID',100),name:text(c.name,'국가명',40),color:c.color,troops:number(c.troops,'병력',0,1000000),recruitment:number(c.recruitment,'추가 충원량',0,10000),personality:c.personality,commandBonus:number(c.commandBonus??0,'국가 지휘한도 보정',-1,1),feature:optionalText(c.feature),capitalId:c.capitalId??null};});
  unique(countries.map(c=>c.id),'국가 ID');const ids=new Set(countries.map(c=>c.id));
  const owner=(v,l)=>{if(v!==null&&!ids.has(v))fail(`${l}가 존재하지 않는 국가를 가리킵니다.`);return v;};
  const counters=new Map();
  const people=array(input.people,'인물 목록',2000).map(p=>{
    object(p,'인물');if(!Object.hasOwn(ROLES,p.role)||!Object.hasOwn(PERSONALITIES,p.personality))fail('인물 직책 또는 성향이 올바르지 않습니다.');
    if(p.role==='general'&&isModernCombat({...ADDITIVE_COMBAT_DEFAULTS,...input.rules})){number(p.ability,'장군 능력 보정',-4,4);}else if(![-2,0,2].includes(p.ability))fail('국왕·승상과 원본 v11 능력은 −2 / 0 / +2 중에서 선택해 주세요.');
    if(p.portraitKey!==undefined&&p.portraitKey!==''&&(typeof p.portraitKey!=='string'||!/^(?:n[0-3]-(king|minister|general)|general-(?:00[1-9]|0[1-4][0-9]|050)|(king|minister)-(?:00[1-9]|010))$/.test(p.portraitKey)))fail('인물 초상화 선택이 올바르지 않습니다.');
    const result={id:text(p.id,'인물 ID',100),name:text(p.name,'인물명',40),countryId:owner(p.countryId,'인물 소속'),role:p.role,ability:p.ability,personality:p.personality,feature:optionalText(p.feature),...(p.portraitKey?{portraitKey:p.portraitKey}:{})};
    if(p.role==='minister'){const style=p.ministerStyle||'balanced';if(!Object.hasOwn(MINISTER_STYLES,style))fail('승상 성향이 올바르지 않습니다.');result.ministerStyle=style;}
    if(p.role==='general'){const slot=number(p.slot??counters.get(p.countryId)??0,'장군 자리 번호',0,Math.max(19,Math.ceil((mapKind==='free'?input.territories?.length||0:rows*cols)/4)-1));counters.set(p.countryId,Math.max(counters.get(p.countryId)||0,slot+1));result.slot=slot;result.commandBonus=number(p.commandBonus??0,'개인 지휘한도 보정',-1,1);}
    return result;
  });
  unique(people.map(p=>p.id),'인물 ID');
  for(const c of countries){for(const role of ['king','minister'])if(people.filter(p=>p.countryId===c.id&&p.role===role).length>1)fail(`${c.name}의 ${ROLES[role]}은 1명만 둘 수 있습니다.`);unique(people.filter(p=>p.countryId===c.id&&p.role==='general').map(p=>p.slot),`${c.name} 장군 자리 번호`);}
  const territories=array(input.territories,'영토 목록',480).map(t=>{object(t,'영토');return {id:text(t.id,'영토 ID',100),...(mapKind==='free'?{}:{row:number(t.row,'영토 행',0,rows-1),col:number(t.col,'영토 열',0,cols-1)}),name:text(t.name,'영토명',24),ownerId:owner(t.ownerId,'영토 소유국'),...(t.terrain!==undefined?{terrain:['plain','mountain'].includes(t.terrain)?t.terrain:fail('지형은 평지 또는 산악이어야 합니다.')}:{})};});
  if(!territories.length)fail('영토는 최소 1개 필요합니다.');if(mapKind!=='free'&&territories.length!==rows*cols)fail('지도 크기와 영토 수가 일치하지 않습니다.');unique(territories.map(t=>t.id),'영토 ID');if(mapKind!=='free'){unique(territories.map(t=>`${t.row},${t.col}`),'영토 좌표');territories.sort((a,b)=>a.row-b.row||a.col-b.col);}
  for(const c of countries){if(c.capitalId!==null&&!territories.some(t=>t.id===c.capitalId))fail('수도가 존재하지 않는 영토를 가리킵니다.');if(!territories.some(t=>t.id===c.capitalId&&t.ownerId===c.id))c.capitalId=territories.find(t=>t.ownerId===c.id)?.id||null;}
  const r=object(input.rules,'규칙');if(r.diceSides!==10)fail('원본 v11 시스템은 D10 주사위를 사용합니다.');
  if(r.seaSupply!==undefined&&typeof r.seaSupply!=='boolean')fail('해상 보급 설정은 켜기 또는 끄기여야 합니다.');
  const thresholds=object(r.domesticThresholds,'성향별 내정 구간'),losses=object(r.lossRates,'손실률'),weights=object(r.ministerWeights,'승상 행동 확률');
  const rules={mode:'v11',diceSides:10,seaSupply:r.seaSupply??true,domesticThresholds:Object.fromEntries(Object.keys(PERSONALITIES).map(k=>[k,number(thresholds[k],`${PERSONALITIES[k]} 내정 구간`,0,10)])),ministerWeights:Object.fromEntries(Object.keys(MINISTER_STYLES).map(k=>{const a=array(weights[k],'승상 행동 구간',3).map(v=>number(v,'승상 행동 확률',0,10));if(a.length!==3||a.reduce((n,v)=>n+v,0)!==10)fail('각 승상 성향의 세 확률 눈금 합계는 10이어야 합니다.');return [k,a];})),lossRates:Object.fromEntries(['win','tie','loss'].map(k=>[k,number(losses[k],'손실률',0,1,false)]))};
  for(const [key,label,min,max] of [['successTarget','내정 성공 기준',1,12],['recruitGain','모병 증가량',0,10000],['productionGain','충원 강화 증가량',0,10000],['supplyGain','보급 강화 증가량',0,10000],['baseCapacity','기본 지휘한도',1,10000],['minimumReserve','수도 최소 병력',0,10000],['territoryProduction','영토당 생산',0,10000],['armyAdvantageBonus','병력 우세 보정',0,10],['roundLimit','제한 라운드',1,100]])rules[key]=number(r[key],label,min,max);
  const combat={...clone(ADDITIVE_COMBAT_DEFAULTS),...r};
  if(!['v11','additive30'].includes(combat.battleMode))fail('지원하지 않는 전투 방식입니다.');rules.battleMode=combat.battleMode;
  if(typeof combat.fieldCommand!=='boolean')fail('실제 출정·복귀 설정을 확인해 주세요.');rules.fieldCommand=combat.fieldCommand;
  if(!['soldier','ten-thousand'].includes(combat.troopRounding))fail('병력 반올림 단위를 확인해 주세요.');rules.troopRounding=combat.troopRounding;
  if(typeof combat.advancedCampaign!=='boolean')fail('새 원정 규칙 설정을 확인해 주세요.');rules.advancedCampaign=combat.advancedCampaign;
  for(const [key,label,min,max] of [['territoryArmyLimit','영토당 충원 상한',1,10000],['fatigueStep','피로 적용 이동 칸',1,100],['fatiguePenalty','피로 감점',0,100]])rules[key]=number(combat[key],label,min,max);
  rules.supplyGainRange=array(combat.supplyGainRange,'보급 강화 한도 범위',2).map(v=>number(v,'지휘한도 증가',1,3));if(rules.supplyGainRange.length!==2||rules.supplyGainRange[0]>rules.supplyGainRange[1])fail('지휘한도 증가 범위를 1~3만 내에서 지정해 주세요.');
  rules.reliefRadius=number(combat.reliefRadius,'구원 범위',0,20);
  rules.expeditionChances=array(combat.expeditionChances,'거리별 출전 확률',6).map(v=>number(v,'출전 확률',0,100));if(rules.expeditionChances.length!==6||rules.expeditionChances.some((v,i)=>i&&v>rules.expeditionChances[i-1]))fail('거리별 출전 확률 6개를 감소 순서로 입력해 주세요.');
  for(const [key,label,min,max] of [['combatSides','전투 주사위',10,60],['experiencePerWin','승리당 보정',0,10],['experienceCap','전적 보정 상한',0,50],['mountainBonus','산악 보정',0,50]])rules[key]=number(combat[key],label,min,max);
  rules.armyBands=array(combat.armyBands,'병력 보정 구간',16).map((pair,i)=>{if(!Array.isArray(pair)||pair.length!==2)fail('병력 보정은 배율·점수 쌍이어야 합니다.');const result=[number(pair[0],'병력 배율',1.001,1000,false),number(pair[1],'병력 보정',0,100)];if(i&&(pair[0]<=combat.armyBands[i-1][0]||pair[1]<combat.armyBands[i-1][1]))fail('병력 보정 배율과 점수는 증가 순서여야 합니다.');return result;});
  if(!rules.armyBands.length)fail('병력 보정 구간을 1개 이상 입력해 주세요.');
  rules.captureThresholds=array(combat.captureThresholds,'추가 점령 기준',2).map(v=>number(v,'점령 점수 차',1,200));if(rules.captureThresholds.length!==2||rules.captureThresholds[0]>=rules.captureThresholds[1])fail('추가 점령 기준은 작은 점수부터 2개 지정해 주세요.');
  rules.combatLosses=Object.fromEntries(['narrow','clear','rout','draw'].map(key=>{const pair=array(combat.combatLosses?.[key],'전투 손실 기준',2).map(v=>number(v,'손실 비율',0,1,false));if(pair.length!==2)fail('양측 손실 기준을 입력해 주세요.');return [key,pair];}));
  const cartography=validateCartography(input.cartography,territories);
  if(mapKind==='free'&&(!cartography||cartography.links===null||territories.some(t=>!Object.hasOwn(cartography.polygons,t.id))))fail('자유 지도에는 모든 영토의 경계와 인접 연결 목록이 필요합니다.');
  return {schemaVersion:2,id:text(input.id,'세계 ID',100),name:text(input.name,'세계 이름'),description:optionalText(input.description,300),rows,cols,mapKind,countries,people,territories,rules,...(cartography?{cartography}:{})};
}
export function removeCountry(world,id){const next=clone(world);next.countries=next.countries.filter(c=>c.id!==id);next.people.forEach(p=>{if(p.countryId===id)p.countryId=null;});next.territories.forEach(t=>{if(t.ownerId===id)t.ownerId=null;});return validateWorld(next);}
