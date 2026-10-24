import { esc } from './icons.js';
import { armyArrowWidth } from './operation-geometry.js';
export function battleMapDefs(attack='#ef8c62',defense='#9acbe1'){return ['attack','defense'].map((key,i)=>`<marker id="${key}-head" viewBox="0 0 14 14" refX="11" refY="7" markerWidth="14" markerHeight="14" markerUnits="userSpaceOnUse" orient="auto"><path d="M1 1 12 7 1 13 4 7Z" fill="${i?defense:attack}" stroke="#172b2c" stroke-width="1"/></marker>`).join('');}
export function battlePosition(point,markers){
  const offsets=[[0,0],[76,0],[-76,0],[0,-86],[0,86],[64,-74],[-64,-74],[64,74],[-64,74],[110,0],[-110,0],[0,-120],[0,120]];
  return offsets.map(([x,y])=>[Math.max(24,Math.min(1176,point[0]+x)),Math.max(24,Math.min(776,point[1]+y))]).find(p=>!markers.some(m=>Math.abs(p[0]-m.point[0])<49&&Math.abs(p[1]-m.point[1])<68))||[point[0]+70,point[1]-60];
}
export function battleRoute(from,to,side,color,options={}){
  if(!from||!to)return '';
  const dx=to[0]-from[0],dy=to[1]-from[1],length=Math.hypot(dx,dy);
  if(length<.1)return '';
  const lane=options.lane||0,offset=lane?Math.ceil(lane/2)*3*(lane%2?1:-1):0;
  const angle=Math.atan2(dy,dx)+Math.atan(offset/65),padding=Math.min(8,length*.12);
  const start=[from[0]+dx/length*padding,from[1]+dy/length*padding],end=[to[0]-Math.cos(angle)*padding,to[1]-Math.sin(angle)*padding];
  const bend=Math.min(8,length*.08)+offset,middle=[(start[0]+end[0])/2-dy/length*bend,(start[1]+end[1])/2+dx/length*bend];
  const d=options.points?.length>2?`M${options.points.map(p=>p.join(',')).join(' L')}`:`M${start} Q${middle} ${end}`;
  const marker=options.id?`route-head-${String(options.id).replace(/[^a-zA-Z0-9_-]/g,'-')}`:`${side}-head`;
  const width=armyArrowWidth(options.army),style=`--army-width:${width}px;--army-shadow:${width+1.6}px`;
  return `<g class="campaign-route-pair ${options.active===false?'past-route':'active-route'}" style="${style}" data-arrow-army="${options.army||0}" ${options.id?`data-round-route="${esc(options.id)}"`:''}>${options.id?`<defs><marker id="${marker}" viewBox="0 0 14 14" refX="11" refY="7" markerWidth="3.4" markerHeight="3.4" markerUnits="strokeWidth" orient="auto"><path d="M1 1 12 7 1 13 4 7Z" fill="${color||'#fff'}" style="fill:${color||'#fff'}" stroke="#071116" stroke-width=".7"/></marker></defs>`:''}<path class="campaign-route-shadow" d="${d}"/><path class="campaign-route ${side}" style="stroke:${color||'#fff'}" d="${d}" fill="none" marker-end="url(#${marker})"/></g>`;
}
export function battleEmblem(point,markers=[],name=''){
 return `<g class="battle-emblem" transform="translate(${point})" aria-label="${esc(name)} 전투 지점"><g class="battle-icon-scale"><circle class="target-ring" r="20"/><circle class="battle-emblem-face" r="13"/><g class="battle-swords-outline" fill="none" stroke="#000" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="m-8-9 16 16m-4-8-4 4M8-9-8 7m4-8 4 4"/></g><g class="battle-swords" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="m-8-9 16 16m-4-8-4 4M8-9-8 7m4-8 4 4"/></g></g></g>`;
}

export function renderBattleSites(world,geometry,campaign,currentId=null){
 return `<g class="season-battle-sites" pointer-events="none">${(campaign.battleSites||[]).filter(s=>s.territoryId!==currentId).map(site=>{const i=world.territories.findIndex(t=>t.id===site.territoryId);if(i<0)return '';const point=world.cartography?.polygons?.[site.territoryId]?.anchors?.battle||geometry.cells[i].center;return `<g data-battle-site="${esc(site.territoryId)}" data-battle-count="${site.count}" transform="translate(${point})"><title>이번 계절 ${site.count}회 전투</title><g class="battle-site-icon"><circle r="8"/><path d="m-5-5 10 10m0-10L-5 5"/>${site.count>1?`<text x="10" y="-7">${site.count}</text>`:''}</g></g>`;}).join('')}</g>`;
}
