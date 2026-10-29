import {mkdirSync,writeFileSync} from 'node:fs';
import {simulate39} from './studio-v39-fixture.mjs';
import {exportHistoryData} from '../src/storage/history-file.js';
mkdirSync('.artifacts',{recursive:true});
for(const [name,options] of [['cohort',{cohort:true}],['multi',{multiAttack:true}],['mirror',{mirror:true}],['fall',{elimination:true}]]){const {run}=simulate39(options);writeFileSync('.artifacts/v39-'+name+'.history.json',JSON.stringify(await exportHistoryData(run)));}
console.log('v39 replayable fixtures: multiple defenders, army against individual, reversed visual geography, army-campaign elimination');
