import {mkdir,writeFile} from 'node:fs/promises';
import {createContinent160World} from '../src/data/continent160-world.js';
import {createRun,nextTurn} from '../src/engine/simulation.js';
import {replayTurn} from '../src/engine/replay.js';
import {saveRun} from '../src/storage/run-store.js';
import {serializeWorld} from '../src/storage/world-store.js';
const w=createContinent160World();w.rules.capitalFallAnnexation=false;w.countries.forEach(c=>c.troops=50);let run=createRun(w,777);
for(let i=0;i<43&&!run.result;i++){
 const rolls={king:i%7===4?1:10};for(let slot=0;slot<40;slot++){rolls['expedition:'+slot]=1;rolls['attack:'+slot]=i%3===1?1:30;rolls['defense:'+slot]=i%3===1?30:1;}
 run=nextTurn(run,{rolls});
}
const chosen=[...run.history].reverse().find(r=>r.turn>run.turn-20&&r.turn<run.turn-1&&r.battles.some(b=>!b.automatic&&b.takenCells.length)&&run.history.some(p=>p.turn<r.turn&&p.round===r.round&&p.changes.length));
if(!chosen)throw Error('A round with earlier and current captures is required');
const movementRecord=[...run.history].reverse().find(r=>r.movements.some(m=>m.moves.some(v=>v.kind==='outbound')&&m.moves.some(v=>['return','relief'].includes(v.kind)))&&r.battles.some(b=>!b.automatic&&b.takenCells.length));
const movement=movementRecord.movements.find(m=>m.moves.some(v=>v.kind==='outbound')&&m.moves.some(v=>['return','relief'].includes(v.kind)));
const movementBattle=movementRecord.battles[movement.battleIndex];
const replay=await replayTurn(run,chosen.turn),battle=replay.record.battles.find(b=>!b.automatic&&b.takenCells.length);
let saved;saveRun({setItem:(_,v)=>saved=JSON.parse(v)},run);
await mkdir('.artifacts',{recursive:true});await writeFile('.artifacts/v20-browser-fixture.json',JSON.stringify({world:JSON.parse(serializeWorld(run.initialWorld)),run:saved,movementTurn:movementRecord.turn,movementBattle,turn:chosen.turn,battle,nextSeasonTurn:43,seasonTurn:run.history.filter(r=>r.seasonStart&&r.turn<chosen.turn&&r.turn>run.turn-20).at(-1)?.turn,ministerTurn:run.history.filter(r=>r.type==='domestic'&&r.turn>run.turn-20).at(-1)?.turn,routePeople:[...new Set(run.history.filter(r=>r.round===chosen.round&&r.turn<chosen.turn).flatMap(r=>(r.movements||[]).flatMap(m=>m.moves.filter(v=>!['retreat','redeploy'].includes(v.kind)).map(v=>v.personId))))],expected:Object.fromEntries(run.world.territories.map(t=>[t.id,t.ownerId]))}));
console.log(JSON.stringify({turns:run.turn,replayTurn:chosen.turn,battle:battle.index,captures:battle.takenTerritoryIds,round:chosen.round}));

const capWorld=createContinent160World();capWorld.countries.forEach(c=>c.troops=50);let capRun=createRun(capWorld,777),capTurn=null;
for(let i=0;i<60&&!capRun.result&&!capTurn;i++){const rolls={king:10};for(let slot=0;slot<40;slot++){rolls['expedition:'+slot]=1;rolls['attack:'+slot]=30;rolls['defense:'+slot]=1;rolls['death:'+slot]=10;}capRun=nextTurn(capRun,{rolls});if(capRun.history.at(-1).events.some(e=>e.type==='capital_fall'))capTurn=capRun.turn;}
if(!capTurn)throw Error('A reproducible capital fall is required');let capSaved;saveRun({setItem:(_,v)=>capSaved=JSON.parse(v)},capRun);await writeFile('.artifacts/v20-capital-fixture.json',JSON.stringify({world:JSON.parse(serializeWorld(capRun.initialWorld)),run:capSaved,turn:capTurn,battle:capRun.history.at(-1).battles.find(b=>b.capitalFall)}));
const refusalWorld=createContinent160World();refusalWorld.rules.expeditionChances=[0,0,0,0,0,0];const refusalRun=nextTurn(createRun(refusalWorld,777),{rolls:{king:10}});let refusalSaved;saveRun({setItem:(_,v)=>refusalSaved=JSON.parse(v)},refusalRun);await writeFile('.artifacts/v20-refusal-fixture.json',JSON.stringify({world:JSON.parse(serializeWorld(refusalRun.initialWorld)),run:refusalSaved,turn:1}));console.log(JSON.stringify({movementTurn:movementRecord.turn,movementBattle:movementBattle.index,capitalTurn:capTurn}));
