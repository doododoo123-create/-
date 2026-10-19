import{mkdir,writeFile}from'node:fs/promises';
import{blankWorld,validateWorld}from'../src/model/world.js';
import{createRun,nextTurn}from'../src/engine/simulation.js';
import{serializeWorld}from'../src/storage/world-store.js';
import{saveRun}from'../src/storage/run-store.js';
function worldFor(split=4,weak=false){
 const w=blankWorld({rows:3,cols:4});w.rules.baseCapacity=100;w.rules.seaSupply=false;w.rules.expeditionChances=[99,99,99,99,99,99];
 w.countries=['a','b'].map(id=>({id,name:id==='a'?'공격국':'수비국',color:id==='a'?'#ff2028':'#006bff',troops:weak?(id==='a'?35:7):45,recruitment:0,personality:'balanced'}));
 w.people=w.countries.flatMap(c=>[{id:'king-'+c.id,name:c.id+'왕',countryId:c.id,role:'king',ability:0,personality:'balanced'},...Array.from({length:3},(_,slot)=>({id:c.id+slot,name:c.id+'장군'+slot,countryId:c.id,role:'general',ability:weak&&c.id==='a'?4:0,personality:'balanced',slot}))]);
 w.territories.forEach((t,i)=>t.ownerId=i<split?'a':'b');w.cartography={version:1,style:'illustrated',opacity:.2,background:null,polygons:{},links:Array.from({length:11},(_,i)=>['tile-'+i,'tile-'+(i+1)])};return validateWorld(w);
}
const encoded=r=>{let data;saveRun({setItem:(_,value)=>data=JSON.parse(value)},r);return{world:JSON.parse(serializeWorld(r.initialWorld)),run:data};};
const w=worldFor(4,true);let history=createRun(w,7);
for(let i=0;i<8;i++)history=nextTurn(history,i===0?{targetId:'b',targetCells:{0:'tile-4'},rolls:{king:10,'expedition:0':1,'attack:0':30,'defense:0':1,'death:0':1}}:{rolls:{king:1,minister:1,domestic:1,'successor:0':9}});
if(history.history[0].battles[0].attack.armyBonus!==20)throw Error('New maximum army bonus was not applied to an actual battle');
if(!history.history[0].events.some(e=>e.type==='death')||!history.history[7].events.some(e=>e.type==='appointment'))throw Error('Missing real death/appointment fixture');
const capital=nextTurn(createRun(worldFor(7),7),{targetId:'b',targetCells:{0:'tile-7'},rolls:{king:10,'expedition:0':1,'expedition:1':100,'attack:0':15,'defense:0':10}});
if(!capital.history[0].events.some(e=>e.type==='retreat'&&e.reason==='capital'))throw Error('Missing capital retreat fixture');
await mkdir(new URL('../.artifacts/',import.meta.url),{recursive:true});await writeFile(new URL('../.artifacts/v10-browser-fixture.json',import.meta.url),JSON.stringify({tiny:encoded(createRun(worldFor(11),7)),history:encoded(history),capital:encoded(capital),capitalPerson:capital.world.people.find(p=>p.countryId==='b'&&p.role==='general'&&p.territoryIds.length===0&&p.active)}));
