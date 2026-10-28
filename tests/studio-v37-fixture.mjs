import {studio36Fixture,studio36Controls} from './studio-v36-fixture.mjs';
import {createRun} from '../src/engine/simulation.js';
import {validateWorld} from '../src/model/world.js';
export function studio37Fixture({twoFronts=false,...options}={}){
 const world=structuredClone(studio36Fixture(options).initialWorld);
 if(twoFronts){
  world.cartography.links.push(['tile-0','tile-14']);
  world.countries[0].troops=105;world.countries[1].troops=55;
  world.countries[1].capitalId='tile-10';
  world.deployment.generals=world.deployment.generals.filter(e=>!e.personId.startsWith('a')&&!e.personId.startsWith('b'));
  const deploy=(id,ids,position)=>({personId:id,territoryIds:ids.map(i=>'tile-'+i),stationId:'tile-'+position,positionId:'tile-'+position});
  world.deployment.generals.push(deploy('a0',[0],0),deploy('a1',[1,2],1),deploy('a2',[3,4],4),deploy('a3',[5],5),deploy('b0',[6,7,8,9],6),deploy('b1',[10,11,12,13,14],14));
 }
 world.territories[6].terrain='mountain';world.territories[6].name='운곡';world.territories[14].name='해림';
 return createRun(validateWorld(world),777);
}
export function studio37Controls({twoFronts=false}={}){const controls={...studio36Controls(),frontOperations:true};if(twoFronts)controls.targetCells={0:'tile-14',1:'tile-14',2:'tile-6',3:'tile-6'};return controls;}
