// Real engine and current automatic-order controls. The cutoff is only a test budget.
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createContinentV31World} from '../src/scenarios/continent-v31.js';
import {enableOfficerTraits} from '../src/model/officer-traits.js';
import {engineFor} from '../src/engine/simulation.js';

const seeds=[0,1,2,3,7,19,29,42,77,123,255,256,777,2026,12345,65535,123456,20261017,20261031,4294967295];
const controls={armyAssembly:true,armyFormation:true,unitSpacing:true,frontOperations:true,directArmyRelease:true,royalCapitalSync:true};
const cutoff=2000;
const output=new URL('../.artifacts/v0442-stress.json',import.meta.url);
if(!isMainThread){
 const world=enableOfficerTraits(createContinentV31World()),engine=engineFor(world).engine;
 for(let i=workerData;i<seeds.length;i+=4){
  const seed=seeds[i],counts={war:0,domestic:0,battles:0,automatic:0,capitalFalls:0,royalReturns:0,eliminations:0,deaths:0,successors:0,counters:0},boundaries=[];
  let state=engine.createGame({seed,roundLimit:null}),failure=null;
  try{
   while(!state.result&&state.turns<cutoff){
    const prepared=engine.prepareTurn(state,controls),record=prepared.record;
    state={...prepared.state,history:[]};
    counts[record.kind]++;
    counts.battles+=record.battles.length;
    counts.automatic+=record.battles.filter(b=>b.automatic).length;
    for(const e of record.events){
     if(e.type==='capital_fall')counts.capitalFalls++;
     if(e.type==='royal_return')counts.royalReturns++;
     if(e.type==='elimination')counts.eliminations++;
     if(e.type==='death')counts.deaths++;
     if(e.type==='appointment')counts.successors++;
     if(e.type==='counteroffensive')counts.counters++;
    }
    if([255,256,512,1000,2000].includes(state.turns)){
     const restored=JSON.parse(JSON.stringify(state));assert(engine.validState(restored));
     if(!state.result)assert.deepEqual(engine.prepareTurn(restored,controls).state,engine.prepareTurn(state,controls).state);
     boundaries.push(state.turns);
    }
   }
   if(state.result){assert.equal(state.result.reason,'conquest');assert.equal(state.result.winners.length,1);assert(state.cells.every(c=>c.owner===state.result.winners[0]));}
  }catch(error){failure={message:error.message,turn:state.turns+1};writeFileSync(new URL(`../.artifacts/v0442-failure-${seed}.json`,import.meta.url),JSON.stringify({world,state,controls,error:failure}));}
  parentPort.postMessage({seed,turns:state.turns,round:state.round,completed:!!state.result,winner:state.result?.winners.map(id=>state.countries[id].name)||[],boundaries,counts,failure});
 }
}else{
 mkdirSync(new URL('../.artifacts/',import.meta.url),{recursive:true});
 const rows=[],write=()=>writeFileSync(output,JSON.stringify({cutoffTurns:cutoff,controls,rows:rows.slice().sort((a,b)=>a.seed-b.seed)},null,2));
 await Promise.all(Array.from({length:4},(_,workerData)=>new Promise((resolve,reject)=>{
  const worker=new Worker(new URL(import.meta.url),{workerData});
  worker.on('message',row=>{rows.push(row);write();console.log(JSON.stringify({finished:rows.length,seed:row.seed,turns:row.turns,winner:row.winner,failure:row.failure}));});
  worker.on('error',reject);worker.on('exit',code=>code?reject(Error('worker exit '+code)):resolve());
 })));
 const totals=Object.fromEntries(Object.keys(rows[0].counts).map(key=>[key,rows.reduce((n,r)=>n+r.counts[key],0)]));
 const summary={runs:rows.length,turns:rows.reduce((n,r)=>n+r.turns,0),completed:rows.filter(r=>r.completed).length,failures:rows.filter(r=>r.failure).length,boundary255:rows.filter(r=>r.boundaries.includes(255)).length,totals};
 writeFileSync(output,JSON.stringify({cutoffTurns:cutoff,controls,summary,rows:rows.sort((a,b)=>a.seed-b.seed)},null,2));console.log(JSON.stringify(summary));
 if(summary.failures)process.exitCode=1;
}
