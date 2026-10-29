import{studio39Fixture,studio39Controls}from'./studio-v39-fixture.mjs';
import{enableOfficerTraits}from'../src/model/officer-traits.js';
import{createRun,nextTurn}from'../src/engine/simulation.js';
export function fourArmyFixture({deathRaw=10}={}){
 const w=structuredClone(studio39Fixture({cohort:true}).initialWorld);w.countries[0].troops=100;w.countries[1].troops=100;
 for(const [nation,prefix,ids,stations] of [['a','a',[[0,1],[2],[3,4],[5]],[0,2,4,5]],['b','b',[[6,7],[8,9],[10,11],[12,13,14]],[6,8,10,13]]]){
  const original=w.people.find(p=>p.id===prefix+'0');w.people=w.people.filter(p=>!(p.countryId===nation&&p.role==='general'));
  w.deployment.generals=w.deployment.generals.filter(p=>!p.personId.startsWith(prefix));
  for(let i=0;i<4;i++){w.people.push({...original,id:prefix+i,name:prefix+i,slot:i,ability:0});w.deployment.generals.push({personId:prefix+i,territoryIds:ids[i].map(n=>'tile-'+n),stationId:'tile-'+stations[i],positionId:'tile-'+(nation==='a'?5:6)});}
 }
 w.rules.defenderCounterattack=false;if(deathRaw===1){w.rules.territoriesPerCommander=3;w.rules.routDeath=true;w.rules.routDeathChance=10;w.rules.captureThresholds=[10,20];}const start=createRun(enableOfficerTraits(w),777),controls=studio39Controls({cohort:true});controls.targetCells={0:'tile-6',1:'tile-6',2:'tile-6',3:'tile-6'};
 for(const key of Object.keys(controls.rolls)){if(key.startsWith('death:'))controls.rolls[key]=deathRaw;if(key.startsWith('attack:'))controls.rolls[key]=key.startsWith('attack:3')?30:1;if(key.startsWith('defense:'))controls.rolls[key]=key.startsWith('defense:3')?1:30;}
 const run=nextTurn(start,controls);return {start,run,record:run.history[0]};
}
