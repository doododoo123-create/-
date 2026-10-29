import { geometryFor, designedBorders } from '../model/cartography-geometry.js';
// Check coordinates as well as IDs: editor changes and undo must invalidate it.
const atlasGeometryCache=new WeakMap(),atlasBorderCache=new WeakMap();
export function atlasGeometry(world){
 const key=world.cartography?.polygons||world,signature=JSON.stringify([world.mapKind,world.rows,world.cols,world.territories.map(t=>[t.id,key[t.id]?.points,key[t.id]?.holes,key[t.id]?.center])]),entry=atlasGeometryCache.get(key);
 if(entry?.signature===signature)return entry.geometry;
 const geometry=geometryFor({...world});atlasGeometryCache.set(key,{signature,geometry});return geometry;
}
export function atlasBorders(world,geometry){
 const signature=JSON.stringify(world.territories.map(t=>[t.id,t.ownerId]));
 let cache=atlasBorderCache.get(geometry);if(!cache){cache=new Map();atlasBorderCache.set(geometry,cache);}
 if(cache.has(signature)){const edges=cache.get(signature);cache.delete(signature);cache.set(signature,edges);return edges;}
 const edges=designedBorders(world,geometry);cache.set(signature,edges);if(cache.size>8)cache.delete(cache.keys().next().value);return edges;
}
