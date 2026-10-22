import { UNIT_CARD_WIDTH } from './unit-layout.js';
// Screen-sized presentation only. Camp IDs, recorded moves and engine coordinates remain untouched.
export function mapUnitScale(screenScale){return Math.max(24/(UNIT_CARD_WIDTH*screenScale),Math.min(1,36/(UNIT_CARD_WIDTH*screenScale)));}
export function fitMapUnits(element){
 const svg=element.querySelector('.atlas-map'),matrix=svg?.getScreenCTM?.();if(!matrix)return;
 const scale=Math.hypot(matrix.a,matrix.b);if(!Number.isFinite(scale)||scale<=0)return;
 svg.style.setProperty('--unit-display-scale',String(mapUnitScale(scale)));
 svg.style.setProperty('--duel-display-scale',String(48/(UNIT_CARD_WIDTH*scale)));
 svg.style.setProperty('--battle-icon-scale',String(14/(20*scale)));
 svg.style.setProperty('--battle-label-offset',`${20/scale}px`);
 const ring=svg.querySelector('.battle-emblem .target-ring');if(!ring)return;
 const r=ring.getBoundingClientRect(),bounds=element.getBoundingClientRect(),center=[r.x+r.width/2,r.y+r.height/2],inverse=matrix.inverse();
 for(const card of svg.querySelectorAll('.map-unit-position[data-combat-side]')){
  const side=card.dataset.combatSide,sign=side==='attack'?-1:1;
  const x=Math.max(bounds.left+28,Math.min(bounds.right-28,center[0]+sign*50));
  const point=new DOMPoint(x,center[1]).matrixTransform(inverse);
  svg.style.setProperty(`--battle-${side}-x`,`${point.x-Number(card.dataset.mapX)}px`);
  svg.style.setProperty(`--battle-${side}-y`,`${point.y-Number(card.dataset.mapY)}px`);
 }
}
