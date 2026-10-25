import { createContinent160World } from '../data/continent160-world.js';
import { enableCampaignV23 } from '../model/campaign-v23.js';
import { applyTerritoryPresetV25 } from '../model/territory-preset-v25.js';
import { createRun } from '../engine/simulation.js';
import { validateWorld } from '../model/world.js';
// Scenario preparation uses the existing initial-assignment engine, never a different battle rule.
export function prepareContinentV25(input){
 const world=applyTerritoryPresetV25(input);
 if(world.rules.battleMode!=='additive30'||!world.rules.fieldCommand)return world;
 const preview=createRun(world,0).world,active=preview.people.filter(p=>p.role==='general'&&p.active&&p.alive);
 for(const p of active)if(!world.people.some(q=>q.id===p.id))world.people.push({id:p.id,name:p.name,role:'general',countryId:p.countryId,slot:p.slot,ability:p.ability,commandBonus:p.commandBonus,personality:p.personality||'balanced',feature:p.feature||''});
 world.deployment={version:1,generals:active.map(p=>({personId:p.id,positionId:p.positionId||p.stationId,stationId:p.stationId,territoryIds:[...p.territoryIds]}))};
 return validateWorld(world);
}
export function createContinentV25World(){return prepareContinentV25(enableCampaignV23(createContinent160World()));}
