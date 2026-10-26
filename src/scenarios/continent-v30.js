import {createContinentV28World} from './continent-v28.js';
import {supportsTerritoryPresetV25} from '../model/territory-preset-v25.js';
import {clone,validateWorld} from '../model/world.js';
import {createRun} from '../engine/simulation.js';
// Approved scenario edits, not a migration of a live history.
export const DEPLOYMENT_V30=Object.freeze({'king-3':'territory-034','general-3-1':'territory-059','general-3-0':'territory-083','king-6':'territory-092','general-6-0':'territory-066','general-4-1':'territory-121','king-2':'territory-053'});
export const MOUNTAINS_V30=Object.freeze(['territory-136','territory-135','territory-117']);
export function applyDeploymentV30(input){
 if(!supportsTerritoryPresetV25(input))throw Error('이 주둔·산악 배치는 기본160영토·7국 대륙에서 사용합니다.');
 const w=clone(input);
 if(!w.deployment){const preview=createRun(w,0).world,active=preview.people.filter(p=>p.role==='general'&&p.active&&p.alive);for(const p of active)if(!w.people.some(q=>q.id===p.id))w.people.push({id:p.id,name:p.name,role:p.role,countryId:p.countryId,slot:p.slot,ability:p.ability,commandBonus:p.commandBonus,personality:p.personality||'balanced',feature:p.feature||''});w.deployment={version:1,generals:active.map(p=>({personId:p.id,stationId:p.stationId,positionId:p.positionId||p.stationId,territoryIds:[...p.territoryIds]}))};}
 for(const [id,target] of Object.entries(DEPLOYMENT_V30)){
  const p=w.people.find(p=>p.id===id),t=w.territories.find(t=>t.id===target);if(!p||t?.ownerId!==p.countryId)throw Error('지정한 시작 영토가 해당 인물의 자국 땅인지 확인해 주세요. 기존 세계는 유지합니다.');
  if(p.role==='king'){w.countries.find(c=>c.id===p.countryId).capitalId=target;continue;}
  const entry=w.deployment.generals.find(e=>e.personId===id);if(!entry)throw Error('지정 장군의 초기 배치를 확인해 주세요.');
  if(!entry.territoryIds.includes(target)){
   const donor=w.deployment.generals.find(e=>e.territoryIds.includes(target));if(donor){donor.territoryIds=donor.territoryIds.filter(t=>t!==target);if(donor.stationId===target){donor.stationId=donor.territoryIds[0]||w.countries.find(c=>c.id===p.countryId).capitalId;donor.positionId=donor.stationId;}}
   entry.territoryIds.push(target);
  }
  entry.stationId=target;entry.positionId=target;
 }
 for(const id of MOUNTAINS_V30)w.territories.find(t=>t.id===id).terrain='mountain';
 return validateWorld(w);
}
export function matchesDeploymentV30(w){return supportsTerritoryPresetV25(w)&&Object.entries(DEPLOYMENT_V30).every(([id,target])=>{const p=w.people.find(p=>p.id===id);if(!p)return false;if(p.role==='king')return w.countries.find(c=>c.id===p.countryId)?.capitalId===target;const e=w.deployment?.generals.find(e=>e.personId===id);return e?.stationId===target&&e.positionId===target&&e.territoryIds.includes(target);})&&MOUNTAINS_V30.every(id=>w.territories.find(t=>t.id===id)?.terrain==='mountain');}
export const createContinentV30World=()=>applyDeploymentV30(createContinentV28World());
