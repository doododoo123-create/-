import {icon,esc} from './icons.js';

// Read only the displayed, committed result. A pending live result is not a reveal.
export function unificationCountry(world,result){
 if(result?.reason!=='unification'||result.winnerIds?.length!==1||!world?.territories?.length)return null;
 const country=world.countries.find(c=>c.id===result.winnerIds[0]);
 return country&&world.territories.every(t=>t.ownerId===country.id)?country:null;
}
export function renderUnificationAnnouncement(world,result,{complete=false}={}){
 const country=unificationCountry(world,result);if(!country)return '';
 return `<aside class="season-announcement unification-announcement" data-unification="${esc(country.id)}" data-unification-phase="${complete?'complete':'announcement'}" style="--victor-color:${esc(country.color)}" role="status" aria-live="polite"><span class="season-symbol" aria-hidden="true">${icon('crown',36)}</span><strong>천하통일</strong><small>${esc(country.name)} · ${world.territories.length}개 영토 통일</small></aside>`;
}
