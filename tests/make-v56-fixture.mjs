import {mkdir,writeFile} from 'node:fs/promises';
import {createContinentV31World} from '../src/scenarios/continent-v31.js';
import {createRun,nextTurn} from '../src/engine/simulation.js';
import {exportHistoryData} from '../src/storage/history-file.js';
import {landSupplyWorld} from '../src/model/land-supply.js';
import {enableOfficerTraits,enablePersonalAbilities} from '../src/model/officer-traits.js';
import {allocateWorldPortraits} from '../src/model/portrait-allocation.js';
import {fourArmyFixture} from './studio-v41-fixture.mjs';
await mkdir('.artifacts',{recursive:true});
await writeFile('.artifacts/v56-army.history.json',JSON.stringify(await exportHistoryData(fourArmyFixture().run)));
let run=createRun(landSupplyWorld(allocateWorldPortraits(enablePersonalAbilities(enableOfficerTraits(createContinentV31World())))),'20261017');
for(let i=0;i<21;i++){
 run=nextTurn(run,{armyAssembly:true,armyFormation:true,unitSpacing:true,frontOperations:true,directArmyRelease:true,royalCapitalSync:true,personalAbility:true,landSupplyOnly:true,regionalMaintenance:true,recruitExiles:true,isolatedEvacuation:true,officerNames:true});
 if(run.history.at(-1).changes.length){await writeFile('.artifacts/v56-campaign.history.json',JSON.stringify(await exportHistoryData(run)));console.log('Actual160-map capture turn',run.turn);break;}
}

let basic=createRun(landSupplyWorld(allocateWorldPortraits(enablePersonalAbilities(enableOfficerTraits(createContinentV31World())))),'20261017');for(let i=0;i<21;i++){basic=nextTurn(basic);if(basic.history.at(-1).changes.length){await writeFile('.artifacts/v56-capture.history.json',JSON.stringify(await exportHistoryData(basic)));break;}}
