// Bounded verification only. No cutoff is added to the game itself.
import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
import {createContinentV31World} from '../src/scenarios/continent-v31.js';
import {enableOfficerTraits,enablePersonalAbilities} from '../src/model/officer-traits.js';
import {engineFor,projectWorld} from '../src/engine/simulation.js';
const world=enablePersonalAbilities(enableOfficerTraits(createContinentV31World())),context=engineFor(world),engine=context.engine,controls={armyAssembly:true,armyFormation:true,unitSpacing:true,frontOperations:true,directArmyRelease:true,royalCapitalSync:true,personalAbility:true},results=[];
for(const seed of [123456,20261017,20261031]){
 let state=engine.createGame({seed,roundLimit:null}),view=projectWorld(world,state,context),combats=0,successors=0,deaths=0,checkpoints=[];
 while(!state.result&&state.turns<1000){const {state:next,record}=engine.prepareTurn(state,controls);state={...next,history:[]};combats+=record.battles.length;successors+=record.events.filter(e=>e.type==='appointment').length;deaths+=record.events.filter(e=>e.type==='death').length;
  for(const b of record.battles.filter(b=>!b.automatic))for(const side of [b.attack,b.defense]){assert.equal(side.score,side.raw+side.bonus);if(side.role!=='king')assert(side.personalAbility>=-4&&side.personalAbility<=4);}
  if(state.turns%25===0||record.events.some(e=>e.type==='appointment')||[255,256,512].includes(state.turns)){view=projectWorld(world,state,context,view);const nations=new Set(view.territories.map(t=>t.ownerId)),people=view.people.filter(p=>nations.has(p.countryId)&&p.alive!==false&&!p.portraitMissing),keys=people.map(p=>p.portraitKey);assert.equal(new Set(keys).size,keys.length);}
  if([255,256,512].includes(state.turns)){const restored=structuredClone(state);assert(engine.validState(restored));assert.deepEqual(engine.prepareTurn(restored,controls).state,engine.prepareTurn(state,controls).state);checkpoints.push(state.turns);}
 }
 const row={seed,turn:state.turns,result:state.result,combats,deaths,successors,checkpoints};results.push(row);console.log(JSON.stringify(row));
}
writeFileSync('.artifacts/v45-stress.json',JSON.stringify({budgetPerSeed:1000,results,failures:0},null,2));
