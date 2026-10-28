import {esc} from './icons.js';
// Persistent card marks read the visible officer state, never a future battle result.
export function confusionCount(person){return person?.alive!==false&&!person?.readiness?.resting?Math.max(0,Math.min(3,Math.floor((person?.confusion||0)/2))):0;}
export function confusionMark(person){const count=confusionCount(person);return count?`<span class="token-confusion" data-confusion="${person.confusion}" aria-label="혼란 ${esc(person.confusion)}점 감점" title="혼란 −${esc(person.confusion)}점">${'↓'.repeat(count)}</span>`:'';}

export function portraitConfusion(person){const count=confusionCount(person);return count?`<span class="portrait-confusion" data-confusion="${person.confusion}" aria-label="혼란 ${esc(person.confusion)}점 감점" title="혼란 −${esc(person.confusion)}점">${'↓'.repeat(count)}</span>`:'';}
