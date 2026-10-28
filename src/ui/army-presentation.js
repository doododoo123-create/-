import {portraitImage} from './portraits.js';
import {displayName} from './display-names.js';
import {esc} from './icons.js';

// Read only group events already applied to this visible map, never future dice.
export function visibleArmyGroups(world,presentation){
 const record=presentation?.record,scene=presentation?.scenes?.[presentation.index],groups=new Map();
 if(scene?.dissolveArmies)return [];
 if(!record||presentation.finished||scene?.kind==='summary')return [];
 const limit=scene?.mapEventIndex??scene?.event?.index??-1;
 for(const e of record.events||[]){
  if(e.index>limit)break;if(e.type==='territory'){const b=record.battles[e.battleIndex];if(b?.armyPrepared){groups.delete(b.armyGroupId);for(const [id,g] of groups)if(g.nation===b.target&&g.members.some(m=>m.slot===b.defenseSlot))groups.delete(id);}}if(!e.armyGroup)continue;
  if(e.index===limit&&e.type==='army_assembly'&&scene.kind==='movement')continue;
  if(e.armyGroup.released)groups.delete(e.armyGroup.id);else groups.set(e.armyGroup.id,e.armyGroup);
 }
 return [...groups.values()].flatMap(group=>{
  const countryId=world.countries[group.nation]?.id,members=group.members.map(m=>world.people.find(p=>p.countryId===countryId&&p.role==='general'&&p.slot===m.slot&&p.generation===m.generation)).filter(p=>p?.active&&p.alive&&p.troops>0);
  if(members.length<2)return [];
  const leader=members.find(p=>p.slot===group.leaderSlot)||members[0];
  return [{...group,countryId,locationId:world.territories[group.location]?.id,leader,members,army:members.reduce((n,p)=>n+p.troops,0)}];
 });
}
export function armyCompanions(group,country){
 if(!group)return '';
 return group.members.filter(p=>p.id!==group.leader.id).map((p,i)=>`<g class="army-mini-unit" transform="translate(${31+i*11},-12) scale(.5)" data-army-companion="${esc(p.id)}"><foreignObject x="-16" y="-27" width="32" height="58"><div xmlns="http://www.w3.org/1999/xhtml" class="token-wrap"><button class="map-unit-token army-mini-card" data-action="focus-unit" data-id="${esc(p.id)}" style="--nation:${country.color}" title="${esc(displayName(p))}"><span class="token-portraits">${portraitImage(p,country,p.role)}</span><span class="token-copy"><b>${esc(displayName(p))}</b></span></button></div></foreignObject></g>`).join('');
}
