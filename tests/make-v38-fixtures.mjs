import {mkdirSync,writeFileSync} from 'node:fs';
import {studio38Fixture,studio38Controls,domestic38Fixture} from './studio-v38-fixture.mjs';
import {nextTurn} from '../src/engine/simulation.js';
import {exportHistoryData} from '../src/storage/history-file.js';
mkdirSync('.artifacts',{recursive:true});
for(const [name,options] of [['army',{}],['cohort',{cohort:true}],['reinforce',{reinforce:true}],['duel',{duel:true}],['empty',{empty:true}],['domestic',{}]]){
 let run=name==='domestic'?domestic38Fixture().run:nextTurn(studio38Fixture(options),studio38Controls(options));
 if(name==='army')run=nextTurn(run,{armyAssembly:true,armyFormation:true,unitSpacing:true,frontOperations:true,directArmyRelease:true,rolls:{king:1,minister:1,domestic:1}});
 writeFileSync('.artifacts/v38-'+name+'.history.json',JSON.stringify(await exportHistoryData(run)));
}
console.log('v38 replayable fixtures: direct-release army, three-defender cohort, reinforcement, simultaneous domestic return, duel, empty capture');
