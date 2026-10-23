import { neighbors } from '../model/world.js';
import { cellPoints } from '../model/cartography-geometry.js';
import { pointInShape } from '../model/cartography.js';
import { sharedFrontSegments } from './round-campaign.js';
import { esc } from './icons.js';
// Revealed incidents only. These decorative teeth never create adjacency or combat rules.
const seasonFrontCache=new WeakMap();
function frontTeeth(geometry,a,b){
 if(!seasonFrontCache.has(geometry))seasonFrontCache.set(geometry,new Map());
 const cache=seasonFrontCache.get(geometry),key=`${geometry.cells.indexOf(a)}:${geometry.cells.indexOf(b)}`;if(cache.has(key))return cache.get(key);
 const shape={points:cellPoints(a),holes:a.holes||[]},lines=[],teeth=[];
 for(const [p,q] of sharedFrontSegments(geometry,a,b)){
  const dx=q[0]-p[0],dy=q[1]-p[1],length=Math.hypot(dx,dy);if(length<.1)continue;
  let nx=-dy/length,ny=dx/length;
  const mid=[(p[0]+q[0])/2,(p[1]+q[1])/2];
  if(!pointInShape([mid[0]+nx*.2,mid[1]+ny*.2],shape)){nx=-nx;ny=-ny;}
  const offset=1.8,start=[p[0]+nx*offset,p[1]+ny*offset],end=[q[0]+nx*offset,q[1]+ny*offset];
  lines.push(`M${start} L${end}`);
  const count=Math.max(1,Math.floor(length/9));
  for(let i=0;i<count;i++){
   const t=(i+.5)/count,base=[start[0]+dx*t,start[1]+dy*t],tip=[base[0]+nx*4.5,base[1]+ny*4.5];
   if(pointInShape(base,shape)&&pointInShape(tip,shape))teeth.push({from:base,to:tip});
  }
 }
 const value={line:lines.join(' '),teeth};cache.set(key,value);return value;
}
export function seasonFronts(world,geometry,campaign){
 const affected=new Set([...campaign.captures.keys(),...(campaign.battleSites||[]).map(s=>s.territoryId)]),index=new Map(world.territories.map((t,i)=>[t.id,i])),fronts=[];
 for(const id of affected){
  const a=world.territories[index.get(id)];if(!a?.ownerId)continue;
  for(const b of neighbors(world,a)){
   if(!b.ownerId||b.ownerId===a.ownerId)continue;
   const cell=geometry.cells[index.get(id)],opposite=geometry.cells[index.get(b.id)],drawing=frontTeeth(geometry,cell,opposite);
   if(drawing.line)fronts.push({territoryId:id,neighborId:b.id,countryId:a.ownerId,cell,...drawing});
  }
 }
 return fronts;
}
export function renderSeasonFronts(world,geometry,campaign){
 const fronts=seasonFronts(world,geometry,campaign);if(!fronts.length)return '';
 return `<g class="season-fronts" pointer-events="none">${fronts.map((f,i)=>{const d=f.line+' '+f.teeth.map(t=>`M${t.from} L${t.to}`).join(' '),clip=`season-front-clip-${i}`,color=world.countries.find(c=>c.id===f.countryId)?.color||'#fff';return `<g class="season-front" data-front-territory="${esc(f.territoryId)}" data-front-neighbor="${esc(f.neighborId)}" data-front-owner="${esc(f.countryId)}"><defs><clipPath id="${clip}"><path d="${f.cell.path}" clip-rule="evenodd"/></clipPath></defs><g clip-path="url(#${clip})"><path class="season-front-shadow" d="${d}"/><path class="season-front-color" d="${d}" style="stroke:${color}"/></g></g>`;}).join('')}</g>`;
}
