import {mapAnchor} from '../model/cartography-geometry.js';
import {armyArrowWidth} from './operation-geometry.js';
const bundleRole=r=>r.kind==='retreat'||r.side==='retreat'?'retreat':r.counterattack?'counter':r.side;
const bundleGroup=r=>JSON.stringify([r.countryId,bundleRole(r)]);
// Only published routes enter this directed graph. Membership is by person/life, not battle count.
export function bundleRouteSegments(routes){
 const groups=new Map();
 for(const r of routes){const ids=r.path?.length?r.path:[r.fromId,r.toId],group=bundleGroup(r);if(!groups.has(group))groups.set(group,{edges:new Map(),sources:new Set(),targets:new Set(),countryId:r.countryId,side:r.side,kind:bundleRole(r)});const g=groups.get(group);g.sources.add(ids[0]);g.targets.add(ids.at(-1));for(let i=1;i<ids.length;i++){if(ids[i-1]===ids[i])continue;const key=JSON.stringify([ids[i-1],ids[i]]);if(!g.edges.has(key))g.edges.set(key,{key,fromId:ids[i-1],toId:ids[i],people:new Map(),visits:0,army:0});const e=g.edges.get(key);e.people.set(r.personId||'unknown:'+r.key,r);e.army=Math.max(e.army,r.army||0);e.visits++;}}
 const output=[];
 for(const [group,g] of [...groups].sort(([a],[b])=>a.localeCompare(b))){
  const incoming=new Map(),outgoing=new Map();for(const e of g.edges.values()){if(!incoming.has(e.toId))incoming.set(e.toId,[]);incoming.get(e.toId).push(e);if(!outgoing.has(e.fromId))outgoing.set(e.fromId,[]);outgoing.get(e.fromId).push(e);e.signature=[...e.people.keys()].sort().join('|');}
  const ordered=[...g.edges.values()].sort((a,b)=>a.key.localeCompare(b.key)),seen=new Set();
  const walk=first=>{if(seen.has(first.key))return;const edges=[first],path=[first.fromId,first.toId];seen.add(first.key);let last=first;for(;;){const next=outgoing.get(last.toId)||[];if(next.length!==1||(incoming.get(last.toId)||[]).length!==1||next[0].signature!==first.signature||seen.has(next[0].key)||next[0].toId===path[0])break;last=next[0];edges.push(last);path.push(last.toId);seen.add(last.key);}const people=new Set(first.people.keys()),count=people.size,width=armyArrowWidth(Math.max(...edges.map(e=>e.army)))*Math.min(1.75,1+.25*(count-1));output.push({key:'bundle-'+group+'-'+path.join('>'),countryId:g.countryId,side:g.side,kind:g.kind,path,fromId:path[0],toId:path.at(-1),people,personId:count===1?[...people][0]:null,count,army:Math.max(...edges.map(e=>e.army)),width,terminal:g.targets.has(path.at(-1)),source:g.sources.has(path[0])&&!incoming.has(path[0]),targets:g.targets,sources:g.sources,known:[...people].every(p=>!p.startsWith('unknown:')),active:false,moving:false});};
  for(const e of ordered){const prev=incoming.get(e.fromId)||[];if(prev.length!==1||(outgoing.get(e.fromId)||[]).length!==1||prev[0].signature!==e.signature)walk(e);}for(const e of ordered)walk(e);
 }
 return output;
}
export function bundledGeometry(world,geometry,bundles){
 const shared=new Map();for(const r of bundles)for(let i=1;i<r.path.length;i++){const a=r.path[i-1],b=r.path[i],key=JSON.stringify([a,b].sort()),group=JSON.stringify([r.countryId,r.kind,a<b?1:-1]);if(!shared.has(key))shared.set(key,new Map());shared.get(key).set(group,Math.max(shared.get(key).get(group)||0,r.width));}
 return bundles.map(r=>{const points=[],anchor=(id,i)=>{const kind=r.targets.has(id)?'battle':i===0&&r.source?'label':'station',p=mapAnchor(world,id,kind,geometry);return kind==='label'?[p[0],p[1]-12]:p;};for(let i=1;i<r.path.length;i++){const from=r.path[i-1],to=r.path[i],a=anchor(from,i-1),b=anchor(to,i),lanes=shared.get(JSON.stringify([from,to].sort())),keys=[...lanes.keys()].sort(),key=JSON.stringify([r.countryId,r.kind,from<to?1:-1]),slot=keys.indexOf(key)-(keys.length-1)/2,offset=slot*(Math.max(...lanes.values())+8)*(from<to?1:-1),dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;if(!points.length)points.push(a);if(offset)for(const t of [.3,.7])points.push([a[0]+dx*t-dy/len*offset,a[1]+dy*t+dx/len*offset]);points.push(b);}return {...r,points};});
}
export function roundedRoutePath(points){
 if(!points.length)return '';let d='M'+points[0].join(',');for(let i=1;i<points.length-1;i++){const a=points[i-1],b=points[i],c=points[i+1],u=Math.hypot(b[0]-a[0],b[1]-a[1]),v=Math.hypot(c[0]-b[0],c[1]-b[1]),radius=Math.min(12,u/3,v/3);if(!radius){d+=' L'+b.join(',');continue;}const p=[b[0]-(b[0]-a[0])*radius/u,b[1]-(b[1]-a[1])*radius/u],q=[b[0]+(c[0]-b[0])*radius/v,b[1]+(c[1]-b[1])*radius/v];d+=' L'+p.join(',')+' Q'+b.join(',')+' '+q.join(',');}if(points.length>1)d+=' L'+points.at(-1).join(',');return d;
}
