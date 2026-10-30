import {writeFile,mkdir} from 'node:fs/promises';
import {fourArmyFixture} from './studio-v41-fixture.mjs';
import {exportHistoryData} from '../src/storage/history-file.js';
import {createRun,nextTurn} from '../src/engine/simulation.js';
import {createContinentV31World} from '../src/scenarios/continent-v31.js';
import {enableOfficerTraits} from '../src/model/officer-traits.js';
await mkdir(new URL('../.artifacts/',import.meta.url),{recursive:true});
await writeFile(new URL('../.artifacts/v43-four.history.json',import.meta.url),JSON.stringify(await exportHistoryData(fourArmyFixture().run)));
let run=createRun(enableOfficerTraits(createContinentV31World()),777);
const controls={armyAssembly:true,armyFormation:true,unitSpacing:true,frontOperations:true,directArmyRelease:true,rolls:{king:10}};
for(let slot=0;slot<30;slot++){controls.rolls['expedition:'+slot]=1;for(let i=0;i<60;i++){const suffix=i?':chain:'+i:'';controls.rolls['attack:'+slot+suffix]=30;controls.rolls['defense:'+slot+suffix]=1;controls.rolls['death:'+slot+suffix]=10;}}
while(run.turn<8&&!run.result)run=nextTurn(run,controls);
await writeFile(new URL('../.artifacts/v43-captures.history.json',import.meta.url),JSON.stringify(await exportHistoryData(run)));
console.log('v43 fixtures: actual4v4 and genuine160-territory eight-country-turn history with captures and season settlement');
