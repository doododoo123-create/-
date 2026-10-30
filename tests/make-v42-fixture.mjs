import {writeFile,mkdir} from 'node:fs/promises';
import {fourArmyFixture} from './studio-v41-fixture.mjs';
import {exportHistoryData} from '../src/storage/history-file.js';
await mkdir(new URL('../.artifacts/',import.meta.url),{recursive:true});
await writeFile(new URL('../.artifacts/v42-four.history.json',import.meta.url),JSON.stringify(await exportHistoryData(fourArmyFixture().run)));
