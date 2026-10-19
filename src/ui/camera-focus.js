import { mapAnchor } from '../model/cartography-geometry.js';
export function sceneFocus(scene,record){
 if(!scene?.event||scene.kind==='summary')return null;const world=scene.worldAfter||scene.worldBefore;if(!world)return null;
 if(scene.kind==='movement'&&scene.moves?.length)return mapAnchor(world,scene.moves[0].toId,'station');
 const battle=record.battles?.[scene.battleIndex];if(battle)return mapAnchor(world,battle.territoryId,'battle');
 if(scene.event.type==='round_end')return [600,400];
 const id=scene.event.nationId||record.actorId,country=world.countries.find(c=>c.id===id);if(!country)return null;
 const person=scene.event.role==='general'?world.people.find(p=>p.countryId===id&&p.role==='general'&&p.slot===scene.event.slot):null;
 return mapAnchor(world,person?.positionId||person?.stationId||country.capitalId,'station');
}
