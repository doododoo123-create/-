import {MassBattleAnimation} from './mass-battle-animation.js';
import {TroopAnimation} from './troop-animation.js';
import {placeVictoryBadge} from './victory-badge.js';
import {ARMY_CARD_SCALE,armyLeaderTransform} from './army-presentation.js';
import {roundedRoutePath} from './route-bundles.js';
import { buildFrontWave,frontWaveAt,frontSequenceProgress } from './front-wave.js';
import { atlasGeometry } from './atlas-cache.js';
import { polylineAt, operationPath,armyArrowWidth } from './operation-geometry.js';
// One presentation clock drives card pins, arrowheads and territory wipes.
export class MapAnimation {
 constructor(){this.massBattle=new MassBattleAnimation();this.troops=new TroopAnimation();this.frame=null;this.root=null;this.playback=null;this.waves=[];this.progressKey=null;}
 start(root,playback){
  this.stop();this.boundScene=playback.scene;this.contrastKey=null;this.massBattle.start(root,playback);if(playback.scene?.massPlan&&this.massBattle.canvas){this.troops.entries=[];this.root=root;this.playback=playback;this.nodes={svg:null,countdowns:[],armies:[],rallies:[],formations:[],arrows:[]};this.waves=[];this.tick();return;}this.troops.start(root,playback);this.root=root;this.playback=playback;const world=playback.displayWorld,geometry=world?atlasGeometry(world):null;
  this.waves=[...root.querySelectorAll('[data-front-wave]')].map(e=>({element:e,index:Number(e.dataset.frontWave),order:Number(e.dataset.waveOrder),count:Number(e.dataset.waveCount),span:Number(e.dataset.wipeSpan),lines:[...root.querySelectorAll(`[data-wave-line="${e.dataset.frontWave}"]`)],glows:[...root.querySelectorAll(`[data-wave-glow="${e.dataset.frontWave}"]`)],model:buildFrontWave(world,geometry,Number(e.dataset.frontWave),e.dataset.waveFrom)}));
  const cards=new Map([...root.querySelectorAll('.map-unit-position')].map(c=>[c.dataset.person,c]));
  this.nodes={svg:root.querySelector('.atlas-map'),countdowns:[...root.querySelectorAll('[data-campaign-countdown]')],armies:[...root.querySelectorAll('[data-army-forming="true"]')].map(card=>({leader:card.querySelector('.army-leader-scale'),minis:[...card.querySelectorAll('.army-mini-unit')],ring:card.querySelector('.army-formation-ring')})),rallies:[...root.querySelectorAll('[data-rally-spot] circle')],formations:[...root.querySelectorAll('[data-forming="true"]')].map(card=>({card,node:card.querySelector('.clock-formation'),target:card.dataset.formationTarget.split(',').map(Number)})),arrows:[...root.querySelectorAll('.operation-arrow[data-route-points]')].map(element=>{const pair=element.querySelector('.campaign-route-pair'),card=cards.get(element.dataset.routePerson);return {element,points:JSON.parse(element.dataset.routePoints),width:Number(pair?.dataset.arrowWidth)||armyArrowWidth(Number(pair?.dataset.arrowArmy)||0),paths:[...element.querySelectorAll('.campaign-route,.campaign-route-shadow')],card,node:card?.querySelector('.clock-marching')};})};
  const list=root.querySelector('.campaign-duel-list'),row=list?.querySelector('[data-current-duel=true]');if(list&&row)list.scrollTop=Math.max(0,row.getBoundingClientRect().top-list.getBoundingClientRect().top+list.scrollTop-(list.clientHeight-row.clientHeight)/2);this.tick();
 }
 focusContrast(){
 if(!this.root?.querySelector||!this.root?.querySelectorAll)return;
 const scene=this.playback?.scene,active=this.root?.querySelector('.map-unit-position[data-combat-side]'),key=(scene?.id||'')+':'+this.nodes?.svg?.getAttribute('viewBox');if(key===this.contrastKey)return;this.contrastKey=key;
 const area=(active?.querySelector('canvas')||active)?.getBoundingClientRect(),participants=new Set([...this.root.querySelectorAll('.map-unit-position[data-combat-side]')].map(n=>n.dataset.person));for(const label of this.root?.querySelectorAll('[data-territory-label]')||[]){let dim=false;if(area&&label.dataset.territoryLabel!==this.playback?.state?.record.battles?.[scene?.battleIndex]?.territoryId){const b=label.getBoundingClientRect();dim=Math.hypot(b.x-area.x,b.y-area.y)<180;}label.style.opacity=dim?'.55':'';}
 for(const route of this.root?.querySelectorAll('.operation-arrow')||[]){const b=route.getBoundingClientRect();route.style.opacity=area&&route.dataset.liveMarch!=='true'&&!participants.has(route.dataset.routePerson)&&Math.hypot(b.x-area.x,b.y-area.y)<180?'.6':'';}
 }
 // Rendering may synchronously update the camera before start() can bind the
 // new DOM. Invalidate old bindings first, while retaining shared sprite caches.
 beginRender(){this.stop();this.root=null;this.playback=null;this.nodes=null;this.boundScene=null;this.waves=[];}
 stop(){if(this.frame!==null)cancelAnimationFrame(this.frame);this.frame=null;}
 tick(){
  this.frame=null;const root=this.root,p=this.playback,nodes=this.nodes;if(!root?.isConnected||!p||!nodes)return;
  if(this.boundScene&&p.scene!==this.boundScene)return;
  if(p.scene?.massPlan&&this.massBattle.canvas){this.massBattle.tick();if(p.playing&&this.massBattle.canvas)this.frame=requestAnimationFrame(()=>this.tick());return;}
  const progress=p.sceneProgress,movement=p.movementProgress;
  this.onFrame?.();this.troops.tick();this.focusContrast();placeVictoryBadge(root,p.sceneProgress);
  const progressKey=p.scene?.kind==='capture'?p.state.record.turn+':'+p.scene.id+':'+Math.floor(progress*(p.state.record.battles[p.scene.battleIndex]?.takenTerritoryIds?.length||1)):null;if(progressKey&&progressKey!==this.progressKey){this.progressKey=progressKey;this.onMapProgress?.();}
  for(const line of nodes.countdowns)line.style.transform='scaleX('+(1-progress)+')';
  const settling=p.scene?.kind==='round-settle',travel=settling?Math.max(0,(progress-.18)/.82):progress,highlight=settling&&progress<.18?Math.sin(progress/.18*Math.PI)*.85:0;
  for(const wave of this.waves){
   const e=wave.element;if(!e.isConnected)continue;const local=frontSequenceProgress(travel,wave.order,wave.count);
   if(wave.progress!==local){const shape=frontWaveAt(wave.model,local);e.setAttribute('d',shape.fill);e.setAttribute('width',String(wave.span*local));e.dataset.waveProgress=String(local);for(const line of wave.lines)line.setAttribute('d',shape.front);wave.progress=local;}
   const glow=Math.max(highlight,settling?Math.sin(local*Math.PI)*.6:0);if(wave.glow!==glow){for(const node of wave.glows)node.setAttribute('opacity',String(glow));wave.glow=glow;}
  }
  const svg=nodes.svg,matrix=svg?.isConnected?svg.getScreenCTM?.():null;
  if(matrix){
   for(const {leader,minis,ring} of nodes.armies){
    const t=p.reducedMotion?.()?1:progress,ease=1-Math.pow(1-t,3),factor=1+(ARMY_CARD_SCALE-1)*ease;
    leader?.setAttribute('transform',armyLeaderTransform(factor));
    minis.forEach((mini,i)=>{const delay=.35+i*.4/Math.max(1,minis.length-1);mini.style.opacity=String(Math.max(0,Math.min(1,(t-delay)/.25)));});
    if(ring)ring.style.opacity=String(.95-.65*t);
   }
   for(const ring of nodes.rallies){const t=p.reducedMotion?.()?0:progress;ring.setAttribute('r',String(16+7*Math.sin(Math.PI*t)));ring.style.opacity=String(.5+.35*Math.sin(Math.PI*t));}
   const duelScale=Number(svg.style.getPropertyValue('--duel-display-scale'))||1;
   const screenScale=Math.hypot(matrix.a,matrix.b);
   for(const entry of nodes.arrows){
    const {element:arrow,points,width,paths,card,node}=entry;if(!arrow.isConnected)continue;
    const moving=arrow.dataset.liveMarch==='true',fraction=moving?Math.min(1,movement*(Number(arrow.dataset.arrivalFactor)||1)):1,key=fraction+':'+screenScale;if(entry.lastKey===key)continue;entry.lastKey=key;
    const part=polylineAt(points,fraction),gap=arrow.dataset.routeTerminal==='false'?0:Math.min(part.total,(22+width*1.5)/screenScale),drawn=polylineAt(points,Math.min(fraction,part.total?(part.total-gap)/part.total:0));
    // Very short routes have no room for a shaft outside the enlarged battle icon.
    for(const path of paths)path.setAttribute('d',part.total>gap?(arrow.dataset.smoothRoute==='true'?roundedRoutePath(drawn.path):operationPath(drawn.path)):'');
    if(moving&&node){const x=part.point[0]-Number(card.dataset.mapX),y=part.point[1]-35-Number(card.dataset.mapY);node.style.transform=`translate(${x}px,${y}px)`;card.dataset.motionPin=part.point.join(',');}
    arrow.dataset.motionTip=drawn.point.join(',');arrow.dataset.iconClearance=String(gap*screenScale);
   }
   for(const {card,node,target} of nodes.formations){
    const inverse=matrix.inverse();
    const final=new DOMPoint(Number(card.dataset.combatScreenX),Number(card.dataset.combatScreenY)).matrixTransform(inverse);
    if(node)node.style.transform=`translate(${(target[0]-final.x)*(1-progress)}px,${(target[1]-35*duelScale-final.y)*(1-progress)}px)`;
   }
  }
  if(p.playing&&(this.troops.entries?.length||p.state?.filming||this.waves.length||nodes.arrows.some(a=>a.element.dataset.liveMarch==='true')||nodes.formations.length||nodes.countdowns.length||nodes.armies.length||nodes.rallies.length))this.frame=requestAnimationFrame(()=>this.tick());
 }
}
