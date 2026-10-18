import { clone, newId, neighbors, validateWorld } from './world.js';
import { defaultCartography, polygonCenter, validatePolygon } from './cartography.js';
export function freeMapFrom(world,cells){
  const next=clone(world);if(next.mapKind==='free')return next;
  next.cartography||=defaultCartography();
  next.cartography.links=world.territories.flatMap(t=>neighbors(world,t).filter(n=>t.id<n.id).map(n=>[t.id,n.id]));
  next.territories.forEach((t,i)=>{Object.defineProperty(next.cartography.polygons,t.id,{value:{points:cells[i].points,center:cells[i].center},enumerable:true,writable:true,configurable:true});delete t.row;delete t.col;});
  next.mapKind='free';return next;
}
export function sharedBoundary(a,b){
  for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++){
    const p=a[i],q=a[(i+1)%a.length],r=b[j],s=b[(j+1)%b.length],dx=q[0]-p[0],dy=q[1]-p[1],length=Math.hypot(dx,dy);
    if(!length)continue;
    if(Math.abs(dx*(r[1]-p[1])-dy*(r[0]-p[0]))/length>.04||Math.abs(dx*(s[1]-p[1])-dy*(s[0]-p[0]))/length>.04)continue;
    const project=v=>((v[0]-p[0])*dx+(v[1]-p[1])*dy)/length,u=project(r),v=project(s);
    if(Math.min(length,Math.max(u,v))-Math.max(0,Math.min(u,v))>.8)return true;
  }return false;
}
export function boundaryLinks(world){const ts=world.territories,shapes=world.cartography.polygons,links=[];for(let i=0;i<ts.length;i++)for(let j=i+1;j<ts.length;j++)if(sharedBoundary(shapes[ts[i].id].points,shapes[ts[j].id].points))links.push([ts[i].id,ts[j].id].sort());return links;}
export function addFreeTerritory(world,points,ownerId=null){
  const next=clone(world),id=newId('land'),shape=validatePolygon(points);next.territories.push({id,name:`새 영토 ${next.territories.length+1}`,ownerId});
  next.cartography.polygons[id]={points:shape,center:polygonCenter(shape)};
  for(const t of world.territories)if(sharedBoundary(shape,world.cartography.polygons[t.id].points))next.cartography.links.push([t.id,id]);
  return {world:validateWorld(next),id};
}
export function removeFreeTerritory(world,id){
  if(world.territories.length<2)throw new Error('영토는 최소 1개 남겨 주세요.');const next=clone(world);next.territories=next.territories.filter(t=>t.id!==id);delete next.cartography.polygons[id];next.cartography.links=next.cartography.links.filter(p=>!p.includes(id));next.countries.forEach(c=>{if(c.capitalId===id)c.capitalId=null;});return validateWorld(next);
}
export function moveFreeTerritory(world,id,point){
  const next=clone(world),shape=next.cartography.polygons[id],dx=point[0]-shape.center[0],dy=point[1]-shape.center[1];
  shape.points=validatePolygon(shape.points.map(p=>[p[0]+dx,p[1]+dy]));shape.center=point;return validateWorld(next);
}
