import { mkdir,writeFile } from 'node:fs/promises';
import { createReferenceWorld } from '../src/data/reference-world.js';
import { createRun,nextTurn } from '../src/engine/simulation.js';
import { saveRun } from '../src/storage/run-store.js';
import { serializeWorld } from '../src/storage/world-store.js';
const w=createReferenceWorld();let r=createRun(w,20261019);
const expected={};for(let i=0;i<16;i++){r=nextTurn(r);if([3,8,16].includes(r.turn))expected[r.turn]={owners:r.world.territories.map(t=>[t.id,t.ownerId]),units:r.world.people.filter(p=>p.role==='general'&&p.active&&p.alive).map(p=>[p.id,p.positionId,p.troops])};}
let run;saveRun({setItem:(_,v)=>run=JSON.parse(v)},r);
await mkdir(new URL('../.artifacts/',import.meta.url),{recursive:true});await writeFile(new URL('../.artifacts/v09-browser-fixture.json',import.meta.url),JSON.stringify({world:JSON.parse(serializeWorld(w)),run,expected}));
