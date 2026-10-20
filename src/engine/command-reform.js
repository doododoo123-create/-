// Explicit opt-in keeps historical campaigns and their random draws unchanged.
export function commandCapacity(country,general,rules,base){
 const experience=rules.commandReform?Math.floor(Math.min(rules.capacityWinCap,general.wins||0)/rules.capacityWinStep):0;
 const total=Math.max(1,base+country.commandBonus+general.commandBonus+country.supplyBonus+experience);
 return rules.commandReform?Math.min(rules.capacityCap,total):total;
}
export function commandRegionSlots(state,id,count,reform){
 if(!reform)return Array.from({length:count},(_,k)=>k);
 const country=state.countries[id],occupied=new Set(state.cells.filter(c=>c.owner===id&&Number.isInteger(c.commander)).map(c=>c.commander));
 // Keep incumbents, then use living veterans without land before creating a new post.
 return [...country.generals].sort((a,b)=>Number(occupied.has(b.slot))-Number(occupied.has(a.slot))||Number(b.appointed&&b.alive)-Number(a.appointed&&a.alive)||a.slot-b.slot).slice(0,count).map(g=>g.slot).sort((a,b)=>a-b);
}
