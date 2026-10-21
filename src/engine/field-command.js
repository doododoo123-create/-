import { scaledDistance } from '../model/map-scale.js';
// Authoritative field positions and paths. Coordinates and sea supply never enter these rules.
export function fieldPaths(state,atlas,countryId,start){
 const paths=new Map();if(!state.cells[start]||state.cells[start].owner!==countryId)return paths;
 paths.set(start,[start]);const queue=[start];
 for(let i=0;i<queue.length;i++)for(const next of atlas.cells[queue[i]].neighbors)if(state.cells[next].owner===countryId&&!paths.has(next)){paths.set(next,[...paths.get(queue[i]),next]);queue.push(next);}
 return paths;
}
export function expeditionRoute(state,atlas,countryId,general,targetId){
 const paths=fieldPaths(state,atlas,countryId,general.position);
 const fronts=atlas.cells[targetId].neighbors.filter(id=>paths.has(id));
 fronts.sort((a,b)=>paths.get(a).length-paths.get(b).length||a-b);
 if(!fronts.length)return null;const path=paths.get(fronts[0]);
 return {from:fronts[0],path,distance:path.length}; // Includes the final attack into the enemy territory.
}
export function expeditionChance(distance,rules){return rules.expeditionChances[Math.min(scaledDistance(distance,rules),rules.expeditionChances.length)-1];}
export function fieldDefense(state,atlas,countryId,homeGeneral,radius){
 const home=homeGeneral.station,canFight=g=>g.active&&g.alive&&g.troops>0;
 if(!canFight(homeGeneral))return {general:homeGeneral,blocked:false,relief:false,path:null,available:false};
 const path=fieldPaths(state,atlas,countryId,homeGeneral.position).get(home);
 if(path)return {general:homeGeneral,blocked:false,relief:false,path,available:true};
 const candidates=state.countries[countryId].generals.filter(g=>g!==homeGeneral&&canFight(g)).flatMap(g=>{
  const route=fieldPaths(state,atlas,countryId,g.position).get(home);
  return route&&route.length-1<=radius?[{general:g,path:route}]:[];
 }).sort((a,b)=>a.path.length-b.path.length||a.general.slot-b.general.slot);
 return candidates.length?{...candidates[0],blocked:true,relief:true,available:true}:{general:homeGeneral,blocked:true,relief:false,path:null,available:false};
}
