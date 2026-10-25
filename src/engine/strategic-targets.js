import { recoveryNationCandidates } from './recovery-priority.js';
import { expeditionRoute } from './field-command.js';
import { scaledDistance } from '../model/map-scale.js';
export function initializeStrategy(s,id){
 const c=s.countries[id];if(!c.strategy)c.strategy={primary:null,temporary:null,temporaryLevel:0,committed:0,stagnant:0,responseOrders:0,baselineOwners:s.cells.map(c=>c.owner),baselineCapital:s.capitals[id],capitalAttackers:[],reason:'첫 주공 선정 대기',mode:null,scores:[]};
 return c.strategy;
}
export function strategicRoutes(s,atlas,id,target){
 return s.countries[id].generals.filter(g=>g.active&&g.alive&&g.troops>0&&!g.stranded).flatMap(g=>{
  const routes=s.cells.filter(c=>c.owner===target).map(c=>expeditionRoute(s,atlas,id,g,c.id)).filter(Boolean);
  return routes.length?[{slot:g.slot,distance:Math.min(...routes.map(r=>r.distance))}]:[];
 });
}
export function strategyLosses(s,id){
 const strategy=initializeStrategy(s,id),losses=Array(s.countries.length).fill(0);
 for(let i=0;i<s.cells.length;i++)if(strategy.baselineOwners[i]===id&&s.cells[i].owner!==id)losses[s.cells[i].owner]++;
 return losses;
}
export function strategicScores(s,atlas,id,candidates,rules){
 const t=initializeStrategy(s,id),losses=strategyLosses(s,id);
 return candidates.map(target=>{
  const routes=strategicRoutes(s,atlas,id,target),distance=scaledDistance(Math.min(...routes.map(r=>r.distance)),rules),lands=s.cells.filter(c=>c.owner===target).length;
  const components={continuity:target===t.primary?25:0,finish:lands<=rules.strategyWeakLands?20:0,recovery:Math.min(20,losses[target]*4),commanders:routes.length>=2?10:0,distance:distance<=2?10:distance>=5?-10:0,stagnation:target===t.primary&&t.stagnant>=rules.strategyStall?-Math.min(60,30+(t.stagnant-rules.strategyStall)*10):0};
  return {target,score:Object.values(components).reduce((a,b)=>a+b,0),lands,distance,commanders:routes.length,components};
 }).sort((a,b)=>b.score-a.score||a.target-b.target);
}
export function strategicThreats(s,atlas,id,candidates,rules){
 const t=initializeStrategy(s,id),losses=strategyLosses(s,id),capital=s.capitals[id];
 return candidates.map(target=>{
  const capitalLost=Number.isInteger(t.baselineCapital)&&s.cells[t.baselineCapital].owner===target;
  const capitalReach=Number.isInteger(capital)&&strategicRoutes(s,atlas,target,id).some(r=>{const g=s.countries[target].generals[r.slot];return !!expeditionRoute(s,atlas,target,g,capital);});
  const level=capitalLost?3:(t.capitalAttackers.includes(target)||t.temporary===target&&t.temporaryLevel>=2)&&capitalReach?2:losses[target]>=rules.strategyEmergencyLoss?1:0;
  return {target,level,losses:losses[target]};
 }).filter(t=>t.level).sort((a,b)=>b.level-a.level||Number(b.target===t.temporary)-Number(a.target===t.temporary)||b.losses-a.losses||a.target-b.target);
}
export function selectStrategicTarget(s,atlas,id,candidates,rules,randomInt){
 const t=initializeStrategy(s,id),eligible=candidates.filter(target=>strategicRoutes(s,atlas,id,target).length);
 if(!eligible.length)throw Error('공격 가능한 전략 목표가 없습니다.');
 const recovery=rules.recoveryPriority?recoveryNationCandidates(s,atlas,id,eligible):[];
 if(recovery.length){const choice=recovery.length===1?recovery[0]:recovery[randomInt(s,recovery.length)];t.mode='recovery';t.selected=choice.target;t.reason=choice.recoverable?'시작 영토 수복 최우선':'빼앗긴 시작 영토로 진격';return {target:choice.target,primary:t.primary,temporary:t.temporary,reason:t.reason,mode:t.mode,recovery:choice};}
 if(rules.strategicTargets===false){t.mode=null;t.selected=eligible[randomInt(s,eligible.length)];t.reason='공격 가능한 접경국 무작위 선정';return {target:t.selected,primary:t.primary,temporary:t.temporary,reason:t.reason,mode:null};}
 let reason='주공 공세 유지';
 if(t.primary===null){t.primary=eligible[randomInt(s,eligible.length)];t.committed=0;t.stagnant=0;reason='최초 접경국 무작위 주공 선정';}
 const threats=strategicThreats(s,atlas,id,eligible,rules),current=threats.find(v=>v.target===t.temporary),best=threats[0];
 if(best){
  if(!current||best.level>current.level){t.temporary=best.target;t.temporaryLevel=best.level;t.responseOrders=0;}
  t.mode='temporary';t.responseOrders++;
  const selected=threats.find(v=>v.target===t.temporary)||best;
  reason=selected.level===3?'수도 함락 대응':selected.level===2?'수도 직접 공격 대응':`영토 ${selected.losses}칸 상실 대응`;
  if(t.responseOrders>rules.strategyResponseOrders){t.responseOrders=1;reason+=' · 위협 유지로 대응 연장';}
 }else{
  if(t.temporary!==null)reason='비상 위협 해소 · 원래 주공 복귀';t.temporary=null;t.temporaryLevel=0;t.responseOrders=0;t.mode='primary';
  const scores=strategicScores(s,atlas,id,eligible,rules);t.scores=scores;
  if(!eligible.includes(t.primary)||t.committed>=rules.strategyCommitment&&t.stagnant>=rules.strategyStall){
   const old=scores.find(v=>v.target===t.primary),highest=scores[0].score,ties=scores.filter(v=>v.score===highest),winner=ties.length===1?ties[0]:ties[randomInt(s,ties.length)];
   if(!old||winner.target!==t.primary&&winner.score-old.score>=rules.strategySwitchMargin){t.primary=winner.target;t.committed=0;t.stagnant=0;reason=old?'공세 정체 · 전략 점수에 따라 주공 변경':'기존 주공 소멸·경로 단절 · 새 주공 선정';}
  }
  t.committed++;
 }
 t.reason=reason;t.selected=t.mode==='temporary'?t.temporary:t.primary;t.scores=strategicScores(s,atlas,id,eligible,rules);
 return {target:t.selected,primary:t.primary,temporary:t.temporary,reason,mode:t.mode,scores:t.scores};
}
export function finishStrategicTurn(s,id,kind,beforeOwners,selected,manual=false){
 const t=initializeStrategy(s,id);
 if(kind==='war'&&!manual&&t.mode==='primary'){
  let net=0;for(let i=0;i<s.cells.length;i++){if(beforeOwners[i]===selected&&s.cells[i].owner===id)net++;if(beforeOwners[i]===id&&s.cells[i].owner===selected)net--;}
  t.stagnant=net>0?0:t.stagnant+1;t.lastNet=net;
 }
 t.baselineOwners=s.cells.map(c=>c.owner);t.baselineCapital=s.capitals[id];t.capitalAttackers=[];
}
export function validStrategy(s,id){
 const t=s.countries[id].strategy;if(!t)return false;
 const target=n=>n===null||Number.isInteger(n)&&n>=0&&n<s.countries.length&&n!==id;
 return target(t.primary)&&target(t.temporary)&&Number.isInteger(t.temporaryLevel)&&t.temporaryLevel>=0&&t.temporaryLevel<=3&&(t.mode===null||['primary','temporary','recovery'].includes(t.mode))&&['committed','stagnant','responseOrders'].every(k=>Number.isSafeInteger(t[k])&&t[k]>=0)&&Array.isArray(t.baselineOwners)&&t.baselineOwners.length===s.cells.length&&t.baselineOwners.every(n=>Number.isInteger(n)&&n>=0&&n<s.countries.length)&&(t.baselineCapital===null||Number.isInteger(t.baselineCapital)&&t.baselineCapital>=0&&t.baselineCapital<s.cells.length)&&Array.isArray(t.capitalAttackers)&&t.capitalAttackers.length<=s.countries.length&&new Set(t.capitalAttackers).size===t.capitalAttackers.length&&t.capitalAttackers.every(n=>n!==null&&target(n))&&typeof t.reason==='string'&&t.reason.length<=200&&Array.isArray(t.scores)&&t.scores.length<=s.countries.length&&t.scores.every(v=>v.target!==null&&target(v.target)&&Number.isFinite(v.score)&&Number.isFinite(v.distance)&&v.distance>=1);
}
