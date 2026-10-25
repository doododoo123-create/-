import { clone,validateWorld } from './world.js';
import { CONTINENT160_NAMES } from '../data/continent160-names.js';
const ids=names=>names.split(' ').map(name=>{const id=Object.keys(CONTINENT160_NAMES).find(id=>CONTINENT160_NAMES[id]===name);if(!id)throw Error('초기 영토 지명을 확인해 주세요: '+name);return id;});
// User-approved borders, 2026-10-25. Geometry and the historical/base preset remain unchanged.
export const TERRITORY_PRESET_V25=Object.freeze({
 'nation-0':ids('설원 백령 빙하 한원 설해 서림 한곡 청록 설봉 북진 운목 은령 청곡 상림 상백 한수 서설 청령 백운 백천 한령 청원 비림 녹원 비곡 송림 중령 북천 천봉 운령 천령 임천 운곡 금곡 운림 청하 중원 용관 금하 하원 용하'),
 'nation-1':ids('임원 금천 수원 강원 하림 남천 남원 화원 낙하 창하 운포 남령 서포 서산 남관 서천 남하 남곡 금림 청산 풍림 서항 남해 금항 남항 월포 청항 월림 남산 해릉 해월 남곡진'),
 'nation-2':ids('북릉 설관 운봉 서령 동설 운설 천설 산음 상원 설진 벽령 황원 금령 양곡 동령 동관 벽산 명원 해동 청해 진원 금원 동진 해원 청진 해관 동림 낙원 해천 해진 동천 금포 청포 해안 동원 동하 풍원 운하 황림 창원 진하 평원'),
 'nation-3':ids('서진 송원 해서 서해 해림 서관 강림 서봉 유림 유곡 곡천 서하 산서 금봉'),
 'nation-4':ids('진천 강진 금진 평하 남림 해곡 동포 연진 연포 해평 남문'),
 'nation-5':ids('창진 남평 남강 용진 연하 남포 청월 남동 해성 해봉 남진 동산 벽해 해운 해문 남운'),
 'nation-6':ids('서원 백림 중천 용원'),
});
export const TERRITORY_CAPITALS_V25=Object.freeze({'nation-0':'territory-003','nation-1':'territory-114','nation-2':'territory-026','nation-3':'territory-086','nation-4':'territory-138','nation-5':'territory-156','nation-6':'territory-066'});
export function supportsTerritoryPresetV25(world){return world?.mapKind==='free'&&world.cartography?.plate==='continent160'&&world.territories.length===160&&Object.keys(CONTINENT160_NAMES).every(id=>world.territories.some(t=>t.id===id))&&Object.keys(TERRITORY_PRESET_V25).every(id=>world.countries.some(c=>c.id===id))&&world.countries.length===7;}
export function matchesTerritoryPresetV25(world){return supportsTerritoryPresetV25(world)&&Object.entries(TERRITORY_PRESET_V25).every(([owner,ids])=>ids.every(id=>world.territories.find(t=>t.id===id)?.ownerId===owner))&&world.countries.every(c=>c.capitalId===TERRITORY_CAPITALS_V25[c.id]);}
export function applyTerritoryPresetV25(input){
 if(!supportsTerritoryPresetV25(input))throw Error('이 영토 배치는 기본 160영토·7국 대륙에서 사용합니다.');
 const next=clone(input),owners=new Map(Object.entries(TERRITORY_PRESET_V25).flatMap(([owner,ids])=>ids.map(id=>[id,owner])));
 if(owners.size!==160)throw Error('초기 영토 배치160개를 확인해 주세요.');
 for(const t of next.territories)t.ownerId=owners.get(t.id);
 for(const c of next.countries)c.capitalId=TERRITORY_CAPITALS_V25[c.id];
 delete next.deployment;
 return validateWorld(next);
}
