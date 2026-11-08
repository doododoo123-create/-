import {blankWorld,validateWorld} from '../src/model/world.js';
import {quiet23World} from './campaign-v23-fixture.mjs';
import {createRun,nextTurn} from '../src/engine/simulation.js';
import {campaign22Controls} from './campaign-v22-fixture.mjs';
export function isolated49Fixture({continuous=true}={}){
 const w=quiet23World(),grid=blankWorld({rows:2,cols:4});w.rows=2;w.cols=4;w.territories=grid.territories;w.id='isolated49-'+continuous;
 w.countries[0].capitalId='tile-0';w.countries[1].capitalId='tile-7';w.countries.forEach(c=>c.troops=45);
 w.territories.forEach((t,i)=>t.ownerId=[3,6,7].includes(i)?'b':'a');
 w.cartography={version:1,style:'classic',opacity:.3,background:null,polygons:{},links:Array.from({length:7},(_,i)=>['tile-'+i,'tile-'+(i+1)])};
 Object.assign(w.rules,{continuousCampaign:continuous,domesticThresholds:{balanced:5,peaceful:5,aggressive:5},nearbyRetreat:true,seaSupply:false,defenderCounterattack:false,capitalFallAnnexation:false,strategicTargets:false,recoveryPriority:false,territoriesPerCommander:3,baseCapacity:25,territoryArmyLimit:100,captureThresholds:[100,200],expeditionChances:[100,100,100,100,100,100]});
 w.deployment={version:1,generals:[['a0',[0,1,2],2],['a1',[4,5],4],['b0',[3],3],['b1',[6,7],7]].map(([personId,ids,position])=>({personId,territoryIds:ids.map(i=>'tile-'+i),stationId:'tile-'+position,positionId:'tile-'+position}))};
 let run=createRun(validateWorld(w),777);for(let i=0;i<12;i++)run=nextTurn(run,{rolls:{king:1,minister:1,domestic:1}});return run;
}
export function isolated49Controls(){const c=campaign22Controls(30,1);c.targetCells={0:'tile-3'};c.isolatedEvacuation=true;return c;}
