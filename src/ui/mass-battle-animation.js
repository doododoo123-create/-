import {placeMassBattle} from './mass-battle-placement.js';
import {troopCenterOffset} from './troop-layout.js';
import {troopSource,troopFrameArt,troopFrame} from './troop-animation.js';
import {massBattleAt} from './mass-battle-plan.js';
import {massSceneTime} from './mass-battle-scenes.js';
import {format} from './icons.js';

// One canvas, one existing RAF/clock. No independent timers, random per-frame
// motion, per-soldier images, or writes into simulation/world objects.
export class MassBattleAnimation{
 watchDensity(){if(!globalThis.matchMedia)return;if(this.densityQuery&&this.densityHandler)this.densityQuery.removeEventListener?.('change',this.densityHandler);this.densityQuery=matchMedia(`(resolution: ${globalThis.devicePixelRatio||1}dppx)`);this.densityHandler=()=>{this.last=null;this.tick();this.watchDensity();};this.densityQuery.addEventListener?.('change',this.densityHandler,{once:true});}
 start(root,playback){
  const canvas=root.querySelector?.('canvas[data-mass-canvas]'),plan=playback.scene?.massPlan;
  if(!canvas||!plan){this.stop();return;}
  if(this.canvas!==canvas||this.plan!==plan){this.stop();this.canvas=canvas;this.plan=plan;this.root=canvas.closest('.mass-battle');this.watchDensity();this.sources=new Map();this.labels=new Map([...this.root.querySelectorAll('[data-mass-unit]')].map(n=>[n.dataset.massUnit,n]));this.totals=[...this.root.querySelectorAll('[data-mass-total]')];this.title=this.root.querySelector('[data-mass-territory]');this.clock=this.root.querySelector('[data-mass-clock]');}
  this.playback=playback;this.last=null;this.tick();
 }
 stop(){if(this.densityQuery&&this.densityHandler)this.densityQuery.removeEventListener?.('change',this.densityHandler);this.densityQuery=null;this.epoch=(this.epoch||0)+1;this.canvas=null;this.plan=null;this.sources?.clear();this.labels=null;this.background=null;this.last=null;}
 source(tier,action){const key=tier+':'+action;if(!this.sources.has(key)){
  this.sources.set(key,null);const epoch=this.epoch;
  void troopSource(tier,action).then(images=>{if(this.epoch!==epoch||!this.canvas?.isConnected||!this.sources.has(key))return;this.sources.set(key,images);this.last=null;this.tick();}).catch(()=>{});
 }return this.sources.get(key);}
 tick(){
  const c=this.canvas,p=this.plan;if(!c?.isConnected||!p)return;
  placeMassBattle(this.playback,this.root?.closest('.map-stage')||this.root);
  const time=massSceneTime(this.playback),state=massBattleAt(p,time),rect=c.getBoundingClientRect();if(!rect.width||!rect.height)return;
  const dpr=globalThis.devicePixelRatio||1,w=Math.ceil(rect.width*dpr),h=Math.ceil(rect.height*dpr),key=[Math.floor(time/32),w,h,this.playback.playing].join(':');if(this.last===key&&c.width===w&&c.height===h)return;this.last=key;
  if(c.width!==w)c.width=w;if(c.height!==h)c.height=h;
  const ctx=c.getContext('2d'),scale=Math.min(w/p.width,h/p.height),sx=scale,sy=scale,ox=(w-p.width*scale)/2,oy=(h-p.height*scale)/2;ctx.setTransform(sx,0,0,sy,ox,oy);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  if(!this.background||this.background.width!==w||this.background.height!==h){
   const bg=document.createElement('canvas');bg.width=w;bg.height=h;const b=bg.getContext('2d');b.setTransform(sx,0,0,sy,ox,oy);
   const ground=b.createLinearGradient(0,0,p.width,p.height);ground.addColorStop(0,'#b9c3a666');ground.addColorStop(.5,'#d4cdb366');ground.addColorStop(1,'#aebc9b66');b.fillStyle=ground;b.fillRect(-ox/sx,-oy/sy,w/sx,h/sy);
   b.strokeStyle='#69785b1a';b.lineWidth=1;for(let i=0;i<12;i++){b.beginPath();b.moveTo(0,p.height*i/12);b.bezierCurveTo(p.width*.3,p.height*i/12-45,p.width*.7,p.height*i/12+45,p.width,p.height*i/12);b.stroke();}
   b.fillStyle='#83916813';for(const [x,y,rx,ry] of [[.1,.2,180,70],[.8,.7,170,60],[.4,.9,200,50]]){b.beginPath();b.ellipse(p.width*x,p.height*y,rx,ry,0,0,Math.PI*2);b.fill();}
   this.background=bg;
  }
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);ctx.drawImage(this.background,0,0);ctx.setTransform(sx,0,0,sy,ox,oy);
  const needed=new Set(),soldiers=[],reduced=!!this.playback.reducedMotion?.();
  // Ground markers and every shadow are behind every soldier. Depth is sorted
  // across the entire battle, not commander-by-commander or front-row-first.
  for(const u of state.units){
   if(!u.visible||!u.figures)continue;
   const action=u.action,source=this.source(u.tier,action);needed.add(u.tier+':'+action);if(!source)continue;
   const sample=troopFrame(action,reduced?0:u.actionTime),art=troopFrameArt(source,u.tier,action,sample.frame,u.color),cols=Math.min(4,u.figures),rows=Math.ceil(u.figures/cols),body=50,offset=troopCenterOffset(u.figures,body,18);
   let alpha=sample.opacity*(u.withdrawn?.55:1);if(action==='death'&&!reduced)alpha*=.65+.35*Math.abs(Math.sin(u.actionTime/75));
   ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=u.color+'22';ctx.strokeStyle=action==='death'?'#ee2637':u.color;ctx.lineWidth=action==='death'?2.5:1.4;
   ctx.beginPath();ctx.ellipse(u.x,u.y+offset-(rows-1)*9,cols*11+9,(rows-1)*9+8,0,0,Math.PI*2);ctx.fill();ctx.stroke();
   for(let n=0;n<u.figures;n++){const row=Math.floor(n/4),count=Math.min(4,u.figures-row*4),x=u.x+(n%4-(count-1)/2)*18,y=u.y+offset-row*18;
    ctx.fillStyle='#111a1640';ctx.beginPath();ctx.ellipse(x,y,9,3,0,0,Math.PI*2);ctx.fill();soldiers.push({x,y,art,alpha,flip:u.flip,scale:body/224,id:u.id+':'+n});
   }ctx.restore();
  }
  soldiers.sort((a,b)=>a.y-b.y||a.x-b.x||a.id.localeCompare(b.id));
  for(const s of soldiers){ctx.save();ctx.globalAlpha=s.alpha;ctx.translate(s.x,s.y);if(s.flip)ctx.scale(-1,1);ctx.drawImage(s.art,-174*s.scale,-292*s.scale,384*s.scale,320*s.scale);ctx.restore();}
  c.dataset.depthOrder=soldiers.map(s=>s.y.toFixed(2)).join(',');
  for(const key of this.sources.keys())if(!needed.has(key))this.sources.delete(key);
  for(const e of state.engagements.filter(e=>!e.automatic)){ctx.save();ctx.font='20px "Studio Symbols", "Studio Emoji"';ctx.textAlign='center';ctx.fillStyle='#b21621';ctx.strokeStyle='#fff9';ctx.lineWidth=3;ctx.strokeText('⚔',e.point.x,e.point.y+7);ctx.fillText('⚔',e.point.x,e.point.y+7);ctx.restore();}
  const px=scale/dpr,py=scale/dpr;
  for(const u of state.units){const label=this.labels.get(u.id);if(!label)continue;
   const width=Math.max(48,Math.min(78,135*px-6)),height=30;
   const half=(Math.min(4,u.figures)-1)*9+30;
   const x=Math.max(0,Math.min(rect.width-width,u.x*px+ox/dpr+(u.side==='attack'?-half*px-width-3:half*px+3)));
   const y=Math.max(0,Math.min(rect.height-height,u.y*py+oy/dpr-height/2));
   label.style.width=width+'px';label.style.transform=`translate(${x}px,${y}px)`;label.classList.toggle('is-withdrawn',u.withdrawn||!u.alive);label.dataset.action=u.action;label.dataset.centerX=String(u.x);label.dataset.centerY=String(u.y);label.dataset.troops=String(u.troops);label.dataset.figures=String(u.visible?u.figures:0);
   const army=label.querySelector('[data-mass-army]'),notice=label.querySelector('[data-mass-notice]');army.textContent=format(u.troops)+'만';label.querySelector('[data-mass-health]').style.transform=`scaleX(${Math.min(1,u.troops/Math.max(u.startArmy,u.troops,.0001))})`;
   const text=u.labels.at(-1)?.text||(!u.alive?'전사':u.troops<=0?'병력 소진':u.withdrawn?'후퇴':'');notice.textContent=text;notice.dataset.tone=u.labels.at(-1)?.kind||'quiet';
  }
  for(const node of this.totals)node.textContent=format(state.totals[node.dataset.massTotal]);
  const current=state.engagements.at(-1)||p.engagements.filter(e=>e.start<=state.base).at(-1)||p.engagements[0];if(this.title)this.title.textContent=(current?.territoryName||'전장')+(current?.terrain==='mountain'?' · 산악':'');
  if(this.clock)this.clock.textContent=`${Math.floor(time/1000)}초 · ${this.playback.effectiveSpeed}×`;
 }
}
