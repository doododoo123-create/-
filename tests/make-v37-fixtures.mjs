import {mkdirSync,writeFileSync} from 'node:fs';
import {studio37Fixture,studio37Controls} from './studio-v37-fixture.mjs';
import {createRun,nextTurn} from '../src/engine/simulation.js';
import {exportHistoryData} from '../src/storage/history-file.js';
mkdirSync('.artifacts',{recursive:true});
for(const [name,options] of [['army',{}],['duel',{duel:true}],['empty',{empty:true}],['fronts',{twoFronts:true}],['confusion',{}],['unequal',{}]]){
 let start=studio37Fixture(options),controls=studio37Controls(options);
 if(name==='unequal'){const w=structuredClone(start.initialWorld);w.deployment.generals.find(e=>e.personId==='a0').positionId='tile-0';start=createRun(w,777);}
 if(name==='confusion'){const w=structuredClone(start.initialWorld);w.rules.warReadiness=true;w.rules.seasonRestConfusion=true;w.territories[6].terrain='plain';start=createRun(w,777);for(const key of Object.keys(controls.rolls))if(key.startsWith('defense:'))controls.rolls[key]=26;}
 let run=nextTurn(start,controls);if(name==='army')while(run.turn<3)run=nextTurn(run,{armyAssembly:true,armyFormation:true,unitSpacing:true,frontOperations:true,rolls:{king:1,minister:1,domestic:1}});
 writeFileSync('.artifacts/v37-'+name+'.history.json',JSON.stringify(await exportHistoryData(run)));
}
console.log('v37 replayable fixtures: army, duel, empty, two fronts, actual mild-defeat confusion');
