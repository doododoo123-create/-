import {mapAnchor} from '../model/cartography-geometry.js';
export function appointmentFocus(scene,record){
 if(scene?.kind!=='apply'||!['appointment','roster'].includes(scene.event?.type))return null;
 const after=scene.worldAfter,before=scene.worldBefore;if(!after)return null;
 const people=after.people.filter(p=>['general','king'].includes(p.role)&&p.active&&p.alive&&
 (scene.event.type==='appointment'?p.countryId===(scene.event.nationId||record.actorId)&&p.role===(scene.event.role||'general')&&p.slot===scene.event.slot:!before?.people.some(q=>q.id===p.id&&q.countryId===p.countryId&&q.active&&q.alive&&q.generation===p.generation)));
 if(!people.length)return null;
 const points=people.map(p=>mapAnchor(after,p.positionId||p.stationId||after.countries.find(c=>c.id===p.countryId)?.capitalId,'station'));
 return points[0];
}
