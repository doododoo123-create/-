import { findCountry, countryPeople, landCount } from '../model/world.js';
import { icon, esc, format } from './icons.js';
import { portraitImage } from './portraits.js';
import { buildMapGeometry, visualHash } from './map-geometry.js';
import { leadGeneral } from './playback.js';
const geometryCache = new Map();
const geometryFor = world => { const key=`${world.rows}:${world.cols}`;if(!geometryCache.has(key))geometryCache.set(key,buildMapGeometry(world.rows,world.cols));return geometryCache.get(key); };
export function countryMarkers(world, geometry=geometryFor(world)) {
  return world.countries.flatMap(country=>{
    const own=world.territories.filter(t=>t.ownerId===country.id);
    if(!own.length)return [];
    const center=own.reduce((sum,t)=>{const p=geometry.cells[t.row*world.cols+t.col].center;return [sum[0]+p[0]/own.length,sum[1]+p[1]/own.length];},[0,0]);
    const candidates=own.map(t=>({territory:t,point:geometry.cells[t.row*world.cols+t.col].center}));
    candidates.sort((a,b)=>(a.point[0]-center[0])**2+(a.point[1]-center[1])**2-((b.point[0]-center[0])**2+(b.point[1]-center[1])**2));
    return [{country,territory:candidates[0].territory,point:candidates[0].point}];
  });
}
export function renderAtlas(world,{selected,observe=false,showNames=true,presentation=null,focusedCountry=null}={}) {
  const geometry=geometryFor(world), record=presentation?.record;
  const scene=presentation?.scenes[presentation.index];
  const battleVisible=record?.type==='war' && scene?.id!=='action';
  const isResult=scene?.kind==='result';
  const markers=countryMarkers(world,geometry);
  const target=world.territories.find(t=>t.id===record?.targetId);
  const targetPoint=target?geometry.cells[target.row*world.cols+target.col].center:null;
  const routeMarkers=presentation?countryMarkers(presentation.before,geometry):markers;
  const attackPoint=routeMarkers.find(m=>m.country.id===record?.actorId)?.point;
  const defensePoint=routeMarkers.find(m=>m.country.id===record?.defenderId)?.point;
  const borders=world.territories.flatMap(t=>{
    const g=geometry.cells[t.row*world.cols+t.col], out=[];
    for(const [dr,dc,a,b] of [[0,1,1,2],[1,0,2,3]]) {
      const neighbor=world.territories.find(n=>n.row===t.row+dr&&n.col===t.col+dc);
      if(neighbor&&neighbor.ownerId!==t.ownerId)out.push(geometry.edgePath(g.vertices[a],g.vertices[b]));
    }
    return out;
  }).join(' ');
  const route=(from,to,color,id)=>from&&to?`<path class="campaign-route ${id}" d="M${from[0]},${from[1]} Q${(from[0]+to[0])/2},${(from[1]+to[1])/2-52} ${to[0]},${to[1]}" fill="none" stroke="${color}" marker-end="url(#${id}-head)"/>`:'';
  return `<div class="atlas-scroll"><svg class="atlas-map" viewBox="0 0 1200 800" role="group" aria-label="${esc(world.name)} 대륙 지도"><defs><linearGradient id="sea-light" x2="0" y2="1"><stop stop-color="#9cbbb9"/><stop offset="1" stop-color="#648e98"/></linearGradient><linearGradient id="land-light" x2=".8" y2="1"><stop stop-color="#f4e9c8"/><stop offset="1" stop-color="#d2c49a"/></linearGradient><filter id="land-shadow"><feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#1c4d57" flood-opacity=".25"/></filter><clipPath id="continent-clip"><path d="${geometry.coastPath}"/></clipPath><marker id="attack-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0 10 5 0 10Z" fill="#f95e57"/></marker><marker id="defense-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0 10 5 0 10Z" fill="#477cce"/></marker></defs>
    <rect width="1200" height="800" fill="url(#sea-light)"/>
    <g class="sea-decor" fill="none" stroke="#d8eeea" opacity=".3">${Array.from({length:18},(_,i)=>{const x=visualHash(i,1)*1160,y=visualHash(i,2)*760;return `<path d="M${x},${y}q13-5 26 0t26 0"/>`;}).join('')}</g>
    <text class="sea-label" x="540" y="71">북 해</text><text class="sea-label" x="46" y="447" transform="rotate(-78 46 447)">서쪽의 바다</text><text class="sea-label" x="1020" y="738">남 해</text>
    <path d="${geometry.coastPath}" fill="none" stroke="#e5e4c7" stroke-width="17" opacity=".65"/>
    <path d="${geometry.coastPath}" fill="url(#land-light)" stroke="#667566" stroke-width="3" filter="url(#land-shadow)"/>
    <g class="atlas-cells">${world.territories.map(t=>{const g=geometry.cells[t.row*world.cols+t.col],c=findCountry(world,t.ownerId);return `<g class="atlas-cell" data-territory="${esc(t.id)}" ${observe?'data-observe="true"':''} tabindex="0" role="button" title="${esc(t.name)} · ${esc(c?.name||'무주지')}" aria-label="${esc(t.name)} · ${esc(c?.name||'무주지')}"><path class="territory atlas-territory ${!observe&&selected===t.id?'selected':''} ${battleVisible&&t.id===record.targetId?'battle-target':''} ${isResult&&record.changes.some(change=>change.territoryId===t.id)?'captured':''}" d="${g.path}" style="--nation:${c?.color||'#b6b9a9'}"/><title>${esc(t.name)} · ${esc(c?.name||'무주지')}</title></g>`;}).join('')}</g>
    <g class="atlas-terrain" clip-path="url(#continent-clip)" pointer-events="none">${geometry.cells.flatMap((g,i)=>{if(visualHash(i,4)<.58)return [];const [x,y]=g.center;const mountain=visualHash(i,5)>.5;return [`<g transform="translate(${x-18},${y+12})" opacity=".15" stroke="#364d36" stroke-width="1.6" fill="none">${mountain?'<path d="m-12 4 12-19L12 4M-3-9l3 4 4-3m5 11 10-16 12 16"/>':'<path d="m-8 4 8-18L8 4Zm8 0v7m8-4 7-15 7 15m-7 0v6"/>'}</g>`];}).join('')}<path class="atlas-river" d="M245 190C380 290 245 368 440 400S640 615 804 669M838 192C800 350 715 394 600 432S426 533 370 640"/></g>
    <path class="national-border" d="${borders}" fill="none"/>
    ${showNames?`<g class="atlas-labels" pointer-events="none">${world.territories.map(t=>{const g=geometry.cells[t.row*world.cols+t.col];return `<text x="${g.center[0]}" y="${g.center[1]+5}" text-anchor="middle" class="atlas-name">${esc(t.name)}</text>`;}).join('')}</g>`:''}
    ${battleVisible&&targetPoint?`<g class="map-campaign" pointer-events="none">${route(attackPoint,targetPoint,'#f95e57','attack')}${route(defensePoint,targetPoint,'#477cce','defense')}<circle class="target-ring" cx="${targetPoint[0]}" cy="${targetPoint[1]}" r="25"/><text class="clash-mark" x="${targetPoint[0]}" y="${targetPoint[1]+8}" text-anchor="middle">⚔</text></g>`:''}
    <g class="country-tokens">${markers.map(({country,point})=>{
      const king=countryPeople(world,country.id).find(p=>p.role==='king'), commander=leadGeneral(world,country.id);
      const before=presentation?.before.countries.find(c=>c.id===country.id);const delta=isResult&&before?country.troops-before.troops:0;
      return `<foreignObject x="${point[0]-66}" y="${point[1]-47}" width="132" height="80"><div xmlns="http://www.w3.org/1999/xhtml" class="token-wrap"><button class="map-country-token ${focusedCountry===country.id?'focused':''} ${battleVisible&&country.id===record.actorId?'attacking':''}" data-action="focus-country" data-id="${esc(country.id)}" style="--nation:${country.color}" title="${esc(country.name)} · 국가 병력 ${country.troops}만"><span class="token-portraits">${portraitImage(king,country,'king')}${commander?portraitImage(commander,country,'general'):''}</span><span class="token-copy"><b>${esc(country.name)}</b><strong>${format(country.troops)}<small>만</small></strong></span></button>${delta?`<span class="army-delta ${delta<0?'negative':'positive'}">${delta>0?'+':''}${format(delta)}만</span>`:''}</div></foreignObject>`;
    }).join('')}</g>
    <g class="map-compass" transform="translate(1115 98)" fill="none" stroke="#345962" opacity=".65"><circle r="27"/><path d="M0-38V38M-38 0H38m-12-12L12 12M-12 12 12-12"/><path d="M0-24 7 9 0 5-7 9Z" fill="#345962"/><text y="-46" text-anchor="middle" fill="#345962" stroke="none">N</text></g>
  </svg></div>`;
}
export function renderNationCards(world,focusedCountry) {
  return `<div class="visual-nations" aria-label="국가별 병력과 영토">${world.countries.map(c=>`<button class="visual-nation-card ${focusedCountry===c.id?'active':''} ${!landCount(world,c.id)?'eliminated':''}" data-action="focus-country" data-id="${esc(c.id)}" style="--nation:${c.color}"><span><i></i>${esc(c.name)}</span><div><strong>${landCount(world,c.id)}<small>영토</small></strong><strong>${format(c.troops)}<small>만 병력</small></strong></div></button>`).join('')}</div>`;
}
export function renderCommanders(world,countryId) {
  const country=findCountry(world,countryId);if(!country)return '';
  const people=countryPeople(world,countryId);
  return `<section class="panel visual-commanders" style="--nation:${country.color}"><div class="panel-head"><h2>${esc(country.name)} 지휘부</h2><span>인물 ${people.length}명 · 국가 통합 병력 ${format(country.troops)}만</span></div><div class="commander-strip">${people.length?people.map(p=>`<button data-action="edit-person" data-id="${esc(p.id)}" class="commander-mini">${portraitImage(p,country,p.role)}<span><b>${esc(p.name)}</b><small>${p.role==='king'?'국왕':p.role==='minister'?'승상':'장군'} · ${p.ability>0?'+':''}${p.ability}</small></span></button>`).join(''):'<p>이 국가에는 아직 인물이 없습니다. 인물 관리에서 추가해 주세요.</p>'}</div></section>`;
}
