import {stableUnitGround} from './stable-unit-placement.js';
import {landMovementPath} from './land-movement.js';
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
// Fixed territory slots and a cached land corridor; no reactive collision push
// is permitted during travel. Disconnected relocations fade at their endpoints.
export function batchMovementPins(moves,world,progress){
 return moves.map(m=>{const person=world.people.find(p=>p.id===m.personId),start=stableUnitGround(world,person,m.fromId),end=stableUnitGround(world,person,m.toId),ids=m.path?.length>1?[...m.path]:[m.fromId];if(ids.at(-1)!==m.toId)ids.push(m.toId);
  const route=landMovementPath(world,ids,start,end,.2+.6*(((person?.slot??0)+1)%7)/7),sample=route?polylineAt(route,progress):null,point=sample?.point||(progress<.5?start:end),opacity=route?1:Math.abs(1-2*progress);
  return {id:m.personId,x:point[0],y:point[1],opacity,path:sample?.path||[],route};
 });
}
