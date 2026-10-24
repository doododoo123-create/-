import {writeFile,mkdir} from 'node:fs/promises';
import {createContinent160World} from '../src/data/continent160-world.js';
import {enableCampaignV22} from '../src/model/campaign-v22.js';
import {createRun,nextTurn} from '../src/engine/simulation.js';
import {saveRun} from '../src/storage/run-store.js';
import {serializeWorld,parseWorld} from '../src/storage/world-store.js';
import {neighbors} from '../src/model/world.js';
await mkdir('.artifacts',{recursive:true});
const w=enableCampaignV22(createContinent160World());w.rules.capitalFallAnnexation=false;w.rules.strategicTargets=false;w.rules.expeditionChances=[100,100,100,100,100,100];w.countries.forEach((c,i)=>c.troops=i===1?0:50);
let run=createRun(w,777);const enemy=w.countries[1].id,actor=w.countries[0].id,target=w.territories.find(t=>t.ownerId===enemy&&neighbors(w,t).some(v=>v.ownerId===actor)).id;
run=nextTurn(run,{targetId:enemy,targetCells:{0:target},rolls:{king:10,'expedition:0':1}});const first=run.history[0].battles.find(b=>b.takenCells.length===3);if(!first)throw Error('A real three-province unopposed advance is required');
for(let i=0;i<7&&!run.result;i++)run=nextTurn(run,{rolls:{king:1,minister:1,domestic:10}});
let saved;saveRun({setItem:(_,v)=>saved=JSON.parse(v)},run);await writeFile('.artifacts/v22-flow-fixture.json',JSON.stringify({world:JSON.parse(serializeWorld(run.initialWorld)),run:saved,turn:1,battle:first,ministerTurn:2,seasonTurn:run.history.find(r=>r.round===2)?.turn}));
let natural=createRun(enableCampaignV22(createContinent160World()),777),counter=null,death=null;
for(let i=0;i<80&&!natural.result&&(!counter||!death);i++){
 natural=nextTurn(natural);const r=natural.history.at(-1);
 for(const id of new Set(r.battles.map(b=>b.operationId))){const bs=r.battles.filter(b=>b.operationId===id),cs=bs.filter(b=>b.continuation==='counter');if(cs.length>=2&&new Set(cs.map(b=>b.actor)).size>1&&!counter)counter={turn:r.turn,operation:id,battles:bs};}
 const e=r.events.find(e=>e.type==='death'&&e.survivors>0);if(e&&!death)death={turn:r.turn,battle:e.battleIndex,event:e};
}
if(!counter||!death)throw Error('A replayable counter-counterattack and positive-army death are required');let naturalSave;saveRun({setItem:(_,v)=>naturalSave=JSON.parse(v)},natural);await writeFile('.artifacts/v22-combat-fixture.json',JSON.stringify({world:JSON.parse(serializeWorld(natural.initialWorld)),run:naturalSave,counter,death}));
console.log(JSON.stringify({flowTurn:1,capture:first.takenTerritoryIds,season:run.history.find(r=>r.round===2)?.turn,counterTurn:counter.turn,deathTurn:death.turn,naturalTurns:natural.turn}));
