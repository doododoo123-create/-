import { esc } from './icons.js';
export const sideBonus=side=>side.bonus??((side.ability||0)+(side.armyBonus||0));
const combatSign=n=>n>=0?`+${n}`:`${n}`;
export function renderCombatBonuses(side){return `<div class="combat-breakdown"><span>장군 ${combatSign(side.ability||0)}</span><span>병력 ${combatSign(side.armyBonus||0)}</span>${side.experienceBonus!==undefined?`<span>전적 ${combatSign(side.experienceBonus)}</span><span>지형 ${combatSign(side.terrainBonus||0)}</span>`:''}${side.fatigueBonus!==undefined?`<span class="fatigue-bonus">이동 ${side.movementEdges}칸 ${combatSign(side.fatigueBonus)}</span>`:''}</div>`;}
export function veteranStars(person){return person?.wins>=3?`<span class="veteran-stars" title="${esc(person.wins)}승">${'★'.repeat(Math.min(3,Math.floor(person.wins/3)))}</span>`:'';}
