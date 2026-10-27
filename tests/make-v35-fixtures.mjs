import {writeFileSync,mkdirSync} from 'node:fs';
import {army35Fixture,army35Controls} from './army-v35-fixture.mjs';
import {nextTurn} from '../src/engine/simulation.js';
import {exportHistoryData} from '../src/storage/history-file.js';
let run=nextTurn(army35Fixture(),army35Controls());while(run.turn<3)run=nextTurn(run,{armyAssembly:true,armyFormation:true,unitSpacing:true,rolls:{king:1,minister:1,domestic:1}});mkdirSync('.artifacts',{recursive:true});writeFileSync('.artifacts/v35-history.history.json',JSON.stringify(await exportHistoryData(run)));console.log('v35 fixtures: preaccepted central/spread deployment, both fronts before dice, exact three-battle history');
