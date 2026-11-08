import {mkdir,writeFile} from 'node:fs/promises';
import {fourArmyFixture} from './studio-v41-fixture.mjs';
import {largeMassFixture} from './mass-battle-v52-fixture.mjs';
import {nextTurn} from '../src/engine/simulation.js';
import {exportHistoryData} from '../src/storage/history-file.js';
await mkdir('.artifacts',{recursive:true});
for(const deathRaw of [1,10])await writeFile(`.artifacts/v52-${deathRaw}.history.json`,JSON.stringify(await exportHistoryData(fourArmyFixture({deathRaw}).run)));
await writeFile('.artifacts/v52-large.history.json',JSON.stringify(await exportHistoryData(largeMassFixture().run)));
console.log('v0.52 real replayable histories: normal army / deaths /32commanders');

let transition=fourArmyFixture().run;for(let i=0;i<2;i++)transition=nextTurn(transition,{rolls:{king:1,minister:1,domestic:1}});await writeFile('.artifacts/v521-transition.history.json',JSON.stringify(await exportHistoryData(transition)));
