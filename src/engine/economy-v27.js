import {regionalAccounts} from './supply-regions.js';
import { scaledProduction,requiredReserve } from '../model/map-scale.js';
import { fieldOfficers } from './war-readiness.js';
import { distributeFieldPool } from './royal-army.js';
export const economyTotal=c=>c.reserve+(c.reorganization||0)+fieldOfficers(c).reduce((n,g)=>n+g.troops,0);
export function desertionPlan(state,id,rules,regions=null,capital=null){
 if(state.regionalMaintenance&&regions){const groups=regionalAccounts(state,id,rules,regions,capital).map(g=>{const amount=rules.overCapacityDesertion&&g.excess&&rules.desertionRate?Math.min(g.excess,Math.max(1,Math.round(g.excess*rules.desertionRate))):0;const protectedReserve=!state.countries[id].royal&&g.central?Math.min(state.countries[id].reserve,requiredReserve(state,id,rules),g.limit):0,parts=g.parts.map(p=>p.role==='pool'?{...p,available:p.available-protectedReserve}:p).filter(p=>p.available>0);return {...g,amount,cuts:regionalCuts(parts,amount,rules)};});return {total:economyTotal(state.countries[id]),limit:groups.reduce((n,g)=>n+g.limit,0),excess:groups.reduce((n,g)=>n+g.excess,0),amount:groups.reduce((n,g)=>n+g.amount,0),regions:groups,cuts:groups.flatMap(g=>g.cuts)};}
 const c=state.countries[id],total=economyTotal(c),limit=state.cells.filter(t=>t.owner===id).length*rules.territoryArmyLimit,excess=Math.max(0,total-limit),amount=rules.overCapacityDesertion&&excess&&rules.desertionRate?Math.min(excess,Math.max(1,Math.round(excess*rules.desertionRate))):0;
 const protectedReserve=c.royal?0:Math.min(c.reserve,requiredReserve(state,id,rules),limit),parts=[{role:'pool',slot:null,available:c.reserve-protectedReserve},{role:'reorganization',slot:null,available:c.reorganization||0},...fieldOfficers(c).map(g=>({role:g.role||'general',slot:g.slot,available:g.troops}))].filter(p=>p.available>0);
 const quantum=rules.troopRounding==='ten-thousand'?1:.0001,n=Math.round(amount/quantum),sum=parts.reduce((v,p)=>v+Math.round(p.available/quantum),0);let left=n;
 const cuts=parts.map((p,index)=>{const product=BigInt(n)*BigInt(Math.round(p.available/quantum)),denominator=BigInt(sum||1),units=Number(product/denominator);left-=units;return {...p,index,units,remainder:product%denominator};});
 const order=[...cuts].sort((a,b)=>a.remainder===b.remainder?a.index-b.index:a.remainder>b.remainder?-1:1);for(let i=0;i<left;i++)order[i%order.length].units++;
 return {total,limit,excess,amount,cuts:cuts.filter(p=>p.units).map(({role,slot,units})=>({role,slot,amount:Number((units*quantum).toFixed(4))}))};
}
export function applyDesertion(state,id,rules,regions=null,capital=null){const p=desertionPlan(state,id,rules,regions,capital),c=state.countries[id];for(const cut of p.cuts){if(cut.role==='pool')c.reserve-=cut.amount;else if(cut.role==='reorganization')c.reorganization-=cut.amount;else fieldOfficers(c).find(g=>g.slot===cut.slot).troops=Number((fieldOfficers(c).find(g=>g.slot===cut.slot).troops-cut.amount).toFixed(4));}c.army=economyTotal(c);return p;}
export function productionPlan(state,id,rules,parts,capital){
 const c=state.countries[id],main=parts.find(p=>p.includes(capital))||[],base=scaledProduction(main.length,rules),extra=rules.territoryRecruitment?Math.min(c.extraRecruitment,base*rules.extraRecruitmentRatio):c.extraRecruitment,shock=rules.capitalDisruption&&(c.capitalShock||0)>0,multiplier=shock?1-rules.capitalDisruptionRate:1;
 const carried=parts.map(()=>0);
 for(const old of c.productionCarries||[]){const ranked=parts.map((p,i)=>({i,n:p.filter(id=>old.cells.includes(id)).length,anchor:p.includes(old.anchor)})).sort((a,b)=>Number(b.anchor)-Number(a.anchor)||b.n-a.n||a.i-b.i);if(ranked[0]?.n)carried[ranked[0].i]+=old.amount;}
 const groups=parts.map((cells,i)=>{const basic=scaledProduction(cells.length,rules),additional=cells.includes(capital)?extra:0,exact=Math.round((basic+additional)*multiplier*10000)+carried[i];return {cells:[...cells],central:cells.includes(capital),base:basic,extra:additional,gross:basic+additional,produced:Math.floor(exact/10000),carry:exact%10000,carryBefore:carried[i]};});
 if(state.regionalMaintenance){const accounts=regionalAccounts(state,id,rules,parts,capital);for(let i=0;i<groups.length;i++)Object.assign(groups[i],{maintenance:{territories:accounts[i].territories,total:accounts[i].total,limit:accounts[i].limit,room:accounts[i].room}});}
 return {base,accumulatedExtra:c.extraRecruitment,appliedExtra:extra,gross:groups.reduce((n,g)=>n+g.gross,0),multiplier,shockBefore:c.capitalShock||0,planned:groups.reduce((n,g)=>n+g.produced,0),groups};
}
export function produceBalanced(state,id,rules,{parts,capital,capacity,stationCell,syncArmy}){
 const c=state.countries[id],plan=productionPlan(state,id,rules,parts,capital),before=economyTotal(c),limit=state.cells.filter(t=>t.owner===id).length*rules.territoryArmyLimit,allocations=[],allocated=Array(c.generals.length).fill(0);let blocked=0;
 // Redeploy existing unassigned soldiers before creating any new recruits.
 const retained=c.royal?0:Math.min(c.reserve,requiredReserve(state,id,rules),limit),pool=(c.reorganization||0)+c.reserve-retained;if(pool){const main=parts.find(p=>p.includes(capital))||[],eligible=fieldOfficers(c).filter(g=>main.includes(g.role==='king'?g.position:stationCell(state,id,g.slot))),moved=distributeFieldPool(state,id,pool,eligible,capacity);c.reserve=retained;c.reorganization=moved.remaining;}
 for(const group of plan.groups){
  const eligible=fieldOfficers(c).filter(g=>group.cells.includes(g.role==='king'?g.position:stationCell(state,id,g.slot))),room=Math.min(Math.max(0,limit-economyTotal(c)),state.regionalMaintenance?regionalAccounts(state,id,rules,parts,capital).find(g=>g.cells[0]===group.cells[0])?.room||0:Infinity),attempt=Math.min(group.produced,room);
  const reserveMinimum=!c.royal&&group.central?Math.min(attempt,Math.max(0,Math.min(requiredReserve(state,id,rules),rules.capitalReserveLimit??Infinity)-c.reserve)):0;c.reserve+=reserveMinimum;
  const moved=distributeFieldPool(state,id,attempt-reserveMinimum,eligible,capacity),reserveExtra=!c.royal&&group.central?Math.min(moved.remaining,Math.max(0,(rules.capitalReserveLimit??Infinity)-c.reserve)):0;c.reserve+=reserveExtra;
  group.accepted=attempt-moved.remaining+reserveExtra;blocked+=group.produced-group.accepted;allocations.push(...moved.allocated);for(const a of moved.allocated)if(a.role==='general')allocated[a.slot]+=a.amount;
 }
 c.productionCarries=plan.groups.filter(g=>g.carry).map(g=>({anchor:Math.min(...g.cells),cells:g.cells,amount:g.carry}));if(rules.capitalDisruption&&c.capitalShock>0)c.capitalShock--;
 syncArmy(c);return {...plan,id,gain:economyTotal(c)-before,rate:plan.planned,blocked,discarded:0,centralGain:plan.groups.find(g=>g.central)?.accepted||0,isolated:plan.groups.filter(g=>!g.central),allocated,allocations,reserve:c.reserve,royalTroops:c.royal?.troops,limit,shockAfter:c.capitalShock||0};
}

function regionalCuts(parts,amount,rules){
 const quantum=rules.troopRounding==='ten-thousand'?1:.0001,n=Math.round(amount/quantum),sum=parts.reduce((v,p)=>v+Math.round(p.available/quantum),0);if(!n||!sum)return [];let left=n;
 const cuts=parts.map((p,index)=>{const product=BigInt(n)*BigInt(Math.round(p.available/quantum)),denominator=BigInt(sum),units=Number(product/denominator);left-=units;return {...p,index,units,remainder:product%denominator};});
 const order=[...cuts].sort((a,b)=>a.remainder===b.remainder?a.index-b.index:a.remainder>b.remainder?-1:1);for(let i=0;i<left;i++)order[i%order.length].units++;
 return cuts.filter(p=>p.units).map(({role,slot,units})=>({role,slot,amount:Number((units*quantum).toFixed(4))}));
}
