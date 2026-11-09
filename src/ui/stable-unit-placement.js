import {pointInShape} from '../model/cartography.js';
import {cellPoints,mapAnchor} from '../model/cartography-geometry.js';
import {atlasGeometry} from './atlas-cache.js';
const stableLandCache=new WeakMap();
// Slots depend on identity/territory, never the other currently visible cards.
// A small province may have tightly packed units; avoiding overlap must never
// push their centers out to sea or move a bystander when another unit arrives.
export function stableUnitGround(world,person,territoryId,geometry=atlasGeometry(world)){
 const index=world.territories.findIndex(t=>t.id===territoryId),cell=geometry.cells[index];
 if(!cell)return mapAnchor(world,territoryId,'station',geometry);
 let cache=stableLandCache.get(geometry);if(!cache){cache=new Map();stableLandCache.set(geometry,cache);}
 const anchor=mapAnchor(world,territoryId,'station',geometry),key=territoryId+':'+anchor.join(',');
 let points=cache.get(key);
 if(!points){const ring=cellPoints(cell),shape={points:ring,holes:cell.holes||[]},xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]),left=Math.min(...xs),top=Math.min(...ys),width=Math.max(...xs)-left,height=Math.max(...ys)-top;
  const candidates=[];for(let y=1;y<12;y++)for(let x=1;x<12;x++){const p=[left+width*x/12,top+height*y/12];if(pointInShape(p,shape))candidates.push(p);}
  candidates.sort((a,b)=>Math.hypot(a[0]-anchor[0],a[1]-anchor[1])-Math.hypot(b[0]-anchor[0],b[1]-anchor[1])||a[1]-b[1]||a[0]-b[0]);
  points=[anchor,...candidates.filter(p=>Math.hypot(p[0]-anchor[0],p[1]-anchor[1])>.1)];cache.set(key,points);
 }
 const slot=person?.role==='king'?0:Math.max(0,(person?.slot??0)+1),stride=Math.max(1,Math.floor(Math.min(24,points.length)/8));
 return [...points[Math.min(points.length-1,slot*stride)]];
}
