import {fieldPaths,expeditionRoute} from './field-command.js';

export const DEFAULT_FRONT_RADIUS=2;
// A contact is an (own province, enemy province) pair. Interior friendly roads
// never join contacts: BOTH sides must be equal or adjacent along the border.
export function borderFronts(state,atlas,actor,opponent,radius=DEFAULT_FRONT_RADIUS){
 const edges=[];
 for(const cell of state.cells)if(cell.owner===actor)for(const id of atlas.cells[cell.id].neighbors)if(state.cells[id].owner===opponent)edges.push({own:cell.id,enemy:id});
 edges.sort((a,b)=>a.own-b.own||a.enemy-b.enemy);
 const adjacent=(a,b)=>a===b||atlas.cells[a].neighbors.includes(b),links=edges.map(()=>[]);
 for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++)if(adjacent(edges[i].own,edges[j].own)&&adjacent(edges[i].enemy,edges[j].enemy)){links[i].push(j);links[j].push(i);}
 const remaining=new Set(edges.map((_,i)=>i)),fronts=[];
 while(remaining.size){
  const seed=remaining.values().next().value,queue=[[seed,0]],selected=new Set([seed]);remaining.delete(seed);
  for(let i=0;i<queue.length;i++){const [at,distance]=queue[i];if(distance>=radius)continue;for(const next of links[at])if(remaining.has(next)){selected.add(next);remaining.delete(next);queue.push([next,distance+1]);}}
  const contacts=[...selected].map(i=>edges[i]),enemyIds=new Set(contacts.map(e=>e.enemy)),ownIds=new Set(contacts.map(e=>e.own));
  fronts.push({id:`front-${state.turns}-${actor}-${opponent}-${fronts.length}`,name:(atlas.cells[edges[seed].enemy].name||'제'+(fronts.length+1))+' 전선',actor,opponent,radius,contacts,enemyIds,ownIds,captured:new Set(),focus:edges[seed].enemy});
 }
 return fronts;
}

export function planFrontOperations(state,atlas,actor,opponent,generals,forced={},radius=DEFAULT_FRONT_RADIUS){
 const fronts=borderFronts(state,atlas,actor,opponent,radius),assignments=new Map(),assignedCount=new Map();
 for(const g of [...generals].sort((a,b)=>a.slot-b.slot)){
  const choices=fronts.flatMap(front=>{const routes=[...front.enemyIds].flatMap(id=>{if(forced[g.slot]!==undefined&&id!==forced[g.slot])return [];const route=expeditionRoute(state,atlas,actor,g,id);return route?[route.distance]:[];});return routes.length?[{front,distance:Math.min(...routes)}]:[];});
  choices.sort((a,b)=>a.distance-b.distance||(assignedCount.get(a.front.id)||0)-(assignedCount.get(b.front.id)||0)||fronts.indexOf(a.front)-fronts.indexOf(b.front));
  if(choices.length){const front=choices[0].front;assignments.set(g.slot,front);assignedCount.set(front.id,(assignedCount.get(front.id)||0)+1);}
 }
 const initialOwners=new Map();for(const front of fronts)for(const id of front.enemyIds){if(!initialOwners.has(id))initialOwners.set(id,new Set());initialOwners.get(id).add(front.id);}
 const targets=(slot,candidates)=>{
  const front=assignments.get(slot);if(!front)return [];
  const distance=new Map([[front.focus,0]]),queue=[front.focus];
  for(let i=0;i<queue.length;i++){const at=queue[i],d=distance.get(at);if(d>=front.radius)continue;for(const next of atlas.cells[at].neighbors)if(!distance.has(next)&&(state.cells[next].owner===opponent||front.captured.has(next))){distance.set(next,d+1);queue.push(next);}}
  return candidates.filter(id=>state.cells[id].owner===opponent&&distance.has(id)&&(!initialOwners.has(id)||initialOwners.get(id).has(front.id))&&atlas.cells[id].neighbors.some(n=>state.cells[n].owner===actor&&(front.ownIds.has(n)||front.captured.has(n))));
 };
 const advance=(slot,id)=>{const front=assignments.get(slot);if(front){front.captured.add(id);front.ownIds.add(id);front.focus=id;}};
 return {fronts,assignments,targets,advance};
}

// A formed group travels and gathers as one unit. The ordinary two-officer
// placement rule is restored only when its recorded release begins.
export function coLocatedPlans(state,atlas,nation,members,centre){
 return members.map(g=>{const path=fieldPaths(state,atlas,nation,g.position).get(centre);if(!path)throw Error('집결지까지 연결된 자국 육지 경로가 없습니다.');return {g,path};});
}
