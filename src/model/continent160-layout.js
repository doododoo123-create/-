import { synchronizeDeployment } from './deployment.js';
import { CONTINENT160_CELLS } from '../data/continent160-map.js';
import { CONTINENT160_NAMES } from '../data/continent160-names.js';
import { clone, validateWorld, landCount } from './world.js';
import { mapAnchor } from './cartography-geometry.js';
import { shapeAnchor } from './cartography.js';
import { ADDITIVE_COMBAT_DEFAULTS } from './combat-rules.js';
import { CONTINENT160_RULES } from './map-scale.js';
// Deterministic, connected country territories. No simulation RNG or source script is used.
export function continentOwners(world,cells=CONTINENT160_CELLS){
 const countries=world.countries;if(!countries.length)return cells.map(()=>null);
 const index=new Map(cells.map((t,i)=>[t.id,i])),links=cells.map(t=>t.neighbors.map(id=>index.get(id)));
 const used=new Set(),seeds=countries.map((c,i)=>{
  const fallback=[600+430*Math.cos(i*Math.PI*2/countries.length),400+260*Math.sin(i*Math.PI*2/countries.length)];
  const origin=mapAnchor(world,c.capitalId)||fallback;
  const candidates=cells.map((t,k)=>({k,d:Math.hypot(t.center[0]-origin[0],t.center[1]-origin[1])})).filter(v=>!used.has(v.k)).sort((a,b)=>a.d-b.d||a.k-b.k);
  const spacious=candidates.filter(v=>links[v.k].length>=3&&![...used].some(seed=>links[seed].includes(v.k)||links[seed].some(n=>links[n].includes(v.k))));
  const best=(spacious.length?spacious:candidates)[0].k;used.add(best);return best;
 });
 const sizes=countries.map(c=>landCount(world,c.id)),total=sizes.reduce((a,b)=>a+b,0),targets=sizes.map(n=>Math.max(1,total?cells.length*n/total:cells.length/countries.length));
 const bias=countries.map(()=>0),locked=new Map(seeds.map((id,c)=>[id,c]));let best=null,bestError=Infinity;
 for(let iteration=0;iteration<90;iteration++){
  const owner=cells.map(()=>-1),distance=cells.map(()=>Infinity),todo=seeds.map((id,c)=>({id,c,d:-bias[c]}));
  while(todo.length){todo.sort((a,b)=>a.d-b.d||a.c-b.c||a.id-b.id);const v=todo.shift();if(v.d>=distance[v.id]||locked.has(v.id)&&locked.get(v.id)!==v.c)continue;owner[v.id]=v.c;distance[v.id]=v.d;
   for(const id of links[v.id]){if(locked.has(id)&&locked.get(id)!==v.c)continue;const d=v.d+Math.hypot(cells[id].center[0]-cells[v.id].center[0],cells[id].center[1]-cells[v.id].center[1]);if(d<distance[id])todo.push({id,c:v.c,d});}
  }
  const counts=countries.map((_,c)=>owner.filter(n=>n===c).length),error=counts.reduce((n,count,c)=>n+(count-targets[c])**2,0);
  if(error<bestError){bestError=error;best=[...owner];}if(error<1)break;
  counts.forEach((count,c)=>bias[c]+=(targets[c]-count)*1.6/(1+iteration/25));
 }
 // Balance frontier cells while preserving each country's connected interior and capital seed.
 const counts=countries.map((_,c)=>best.filter(n=>n===c).length);
 const removable=(id,c)=>{const rest=best.map((owner,k)=>owner===c&&k!==id?k:-1).filter(k=>k>=0);if(!rest.length)return false;const seen=new Set([rest[0]]),queue=[rest[0]];for(let k=0;k<queue.length;k++)for(const n of links[queue[k]])if(n!==id&&best[n]===c&&!seen.has(n)){seen.add(n);queue.push(n);}return seen.size===rest.length;};
 for(let step=0;step<cells.length*2;step++){
  let move=null,benefit=0;
  for(let id=0;id<cells.length;id++){const from=best[id];if(locked.has(id))continue;for(const to of new Set(links[id].map(n=>best[n]).filter(c=>c!==from))){const gain=(counts[from]-targets[from])**2+(counts[to]-targets[to])**2-(counts[from]-1-targets[from])**2-(counts[to]+1-targets[to])**2;if(gain>benefit+.001&&removable(id,from)){benefit=gain;move={id,from,to};}}}
  if(!move)break;best[move.id]=move.to;counts[move.from]--;counts[move.to]++;
 }
 if(best.some(c=>c<0))throw Error('지도 인접 관계에 국가를 배정할 수 없는 고립 영토가 있습니다.');
 return best.map(c=>countries[c].id);
}
export function continent160Layout(input){
 const world=clone(input),owners=continentOwners(world);world.mapKind='free';
 world.cartography={version:1,style:'illustrated',plate:'continent160',opacity:.18,background:null,polygons:{},links:[]};
 world.territories=CONTINENT160_CELLS.map((t,i)=>{const shape={points:clone(t.points)};shape.center=shapeAnchor(shape.points,[],t.center);world.cartography.polygons[t.id]=shape;return {id:t.id,name:CONTINENT160_NAMES[t.id],ownerId:owners[i],terrain:t.terrain};});
 world.cartography.links=CONTINENT160_CELLS.flatMap(t=>t.neighbors.filter(id=>t.id<id).map(id=>[t.id,id]));
 for(const c of world.countries){const own=world.territories.filter(t=>t.ownerId===c.id),old=mapAnchor(input,c.capitalId)||[600,400];c.capitalId=own.sort((a,b)=>{const p=world.cartography.polygons[a.id].center,q=world.cartography.polygons[b.id].center;return Math.hypot(p[0]-old[0],p[1]-old[1])-Math.hypot(q[0]-old[0],q[1]-old[1]);})[0]?.id||null;}
 if(world.rules.battleMode==='v11')world.people.forEach(p=>{if(p.role==='general')p.ability*=2;});
 world.rules={...world.rules,...clone(ADDITIVE_COMBAT_DEFAULTS),...clone(CONTINENT160_RULES)};
 const preserved=Object.fromEntries(['recoveryPriority','underdogExperience','frontierReserves','continuousCampaign','routDeath','strategicTargets'].filter(k=>typeof input.rules[k]==='boolean').map(k=>[k,input.rules[k]]));Object.assign(world.rules,preserved);if(input.rules.underdogExperience)for(const key of ['experienceWinStep','experiencePerWin','experienceCap'])world.rules[key]=input.rules[key];
 return validateWorld(synchronizeDeployment(world,input));
}
