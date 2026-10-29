import {studio38Fixture,studio38Controls} from './studio-v38-fixture.mjs';
import {createRun,nextTurn} from '../src/engine/simulation.js';
export function studio39Fixture({multiAttack=false,mirror=false,elimination=false,...options}={}){
 const w=structuredClone(studio38Fixture({...options,cohort:mirror||options.cohort}).initialWorld);
 if(elimination){w.countries[1].capitalId='tile-7';w.territories.forEach((t,i)=>{if(i>=8)t.ownerId='c';});w.deployment.generals=w.deployment.generals.filter(e=>e.personId.startsWith('a'));w.deployment.generals.push({personId:'b0',stationId:'tile-6',positionId:'tile-6',territoryIds:['tile-6','tile-7']},{personId:'c0',stationId:'tile-17',positionId:'tile-17',territoryIds:Array.from({length:10},(_,i)=>'tile-'+(8+i))});}
 if(mirror){w.cartography.polygons=Object.fromEntries(w.territories.map((t,i)=>{const x=1100-(i%9)*115,y=180+Math.floor(i/9)*300;return [t.id,{points:[[x,y],[x+100,y],[x+100,y+180],[x,y+180]],center:[x+50,y+90]}];}));}
 return createRun(w,777);
}
export function studio39Controls({multiAttack=false,...options}={}){const c=studio38Controls(options);if(multiAttack)for(const key of Object.keys(c.rolls)){if(key.startsWith('attack:'))c.rolls[key]=15;if(key.startsWith('defense:'))c.rolls[key]=16;}return c;}
export function simulate39(options={}){const start=studio39Fixture(options),run=nextTurn(start,studio39Controls(options));return {start,run,record:run.history[0]};}
