import { V11_ATLAS } from '../data/v11-preset.js';
import { buildMapGeometry } from './map-geometry.js';
import { polygonCenter } from '../model/cartography.js';
const baseGeometryCache=new Map(),designedGeometryCache=new WeakMap();
export const polygonPath=points=>'M'+points.map(p=>p.join(',')).join(' L')+' Z';
export function geometryFor(world){
  const key=`${world.rows}:${world.cols}`;
  if(world.mapKind!=='v11'&&!baseGeometryCache.has(key))baseGeometryCache.set(key,buildMapGeometry(world.rows,world.cols));
  if(world.mapKind==='free'){if(designedGeometryCache.has(world))return designedGeometryCache.get(world);const cells=world.territories.map((t,i)=>{const shape=world.cartography.polygons[t.id];return {id:i,points:shape.points,path:polygonPath(shape.points),center:shape.center};});const geometry={width:1200,height:800,cells,coastPath:cells.map(c=>c.path).join(' ')};designedGeometryCache.set(world,geometry);return geometry;}
  const base=world.mapKind==='v11'?V11_ATLAS:baseGeometryCache.get(key),design=world.cartography;
  if(!design||!Object.keys(design.polygons).length)return base;
  if(designedGeometryCache.has(world))return designedGeometryCache.get(world);
  const cells=base.cells.map((cell,i)=>{const id=world.territories[i].id,shape=Object.hasOwn(design.polygons,id)?design.polygons[id]:null;return shape?{...cell,points:shape.points,path:polygonPath(shape.points),center:shape.center||polygonCenter(shape.points)}:cell;});
  const geometry={...base,cells,coastPath:cells.map(c=>c.path).join(' ')};
  designedGeometryCache.set(world,geometry);return geometry;
}
export function cellPoints(cell){return cell.points?.map(p=>[...p])||[...cell.path.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map(m=>[Number(m[1]),Number(m[2])]);}
// Shared coordinates produce one country boundary. User-drawn unmatched coast edges stay visible.
export function designedBorders(world,geometry){
  const edges=new Map();
  world.territories.forEach((t,i)=>{const points=cellPoints(geometry.cells[i]);for(let j=0;j<points.length;j++){const a=points[j],b=points[(j+1)%points.length],key=[a.map(n=>n.toFixed(2)).join(','),b.map(n=>n.toFixed(2)).join(',')].sort().join('|');if(!edges.has(key))edges.set(key,[]);edges.get(key).push({t,a,b});}});
  return [...edges.values()].filter(list=>list.length===1||list.some(e=>e.t.ownerId!==list[0].t.ownerId)).map(list=>({path:`M${list[0].a.join(',')} L${list[0].b.join(',')}`,ownerId:list[0].t.ownerId}));
}

export function territoryCell(world,geometry,territory){return geometry.cells[world.territories.findIndex(t=>t.id===territory?.id)];}
