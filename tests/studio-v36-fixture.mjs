import {army35Fixture,army35Controls} from './army-v35-fixture.mjs';
import {createRun} from '../src/engine/simulation.js';
// Fixtures are entirely defined by the starting world, so exported history can
// reconstruct them from the seed without any unrecorded state mutations.
export function studio36Fixture({duel=false,empty=false,defense=false}={}){
 const world=structuredClone(army35Fixture().initialWorld);
 if(duel){world.countries[0].troops=25;world.deployment.generals=world.deployment.generals.filter(e=>!e.personId.startsWith('a'));world.deployment.generals.push({personId:'a0',stationId:'tile-1',positionId:'tile-1',territoryIds:Array.from({length:6},(_,i)=>'tile-'+i)});}
 if(defense){world.deployment.generals=world.deployment.generals.filter(e=>!e.personId.startsWith('b'));world.deployment.generals.push({personId:'b0',stationId:'tile-8',positionId:'tile-8',territoryIds:[6,7,8,9].map(i=>'tile-'+i)},{personId:'b1',stationId:'tile-10',positionId:'tile-6',territoryIds:[10,11,12,13,14].map(i=>'tile-'+i)});}
 if(empty)world.countries[1].troops=0;
 return createRun(world,777);
}
export const studio36Controls=army35Controls;
