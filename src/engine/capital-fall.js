// A captured capital annexes only the former owner's immediate land neighbors.
// Snapshot candidates before conquest: a relocated capital never chains within this battle.
export function capitalFall(s,atlas,b,rules,capitalsBefore,ownersBefore){
 if(!rules.capitalFallAnnexation||!b.takenCells.length||b.winner===null)return null;
 const winner=b.captureOwner??b.actor,loser=winner===b.actor?b.target:b.actor,capital=capitalsBefore[loser];
 if(!Number.isInteger(capital)||!b.takenCells.includes(capital)||ownersBefore[capital]!==loser)return null;
 const neighbors=atlas.cells[capital].neighbors.filter(id=>ownersBefore[id]===loser),extra=[];
 for(const id of neighbors)if(s.cells[id].owner===loser){s.cells[id].owner=winner;s.cells[id].commander=winner===b.actor?b.slot:b.defenseSlot;extra.push(id);}
 b.takenCells=[...new Set([...b.takenCells,...extra])];
 const fall={nation:loser,captor:winner,capital,neighbors:[...neighbors],extraCells:extra};b.capitalFall=fall;return fall;
}
