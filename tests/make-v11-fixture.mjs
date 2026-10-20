import {mkdir,writeFile} from 'node:fs/promises';
import {createReferenceWorld} from '../src/data/reference-world.js';
import {createRun,nextTurn} from '../src/engine/simulation.js';
import {serializeWorld} from '../src/storage/world-store.js';
import {saveRun} from '../src/storage/run-store.js';
const encode=run=>{let data;saveRun({setItem:(_,value)=>data=JSON.parse(value)},run);return {world:JSON.parse(serializeWorld(run.initialWorld)),run:data};};
function visualWorld(dispatch){const w=createReferenceWorld();w.rules.expeditionChances.fill(dispatch);w.countries.forEach(c=>c.troops=80);return w;}
const refusalStart=createRun(visualWorld(0),7);const refusal=nextTurn(refusalStart,{rolls:{king:10}});
const battleWorld=visualWorld(100);let battle=createRun(battleWorld,7);const domestic={rolls:{king:1,minister:1,domestic:1}};
for(let i=0;i<24;i++)battle=nextTurn(battle,i%7===0?{rolls:{king:10}}:domestic);
if(!battle.history.some(r=>r.battles.some(b=>!b.automatic)))throw Error('Missing genuine battle fixture');
const policies=nextTurn(createRun(visualWorld(100),77),{rolls:{king:1,minister:10,domestic:10,supply_gain:1}});
await mkdir('.artifacts',{recursive:true});await writeFile('.artifacts/v11-browser-fixture.json',JSON.stringify({refusal:encode(refusal),battle:encode(battle),policies:encode(policies)}));
