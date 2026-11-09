import {followsMapScene} from './camera-policy.js';
import {appointmentFocus} from './appointment-focus.js';
import {placeMassBattle} from './mass-battle-placement.js';
import {placeVictoryBadge} from './victory-badge.js';
import {followArmyCampaign} from './army-camera.js';
import {filmSafeTarget,filmCameraAt} from './filming-camera.js';
import {updateHanMaps} from './han-map.js';
import {alignMountainLabels} from './mountain-labels.js';
import {mapAnchor} from '../model/cartography-geometry.js';
import { cameraExtent, placeCompactDuel, placeRoyalChoice, nationFraming, battleFraming, sceneFocus } from './camera-focus.js';
import { observerDetail } from './observer-map.js';
import { fitMapUnits } from './battle-presentation.js';
// View state only; SVG coordinates and the world remain unchanged.
export function mapZoomControls(context='overview'){
 return `<div class="map-camera-controls" data-camera-controls="${context}"><button type="button" class="button outline" data-action="map-zoom-out" data-camera="${context}" aria-label="지도 축소">−</button><output data-camera-scale="${context}">100%</output><button type="button" class="button outline" data-action="map-zoom-in" data-camera="${context}" aria-label="지도 확대">＋</button><button type="button" class="button subtle" data-action="map-zoom-reset" data-camera="${context}">전체 보기</button>${context!=='editor'?`<label class="observer-detail-control">지도 정보 <select data-map-detail aria-label="지도 정보 표시"><option value="auto">확대에 맞춰 표시</option><option value="all">모든 정보 표시</option></select></label>`:''}${context==='editor'?`<button type="button" class="button outline" data-action="map-pan-toggle" data-camera="editor" aria-pressed="false">지도 이동</button>`:''}</div>`;
}
export const MAX_MAP_ZOOM=5;
export class MapCamera {
 constructor(){this.views=new Map();this.pendingUpdates=new Map();this.armyZoomPending=false;this.drag=null;this.panEditor=false;this.suppressClick=false;this.autoFollow=false;this.followKey=null;this.followRecord=null;this.motion=null;this.detailMode='auto';this.inspectedTerritory=null;this.filmKey=null;this.filmPlan=null;this.filmFrames=new Map();}
 cancelMotion(){if(this.motion!==null){globalThis.cancelAnimationFrame?.(this.motion);this.motion=null;}}
 manual(){this.cancelMotion();this.filmPlan=null;}
 queueUpdate(context){if(this.pendingUpdates.has(context))return;if(!globalThis.requestAnimationFrame){this.update(context);return;}const frame=requestAnimationFrame(()=>{this.pendingUpdates.delete(context);this.update(context);});this.pendingUpdates.set(context,frame);}
 flushUpdate(context){const frame=this.pendingUpdates.get(context);if(frame===undefined)return;globalThis.cancelAnimationFrame?.(frame);this.pendingUpdates.delete(context);this.update(context);}
 keyboard(event,context){this.manual();const v=this.view(context),step=(event.shiftKey?3:1)*70/v.zoom;v.x+=event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0;v.y+=event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0;this.clamp(v);this.update(context);}
 viewport(context){const el=globalThis.document?.querySelector?.(`.atlas-scroll[data-map-camera="${context}"]`);return {width:el?.clientWidth||1200,height:el?.clientHeight||800};}
 resetFollow(){this.followRecord=null;this.followKey=null;this.filmKey=null;this.filmPlan=null;this.cancelMotion();}
 setFollowing(value,playback){this.autoFollow=!!value;this.followKey=null;this.filmKey=null;this.cancelMotion();if(this.autoFollow)this.follow(playback);}
 follow(playback){
  this.playback=playback;
  if(playback?.scene?.massPlan){this.followMass(playback);return;}
  if(playback?.scene?.massReturn)return;
  if(playback?.state?.filming){this.followFilm(playback);return;}
  if(this.inspectedTerritory&&!playback?.playing)return;if(this.inspectedTerritory){this.inspectedTerritory=null;this.followKey=null;}
  const record=playback?.state?.record,scene=playback?.scene;if(!record||!scene)return;
  const world=scene.worldBefore||scene.worldAfter||playback.displayWorld;if(!world)return;
  const viewport=this.viewport('simulation'),view=this.view('simulation');
  if(this.followRecord!==record){this.followRecord=record;this.followKey=null;const target=!this.autoFollow&&nationFraming(world,record.actorId,viewport);if(target){this.cancelMotion();Object.assign(view,{x:target.x,y:target.y});this.clamp(view);this.update('simulation');}}
  const appointed=appointmentFocus(scene,record);if(this.autoFollow&&appointed){const key='appointment:'+record.turn+':'+scene.event.index;if(this.followKey!==key){this.followKey=key;Object.assign(view,{x:appointed[0],y:appointed[1]});this.update('simulation');}return;}

  if(scene.massRecap&&this.autoFollow){const point=scene.cameraPoint||sceneFocus(scene,record),key=scene.cameraGroup||'recap:'+scene.id;if(point&&this.followKey!==key){this.followKey=key;Object.assign(view,{x:point[0],y:point[1]});this.update('simulation');}return;}
  if(followArmyCampaign(this)){this.followKey='army:'+scene.campaign?.id;return;}
  if(!this.autoFollow||!followsMapScene(scene))return;
  const battle=record.battles?.[scene.battleIndex],point=battle?null:sceneFocus(scene,record),key=battle?'battle:'+battle.territoryId:point?'point:'+point.join(','):null;
  if(!key||key===this.followKey)return;
  this.followKey=key;const anchor=battle?mapAnchor(world,battle.territoryId,'battle'):point,target=anchor?{x:anchor[0],y:anchor[1]}:null;if(!target)return;
  this.cancelMotion();Object.assign(view,target);this.clamp(view);this.update('simulation');
 }
 followMass(playback){
  if(!this.autoFollow)return;
  const scene=playback.scene,record=playback.state.record,plan=scene.massPlan;
  const appointment=scene.massCritical&&scene.event.type==='appointment';
  const point=appointment?sceneFocus({...scene,kind:'apply',worldAfter:record.frames?.[scene.event.index]?.after||plan.after},record):mapAnchor(plan.before,plan.engagements[0].territoryId,'battle');
  const key=appointment?'appointment:'+record.turn+':'+scene.event.index:'mass:'+plan.id;
  if(!point||this.followKey===key)return;
  this.followKey=key;Object.assign(this.view('simulation'),{x:point[0],y:point[1]});this.update('simulation');
 }
 followFilm(playback){
  const scene=playback.scene;if(!scene)return;
  if(scene.kind!=='film-camera'){if(this.filmPlan?.needed){Object.assign(this.view('simulation'),this.filmPlan.to);this.update('simulation',true);}this.filmPlan=null;return;}
  const key=playback.state.record.turn+':'+scene.id+':'+(playback.state.take||0);
  if(!this.autoFollow){scene.filmCamera={needed:false};playback.remaining=0;this.filmPlan=null;return;}
  if(this.filmKey===key)return;this.filmKey=key;
  const world=scene.worldBefore,point=mapAnchor(world,scene.filmBattle.territoryId,'battle');if(!point){scene.filmCamera={needed:false};playback.remaining=0;return;}
  const view=this.view('simulation'),viewport=this.viewport('simulation'),root=globalThis.document?.querySelector('.map-stage'),hud=root?.querySelector('.film-hud'),toolbar=root?.querySelector('.film-toolbar'),scale=Number(root?.style.getPropertyValue('--film-card-scale'))||1;
  const bottom=(hud?.getBoundingClientRect().height||240*(Number(root?.querySelector('.film-layer')?.style.getPropertyValue('--film-info-scale'))||1))+(toolbar&&!root?.classList.contains('film-clean')?toolbar.getBoundingClientRect().height+40:50)+80;
  const plan=filmSafeTarget(view,this.box('simulation'),viewport,point,{bottom,cardWidth:84*scale});
  const saved=this.filmFrames.get(playback.state.record.turn+':'+scene.battleIndex);if(saved){plan.to={...saved};plan.needed=Math.abs(saved.x-view.x)+Math.abs(saved.y-view.y)+Math.abs(saved.zoom-view.zoom)>.01;}
  this.clamp(plan.to);scene.filmCamera=plan;this.filmPlan=plan;playback.remaining=playback.duration();
  if(playback.reducedMotion?.()&&plan.needed){Object.assign(view,plan.to);this.update('simulation');}
 }
 animateFilm(playback){
  const plan=this.filmPlan;if(!plan?.needed||playback.scene?.kind!=='film-camera')return;
  const view=this.view('simulation'),progress=Number.isFinite(playback.sceneProgress)?playback.sceneProgress:1,target=filmCameraAt(plan,progress);
  const zoom=plan.from.zoom+(plan.to.zoom-plan.from.zoom)*progress;
  if(Math.abs(view.x-target.x)+Math.abs(view.y-target.y)+Math.abs(view.zoom-zoom)<.001)return;
  Object.assign(view,target,{zoom});this.update('simulation',true);
 }
 view(context){if(!this.views.has(context))this.views.set(context,{zoom:1,x:600,y:400});return this.views.get(context);}
 inspect(world,id){if(!world.territories.some(t=>t.id===id))return;this.manual();const p=mapAnchor(world,id,'battle');Object.assign(this.view('simulation'),{x:p[0],y:p[1]});this.inspectedTerritory=id;this.clamp(this.view('simulation'));this.update('simulation');}
 resetAll(){for(const frame of this.pendingUpdates.values())globalThis.cancelAnimationFrame?.(frame);this.pendingUpdates.clear();this.armyZoomPending=false;this.inspectedTerritory=null;this.resetFollow();this.views.clear();this.filmFrames.clear();this.panEditor=false;this.drag=null;}
 box(context){const v=this.view(context),viewport=this.viewport(context),[w,h]=cameraExtent(viewport.width,viewport.height);return [v.x-w/2/v.zoom,v.y-h/2/v.zoom,w/v.zoom,h/v.zoom];}
 restore(){document.querySelectorAll('.atlas-scroll[data-map-camera]').forEach(el=>this.update(el.dataset.mapCamera));}
 update(context,silent=false){const pending=this.pendingUpdates.get(context);if(pending!==undefined){globalThis.cancelAnimationFrame?.(pending);this.pendingUpdates.delete(context);}const v=this.view(context);this.clamp(v);const box=this.box(context).join(' '),bounds=this.viewport(context);document.querySelectorAll(`.atlas-scroll[data-map-camera="${context}"]`).forEach(el=>{for(const svg of el.querySelectorAll(':scope > .atlas-map,:scope > .atlas-art-surface'))if(svg.getAttribute('viewBox')!==box)svg.setAttribute('viewBox',box);el.dataset.zoom=String(v.zoom);const scale=Math.min(bounds.width/1200,bounds.height/800)*v.zoom;el.dataset.detail=context==='editor'?'editor':observerDetail(this.detailMode,scale,v.zoom);el.classList.toggle('camera-pan-mode',context==='editor'&&this.panEditor);fitMapUnits(el);alignMountainLabels(el);updateHanMaps(el);el.querySelectorAll('.atlas-cell').forEach(cell=>cell.classList.toggle('event-selected-territory',context==='simulation'&&cell.dataset.territory===this.inspectedTerritory));});document.querySelectorAll(`[data-camera-scale="${context}"]`).forEach(el=>el.textContent=`${Math.round(v.zoom*100)}%`);document.querySelectorAll('[data-map-detail]').forEach(el=>el.value=this.detailMode);const select=document.querySelector('#map-editor-zoom');if(context==='editor'&&select){let option=[...select.options].find(o=>Number(o.value)===v.zoom);if(!option){option=new Option(`${Math.round(v.zoom*100)}%`,String(v.zoom));select.add(option);}select.value=String(v.zoom);}document.querySelectorAll('[data-action="map-pan-toggle"]').forEach(el=>el.setAttribute('aria-pressed',String(this.panEditor)));if(context==='simulation'){placeCompactDuel();placeRoyalChoice();placeVictoryBadge();placeMassBattle(this.playback,globalThis.document,false);}if(!silent)this.onUpdate?.();if(context==='simulation'&&this.armyZoomPending){this.armyZoomPending=false;followArmyCampaign(this);}}
 zoom(context,value,anchor=null,deferred=false){this.manual();const v=this.view(context),next=Math.round(Math.max(.5,Math.min(MAX_MAP_ZOOM,value))*1000)/1000;if(anchor){v.x=anchor[0]-(anchor[0]-v.x)*v.zoom/next;v.y=anchor[1]-(anchor[1]-v.y)*v.zoom/next;}v.zoom=next;this.clamp(v);this.armyZoomPending=context==='simulation'&&this.autoFollow;if(deferred)this.queueUpdate(context);else this.update(context);}
 clamp(v){v.zoom=Math.max(.5,Math.min(MAX_MAP_ZOOM,Number(v.zoom)||1));const context=[...this.views].find(([,view])=>view===v)?.[0]||'simulation',viewport=this.viewport(context),[,height]=cameraExtent(viewport.width,viewport.height),half=height/(2*v.zoom);v.x=Math.max(0,Math.min(1200,v.x));v.y=Math.max(Math.min(0,-800+half),Math.min(Math.max(800,1600-half),v.y));}
 action(action,context){if(!['map-zoom-in','map-zoom-out','map-zoom-reset','map-pan-toggle'].includes(action))return false;context||='overview';this.manual();if(action==='map-pan-toggle'){this.panEditor=!this.panEditor;this.update('editor');return true;}if(action==='map-zoom-reset'){this.views.set(context,{zoom:1,x:600,y:400});this.update(context);}else this.zoom(context,this.view(context).zoom*(action==='map-zoom-in'?1.25:.8));return true;}
 point(event,svg,context=null){const matrix=svg?.getScreenCTM();if(!matrix)return null;const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());if(context&&svg.viewBox?.baseVal){const shown=svg.viewBox.baseVal,box=this.box(context);if(shown.width&&shown.height)return [box[0]+(p.x-shown.x)/shown.width*box[2],box[1]+(p.y-shown.y)/shown.height*box[3]];}return [p.x,p.y];}
 wheel(event){const el=event.target.closest('.atlas-scroll[data-map-camera]');if(!el||event.target.closest('dialog'))return;const svg=el.querySelector('.atlas-map'),point=this.point(event,svg,el.dataset.mapCamera);if(!point)return;event.preventDefault();this.zoom(el.dataset.mapCamera,this.view(el.dataset.mapCamera).zoom*Math.exp(-Math.max(-160,Math.min(160,event.deltaY))*.0025),point,true);}
 down(event){const el=event.target.closest('.atlas-scroll[data-map-camera]');if(!el)return false;const context=el.dataset.mapCamera;if(event.button===0&&(context==='editor'&&!this.panEditor||event.target.closest('[data-action]')))return false;if(![0,1,2].includes(event.button))return false;this.flushUpdate(context);const svg=el.querySelector('.atlas-map'),matrix=svg.getScreenCTM();if(!matrix)return false;event.preventDefault();this.manual();this.drag={el,svg,context,pointer:event.pointerId,button:event.button,start:[event.clientX,event.clientY],center:{...this.view(context)},matrix:matrix.inverse(),moved:false};if(event.button!==0)el.setPointerCapture(event.pointerId);el.classList.add('camera-dragging');return true;}
 move(event){const drag=this.drag;if(!drag||drag.pointer!==event.pointerId)return false;if(!drag.el.isConnected){this.up();return false;}event.preventDefault();const a=new DOMPoint(...drag.start).matrixTransform(drag.matrix),b=new DOMPoint(event.clientX,event.clientY).matrixTransform(drag.matrix),v=this.view(drag.context);v.x=drag.center.x+a.x-b.x;v.y=drag.center.y+a.y-b.y;this.clamp(v);drag.moved||=Math.hypot(event.clientX-drag.start[0],event.clientY-drag.start[1])>4;if(drag.moved&&!drag.el.hasPointerCapture(event.pointerId))drag.el.setPointerCapture(event.pointerId);this.queueUpdate(drag.context);return true;}
 up(){if(!this.drag)return;this.flushUpdate(this.drag.context);this.drag.el.classList.remove('camera-dragging');if(this.drag.moved&&this.drag.button===0)this.suppressClick=true;this.drag=null;}
 consumeClick(event){if(!this.suppressClick)return false;this.suppressClick=false;if(event.target.closest('.atlas-scroll')){event.preventDefault();event.stopImmediatePropagation();return true;}return false;}
}
