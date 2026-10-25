import {mkdir,writeFile} from 'node:fs/promises';
import {quiet23World,manual23World} from './campaign-v23-fixture.mjs';
import {createRun,nextTurn} from '../src/engine/simulation.js';
import {saveRun} from '../src/storage/run-store.js';
import {serializeWorld} from '../src/storage/world-store.js';
const w=manual23World();let run=createRun(w,777);for(let i=0;i<304;i++)run=nextTurn(run,{rolls:{king:1,minister:1,domestic:1}});let saved;saveRun({setItem:(_,v)=>saved=JSON.parse(v)},run);await mkdir('.artifacts',{recursive:true});await writeFile('.artifacts/v23-fixture.json',JSON.stringify({world:JSON.parse(serializeWorld(w)),run:saved}));console.log(JSON.stringify({turn:run.turn,round:run.round,engine:saved.engineVersion,limit:run.engineState.roundLimit}));
