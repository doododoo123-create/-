import { calendarAtRound } from '../model/calendar.js';
import { esc } from './icons.js';
export function renderSeasonAnnouncement(scene){
 const calendar=calendarAtRound(scene.event?.round||scene.round||1),label=scene.title||calendar.label,index=scene.event?.seasonIndex??calendar.seasonIndex;
 return `<aside class="season-announcement season-${index}" data-season="${index}" role="status" aria-live="polite"><span class="season-symbol" aria-hidden="true">${['✿','☀','❧','❄'][index]}</span><strong>${esc(label)}</strong></aside>`;
}
