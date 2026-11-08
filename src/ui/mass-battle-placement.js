import {mapAnchor} from '../model/cartography-geometry.js';
import {massSceneTime} from './mass-battle-scenes.js';
import {massBattleTime} from './mass-battle-plan.js';

export function massPanelPlacement(bounds,anchor,size){
 const margin=8,top=Math.min(108,Math.max(margin,bounds.height-size.height-margin));
 return {left:Math.max(margin,Math.min(bounds.width-size.width-margin,anchor.x-size.width/2)),top:Math.max(top,Math.min(bounds.height-size.height-margin,anchor.y-size.height/2))};
}
export function placeMassBattle(playback,root=globalThis.document){
 const pane=root?.querySelector?.('.map-stage > .mass-battle'),stage=pane?.closest('.map-stage'),svg=stage?.querySelector('.atlas-map'),plan=playback?.scene?.massPlan,matrix=svg?.getScreenCTM?.();
 if(!pane||!matrix||!plan)return;
 const base=massBattleTime(plan,massSceneTime(playback)).base,current=plan.engagements.filter(e=>e.resolve<=base).at(-1)||plan.engagements[0];
 const point=mapAnchor(plan.before,current.territoryId,'battle'),screen=new DOMPoint(...point).matrixTransform(matrix),bounds=stage.getBoundingClientRect();
 const position=massPanelPlacement(bounds,{x:screen.x-bounds.left,y:screen.y-bounds.top},{width:pane.offsetWidth,height:pane.offsetHeight});
 pane.style.left=position.left+'px';pane.style.top=position.top+'px';pane.dataset.anchorTerritory=current.territoryId;
 pane.dataset.anchorX=String(screen.x);pane.dataset.anchorY=String(screen.y);
}
