import { geometryFor, designedBorders } from '../model/cartography-geometry.js';
import { mobileProfile } from './performance-profile.js';
// Projected playback frames share immutable cartography. Ownership changes only invalidate borders.
const mobileGeometryCache=new WeakMap(),mobileBorderCache=new WeakMap();
export function atlasGeometry(world){
 if(!mobileProfile())return geometryFor(world);
 const key=world.cartography?.polygons||world,signature=JSON.stringify([world.mapKind,world.rows,world.cols,world.territories.map(t=>t.id)]),entry=mobileGeometryCache.get(key);
 if(entry?.signature===signature)return entry.geometry;
 const geometry=geometryFor(world);mobileGeometryCache.set(key,{signature,geometry});return geometry;
}
export function atlasBorders(world,geometry){
 if(!mobileProfile())return designedBorders(world,geometry);
 const signature=JSON.stringify(world.territories.map(t=>t.ownerId)),entry=mobileBorderCache.get(geometry);
 if(entry?.signature===signature)return entry.edges;
 const edges=designedBorders(world,geometry);mobileBorderCache.set(geometry,{signature,edges});return edges;
}
