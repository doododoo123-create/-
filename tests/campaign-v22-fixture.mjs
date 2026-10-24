import {blankWorld,validateWorld} from '../src/model/world.js';
import {enableCampaignV22} from '../src/model/campaign-v22.js';
import {createRun,projectWorld,engineFor} from '../src/engine/simulation.js';
export function campaign22Fixture({empty=false,secondArmy=0}={}){
 const w=enableCampaignV22(blankWorld({rows:2,cols:6}));Object.assign(w.rules,{seaSupply:false,captureThresholds:[10,20],capitalFallAnnexation:false,strategicTargets:false,baseCapacity:25,territoryArmyLimit:100,territoriesPerCommander:2,expeditionChances:[100,100,100,100,100,100]});
 w.countries=['a','b','c'].map((id,i)=>({id,name:id+'국',color:['#ff2030','#007bff','#00dd50'][i],troops:30,recruitment:0,personality:'balanced',capitalId:'tile-'+[0,10,11][i]}));
 w.people=w.countries.flatMap(c=>[{id:'king-'+c.id,countryId:c.id,name:c.id+'왕',role:'king',ability:0,personality:'balanced'},{id:'minister-'+c.id,countryId:c.id,name:c.id+'승상',role:'minister',personality:'balanced',ability:2,ministerStyle:'balanced'},...Array.from({length:5},(_,slot)=>({id:c.id+slot,countryId:c.id,name:c.id+slot,role:'general',ability:0,personality:'balanced',slot}))]);
 w.territories.forEach((t,i)=>t.ownerId=i<4?'a':i<11?'b':'c');w.cartography={version:1,style:'classic',opacity:.3,background:null,polygons:{},links:Array.from({length:11},(_,i)=>['tile-'+i,'tile-'+(i+1)])};
 const r=createRun(validateWorld(w),777),s=r.engineState,assigned=[0,0,1,1,0,0,1,1,2,2,3,0];s.cells.forEach((t,i)=>t.commander=assigned[i]);
 for(const c of s.countries){c.reserve=5;for(const g of c.generals)g.troops=g.active?7:0;}
 const a=s.countries[0].generals;a[0].position=0;a[0].station=0;a[0].troops=7;a[1].position=2;a[1].station=2;a[1].troops=secondArmy;
 const b=s.countries[1].generals;for(let i=0;i<4;i++){b[i].position=4+i*2;b[i].station=4+i*2;b[i].troops=empty?0:7;}
 for(const c of s.countries)c.army=c.reserve+(c.reorganization||0)+c.generals.reduce((n,g)=>n+g.troops,0);r.world=projectWorld(r.initialWorld,s);if(!engineFor(r.initialWorld).engine.validState(s))throw Error('Invalid v22 fixture');return r;
}
export function campaign22Controls(attack=30,defense=1){const rolls={king:10};for(let slot=0;slot<6;slot++){rolls['expedition:'+slot]=1;for(let i=0;i<40;i++){const suffix=i?':chain:'+i:'';rolls['attack:'+slot+suffix]=attack;rolls['defense:'+slot+suffix]=defense;rolls['death:'+slot+suffix]=10;}}return {targetId:'b',targetCells:{0:'tile-4'},rolls};}
