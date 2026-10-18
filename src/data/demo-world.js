import { V11_ATLAS, V11_NATIONS, V11_ROSTERS } from './v11-preset.js';
import { clone, DEFAULT_RULES, validateWorld } from '../model/world.js';
export function createDemoWorld(){
  const people=[];
  for(const c of V11_NATIONS){
    const id=`nation-${c.id}`,personality={balanced:'balanced',domestic:'peaceful',warlike:'aggressive'}[c.king];
    people.push({id:`king-${c.id}`,name:c.kingName,countryId:id,role:'king',ability:0,personality,feature:c.kingFeature});
    people.push({id:`minister-${c.id}`,name:c.ministerName,countryId:id,role:'minister',ability:c.ministerAbility,personality:'balanced',ministerStyle:c.minister,feature:c.ministerFeature});
    V11_ROSTERS[c.id].forEach((r,slot)=>people.push({id:`general-${c.id}-${slot}`,name:r[0],countryId:id,role:'general',ability:r[1],commandBonus:r[2],feature:r[3],slot,personality:'balanced'}));
  }
  return validateWorld({schemaVersion:2,id:'seven-realms-v11',name:'칠국의 여명',description:'원본 룰북 v11 · 7국, 80영토, 국왕·승상과 장군별 부대가 만드는 역사',rows:8,cols:10,mapKind:'v11',countries:V11_NATIONS.map(c=>({id:`nation-${c.id}`,name:c.name,color:c.color,troops:10,recruitment:0,personality:{balanced:'balanced',domestic:'peaceful',warlike:'aggressive'}[c.king],commandBonus:c.commandBonus,feature:c.feature,capitalId:`tile-${V11_ATLAS.capitals[c.id]}`})),people,territories:V11_ATLAS.cells.map(t=>({id:`tile-${t.id}`,row:t.row,col:t.col,name:t.name,ownerId:`nation-${t.owner}`})),rules:{...clone(DEFAULT_RULES),seaSupply:false}});
}
