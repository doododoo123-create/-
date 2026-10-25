import { esc } from './icons.js';
export const sideBonus=side=>side.bonus??((side.ability||0)+(side.armyBonus||0));
const combatSign=n=>n>=0?`+${n}`:`${n}`;
export function renderCombatBonuses(side){return `<div class="combat-breakdown"><span>장군 ${combatSign(side.ability||0)}</span><span>병력 ${combatSign(side.armyBonus||0)}</span>${side.experienceBonus!==undefined?`<span>${side.underdogWins!==undefined?'역전':'전적'} ${combatSign(side.experienceBonus)}</span><span>지형 ${combatSign(side.terrainBonus||0)}</span>`:''}${side.fatigueBonus!==undefined?`<span class="fatigue-bonus">이동 ${side.movementEdges}칸 ${combatSign(side.fatigueBonus)}</span>`:''}${side.confusionBonus!==undefined?`<span>혼란 ${combatSign(side.confusionBonus)}</span>`:''}</div>`;}
export function renderObserverBonuses(side,{all=false}={}){
 const items=[['장군',side.ability||0],['병력',side.armyBonus||0],[side.underdogWins!==undefined?'역전':'전적',side.experienceBonus||0],[all?'지형':'산악',side.terrainBonus||0],['피로',side.fatigueBonus||0],...(side.confusionBonus!==undefined?[['혼란',side.confusionBonus]]:[])].filter(([,n])=>all||n);
 return `<div class="observer-bonuses">${items.length?items.map(([name,n])=>`<span>${name} ${combatSign(n)}</span>`).join(''):'<span class="no-bonus">추가 보정 없음</span>'}</div>`;
}
export function renderObserverScore(side,revealed){return `<div class="observer-score" data-score-visible="${revealed}"><span>최종 점수</span><strong>${revealed?side.score:'—'}</strong><small>${revealed?`주사위 ${side.raw} ${sideBonus(side)<0?'−':'+'} 보정 ${Math.abs(sideBonus(side))}`:'판정 대기'}</small></div>`;}
export function veteranStars(person){const underdog=person?.underdogWins!==undefined,count=underdog?person.underdogWins:person?.wins||0;return count>=3?`<span class="veteran-stars" title="${esc(count)}${underdog?'회 역전승':'승'}">${'★'.repeat(Math.min(3,Math.floor(count/3)))}</span>`:'';}
