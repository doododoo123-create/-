import {mkdirSync,writeFileSync} from 'node:fs';
import {campaign28Fixture,campaign28Controls} from './campaign-v28-fixture.mjs';
import {nextTurn} from '../src/engine/simulation.js';
import {runSaveData} from '../src/storage/run-store.js';
import {serializeWorld} from '../src/storage/world-store.js';
let run=nextTurn(campaign28Fixture(),campaign28Controls());while(run.turn<3)run=nextTurn(run,{rolls:{king:1,minister:1,domestic:1}});mkdirSync('.artifacts',{recursive:true});writeFileSync('.artifacts/v28-browser-fixture.json',JSON.stringify({world:JSON.parse(serializeWorld(run.initialWorld)),run:runSaveData(run)}));console.log('v28 actual3-loss history saved, confusion reset',run.engineState.countries[1].generals[0].confusion);
