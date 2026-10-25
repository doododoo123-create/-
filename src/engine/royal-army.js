import { fieldPaths } from './field-command.js';
export const royalCapacity=(rules)=>Math.min(rules.capacityCap,rules.capitalReserveLimit??rules.capacityCap);
export function initializeRoyals(state,capitalCell,rules){for(const c of state.countries){const cap=capitalCell(state,c.id),troops=Math.min(c.reserve,royalCapacity(rules));c.reorganization=(c.reorganization||0)+c.reserve-troops;c.royal={slot:-1,role:'king',name:c.kingName,ability:c.kingAbility||0,commandBonus:0,troops,active:cap!==null,alive:true,appointed:true,waited:0,generation:0,station:cap,position:cap,stranded:false,wins:0,underdogWins:0,confusion:0};c.reserve=0;}}
export function ensureRoyals(state,capitalCell){for(const c of state.countries){const g=c.royal;if(!g)continue;const cap=capitalCell(state,c.id);g.station=cap;g.active=cap!==null;if(!g.active||!g.alive){g.position=null;if(!g.active)g.troops=0;continue;}if(!Number.isInteger(g.position)||state.cells[g.position]?.owner!==c.id)g.position=cap;}}
export function distributeFieldPool(state,id,amount,eligible,capacity,{randomInt=null,balanced=false}={}){
 const given=[];let pool=amount;
 while(pool>0){const list=eligible.filter(g=>g.active&&g.alive&&!g.stranded&&g.troops<capacity(state.countries[id],g));if(!list.length)break;
 const empty=list.find(g=>g.troops===0),g=empty||(balanced||!randomInt?list.sort((a,b)=>a.troops-b.troops||a.slot-b.slot)[0]:list[randomInt(state,list.length)]),gain=Math.min(1,pool,capacity(state.countries[id],g)-g.troops);g.troops=Number((g.troops+gain).toFixed(4));pool=Number((pool-gain).toFixed(4));const row=given.find(x=>x.slot===g.slot);if(row)row.amount+=gain;else given.push({slot:g.slot,role:g.role||'general',amount:gain});}
 return {remaining:pool,allocated:given};
}
export function royalDefender(state,atlas,nation,target,homeAvailable,radius,can){const g=state.countries[nation].royal;if(!g||!can(g))return null;const path=fieldPaths(state,atlas,nation,g.position).get(target);return path&&(g.position===target||g.station===target||!homeAvailable&&path.length-1<=radius)?{general:g,path,kind:g.position===target?'resident':g.station===target?'return':'relief'}:null;}
