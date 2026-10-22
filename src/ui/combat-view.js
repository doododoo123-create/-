import { esc } from './icons.js';
export const sideBonus=side=>side.bonus??((side.ability||0)+(side.armyBonus||0));
const combatSign=n=>n>=0?`+${n}`:`${n}`;
export function renderCombatBonuses(side){return `<div class="combat-breakdown"><span>장군 ${combatSign(side.ability||0)}</span><span>병력 ${combatSign(side.armyBonus||0)}</span>${side.experienceBonus!==undefined?`<span>전적 ${combatSign(side.experienceBonus)}</span><span>지형 ${combatSign(side.terrainBonus||0)}</span>`:''}${side.fatigueBonus!==undefined?`<span class="fatigue-bonus">이동 ${side.movementEdges}칸 ${combatSign(side.fatigueBonus)}</span>`:''}</div>`;}
export function renderObserverBonuses(side){
 const items=[['장군',side.ability],['병력',side.armyBonus],['전적',side.experienceBonus],['산악',side.terrainBonus],['피로',side.fatigueBonus]].filter(([,n])=>n);
 return `<div class="observer-bonuses">${items.length?items.map(([name,n])=>`<span>${name} ${combatSign(n)}</span>`).join(''):'<span class="no-bonus">추가 보정 없음</span>'}</div>`;
}
export function renderObserverScore(side,revealed){return `<div class="observer-score" data-score-visible="${revealed}"><span>최종 점수</span><strong>${revealed?side.score:'—'}</strong><small>${revealed?`주사위 ${side.raw} ${sideBonus(side)<0?'−':'+'} 보정 ${Math.abs(sideBonus(side))}`:'판정 대기'}</small></div>`;}
export function veteranStars(person){return person?.wins>=3?`<span class="veteran-stars" title="${esc(person.wins)}승">${'★'.repeat(Math.min(3,Math.floor(person.wins/3)))}</span>`:'';}
