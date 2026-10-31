import {fieldOfficers} from './war-readiness.js';
// Troops belong to their home supply region. Temporary battlefield movement does
// not change maintenance. Unassigned troops and the king belong to the capital.
export function regionalAccounts(state,id,rules,parts,capital){
 const c=state.countries[id],groups=parts.map(cells=>({cells:[...cells],central:cells.includes(capital),territories:cells.length,limit:cells.length*rules.territoryArmyLimit,total:0,parts:[]})),main=groups.find(g=>g.central),byCell=new Map(groups.flatMap(g=>g.cells.map(cell=>[cell,g])));
 const add=(group,role,slot,available)=>{if(!group||available<=0)return;group.total+=available;group.parts.push({role,slot,available});};
 add(main,'pool',null,c.reserve);add(main,'reorganization',null,c.reorganization||0);
 for(const officer of fieldOfficers(c)){const group=officer.role==='king'?main:byCell.get(officer.station)||main;add(group,officer.role||'general',officer.slot,officer.troops);}
 return groups.map(g=>({...g,total:Number(g.total.toFixed(4)),room:Math.max(0,Number((g.limit-g.total).toFixed(4))),excess:Math.max(0,Number((g.total-g.limit).toFixed(4)))}));
}
export function regionalRecruitRoom(state,id,rules,parts,capital){return regionalAccounts(state,id,rules,parts,capital).find(g=>g.central)?.room||0;}
