export function deploymentUnchanged(state,id){const lock=state.countries[id].deploymentLock;if(!lock)return false;const own=state.cells.filter(c=>c.owner===id).map(c=>c.id);return own.length===lock.length&&own.every((v,i)=>v===lock[i]);}
export function applyInitialDeployment(state,plan){
 const nations=new Set((plan||[]).map(e=>e.nation));
 for(const id of nations){
  const c=state.countries[id],entries=plan.filter(e=>e.nation===id);c.deploymentLock=state.cells.filter(c=>c.owner===id).map(c=>c.id);
  for(const g of c.generals){g.active=false;g.appointed=false;g.station=null;g.position=null;}
  for(const e of entries){const g=c.generals[e.slot];g.active=true;g.appointed=true;g.station=e.station;g.position=e.position;g.stranded=false;for(const cell of e.territories)state.cells[cell].commander=g.slot;}
 }
}
