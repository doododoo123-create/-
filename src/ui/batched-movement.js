import {mapAnchor} from '../model/cartography-geometry.js';
import {polylineAt} from './operation-geometry.js';
export function batchRetreats(scenes){
 const result=[];
 for(let i=0;i<scenes.length;i++){
  const s=scenes[i],retreat=s.kind==='movement'&&s.moves?.length&&s.moves.every(m=>m.kind==='retreat'||m.kind==='redeploy'&&s.event?.type==='retreat');
  if(!retreat){result.push(s);continue;}
  const group=[s],ids=new Set(s.moves.map(m=>m.personId));
  while(i+1<scenes.length){const n=scenes[i+1];if(n.kind!=='movement'||!n.moves?.every(m=>['retreat','redeploy'].includes(m.kind)&&!ids.has(m.personId)))break;group.push(n);n.moves.forEach(m=>ids.add(m.personId));i++;}
  const last=group.at(-1),moves=group.flatMap(v=>v.moves).map(m=>({...m,kind:'retreat'}));
  result.push({...s,id:'batch-'+s.id,batchMovement:true,batchRetreat:true,campsBefore:s.campsBefore,camps:last.camps,moves,title:'부대 동시 후퇴'});
 }
 return result;
}
// A stable formation footprint is reserved at every progress value. This solver
// uses screen-sized boxes, never changes a legal path or game position.
export function batchMovementPins(moves,world,progress,scale=1,unitWidth=42,endpoints=null){
 const columns=Math.ceil(Math.sqrt(moves.length)),spacingX=unitWidth*3/scale,spacingY=unitWidth*3.6/scale;
 const desired=moves.map((m,i)=>{const path=(m.path?.length>1?m.path:[m.fromId,m.toId]).map(id=>mapAnchor(world,id,'station')),p=polylineAt(path,progress).point,col=i%columns,row=Math.floor(i/columns),rows=Math.ceil(moves.length/columns);const endpoint=endpoints?.get(m.personId),last=path.at(-1),dx=endpoint?endpoint.x-last[0]:(col-(columns-1)/2)*spacingX,dy=endpoint?endpoint.y-last[1]:(row-(rows-1)/2)*spacingY;return {id:m.personId,x:p[0]+dx,y:p[1]+dy};});
 const placed=[];for(const d of desired){let y=d.y;while(placed.some(p=>Math.abs(d.x-p.x)<spacingX*.95&&Math.abs(y-p.y)<spacingY*.95))y+=spacingY;placed.push({...d,y});}
 return placed;
}
