import {TROOP_FOOTPRINT} from './troop-layout.js';
import { UNIT_CARD_WIDTH } from './unit-layout.js';
import {duelStacks} from './duel-stacks.js';
import {fitFilmClusters} from './filming-camera.js';
export function mapUnitScale(screenScale,zoom=screenScale){
 const width=1.2*Math.max(24,Math.min(80,UNIT_CARD_WIDTH*Math.pow(zoom,.6)));
 return width/(UNIT_CARD_WIDTH*screenScale);
}
export function duelDirection(origin,target){
 // Territory coordinates choose order only; both cards always sit on the same horizontal row.
 return {x:origin[0]<target[0]-.01?-1:origin[0]>target[0]+.01?1:-1,y:0,axis:'horizontal'};
}
export function fitMapUnits(element){
 const svg=element.querySelector('.atlas-map'),matrix=svg?.getScreenCTM?.();if(!matrix)return;
 const scale=Math.hypot(matrix.a,matrix.b);if(!Number.isFinite(scale)||scale<=0)return;
 for(const card of svg.querySelectorAll('.map-unit-position'))card.querySelector('.troop-ground')?.setAttribute('transform',`translate(${-Number(card.dataset.stackOffset||0)},0)`);
 const filming=element.closest('.filming-mode'),filmScale=Number(filming?.style.getPropertyValue('--film-card-scale'))||1;
 const bounds=element.getBoundingClientRect(),zoom=Number(element.dataset.zoom)||1,ordinaryWidth=filming?52*filmScale:UNIT_CARD_WIDTH*scale*mapUnitScale(scale,zoom),width=filming?84*filmScale:Math.min(96,Math.max(48,ordinaryWidth*1.2));
 svg.style.setProperty('--unit-display-scale',String(filming?ordinaryWidth/(UNIT_CARD_WIDTH*scale):mapUnitScale(scale,zoom)));
 svg.style.setProperty('--duel-display-scale',String(width/(UNIT_CARD_WIDTH*scale)));
 svg.style.setProperty('--minister-offset-x',`${ordinaryWidth*1.25/scale}px`);
 svg.style.setProperty('--battle-icon-scale',String(14/(20*scale)));
 svg.style.setProperty('--battle-site-scale',String(1/scale));
 svg.style.setProperty('--battle-label-offset',`${20/scale}px`);
 const ring=svg.querySelector('.battle-emblem .target-ring'),campaign=svg.querySelector('.map-campaign');if(!ring||!campaign){if(filming)fitFilmClusters(element);return;}
 const r=ring.getBoundingClientRect(),center=[r.x+r.width/2,r.y+r.height/2],inverse=matrix.inverse(),raw=(campaign.dataset.attackOrigin||'0,0').split(',').map(Number),target=(campaign.dataset.targetReference||'0,0').split(',').map(Number);
 const direction=duelDirection(raw,target),hasLoss=!!svg.querySelector('.unit-loss-label');
 const cards=[...svg.querySelectorAll('.map-unit-position[data-combat-side]')],layout=duelStacks({left:bounds.left,right:bounds.right,center:center[0],width:width*TROOP_FOOTPRINT,iconRadius:Math.max(14,r.width/2),direction:direction.x,attack:cards.filter(c=>c.dataset.combatSide==='attack').length,defense:cards.filter(c=>c.dataset.combatSide==='defense').length});
 const bodyWidth=layout.width/TROOP_FOOTPRINT,half=bodyWidth*40/32,top=(hasLoss?125:113)*bodyWidth/32;
 svg.style.setProperty('--duel-display-scale',String(bodyWidth/(UNIT_CARD_WIDTH*scale)));
 const rowTop=Math.max(113,...[...svg.querySelectorAll('canvas[data-troop-height]')].map(c=>Number(c.dataset.troopHeight)+40));
 svg.dataset.duelAxis='horizontal';
 // Clamp the whole pair together, preserving both horizontal alignment and card order.
 const cy=Math.max(bounds.top+Math.max(top,rowTop*bodyWidth/32)+8,Math.min(bounds.bottom-half-8,center[1]));
 for(const card of cards){
  const side=card.dataset.combatSide,placement=layout[side],x=placement.x,y=cy,rank=Number(card.dataset.stackOffset||0)/24;
  card.querySelector('.unit-stack-card')?.setAttribute('transform',`translate(${placement.sign*rank*placement.step*UNIT_CARD_WIDTH/bodyWidth},0)`);
  card.querySelector('.troop-ground')?.setAttribute('transform',`translate(${-placement.sign*rank*placement.step*UNIT_CARD_WIDTH/bodyWidth},0)`);
  card.dataset.stackDirection=String(placement.sign);
  const point=new DOMPoint(x,y).matrixTransform(inverse);
  svg.style.setProperty(`--battle-${side}-x`,`${point.x-Number(card.dataset.mapX)}px`);
  svg.style.setProperty(`--battle-${side}-y`,`${point.y-Number(card.dataset.mapY)}px`);
  card.style.setProperty(`--battle-${side}-x`,`${point.x-Number(card.dataset.mapX)}px`);
  card.style.setProperty(`--battle-${side}-y`,`${point.y-Number(card.dataset.mapY)}px`);
  card.dataset.combatScreenX=String(x);card.dataset.combatScreenY=String(y);
 }
 const badge=svg.querySelector('.cohort-advantage');if(badge){const winners=cards.filter(c=>c.dataset.country===badge.dataset.cohortWinner);if(winners.length){const place=layout[winners[0].dataset.combatSide],x=place.x+place.sign*(winners.length-1)*place.step/2,point=new DOMPoint(x,cy).matrixTransform(inverse);badge.setAttribute('transform',`translate(${point.x},${point.y}) scale(${1/scale})`);}}
 if(filming)fitFilmClusters(element);

}
