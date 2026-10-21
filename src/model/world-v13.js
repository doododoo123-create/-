import { clone } from './world.js';
import { CONTINENT160_NAMES } from '../data/continent160-names.js';
// Upgrade only the editable setup. Running campaigns retain their original names, rules and seed.
export function prepareV13World(input){
 const world=clone(input);
 if(world.cartography?.plate==='continent160')for(const t of world.territories)if(/^영지\s*\d+$/.test(t.name)&&CONTINENT160_NAMES[t.id])t.name=CONTINENT160_NAMES[t.id];
 if(world.rules.battleMode==='additive30'&&world.rules.experiencePerWin===1&&world.rules.experienceCap===9&&(world.rules.experienceWinStep??1)===1){world.rules.experienceWinStep=3;world.rules.experienceCap=3;}
 return world;
}
