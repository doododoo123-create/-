import{mkdir,writeFile}from'node:fs/promises';
import{fourArmyFixture}from'./studio-v41-fixture.mjs';
import{createRun,nextTurn}from'../src/engine/simulation.js';
import{enablePersonalAbilities}from'../src/model/officer-traits.js';
import{exportHistoryData}from'../src/storage/history-file.js';
await mkdir('.artifacts',{recursive:true});
for(const death of [false,true]){
 const f=fourArmyFixture({deathRaw:death?1:10}),w=enablePersonalAbilities(structuredClone(f.start.initialWorld));
 for(const p of w.people.filter(p=>p.role==='general'))p.personalAbility=p.id==='a0'?4:p.id==='b0'?-3:0;
 let run=nextTurn(createRun(w,777),{...f.record.controls,personalAbility:true});
 if(death)for(let i=0;i<24&&!run.result&&!run.history.at(-1).events.some(e=>e.type==='appointment');i++)run=nextTurn(run,{personalAbility:true,armyAssembly:true,armyFormation:true,unitSpacing:true,frontOperations:true,directArmyRelease:true,royalCapitalSync:true,rolls:{king:1,minister:1,domestic:1}});
 const data=await exportHistoryData(run);await writeFile(`.artifacts/v45-${death?'death':'four'}.history.json`,JSON.stringify(data));
 console.log(JSON.stringify({name:death?'death':'four',turn:run.turn,battles:run.history[0].battles.length,deathTurns:run.history.filter(r=>r.events.some(e=>e.type==='death')).map(r=>r.turn),appointmentTurns:run.history.filter(r=>r.events.some(e=>e.type==='appointment')).map(r=>r.turn)}));
}
