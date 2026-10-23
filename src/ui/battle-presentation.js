import { UNIT_CARD_WIDTH } from './unit-layout.js';
export function mapUnitScale(screenScale,zoom=screenScale){
 const width=Math.max(24,Math.min(80,UNIT_CARD_WIDTH*Math.pow(zoom,.6)));
 return width/(UNIT_CARD_WIDTH*screenScale);
}
export function duelDirection(origin,target,short=false){
 const dx=origin[0]-target[0],dy=origin[1]-target[1],length=Math.hypot(dx,dy)||1;
 const vertical=Math.abs(dy)>Math.abs(dx)*1.2;
 return {x:dx/length||(!dy?-1:0),y:dy/length,axis:vertical?(short?'diagonal':'vertical'):'horizontal'};
}
export function fitMapUnits(element){
 const svg=element.querySelector('.atlas-map'),matrix=svg?.getScreenCTM?.();if(!matrix)return;
 const scale=Math.hypot(matrix.a,matrix.b);if(!Number.isFinite(scale)||scale<=0)return;
 const bounds=element.getBoundingClientRect(),zoom=Number(element.dataset.zoom)||1,ordinaryWidth=UNIT_CARD_WIDTH*scale*mapUnitScale(scale,zoom),width=Math.min(80,Math.max(40,ordinaryWidth*1.2));
 svg.style.setProperty('--unit-display-scale',String(mapUnitScale(scale,zoom)));
 svg.style.setProperty('--duel-display-scale',String(width/(UNIT_CARD_WIDTH*scale)));
 svg.style.setProperty('--battle-icon-scale',String(14/(20*scale)));
 svg.style.setProperty('--battle-site-scale',String(1/scale));
 svg.style.setProperty('--battle-label-offset',`${20/scale}px`);
 const ring=svg.querySelector('.battle-emblem .target-ring'),campaign=svg.querySelector('.map-campaign');if(!ring||!campaign)return;
 const r=ring.getBoundingClientRect(),center=[r.x+r.width/2,r.y+r.height/2],inverse=matrix.inverse(),raw=(campaign.dataset.attackOrigin||'0,0').split(',').map(Number),from=new DOMPoint(...raw).matrixTransform(matrix);
 const direction=duelDirection([from.x,from.y],center,bounds.height<500),half=width*54/64,hasLoss=!!svg.querySelector('.unit-loss-label'),top=(hasLoss?68:43)*width/32;
 svg.dataset.duelAxis=direction.axis;
 for(const card of svg.querySelectorAll('.map-unit-position[data-combat-side]')){
  const side=card.dataset.combatSide,sign=side==='attack'?1:-1;
  let x,y;
  if(direction.axis==='vertical'){
   const up=direction.y*sign<0;x=center[0]+direction.x*sign*width*.3;y=center[1]+(up?-half-24:top+24);
  }else{
   const sx=direction.x?Math.sign(direction.x): -1;x=center[0]+sx*sign*(width/2+24);
   y=center[1]+(direction.axis==='diagonal'?Math.sign(direction.y)*sign*23:direction.y*sign*18);
  }
  x=Math.max(bounds.left+width/2+8,Math.min(bounds.right-width/2-8,x));
  y=Math.max(bounds.top+top+8,Math.min(bounds.bottom-half-8,y));
  const point=new DOMPoint(x,y).matrixTransform(inverse);
  svg.style.setProperty(`--battle-${side}-x`,`${point.x-Number(card.dataset.mapX)}px`);
  svg.style.setProperty(`--battle-${side}-y`,`${point.y-Number(card.dataset.mapY)}px`);
  card.dataset.combatScreenX=String(x);card.dataset.combatScreenY=String(y);
 }
}
