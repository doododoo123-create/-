import {studio37Fixture,studio37Controls} from './studio-v37-fixture.mjs';
import {createRun,nextTurn} from '../src/engine/simulation.js';
export function studio38Fixture({cohort=false,reinforce=false,...options}={}){
 const w=structuredClone(studio37Fixture({...options,duel:cohort||options.duel}).initialWorld);
 const deploy=(id,ids,station,position=station)=>({personId:id,territoryIds:ids.map(i=>'tile-'+i),stationId:'tile-'+station,positionId:'tile-'+position});
 if(cohort){w.countries[1].troops=80;w.deployment.generals=w.deployment.generals.filter(e=>!e.personId.startsWith('b'));w.deployment.generals.push(deploy('b0',[6,7,8],6),deploy('b1',[9,10,11],10,6),deploy('b2',[12,13,14],13,6));}
 if(reinforce){w.countries[1].troops=55;w.deployment.generals=w.deployment.generals.filter(e=>!e.personId.startsWith('b'));w.deployment.generals.push(deploy('b0',[6],6),deploy('b1',[7,8,9,10,11,12,13,14],8));}
 return createRun(w,777);
}
export function studio38Controls(options={}){return {...studio37Controls(options),directArmyRelease:true};}
export function domestic38Fixture(){
 const w=structuredClone(studio37Fixture().initialWorld);
 for(const e of w.deployment.generals.filter(e=>e.personId.startsWith('a')))e.positionId='tile-5';
 const start=createRun(w,777),run=nextTurn(start,{armyAssembly:true,armyFormation:true,unitSpacing:true,frontOperations:true,directArmyRelease:true,rolls:{king:1,minister:1,domestic:1}});return {start,run};
}
