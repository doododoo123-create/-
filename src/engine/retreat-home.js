import { fieldPaths } from './field-command.js';

// Retreat destination depends on ownership/assignments, never map artwork or RNG.
export function homeRetreatDestination(state,atlas,id,g,capital){
 const own=state.cells.filter(c=>c.owner===id);if(!own.length)return null;
 const personal=own.filter(c=>c.commander===g.slot).map(c=>c.id).sort((a,b)=>a-b);
 let to,reason;
 if(personal.length){to=personal.includes(g.station)?g.station:personal[0];reason='home';}
 else{
  const center=own.some(c=>c.id===capital)?capital:own[0].id;
  const nearby=atlas.cells[center].neighbors.filter(v=>state.cells[v].owner===id);
  const area=nearby.length?nearby:[center];
  const residents=v=>state.countries[id].generals.filter(p=>p!==g&&p.active&&p.alive&&p.position===v).length;
  area.sort((a,b)=>residents(a)-residents(b)||a-b);
  to=area.includes(g.station)?g.station:area[0];reason='capital';
 }
 const start=g.position,paths=fieldPaths(state,atlas,id,start);
 if(!paths.size&&Number.isInteger(start))for(const next of atlas.cells[start].neighbors)if(state.cells[next].owner===id){
  for(const [end,path] of fieldPaths(state,atlas,id,next))if(!paths.has(end)||paths.get(end).length>path.length+1)paths.set(end,[start,...path]);
 }
 const path=paths.get(to)||null;
 return {to,reason,path,relocation:!path};
}

// A relocation is an explicit recorded placement, not a legal road through enemy land.
export function applyHomeRetreat(state,atlas,id,g,capital){
 const destination=homeRetreatDestination(state,atlas,id,g,capital);if(!destination)return null;
 const from=g.position,{to,path,reason,relocation}=destination;
 const moves=Number.isInteger(from)&&from!==to?[{nation:id,slot:g.slot,generation:g.generation,kind:relocation?'redeploy':'retreat',from,to,path:path||[from,to]}]:[];
 g.position=to;g.station=to;g.stranded=false;
 return {moves,reason,relocation,to};
}
