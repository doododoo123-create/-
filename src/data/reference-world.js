import { ADDITIVE_COMBAT_DEFAULTS } from '../model/combat-rules.js';
import { createDemoWorld } from './demo-world.js';
import { REFERENCE_CELLS } from './reference-map.js';
import { validateWorld, clone } from '../model/world.js';
import { defaultCartography } from '../model/cartography.js';
import { boundaryLinks } from '../model/free-map.js';
export function referenceLayout(world){
  if(world.territories.length!==REFERENCE_CELLS.length)throw new Error('참고 대륙 배치는 80개 영토 세계에 적용할 수 있습니다. 새 세계에서 참고 대륙을 선택해 주세요.');
  const next=clone(world);next.mapKind='free';next.cartography={...defaultCartography(),plate:'reference',opacity:.17,polygons:{},links:[]};
  next.territories.forEach((t,i)=>{delete t.row;delete t.col;Object.defineProperty(next.cartography.polygons,t.id,{value:clone(REFERENCE_CELLS[i]),enumerable:true,writable:true,configurable:true});});
  next.cartography.links=boundaryLinks(next);return validateWorld(next);
}
export function createReferenceWorld(){const world=referenceLayout(createDemoWorld());world.id='seven-realms-free-coast';world.rules={...world.rules,...clone(ADDITIVE_COMBAT_DEFAULTS),seaSupply:true};world.people.forEach(p=>{if(p.role==='general')p.ability*=2;});const colors=['#006BFF','#EF2028','#FFC400','#00B550','#903CFF','#00CADB','#FF7700'];world.countries.forEach((c,i)=>c.color=colors[i%colors.length]);world.description='참고 그림을 바탕으로 한 자유 대륙 · 큰 만과 반도, 80개 영토 · 거리별 출전·구원 방어·D30 전투';return world;}
