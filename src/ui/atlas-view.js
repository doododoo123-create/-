import { findCountry, countryPeople, landCount } from '../model/world.js';
import { icon, esc, format } from './icons.js';
import { portraitImage } from './portraits.js';
import { visualHash } from './map-geometry.js';
import { geometryFor, designedBorders, territoryCell } from './cartography-geometry.js';
import { REFERENCE_ART } from '../data/reference-art.js';
import { TERRAIN_ART } from '../data/terrain-art.js';
import { renderMapDraft } from './map-editor-view.js';
import { V11_ATLAS } from '../data/v11-preset.js';
import { mapEffects, renderMapEffects } from './map-effects.js';
import { arrangeUnits, UNIT_CARD_WIDTH, UNIT_CARD_HEIGHT } from './unit-layout.js';
import { battleMapDefs, battleRoute, battleEmblem, battlePosition } from './battle-map.js';
import { renderOcean, oceanSource } from './map-ocean.js';
import { displayName } from './display-names.js';
export function countryMarkers(world,geometry=geometryFor(world)) {
  return world.countries.flatMap(country=>{
    const own=world.territories.filter(t=>t.ownerId===country.id);if(!own.length)return [];
    const territory=own.find(t=>t.id===country.capitalId)||own[0];
    return [{country,territory,point:territoryCell(world,geometry,territory).center}];
  });
}
export function unitMarkers(world,geometry=geometryFor(world),camps=world.visualCamps||{}) {
  const units=countryMarkers(world,geometry).map(m=>({...m,person:countryPeople(world,m.country.id).find(p=>p.role==='king'),role:'king',troops:m.country.reserve??Math.min(5,m.country.troops)}));
  for(const person of world.people.filter(p=>p.role==='general'&&p.active&&p.alive)) {
    const country=findCountry(world,person.countryId),camp=world.territories.find(t=>t.id===camps[person.id]?.territoryId&&t.ownerId===country?.id),territory=camp||world.territories.find(t=>t.id===person.stationId&&t.ownerId===country?.id);if(!territory)continue;
    units.push({country,territory,person,role:'general',troops:person.troops,point:territoryCell(world,geometry,territory).center});
  }
  return arrangeUnits(units);
}
export function renderAtlas(world,{selected,observe=false,showNames=true,presentation=null,focusedCountry=null,editing=false,draft=null,draftMode=null,showUnits=true,linkedIds=[]}={}) {
  const geometry=geometryFor(world), record=presentation?.record;
  const design=world.cartography, illustrated=design?.style!=='classic',background=design?.background||(illustrated&&design?.plate==='reference'?REFERENCE_ART:null),custom=!!Object.keys(design?.polygons||{}).length;
  const rawOutlines=illustrated||custom?designedBorders(world,geometry):[],outlineGroups=new Map();for(const edge of rawOutlines){if(!outlineGroups.has(edge.ownerId))outlineGroups.set(edge.ownerId,[]);outlineGroups.get(edge.ownerId).push(edge.path);}const outlines=[...outlineGroups].map(([ownerId,paths])=>({ownerId,path:paths.join(' ')}));
  const scene=presentation?.scenes[presentation.index],battle=record?.battles[scene?.battleIndex];
  const battleVisible=presentation?.phase!=='settled'&&!!battle&&['territory','attack_roll','defense_roll','battle_auto','resolve'].includes(scene?.event?.type);
  const effects=mapEffects(presentation?.phase==='settled'?null:scene),captured=new Set(effects.territories.map(e=>e.territoryId));
  const camps=scene?.camps||world.visualCamps||{};
  const markers=unitMarkers(world,geometry,camps);
  const target=world.territories.find(t=>t.id===battle?.territoryId);
  const targetPoint=target?territoryCell(world,geometry,target).center:null;
  const routeWorld=scene?.worldBefore||world,routeMarkers=unitMarkers(routeWorld,geometry,camps);
  const battlePoint=targetPoint?battlePosition(targetPoint,markers):null;
  const attackPoint=routeMarkers.find(m=>m.role==='general'&&m.country.id===battle?.actorId&&m.person.slot===battle?.slot)?.point;
  const defensePoint=battle?.automatic?null:routeMarkers.find(m=>m.role==='general'&&m.country.id===battle?.defenderId&&m.person.slot===battle?.defenseSlot)?.point;
  let borders='',regions='';
  if(!custom&&world.mapKind==='v11')for(const edge of V11_ATLAS.edges){const a=world.territories[edge.a],b=world.territories[edge.b];if(a.ownerId!==b.ownerId)borders+=edge.path+' ';else if(a.commanderSlot!==b.commanderSlot)regions+=edge.path+' ';}
  else if(!custom) borders=world.territories.flatMap(t=>{const g=territoryCell(world,geometry,t);return [[0,1,1,2],[1,0,2,3]].flatMap(([dr,dc,a,b])=>{const n=world.territories.find(n=>n.row===t.row+dr&&n.col===t.col+dc);return n&&n.ownerId!==t.ownerId?[geometry.edgePath(g.vertices[a],g.vertices[b])]:[];});}).join(' ');

  return `<div class="atlas-scroll" data-map-camera="${editing?'editor':observe?'simulation':'overview'}" ${illustrated?`data-ocean="true"`:''}>${illustrated?`<img class="ocean-texture" src="${oceanSource()}" alt="" aria-hidden="true" decoding="async">`:''}<svg class="atlas-map ${illustrated?'illustrated-atlas':'classic-atlas'} ${background?'image-atlas':''} ${editing?'editing-atlas':''}" style="--map-opacity:${design?.opacity??.3}" viewBox="0 0 ${geometry.width||1200} ${geometry.height||800}" role="group" aria-label="${esc(world.name)} 대륙 지도"><defs><linearGradient id="sea-light" x2="0" y2="1"><stop stop-color="#9cbbb9"/><stop offset="1" stop-color="#648e98"/></linearGradient><linearGradient id="land-light" x2=".8" y2="1"><stop stop-color="#f4e9c8"/><stop offset="1" stop-color="#d2c49a"/></linearGradient><filter id="land-shadow"><feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#1c4d57" flood-opacity=".25"/></filter><clipPath id="continent-clip"><path d="${geometry.coastPath}" clip-rule="evenodd"/></clipPath>${battleMapDefs()}</defs>
    <rect width="1200" height="800" fill="${illustrated?'transparent':'url(#sea-light)'}"/>
    ${!background?` ${illustrated?renderOcean(geometry.coastPath):''}<g class="sea-decor" fill="none" stroke="#d8eeea" opacity=".3">${Array.from({length:18},(_,i)=>{const x=visualHash(i,1)*1160,y=visualHash(i,2)*760;return `<path d="M${x},${y}q13-5 26 0t26 0"/>`;}).join('')}</g>
    <text class="sea-label" x="540" y="71">북 해</text><text class="sea-label" x="46" y="447" transform="rotate(-78 46 447)">서쪽의 바다</text><text class="sea-label" x="1020" y="738">남 해</text>
    <path d="${geometry.coastPath}" fill="none" stroke="#e5e4c7" stroke-width="${illustrated?2:17}" opacity=".65"/>
    <path d="${geometry.coastPath}" fill="url(#land-light)" stroke="#667566" stroke-width="3" filter="url(#land-shadow)"/>
${illustrated?`<image class="terrain-art" href="${TERRAIN_ART}" x="0" y="0" width="1200" height="800" preserveAspectRatio="none" clip-path="url(#continent-clip)" pointer-events="none"/>`:''}`:`<image class="map-background-image" href="${esc(background)}" width="1200" height="800" preserveAspectRatio="none" pointer-events="none"/>`}
    <g class="atlas-cells">${world.territories.map(t=>{const g=territoryCell(world,geometry,t),c=findCountry(world,t.ownerId);return `<g class="atlas-cell ${linkedIds.includes(t.id)?'linked-territory':''}" data-territory="${esc(t.id)}" ${observe?'data-observe="true"':''} tabindex="0" role="button" title="${esc(t.name)} · ${esc(c?.name||'무주지')}" aria-label="${esc(t.name)} · ${esc(c?.name||'무주지')}"><path class="territory atlas-territory ${!observe&&selected===t.id?'selected':''} ${battleVisible&&t.id===battle.territoryId?'battle-target':''} ${captured.has(t.id)?'captured':''}" d="${g.path}" fill-rule="evenodd" style="--nation:${c?.color||'#b6b9a9'}"/><title>${esc(t.name)} · ${esc(c?.name||'무주지')}</title></g>`;}).join('')}</g>
    ${!illustrated?`<g class="atlas-terrain" clip-path="url(#continent-clip)" pointer-events="none">${geometry.cells.flatMap((g,i)=>{if(visualHash(i,4)<.58)return [];const [x,y]=g.center;const mountain=visualHash(i,5)>.5;return [`<g transform="translate(${x-18},${y+12})" opacity=".15" stroke="#364d36" stroke-width="1.6" fill="none">${mountain?'<path d="m-12 4 12-19L12 4M-3-9l3 4 4-3m5 11 10-16 12 16"/>':'<path d="m-8 4 8-18L8 4Zm8 0v7m8-4 7-15 7 15m-7 0v6"/>'}</g>`];}).join('')}<path class="atlas-river" d="M245 190C380 290 245 368 440 400S640 615 804 669M838 192C800 350 715 394 600 432S426 533 370 640"/></g>`:''}
    ${illustrated||custom?`<g class="country-outlines" pointer-events="none">${outlines.map(e=>`<path d="${e.path}" fill="none" stroke="#111e20" stroke-width="5.5"/><path d="${e.path}" fill="none" stroke="${findCountry(world,e.ownerId)?.color||'#c5bb96'}" stroke-width="2.6"/>`).join('')}</g>`:`<path class="national-border" d="${borders}" fill="none"/>`}<path class="commander-border" d="${regions}" fill="none"/>
    ${showNames?`<g class="atlas-labels" pointer-events="none">${world.territories.map(t=>{const g=territoryCell(world,geometry,t);return `<text x="${g.center[0]}" y="${g.center[1]+5}" text-anchor="middle" class="atlas-name">${esc(t.name)}</text>`;}).join('')}</g>`:''}
    <g class="station-leaders" pointer-events="none">${showUnits?markers.filter(m=>Math.hypot(m.point[0]-m.anchorPoint[0],m.point[1]-m.anchorPoint[1])>14).map(m=>`<path d="M${m.anchorPoint} L${m.point}"/><circle cx="${m.anchorPoint[0]}" cy="${m.anchorPoint[1]}" r="2.3"/>`).join(''):''}</g>
    ${scene?.kind==='movement'?`<g class="march-routes" pointer-events="none">${scene.moves.map(m=>{const points=m.path.map(id=>territoryCell(world,geometry,world.territories.find(t=>t.id===id))?.center).filter(Boolean);return `<path class="${m.kind}" d="M${points.map(p=>p.join(',')).join(' L')}"/>`;}).join('')}</g>`:''}
    <g class="country-tokens">${(showUnits?markers:[]).map(({country,person,point,role,troops})=>{
      const name=displayName(person,country.name),motion=scene?.kind==='movement'&&scene.moves?.find(m=>m.personId===person?.id);
      const origin=motion?unitMarkers(world,geometry,scene.campsBefore).find(m=>m.person?.id===person.id)?.point:null;
      const waypoints=motion&&origin?[origin,...motion.path.slice(1,-1).map(id=>territoryCell(world,geometry,world.territories.find(t=>t.id===id)).center),point]:null;
      const relative=waypoints?.map(p=>[p[0]-point[0],p[1]-point[1]]),motionStyle=relative?`offset-path:path('M${relative.map(p=>p.join(',')).join(' L')}');--march-time:${1.6/(presentation?.speed||1)}s;--march-delay:${-1.6*(presentation?.movementProgress||0)/(presentation?.speed||1)}s`:'';
      return `<g class="map-unit-position" transform="translate(${point})" data-person="${esc(person?.id||country.id)}" data-camp="${esc(camps[person?.id]?.territoryId||person?.stationId||country.capitalId)}"><g class="${motion?'unit-marching':''}" style="${motionStyle}"><foreignObject x="${-UNIT_CARD_WIDTH/2}" y="${-UNIT_CARD_HEIGHT/2}" width="${UNIT_CARD_WIDTH}" height="${UNIT_CARD_HEIGHT+4}"><div xmlns="http://www.w3.org/1999/xhtml" class="token-wrap"><button class="map-unit-token ${focusedCountry===country.id?'focused':''} ${battleVisible&&country.id===battle.actorId&&person?.slot===battle.slot?'attacking':''}" data-role="${role}" data-slot="${person?.slot??''}" data-action="focus-country" data-id="${esc(country.id)}" style="--nation:${country.color}" title="${esc(name)} · ${role==='king'?'수도 예비병':`장군 주둔군 / 한도 ${person.capacity}만 / ${person.connected?'수도 연결':'단절'}`} ${troops}만" aria-label="${esc(name)} · 병력 ${troops}만"><span class="token-portraits">${portraitImage(person,country,role)}</span><span class="token-copy"><b>${esc(name)}</b><strong><small>병력</small> ${format(troops)}<span>만</span></strong></span></button></div></foreignObject>${motion?`<text class="march-label" text-anchor="middle" y="-53">${motion.kind==='return'?'복귀 · 방어':'출정'}</text>`:''}</g></g>`;
    }).join('')}</g>
    ${battleVisible&&battlePoint?`<g class="map-campaign" pointer-events="none"><path class="battle-location-leader" d="M${targetPoint} L${battlePoint}"/>${battleRoute(attackPoint,battlePoint,'attack')}${battleRoute(defensePoint,battlePoint,'defense')}${battleEmblem(battlePoint)}</g>`:''}
    ${renderMapEffects(effects,geometry,world,markers,scene?.worldBefore?unitMarkers(scene.worldBefore,geometry):[])}
    <g class="map-compass" transform="translate(1115 98)" fill="none" stroke="#345962" opacity=".65"><circle r="27"/><path d="M0-38V38M-38 0H38m-12-12L12 12M-12 12 12-12"/><path d="M0-24 7 9 0 5-7 9Z" fill="#345962"/><text y="-46" text-anchor="middle" fill="#345962" stroke="none">N</text></g>
    ${editing?renderMapDraft(draft,draftMode):''}
  </svg>${effects.announcement?`<div class="map-event-announcement" aria-live="polite">${esc(effects.announcement)}</div>`:''}</div>`;
}
export function renderNationCards(world,focusedCountry) {
  return `<div class="visual-nations" aria-label="국가별 병력과 영토">${world.countries.map(c=>`<button class="visual-nation-card ${focusedCountry===c.id?'active':''} ${!landCount(world,c.id)?'eliminated':''}" data-action="focus-country" data-id="${esc(c.id)}" style="--nation:${c.color}"><span><i></i>${esc(c.name)}</span><div><strong>${landCount(world,c.id)}<small>영토</small></strong><strong>${format(c.troops)}<small>만 총병력</small></strong></div><small>수도 ${c.reserve??'—'}만 · 장군 ${c.commanders??'—'}명 · 충원 +${c.recruitment}</small></button>`).join('')}</div>`;
}
export function renderCommanders(world,countryId) {
  const country=findCountry(world,countryId);if(!country)return '';
  const people=countryPeople(world,countryId);
  return `<section class="panel visual-commanders" style="--nation:${country.color}"><div class="panel-head"><h2>${esc(country.name)} 지휘부</h2><span>수도 예비병 ${country.reserve??'—'}만 · 총 ${format(country.troops)}만</span></div><div class="commander-strip">${people.map(p=>`<button data-action="edit-person" data-id="${esc(p.id)}" class="commander-mini ${p.alive===false?'fallen':''}">${portraitImage(p,country,p.role)}<span><b>${esc(displayName(p))}</b><small>${p.role==='king'?'국왕':p.role==='minister'?'승상':p.alive===false?`전사 · 후임 대기 ${p.waited}/3턴`:!p.active?'후보 장군':`${p.troops}/${p.capacity}만 · ${p.connected?'수도 연결':'단절'}`} · 능력 ${p.ability>0?'+':''}${p.ability}</small>${p.role==='general'&&p.active?`<small>${p.territoryIds?.length||0}개 영토 · ${esc(world.territories.find(t=>t.id===p.stationId)?.name||'주둔지 없음')}</small>`:''}</span></button>`).join('')}</div></section>`;
}
