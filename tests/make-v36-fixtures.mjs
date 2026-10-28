import {mkdirSync,writeFileSync} from 'node:fs';
import {studio36Fixture,studio36Controls} from './studio-v36-fixture.mjs';
import {nextTurn} from '../src/engine/simulation.js';
import {exportHistoryData} from '../src/storage/history-file.js';
mkdirSync('.artifacts',{recursive:true});
for(const [name,options] of [['army',{}],['duel',{duel:true}],['empty',{empty:true}]]){let run=nextTurn(studio36Fixture(options),studio36Controls());if(name==='army')while(run.turn<3)run=nextTurn(run,{armyAssembly:true,armyFormation:true,unitSpacing:true,rolls:{king:1,minister:1,domestic:1}});writeFileSync('.artifacts/v36-'+name+'.history.json',JSON.stringify(await exportHistoryData(run)));}
console.log('v36 fixtures: actual army, individual duel, direct unopposed capture');
