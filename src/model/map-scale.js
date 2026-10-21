// Explicit per-world settings; territory count never silently changes an existing campaign.
export const MAP_SCALE_DEFAULTS=Object.freeze({territoriesPerCommander:4,productionDivisor:1,distanceScale:1,adaptiveReserve:false});
export const CONTINENT160_RULES=Object.freeze({territoriesPerCommander:8,productionDivisor:2,distanceScale:1.5,adaptiveReserve:true,territoryArmyLimit:5,captureThresholds:[10,20]});
export const scaledProduction=(count,rules)=>Math.floor(count*rules.territoryProduction/(rules.productionDivisor||1));
export const scaledDistance=(distance,rules)=>Math.max(1,Math.ceil(distance/(rules.distanceScale||1)));
export function requiredReserve(state,id,rules){
 const base=rules.minimumReserve;if(!rules.adaptiveReserve)return base;
 const limit=state.cells.filter(c=>c.owner===id).length*rules.territoryArmyLimit;
 return Math.min(base,Math.max(1,Math.floor(limit/2)));
}
