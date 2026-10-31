import {studio39Fixture,studio39Controls} from './studio-v39-fixture.mjs';
import {enableOfficerTraits,enablePersonalAbilities} from '../src/model/officer-traits.js';
import {createRun,nextTurn} from '../src/engine/simulation.js';
export function exile46World(){
 const w=structuredClone(studio39Fixture({elimination:true}).initialWorld);Object.assign(w.rules,{territoriesPerCommander:2,baseCapacity:25,capacityCap:25,captureThresholds:[10,20],routDeath:false,defenderCounterattack:false,capitalFallAnnexation:false,warReadiness:false});w.countries[0].troops=65;w.countries[1].troops=25;w.countries[2].troops=40;
 const d=(id,ids,station)=>({personId:id,territoryIds:ids.map(i=>'tile-'+i),stationId:'tile-'+station,positionId:'tile-'+station});
 w.deployment.generals=[d('a0',[0,1],1),d('a1',[2,3],3),d('a2',[4,5],5),d('b0',[6,7],6),...Array.from({length:5},(_,i)=>d('c'+i,[8+i*2,9+i*2],8+i*2))];
 return enablePersonalAbilities(enableOfficerTraits(w));
}
export function exile46Controls(win=true){const c=studio39Controls({elimination:true});c.targetCells={0:'tile-6'};c.recruitExiles=true;c.personalAbility=true;c.royalCapitalSync=true;c.landSupplyOnly=true;for(const key of Object.keys(c.rolls)){if(key.startsWith('attack:'))c.rolls[key]=win?30:1;if(key.startsWith('defense:'))c.rolls[key]=win?1:30;}return c;}
export function exile46Fixture(){
 const start=createRun(exile46World(),777);let run=nextTurn(start,exile46Controls(false));const veteran=run.world.people.find(p=>p.id==='b0');
 run=nextTurn(run,{recruitExiles:true,rolls:{king:1,minister:1,domestic:1}});run=nextTurn(run,{recruitExiles:true,rolls:{king:1,minister:1,domestic:1}});const beforeCapture=run;run=nextTurn(run,exile46Controls(true));return {start,beforeCapture,run,veteran};
}
