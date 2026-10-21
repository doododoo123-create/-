export function battleMapDefs(attack='#ef8c62',defense='#9acbe1'){return ['attack','defense'].map((key,i)=>`<marker id="${key}-head" viewBox="0 0 14 14" refX="11" refY="7" markerWidth="14" markerHeight="14" markerUnits="userSpaceOnUse" orient="auto"><path d="M1 1 12 7 1 13 4 7Z" fill="${i?defense:attack}" stroke="#172b2c" stroke-width="1"/></marker>`).join('');}
export function battlePosition(point,markers){
  const offsets=[[0,0],[76,0],[-76,0],[0,-86],[0,86],[64,-74],[-64,-74],[64,74],[-64,74],[110,0],[-110,0],[0,-120],[0,120]];
  return offsets.map(([x,y])=>[Math.max(24,Math.min(1176,point[0]+x)),Math.max(24,Math.min(776,point[1]+y))]).find(p=>!markers.some(m=>Math.abs(p[0]-m.point[0])<49&&Math.abs(p[1]-m.point[1])<68))||[point[0]+70,point[1]-60];
}
export function battleRoute(from,to,side,color){
  if(!from||!to)return '';
  const dx=to[0]-from[0],dy=to[1]-from[1],length=Math.hypot(dx,dy);if(length<28)return '';
  const edge=Math.min(29/(Math.abs(dx)||.001),48/(Math.abs(dy)||.001));
  const start=[from[0]+dx*Math.min(.75,edge),from[1]+dy*Math.min(.75,edge)],end=[to[0]-dx/length*20,to[1]-dy/length*20];
  const bend=side==='attack'?-30:25,middle=[(start[0]+end[0])/2-dy/length*bend,(start[1]+end[1])/2+dx/length*bend];
  const d=`M${start} Q${middle} ${end}`;
  return `<path class="campaign-route-shadow" d="${d}"/><path class="campaign-route ${side}" style="stroke:${color||'#fff'}" d="${d}" fill="none" marker-end="url(#${side}-head)"/>`;
}
export function battleEmblem(point,markers=[]){
 const [lx,ly]=[[0,-30],[72,-30],[-72,-30],[0,-112],[102,-55],[-102,-55]].find(([x,y])=>!markers.some(m=>Math.abs(point[0]+x-m.point[0])<62&&point[1]+y+5>m.point[1]-36&&point[1]+y-18<m.point[1]+36))||[72,-30];
 return `<g class="battle-emblem" transform="translate(${point})" aria-label="전투 지점">${lx?`<path class="battle-alert-leader" d="M0 -22 L${lx} ${ly+5}"/>`:""}<text class="battle-alert-label" text-anchor="middle" x="${lx}" y="${ly}">전투 발생</text><circle class="target-ring" r="21"/><circle class="battle-emblem-face" r="14"/><g class="battle-swords-outline" fill="none" stroke="#000" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="m-8-9 12 12m-1-5-5 5m8 1-3-3m-11-10 2 5 3-3ZM8-9-4 3m1-5 5 5m-8 1 3-3M8-9 6-4 3-7Z"/></g><g class="battle-swords" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="m-8-9 12 12m-1-5-5 5m8 1-3-3m-11-10 2 5 3-3ZM8-9-4 3m1-5 5 5m-8 1 3-3M8-9 6-4 3-7Z"/></g></g>`;}
