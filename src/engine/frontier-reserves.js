import { fieldPaths } from './field-command.js';
import { lostHomelands,homelandDistances } from './recovery-priority.js';
export function moveFrontierReserves(state,atlas,nation,emit){
 const country=state.countries[nation],noLand=g=>!state.cells.some(c=>c.owner===nation&&c.commander===g.slot),eligible=country.generals.filter(g=>g.active&&g.alive&&g.troops>=5&&noLand(g)),moved=new Set();
 const lost=lostHomelands(state,atlas,nation),distance=homelandDistances(atlas,lost);
 for(const g of eligible){
  const paths=fieldPaths(state,atlas,nation,g.position),front=state.cells.filter(c=>c.owner===nation&&paths.has(c.id)&&atlas.cells[c.id].neighbors.some(id=>state.cells[id].owner!==nation));if(!front.length)continue;
  if(front.some(c=>c.id===g.position)){moved.add(g.slot);continue;}
  const residents=id=>country.generals.filter(p=>p!==g&&p.active&&p.alive&&p.position===id).length;
  front.sort((a,b)=>(lost.length?(distance.get(a.id)??Infinity)-(distance.get(b.id)??Infinity):0)||residents(a.id)-residents(b.id)||Number(b.id===g.position)-Number(a.id===g.position)||paths.get(a.id).length-paths.get(b.id).length||a.id-b.id);
  const to=front[0].id,from=g.position;moved.add(g.slot);if(to===from)continue;const path=paths.get(to);g.position=to;g.stranded=false;
  emit('frontier_reserve',g.name+' · 전선 대기','관할 영지가 없는 병력 5만 이상 지휘관을 접경으로 배치했어.',{nation,slot:g.slot,role:'general',moves:[{nation,slot:g.slot,generation:g.generation,kind:'frontier',from,to,path}]},true);
 }
 // Eligible officers with no reachable frontier stay put rather than marching home and back.
 eligible.forEach(g=>moved.add(g.slot));return moved;
}
