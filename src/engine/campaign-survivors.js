import {fieldOfficers} from './war-readiness.js';
import {distributeFieldPool} from './royal-army.js';
// Transfers surviving soldiers, never recruits them. Overflow waits outside the capital reserve.
export function reorganizeSurvivors(state,id,rules,capacity,minimumReserve){
 const c=state.countries[id];if(c.royal){const before=c.reorganization||0,result=distributeFieldPool(state,id,before,fieldOfficers(c),capacity);c.reorganization=result.remaining;return {transferred:before-result.remaining,waiting:result.remaining,allocated:result.allocated};}
 const before=c.reorganization||0,allocated=[];let pool=before;
 const reserve=(amount)=>{const n=Math.max(0,Math.min(pool,amount));c.reserve+=n;pool-=n;};
 reserve(Math.max(0,Math.min(rules.capitalReserveLimit??Infinity,minimumReserve)-c.reserve));
 for(const g of c.generals.filter(g=>g.active&&g.alive).sort((a,b)=>a.troops-b.troops||a.slot-b.slot)){
  const n=Math.max(0,Math.min(pool,capacity(c,g)-g.troops));if(n){g.troops+=n;pool-=n;allocated.push({slot:g.slot,amount:n});}
 }
 reserve(Math.max(0,(rules.capitalReserveLimit??minimumReserve)-c.reserve));
 if(before||c.reorganization!==undefined)c.reorganization=pool;
 return {transferred:before-pool,waiting:pool,allocated};
}
