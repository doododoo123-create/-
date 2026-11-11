import {neighbors} from '../model/world.js';
import {geometryFor,cellPoints,mapAnchor} from '../model/cartography-geometry.js';

// Only display coordinates are compressed; adjacency and engine distances stay intact.
const slotRows=count=>Math.min(8,Math.max(3,Math.ceil(Math.sqrt(count))));
export function regionalFieldLayout(plan,world){
 const geometry=geometryFor(world),ids=new Set(plan.territories.map(t=>t.id));
 const locations=world.territories.filter(t=>ids.has(t.id)).map(t=>{
  const [gx,gy]=mapAnchor(world,t.id,'reference',geometry);
  return {id:t.id,name:t.name,ownerId:t.ownerId,gx,gy};
 });
 const first=locations.find(t=>t.id===plan.regions?.[0]?.territoryId)||locations[0]||{gx:0,gy:0};
 const warp=(v,c)=>Math.sign(v-c)*Math.pow(Math.abs(v-c),.72);
 const xs=locations.map(t=>warp(t.gx,first.gx)),ys=locations.map(t=>warp(t.gy,first.gy));
 const loX=Math.min(0,...xs),hiX=Math.max(0,...xs),loY=Math.min(0,...ys),hiY=Math.max(0,...ys);
 const counts=new Map();for(const u of plan.units||[])counts.set(u.countryId,(counts.get(u.countryId)||0)+1);
 const count=Math.max(1,...counts.values()),rows=slotRows(count);
 const marginX=Math.max(160,58+Math.floor((count-1)/rows)*52+100),marginY=Math.max(135,rows*26+100);
 const width=1130+marginX*2,height=490+marginY*2;
 const scale=Math.min(1130/Math.max(hiX-loX,1),490/Math.max(hiY-loY,1));
 const ox=width/2-(loX+hiX)/2*scale,oy=height/2-(loY+hiY)/2*scale;
 const transform=(x,y)=>({x:ox+warp(x,first.gx)*scale,y:oy+warp(y,first.gy)*scale});
 // These are invisible focus targets, never enclosing territory boxes.
 const nodes=locations.map(t=>{const c=transform(t.gx,t.gy);return {...t,x:c.x-115,y:c.y-90,cx:c.x,cy:c.y,width:230,height:180};});
 const byId=new Map(nodes.map(n=>[n.id,n])),edges=[];
 for(const t of world.territories.filter(t=>ids.has(t.id)))for(const next of neighbors(world,t))if(ids.has(next.id)&&t.id<next.id)edges.push({from:t.id,to:next.id});
 const polygons=world.territories.map((t,i)=>({id:t.id,ownerId:t.ownerId,terrain:t.terrain,
  points:cellPoints(geometry.cells[i]).map(([x,y])=>transform(x,y)),
  holes:(geometry.cells[i].holes||[]).map(ring=>ring.map(([x,y])=>transform(x,y)))}));
 const occupied=[];
 for(const n of nodes){
  const w=Math.min(400,n.name.length*33+32);let box;
  for(const [dx,dy]of [[0,-42],[0,-85],[75,-55],[-75,-55],[0,105],[90,70]]){
   const x=Math.max(4,Math.min(width-w-4,n.cx+dx-w/2)),y=Math.max(30,Math.min(height-46,n.cy+dy-30));
   if(!occupied.some(b=>x<b.x+b.w&&x+w>b.x&&y<b.y+b.h&&y+42>b.y)){box={x,y,w,h:42};break;}
  }
  n.label=box||{x:n.cx-w/2,y:n.cy-65,w,h:42};occupied.push(n.label);
 }
 return {nodes,byId,edges,width,height,polygons,countries:world.countries};
}
export function regionalSlot(field,territoryId,unit,units,side=null){
 const n=field.byId.get(territoryId)||field.nodes[0];if(!n)return {x:field.width/2,y:field.height/2};
 const members=units.filter(u=>u.countryId===unit.countryId).sort((a,b)=>a.id.localeCompare(b.id));
 const i=Math.max(0,members.findIndex(u=>u.id===unit.id)),rows=slotRows(members.length),sign=(side||unit.side)==='attack'?-1:1;
 return {x:n.cx+sign*(58+Math.floor(i/rows)*52),y:n.cy+40+(i%rows-(rows-1)/2)*52};
}
