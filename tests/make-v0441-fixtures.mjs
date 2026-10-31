import {mkdir,writeFile} from 'node:fs/promises';
import {createContinentV31World} from '../src/scenarios/continent-v31.js';
import {enableOfficerTraits} from '../src/model/officer-traits.js';
import {createRun,nextTurn} from '../src/engine/simulation.js';
import {exportHistoryData} from '../src/storage/history-file.js';
import {quiet23World} from './campaign-v23-fixture.mjs';

const controls={armyAssembly:true,armyFormation:true,unitSpacing:true,frontOperations:true,directArmyRelease:true};
await mkdir(new URL('../.artifacts/',import.meta.url),{recursive:true});
for(const [seed,turn,name] of [[20261017,115,'116'],[123456,177,'178']]){
 let run=createRun(enableOfficerTraits(createContinentV31World()),seed);
 while(run.turn<turn)run=nextTurn(run,controls);
 await writeFile(new URL(`../.artifacts/v0441-before-${name}.history.json`,import.meta.url),JSON.stringify(await exportHistoryData(run)));
}
let quiet=createRun(quiet23World(),777);
while(quiet.turn<255)quiet=nextTurn(quiet,{rolls:{king:1,minister:1,domestic:1}});
await writeFile(new URL('../.artifacts/v0441-before-256.history.json',import.meta.url),JSON.stringify(await exportHistoryData(quiet)));
console.log('Prepared the two original stopped campaigns and the turn255 boundary history.');
