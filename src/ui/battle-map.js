import { esc } from './icons.js';
export function battleMapDefs(attack='#ef8c62',defense='#9acbe1'){return ['attack','defense'].map((key,i)=>`<marker id="${key}-head" viewBox="0 0 14 14" refX="11" refY="7" markerWidth="14" markerHeight="14" markerUnits="userSpaceOnUse" orient="auto"><path d="M1 1 12 7 1 13 4 7Z" fill="${i?defense:attack}" stroke="#172b2c" stroke-width="1"/></marker>`).join('');}
export function battlePosition(point,markers){
  const offsets=[[0,0],[76,0],[-76,0],[0,-86],[0,86],[64,-74],[-64,-74],[64,74],[-64,74],[110,0],[-110,0],[0,-120],[0,120]];
  return offsets.map(([x,y])=>[Math.max(24,Math.min(1176,point[0]+x)),Math.max(24,Math.min(776,point[1]+y))]).find(p=>!markers.some(m=>Math.abs(p[0]-m.point[0])<49&&Math.abs(p[1]-m.point[1])<68))||[point[0]+70,point[1]-60];
}
export function battleRoute(from,to,side,color,options={}){
  if(!from||!to)return '';
  const dx=to[0]-from[0],dy=to[1]-from[1],length=Math.hypot(dx,dy);
  if(length<28&&!options.id)return '';
  const edge=Math.min(29/(Math.abs(dx)||.001),48/(Math.abs(dy)||.001));
  const lane=options.lane||0,offset=lane?Math.ceil(lane/2)*15*(lane%2?1:-1):0;
  const angle=Math.atan2(dy,dx)+Math.atan(offset/65);
  const start=[from[0]+dx*Math.min(.75,edge),from[1]+dy*Math.min(.75,edge)],end=[to[0]-Math.cos(angle)*20,to[1]-Math.sin(angle)*20];
  const bend=(side==='attack'?-30:25)+offset,middle=[(start[0]+end[0])/2-dy/(length||1)*bend,(start[1]+end[1])/2+dx/(length||1)*bend];
  const d=length<28?`M${to[0]+20+lane*2},${to[1]-3} C${to[0]+58+lane*7},${to[1]-55} ${to[0]-58-lane*7},${to[1]-55} ${to[0]-20-lane*2},${to[1]-3}`:`M${start} Q${middle} ${end}`;
  const marker=options.id?`route-head-${String(options.id).replace(/[^a-zA-Z0-9_-]/g,'-')}`:`${side}-head`;
  return `<g class="campaign-route-pair ${options.active===false?'past-route':'active-route'}" ${options.id?`data-round-route="${esc(options.id)}"`:''}>${options.id?`<defs><marker id="${marker}" viewBox="0 0 14 14" refX="11" refY="7" markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto"><path d="M1 1 12 7 1 13 4 7Z" fill="${color||'#fff'}" stroke="#071116" stroke-width="1.2"/></marker></defs>`:''}<path class="campaign-route-shadow" d="${d}"/><path class="campaign-route ${side}" style="stroke:${color||'#fff'}" d="${d}" fill="none" marker-end="url(#${marker})"/></g>`;
}
export function battleEmblem(point,markers=[],name='',sides={}){
 const token=(side,x,sign)=>`<foreignObject x="${x}" y="-16" width="32" height="32"><div xmlns="http://www.w3.org/1999/xhtml" class="battle-side-token ${side}" style="--nation:${sides[side+'Color']||'#fff'}" aria-label="${side==='attack'?'공격 지휘관':'방어 지휘관'}">${sides[side+'Face']||''}<b aria-hidden="true">${sign}</b></div></foreignObject>`;
 return `<g class="battle-emblem" transform="translate(${point})" aria-label="${esc(name)} 전투 지점"><circle class="target-ring" r="20"/><circle class="battle-emblem-face" r="13"/><g class="battle-swords-outline" fill="none" stroke="#000" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="m-8-9 16 16m-4-8-4 4M8-9-8 7m4-8 4 4"/></g><g class="battle-swords" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="m-8-9 16 16m-4-8-4 4M8-9-8 7m4-8 4 4"/></g>${token('attack',-57,'⚔')}${sides.automatic?'':token('defense',25,'🛡')}</g>`;
}
