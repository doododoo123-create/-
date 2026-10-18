import { V11_ATLAS } from '../data/v11-preset.js';
import { buildMapGeometry } from './map-geometry.js';
import { polygonCenter } from '../model/cartography.js';
const baseGeometryCache=new Map(),designedGeometryCache=new WeakMap();
export const polygonPath=(points,holes=[])=>[points,...holes].map(ring=>'M'+ring.map(p=>p.join(',')).join(' L')+' Z').join(' ');
export function geometryFor(world){
  const key=`${world.rows}:${world.cols}`;
  if(world.mapKind!=='v11'&&!baseGeometryCache.has(key))baseGeometryCache.set(key,buildMapGeometry(world.rows,world.cols));
  if(world.mapKind==='free'){if(designedGeometryCache.has(world))return designedGeometryCache.get(world);const cells=world.territories.map((t,i)=>{const shape=world.cartography.polygons[t.id];return {id:i,points:shape.points,path:polygonPath(shape.points,shape.holes),...(shape.holes?{holes:shape.holes}:{}),center:shape.center};});const geometry={width:1200,height:800,cells,coastPath:cells.map(c=>c.path).join(' ')};designedGeometryCache.set(world,geometry);return geometry;}
  const base=world.mapKind==='v11'?V11_ATLAS:baseGeometryCache.get(key),design=world.cartography;
  if(!design||!Object.keys(design.polygons).length)return base;
  if(designedGeometryCache.has(world))return designedGeometryCache.get(world);
  const cells=base.cells.map((cell,i)=>{const id=world.territories[i].id,shape=Object.hasOwn(design.polygons,id)?design.polygons[id]:null;return shape?{...cell,points:shape.points,path:polygonPath(shape.points,shape.holes),...(shape.holes?{holes:shape.holes}:{}),center:shape.center||polygonCenter(shape.points)}:cell;});
  const geometry={...base,cells,coastPath:cells.map(c=>c.path).join(' ')};
  designedGeometryCache.set(world,geometry);return geometry;
}
export function cellPoints(cell){return cell.points?.map(p=>[...p])||[...cell.path.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map(m=>[Number(m[1]),Number(m[2])]);}
// Shared coordinates produce one country boundary. User-drawn unmatched coast edges stay visible.
export function designedBorders(world,geometry){
  // Split collinear overlaps at shared endpoints. Long and short versions of the
  // same edge must not create false country borders in generated maps.
  const lines=new Map(),exact=new Map(),output=[];
  world.territories.forEach((t,i)=>{const cell=geometry.cells[i];for(const points of [cellPoints(cell),...(cell.holes||[])])for(let j=0;j<points.length;j++){
    const a=points[j],b=points[(j+1)%points.length],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);if(!length)continue;
    let nx=-dy/length,ny=dx/length;if(nx<-.000001||Math.abs(nx)<.000001&&ny<0){nx=-nx;ny=-ny;}const c=nx*a[0]+ny*a[1],key=`${nx.toFixed(5)}:${ny.toFixed(5)}:${c.toFixed(2)}`,axis=Math.abs(dx)>=Math.abs(dy)?0:1;
    const edge={t,a,b,axis,lo:Math.min(a[axis],b[axis]),hi:Math.max(a[axis],b[axis])};const edgeKey=[a.join(','),b.join(',')].sort().join('|');if(!exact.has(edgeKey))exact.set(edgeKey,[]);exact.get(edgeKey).push({...edge,lineKey:key});
  }});
  for(const edges of exact.values()){if(edges.length>1){if(edges.some(e=>e.t.ownerId!==edges[0].t.ownerId))output.push({path:`M${edges[0].a.join(',')} L${edges[0].b.join(',')}`,ownerId:edges[0].t.ownerId});}else{const e=edges[0];if(!lines.has(e.lineKey))lines.set(e.lineKey,[]);lines.get(e.lineKey).push(e);}}
  for(const edges of lines.values()){
    const cuts=[...new Set(edges.flatMap(e=>[e.lo,e.hi]))].sort((a,b)=>a-b);
    for(let i=1;i<cuts.length;i++){const lo=cuts[i-1],hi=cuts[i];if(hi-lo<.0001)continue;const middle=(lo+hi)/2,cover=edges.filter(e=>middle>=e.lo-.0001&&middle<=e.hi+.0001);if(!cover.length||cover.length>1&&cover.every(e=>e.t.ownerId===cover[0].t.ownerId))continue;
      const edge=cover[0],at=v=>{const f=(v-edge.a[edge.axis])/(edge.b[edge.axis]-edge.a[edge.axis]);return edge.a.map((n,k)=>Math.round((n+(edge.b[k]-n)*f)*1000)/1000);};
      output.push({path:`M${at(lo).join(',')} L${at(hi).join(',')}`,ownerId:edge.t.ownerId});
    }
  }return output;
}

export function territoryCell(world,geometry,territory){return geometry.cells[world.territories.findIndex(t=>t.id===territory?.id)];}
