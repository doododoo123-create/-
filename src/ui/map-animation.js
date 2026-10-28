import {roundedRoutePath} from './route-bundles.js';
import { buildFrontWave,frontWaveAt,frontSequenceProgress } from './front-wave.js';
import { atlasGeometry } from './atlas-cache.js';
import { polylineAt, operationPath,armyArrowWidth } from './operation-geometry.js';
// One presentation clock drives card pins, arrowheads and territory wipes.
export class MapAnimation {
 constructor(){this.frame=null;this.root=null;this.playback=null;this.waves=[];this.progressKey=null;}
 start(root,playback){this.stop();this.root=root;this.playback=playback;const world=playback.displayWorld,geometry=world?atlasGeometry(world):null;this.waves=[...root.querySelectorAll('[data-front-wave]')].map(e=>({element:e,index:Number(e.dataset.frontWave),model:buildFrontWave(world,geometry,Number(e.dataset.frontWave),e.dataset.waveFrom)}));const list=root.querySelector('.campaign-duel-list'),row=list?.querySelector('[data-current-duel=true]');if(list&&row)list.scrollTop=Math.max(0,row.getBoundingClientRect().top-list.getBoundingClientRect().top+list.scrollTop-(list.clientHeight-row.clientHeight)/2);this.tick();}
 stop(){if(this.frame!==null)cancelAnimationFrame(this.frame);this.frame=null;}
 tick(){
  this.frame=null;const root=this.root,p=this.playback;if(!root?.isConnected||!p)return;
  const progress=p.sceneProgress,movement=p.movementProgress;
  const progressKey=p.scene?.kind==='capture'?p.state.record.turn+':'+p.scene.id+':'+Math.floor(progress*(p.state.record.battles[p.scene.battleIndex]?.takenTerritoryIds?.length||1)):null;if(progressKey&&progressKey!==this.progressKey){this.progressKey=progressKey;this.onMapProgress?.();}
  for(const line of root.querySelectorAll('[data-campaign-countdown]'))line.style.transform='scaleX('+(1-progress)+')';
  const settling=p.scene?.kind==='round-settle',travel=settling?Math.max(0,(progress-.18)/.82):progress,highlight=settling&&progress<.18?Math.sin(progress/.18*Math.PI)*.85:0;
  for(const wave of this.waves){const e=wave.element;if(!e.isConnected)continue;const local=frontSequenceProgress(travel,Number(e.dataset.waveOrder),Number(e.dataset.waveCount)),shape=frontWaveAt(wave.model,local);e.setAttribute('d',shape.fill);e.setAttribute('width',String(Number(e.dataset.wipeSpan)*local));e.dataset.waveProgress=String(local);
   for(const line of root.querySelectorAll(`[data-wave-line="${wave.index}"]`))line.setAttribute('d',shape.front);
   for(const glow of root.querySelectorAll(`[data-wave-glow="${wave.index}"]`))glow.setAttribute('opacity',String(Math.max(highlight,settling?Math.sin(local*Math.PI)*.6:0)));
  }
  const svg=root.querySelector('.atlas-map'),matrix=svg?.getScreenCTM?.();
  if(matrix){
   for(const card of root.querySelectorAll('[data-army-forming="true"]')){
    const t=p.reducedMotion?.()?1:progress,ease=1-Math.pow(1-t,3),factor=1+.7*ease,leader=card.querySelector('.army-leader-scale'),minis=[...card.querySelectorAll('.army-mini-unit')];
    leader?.setAttribute('transform',`translate(0,${-35*(factor-1)}) scale(${factor})`);
    minis.forEach((mini,i)=>{const delay=.35+i*.4/Math.max(1,minis.length-1);mini.style.opacity=String(Math.max(0,Math.min(1,(t-delay)/.25)));});
    const ring=card.querySelector('.army-formation-ring');if(ring)ring.style.opacity=String(.95-.65*t);
   }
   for(const ring of root.querySelectorAll('[data-rally-spot] circle')){const t=p.reducedMotion?.()?0:progress;ring.setAttribute('r',String(16+7*Math.sin(Math.PI*t)));ring.style.opacity=String(.5+.35*Math.sin(Math.PI*t));}
   const duelScale=Number(svg.style.getPropertyValue('--duel-display-scale'))||1;
   const screenScale=Math.hypot(matrix.a,matrix.b);
   for(const arrow of root.querySelectorAll('.operation-arrow[data-route-points]')){
    const moving=arrow.dataset.liveMarch==='true',points=JSON.parse(arrow.dataset.routePoints),part=polylineAt(points,moving?movement:1),width=Number(arrow.querySelector('.campaign-route-pair')?.dataset.arrowWidth)||armyArrowWidth(Number(arrow.querySelector('.campaign-route-pair')?.dataset.arrowArmy)||0),gap=arrow.dataset.routeTerminal==='false'?0:Math.min(part.total,(22+width*1.5)/screenScale),drawn=polylineAt(points,Math.min(moving?movement:1,part.total?(part.total-gap)/part.total:0));
    // Very short routes have no room for a shaft outside the enlarged battle icon.
    for(const path of arrow.querySelectorAll('.campaign-route,.campaign-route-shadow'))path.setAttribute('d',part.total>gap?(arrow.dataset.smoothRoute==='true'?roundedRoutePath(drawn.path):operationPath(drawn.path)):'');
    const card=[...root.querySelectorAll('.map-unit-position')].find(c=>c.dataset.person===arrow.dataset.routePerson),node=card?.querySelector('.clock-marching');
    if(moving&&node){const x=part.point[0]-Number(card.dataset.mapX),y=part.point[1]-35-Number(card.dataset.mapY);node.style.transform=`translate(${x}px,${y}px)`;card.dataset.motionPin=part.point.join(',');}
    arrow.dataset.motionTip=drawn.point.join(',');arrow.dataset.iconClearance=String(gap*screenScale);
   }
   for(const card of root.querySelectorAll('[data-forming="true"]')){
    const node=card.querySelector('.clock-formation'),target=card.dataset.formationTarget.split(',').map(Number),inverse=matrix.inverse();
    const final=new DOMPoint(Number(card.dataset.combatScreenX),Number(card.dataset.combatScreenY)).matrixTransform(inverse);
    if(node)node.style.transform=`translate(${(target[0]-final.x)*(1-progress)}px,${(target[1]-35*duelScale-final.y)*(1-progress)}px)`;
   }
  }
  if(p.playing&&root.querySelector('[data-wipe-span],.clock-marching,[data-forming="true"],[data-campaign-countdown],[data-army-forming=true],[data-rally-spot]'))this.frame=requestAnimationFrame(()=>this.tick());
 }
}
