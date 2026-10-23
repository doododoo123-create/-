import {mkdir,writeFile} from 'node:fs/promises';
import {createContinent160World} from '../src/data/continent160-world.js';
import {createRun,nextTurn} from '../src/engine/simulation.js';
import {replayTurn} from '../src/engine/replay.js';
import {saveRun} from '../src/storage/run-store.js';
import {serializeWorld} from '../src/storage/world-store.js';
const w=createContinent160World();w.countries.forEach(c=>c.troops=50);let run=createRun(w,777);
for(let i=0;i<42&&!run.result;i++){
 const rolls={king:10};for(let slot=0;slot<40;slot++){rolls['expedition:'+slot]=1;rolls['attack:'+slot]=i%3===1?1:30;rolls['defense:'+slot]=i%3===1?30:1;}
 run=nextTurn(run,{rolls});
}
const chosen=[...run.history].reverse().find(r=>r.turn>run.turn-20&&r.turn<run.turn&&r.battles.some(b=>!b.automatic&&b.takenCells.length)&&run.history.some(p=>p.turn<r.turn&&p.round===r.round&&p.changes.length));
if(!chosen)throw Error('A round with earlier and current captures is required');
const replay=await replayTurn(run,chosen.turn),battle=replay.record.battles.find(b=>!b.automatic&&b.takenCells.length);
let saved;saveRun({setItem:(_,v)=>saved=JSON.parse(v)},run);
await mkdir('.artifacts',{recursive:true});await writeFile('.artifacts/v17-browser-fixture.json',JSON.stringify({world:JSON.parse(serializeWorld(run.initialWorld)),run:saved,turn:chosen.turn,battle,routePeople:[...new Set(run.history.filter(r=>r.round===chosen.round&&r.turn<chosen.turn).flatMap(r=>(r.movements||[]).flatMap(m=>m.moves.filter(v=>!['retreat','redeploy'].includes(v.kind)).map(v=>v.personId))))],expected:Object.fromEntries(run.world.territories.map(t=>[t.id,t.ownerId]))}));
console.log(JSON.stringify({turns:run.turn,replayTurn:chosen.turn,battle:battle.index,captures:battle.takenTerritoryIds,round:chosen.round}));
