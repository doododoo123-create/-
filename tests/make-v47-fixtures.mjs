import {mkdir,writeFile} from 'node:fs/promises';
import {fourArmyFixture} from './studio-v41-fixture.mjs';
import {exportHistoryData} from '../src/storage/history-file.js';
import {createRun,nextTurn} from '../src/engine/simulation.js';
await mkdir('.artifacts',{recursive:true});
for(const death of [false,true]){
 const f=fourArmyFixture({deathRaw:death?1:10});
 await writeFile(`.artifacts/v47-${death?'death':'four'}.history.json`,JSON.stringify(await exportHistoryData(f.run)));
}
// A legal custom starting world plus recorded control rolls: no edited outcome.
const f=fourArmyFixture(),world=structuredClone(f.start.initialWorld);world.countries[0].troops=32;
const controls=structuredClone(f.record.controls);
for(const key of Object.keys(controls.rolls)){if(key.startsWith('attack:'))controls.rolls[key]=30;if(key.startsWith('defense:'))controls.rolls[key]=1;}
const run=nextTurn(createRun(world,777),controls);
await writeFile('.artifacts/v47-honor.history.json',JSON.stringify(await exportHistoryData(run)));
console.log('v47: real seven-duel, death-interruption, and3x-upset replay fixtures prepared.');
