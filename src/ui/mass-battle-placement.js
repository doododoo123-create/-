import {mapAnchor} from '../model/cartography-geometry.js';
const massPlacements=new WeakMap();

export function massPanelPlacement(bounds,anchor,size){
 const margin=8,top=Math.min(108,Math.max(margin,bounds.height-size.height-margin));
 return {left:Math.max(margin,Math.min(bounds.width-size.width-margin,anchor.x-size.width/2)),top:Math.max(top,Math.min(bounds.height-size.height-margin,anchor.y-size.height/2))};
}
export function placeMassBattle(playback,root=globalThis.document,freeze=true){
 const pane=root?.querySelector?.('.map-stage > .mass-battle'),stage=pane?.closest('.map-stage'),svg=stage?.querySelector('.atlas-map'),plan=playback?.scene?.massPlan,matrix=svg?.getScreenCTM?.();
 if(!pane||!matrix||!plan)return;
 const current=plan.engagements[0],bounds=stage.getBoundingClientRect(),key=plan.id+':'+bounds.width+':'+bounds.height;
 const saved=massPlacements.get(plan);if(saved?.key===key){pane.style.left=saved.left+'px';pane.style.top=saved.top+'px';pane.dataset.fixedPlacement=key;pane.dataset.anchorX=String(saved.anchorX);pane.dataset.anchorY=String(saved.anchorY);return;}
 const point=mapAnchor(plan.before,current.territoryId,'battle'),screen=new DOMPoint(...point).matrixTransform(matrix);
 const position=massPanelPlacement(bounds,{x:screen.x-bounds.left,y:screen.y-bounds.top},{width:pane.offsetWidth,height:pane.offsetHeight});
 if(freeze)massPlacements.set(plan,{key,...position,anchorX:screen.x,anchorY:screen.y});pane.dataset.fixedPlacement=key;pane.style.left=position.left+'px';pane.style.top=position.top+'px';pane.dataset.anchorTerritory=current.territoryId;
 pane.dataset.anchorX=String(screen.x);pane.dataset.anchorY=String(screen.y);
}
