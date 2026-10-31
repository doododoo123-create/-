import {quiet23World} from './campaign-v23-fixture.mjs';
import {createRun,nextTurn} from '../src/engine/simulation.js';
export const currentControls={armyAssembly:true,armyFormation:true,unitSpacing:true,frontOperations:true,directArmyRelease:true,royalCapitalSync:true};
export function unificationFixture(){
 const world=quiet23World();
 world.rules.domesticThresholds={balanced:1,peaceful:1,aggressive:1};
 world.countries[1].troops=0;
 world.territories.forEach((t,i)=>t.ownerId=i===3?'b':'a');
 world.countries[1].capitalId='tile-3';
 const start=createRun(world,1),run=nextTurn(start,currentControls);
 return {start,run,record:run.history.at(-1)};
}
