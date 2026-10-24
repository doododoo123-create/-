import { polylineAt, operationPath } from './operation-geometry.js';
// One presentation clock drives card pins, arrowheads and territory wipes.
export class MapAnimation {
 constructor(){this.frame=null;this.root=null;this.playback=null;}
 start(root,playback){this.stop();this.root=root;this.playback=playback;this.tick();}
 stop(){if(this.frame!==null)cancelAnimationFrame(this.frame);this.frame=null;}
 tick(){
  this.frame=null;const root=this.root,p=this.playback;if(!root?.isConnected||!p?.state)return;
  const progress=p.sceneProgress,movement=p.movementProgress;
  for(const e of root.querySelectorAll('[data-wipe-span]'))e.setAttribute('width',String(Number(e.dataset.wipeSpan)*progress));
  const svg=root.querySelector('.atlas-map'),matrix=svg?.getScreenCTM?.();
  if(matrix){
   const duelScale=Number(svg.style.getPropertyValue('--duel-display-scale'))||1;
   for(const arrow of root.querySelectorAll('.operation-arrow[data-live-march="true"]')){
    const points=JSON.parse(arrow.dataset.routePoints),part=polylineAt(points,movement);
    for(const path of arrow.querySelectorAll('.campaign-route,.campaign-route-shadow'))path.setAttribute('d',operationPath(part.path));
    const card=[...root.querySelectorAll('.map-unit-position')].find(c=>c.dataset.person===arrow.dataset.routePerson),node=card?.querySelector('.clock-marching');
    if(node){const x=part.point[0]-Number(card.dataset.mapX),y=part.point[1]-35-Number(card.dataset.mapY);node.style.transform=`translate(${x}px,${y}px)`;card.dataset.motionPin=part.point.join(',');}
    arrow.dataset.motionTip=part.point.join(',');
   }
   for(const card of root.querySelectorAll('[data-forming="true"]')){
    const node=card.querySelector('.clock-formation'),target=card.dataset.formationTarget.split(',').map(Number),inverse=matrix.inverse();
    const final=new DOMPoint(Number(card.dataset.combatScreenX),Number(card.dataset.combatScreenY)).matrixTransform(inverse);
    if(node)node.style.transform=`translate(${(target[0]-final.x)*(1-progress)}px,${(target[1]-35*duelScale-final.y)*(1-progress)}px)`;
   }
  }
  if(p.playing&&root.querySelector('[data-wipe-span],.clock-marching,[data-forming="true"]'))this.frame=requestAnimationFrame(()=>this.tick());
 }
}
