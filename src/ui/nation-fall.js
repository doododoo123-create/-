import {esc} from './icons.js';
export function renderNationFall(scene){
 const world=scene.worldAfter||scene.worldBefore,country=world?.countries.find(c=>c.id===scene.event?.targetId),name=country?.name||scene.event?.title?.replace(/ 멸망$/,'')||'국가';
 return `<aside class="season-announcement nation-fall-announcement" data-nation-fall="${esc(country?.id||scene.event?.targetId||'')}" style="--fallen-color:${esc(country?.color||'#d1a367')}" role="status" aria-live="polite"><span class="season-symbol" aria-hidden="true">⚑</span><strong>${esc(name)} 멸망</strong></aside>`;
}
