import { esc } from './icons.js';
import { cellPoints, mapAnchor } from '../model/cartography-geometry.js';
// Every wipe is clipped to an existing territory; it cannot change ownership.
export function captureFlow(world,geometry,capture,index){
 const cell=geometry.cells[index],center=mapAnchor(world,capture.territoryId,'reference',geometry),from=mapAnchor(world,capture.fromId,'reference',geometry)||[center[0]-1,center[1]];
 const angle=Math.atan2(center[1]-from[1],center[0]-from[0]),cos=Math.cos(angle),sin=Math.sin(angle);
 const points=cellPoints(cell),xs=points.map(p=>p[0]*cos+p[1]*sin),ys=points.map(p=>-p[0]*sin+p[1]*cos),min=Math.min(...xs)-16,top=Math.min(...ys)-16,span=Math.max(...xs)-min+16,height=Math.max(...ys)-top+16;
 const bx=Math.min(...points.map(p=>p[0]))-16,by=Math.min(...points.map(p=>p[1]))-16,bw=Math.max(...points.map(p=>p[0]))-bx+16,bh=Math.max(...points.map(p=>p[1]))-by+16;
 return {bounds:{x:bx,y:by,width:bw,height:bh},id:'capture-flow-'+index,angle:angle*180/Math.PI,min,top,span,height,path:cell.path};
}
export function captureFlowDefs(world,geometry,campaign){
 const active=[...campaign.captures.values()].filter(c=>c.revealing||campaign.settling);
 if(!active.length)return '';
 const flows=active.map((c,order)=>({...captureFlow(world,geometry,c,world.territories.findIndex(t=>t.id===c.territoryId)),fromId:c.fromId,index:world.territories.findIndex(t=>t.id===c.territoryId),order:campaign.settling?order:c.sequenceIndex||0,count:campaign.settling?active.length:c.sequenceCount||1}));
 const nx=Math.min(...flows.map(f=>f.bounds.x)),ny=Math.min(...flows.map(f=>f.bounds.y)),nw=Math.max(...flows.map(f=>f.bounds.x+f.bounds.width))-nx,nh=Math.max(...flows.map(f=>f.bounds.y+f.bounds.height))-ny;
 return `<defs>${flows.map(f=>`<clipPath id="${f.id}" clipPathUnits="userSpaceOnUse"><path d="" fill-rule="evenodd" clip-rule="evenodd" data-front-wave="${f.index}" data-wave-from="${esc(f.fromId||'')}" data-wave-order="${f.order}" data-wave-count="${f.count}" data-wipe-span="${f.span}" width="0"/></clipPath><mask id="${f.id}-remaining" maskUnits="userSpaceOnUse" x="${f.bounds.x}" y="${f.bounds.y}" width="${f.bounds.width}" height="${f.bounds.height}"><rect x="${f.bounds.x}" y="${f.bounds.y}" width="${f.bounds.width}" height="${f.bounds.height}" fill="white"/><path d="${f.path}" fill="black" clip-path="url(#${f.id})"/></mask>`).join('')}
 <mask id="capture-border-old" maskUnits="userSpaceOnUse" x="-16" y="-16" width="${(geometry.width||1200)+32}" height="${(geometry.height||800)+32}"><rect x="-16" y="-16" width="${(geometry.width||1200)+32}" height="${(geometry.height||800)+32}" fill="white"/>${flows.map(f=>`<path d="${f.path}" fill="black" stroke="black" stroke-width="14" clip-path="url(#${f.id})"/>`).join('')}</mask>
 <mask id="capture-border-new" maskUnits="userSpaceOnUse" x="${nx}" y="${ny}" width="${nw}" height="${nh}"><rect x="${nx}" y="${ny}" width="${nw}" height="${nh}" fill="black"/>${flows.map(f=>`<path d="${f.path}" fill="white" stroke="white" stroke-width="14" clip-path="url(#${f.id})"/>`).join('')}</mask></defs>`;
}
export function captureLayerAttributes(capture,index,campaign){return campaign.settling?`mask="url(#capture-flow-${index}-remaining)"`:capture.revealing?`clip-path="url(#capture-flow-${index})"`:'';}

export function renderCaptureWaves(world,geometry,campaign){
 return `<g class="moving-capture-front" pointer-events="none">${[...campaign.captures.values()].filter(c=>c.revealing||campaign.settling).map(c=>{const index=world.territories.findIndex(t=>t.id===c.territoryId),color=world.countries.find(n=>n.id===c.ownerId)?.color||'#fff';return `<defs><clipPath id="front-land-${index}"><path d="${geometry.cells[index].path}" clip-rule="evenodd"/></clipPath></defs><g clip-path="url(#front-land-${index})"><path class="moving-front-shadow" data-wave-line="${index}" fill="none"/><path class="moving-front-color" data-wave-line="${index}" fill="none" stroke="${color}"/>${campaign.settling?`<path class="settlement-highlight" data-wave-glow="${index}" d="${geometry.cells[index].path}" fill="${color}" stroke="${color}" fill-rule="evenodd" opacity="0"/>`:''}</g>`;}).join('')}</g>`;
}
