import { expeditionRoute } from './field-command.js';
export function lostHomelands(state,atlas,nation){return state.cells.filter(c=>atlas.cells[c.id].owner===nation&&c.owner!==nation).map(c=>c.id);}
export function homelandDistances(atlas,targets){const distances=new Map(targets.map(id=>[id,0])),queue=[...targets];for(let i=0;i<queue.length;i++)for(const id of atlas.cells[queue[i]].neighbors)if(!distances.has(id)){distances.set(id,distances.get(queue[i])+1);queue.push(id);}return distances;}
export function recoveryNationCandidates(state,atlas,nation,candidates){
 const lost=lostHomelands(state,atlas,nation);if(!lost.length)return [];
 const paths=state.countries[nation].generals.filter(g=>g.active&&g.alive&&g.troops>0&&!g.stranded),distance=homelandDistances(atlas,lost);
 const ranked=candidates.map(target=>{const reachable=state.cells.filter(c=>c.owner===target&&paths.some(g=>expeditionRoute(state,atlas,nation,g,c.id)));return {target,recoverable:reachable.filter(c=>atlas.cells[c.id].owner===nation).length,lost:lost.filter(id=>state.cells[id].owner===target).length,distance:Math.min(Infinity,...reachable.map(c=>distance.get(c.id)??Infinity))};}).filter(r=>Number.isFinite(r.distance));
 const direct=ranked.some(r=>r.recoverable>0);ranked.sort((a,b)=>Number(b.recoverable>0)-Number(a.recoverable>0)||(direct?b.lost-a.lost:a.distance-b.distance)||(direct?a.distance-b.distance:b.lost-a.lost)||a.target-b.target);
 if(!ranked.length)return [];const best=ranked[0];return ranked.filter(r=>Number(r.recoverable>0)===Number(best.recoverable>0)&&r.lost===best.lost&&r.distance===best.distance);
}
export function recoveryTerritoryCandidates(state,atlas,nation,candidates){
 const lost=lostHomelands(state,atlas,nation);if(!lost.length)return candidates;
 const direct=candidates.filter(id=>atlas.cells[id].owner===nation);if(direct.length)return direct;
 const distance=homelandDistances(atlas,lost),nearest=Math.min(...candidates.map(id=>distance.get(id)??Infinity));return candidates.filter(id=>(distance.get(id)??Infinity)===nearest);
}
