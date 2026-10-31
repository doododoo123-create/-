// Current editor policy only. Historic initial worlds retain their original rule.
export function landSupplyWorld(world){return {...world,rules:{...world.rules,seaSupply:false}};}
