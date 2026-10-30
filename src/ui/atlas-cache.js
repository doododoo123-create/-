import { geometryFor, designedBorders } from '../model/cartography-geometry.js';
// Check coordinates as well as IDs: editor changes and undo must invalidate it.
const atlasGeometryCache=new WeakMap(),atlasBorderCache=new WeakMap();
function sameRing(a,b){return a===undefined?b===undefined:!!b&&a.length===b.length&&a.every((p,i)=>p.length===b[i].length&&p.every((n,j)=>Object.is(n,b[i][j])));}
function geometrySnapshot(world){
 return {kind:world.mapKind,rows:world.rows,cols:world.cols,cells:world.territories.map(t=>{const p=world.cartography?.polygons?.[t.id];return {id:t.id,points:p?.points?.map(p=>[...p]),holes:p?.holes?.map(r=>r.map(p=>[...p])),center:p?.center?[...p.center]:undefined};})};
}
function matchesGeometry(world,snapshot){
 if(snapshot.kind!==world.mapKind||snapshot.rows!==world.rows||snapshot.cols!==world.cols||snapshot.cells.length!==world.territories.length)return false;
 return world.territories.every((t,i)=>{const a=snapshot.cells[i],p=world.cartography?.polygons?.[t.id];return a.id===t.id&&sameRing(a.points,p?.points)&&(a.holes===undefined?p?.holes===undefined:!!p?.holes&&a.holes.length===p.holes.length&&a.holes.every((r,j)=>sameRing(r,p.holes[j])) )&&(a.center===undefined?p?.center===undefined:!!p?.center&&a.center.length===p.center.length&&a.center.every((v,j)=>Object.is(v,p.center[j])));});
}
export function atlasGeometry(world){
 const key=world.cartography?.polygons||world,entry=atlasGeometryCache.get(key);
 if(entry&&matchesGeometry(world,entry.snapshot))return entry.geometry;
 const geometry=geometryFor({...world});atlasGeometryCache.set(key,{snapshot:geometrySnapshot(world),geometry});return geometry;
}
export function atlasBorders(world,geometry){
 const signature=JSON.stringify(world.territories.map(t=>[t.id,t.ownerId]));
 let cache=atlasBorderCache.get(geometry);if(!cache){cache=new Map();atlasBorderCache.set(geometry,cache);}
 if(cache.has(signature)){const edges=cache.get(signature);cache.delete(signature);cache.set(signature,edges);return edges;}
 const edges=designedBorders(world,geometry);cache.set(signature,edges);if(cache.size>8)cache.delete(cache.keys().next().value);return edges;
}
