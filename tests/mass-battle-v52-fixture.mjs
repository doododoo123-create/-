import {fourArmyFixture} from './studio-v41-fixture.mjs';
import {blankWorld} from '../src/model/world.js';
import {createRun,nextTurn} from '../src/engine/simulation.js';
export function largeMassFixture(){
 const f=fourArmyFixture(),w=structuredClone(f.start.initialWorld),grid=blankWorld({rows:8,cols:8});Object.assign(w,{rows:8,cols:8,mapKind:'grid',territories:grid.territories,cartography:{version:1,style:'classic',opacity:.3,background:null,polygons:{},links:null}});
 w.countries[0].capitalId='tile-0';w.countries[1].capitalId='tile-63';w.countries.forEach(c=>c.troops=320);w.territories.forEach((t,i)=>t.ownerId=i<32?'a':'b');Object.assign(w.rules,{territoriesPerCommander:2,territoryArmyLimit:100,baseCapacity:25,capacityCap:25,warReadiness:false,routDeath:false});
 const originals=['a','b'].map(id=>w.people.find(p=>p.countryId===id&&p.role==='general'));w.people=w.people.filter(p=>p.role!=='general');w.deployment={version:1,generals:[]};
 for(let n=0;n<2;n++)for(let i=0;i<16;i++){const id=(n?'b':'a')+i,station=n*32+i*2;w.people.push({...originals[n],id,name:id,slot:i});w.deployment.generals.push({personId:id,territoryIds:['tile-'+station,'tile-'+(station+1)],stationId:'tile-'+station,positionId:'tile-'+(n?32:24)});}
 const start=createRun(w,777),controls=structuredClone(f.record.controls);controls.targetCells=Object.fromEntries(Array.from({length:16},(_,i)=>[i,'tile-32']));for(let i=0;i<16;i++){controls.rolls['expedition:'+i]=1;controls.rolls['attack:'+i]=i<15?1:30;controls.rolls['defense:'+i]=i<15?30:1;}
 const run=nextTurn(start,controls);return {start,run,record:run.history[0]};
}
