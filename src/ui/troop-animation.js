import {TROOP_BODY_HEIGHT,TROOP_FOOT_Y,troopPositions} from './troop-layout.js';
import {TROOP_ART} from '../data/troop-art.js';
import {localImageURL} from './local-image-url.js';
// Shared, bounded atlases. A canvas belongs to a card, not to an independent clock.
const troopAtlases=new Map(),troopPending=new Map();
const loadTroopImage=source=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=localImageURL(source);});
async function troopAtlas(tier,action,color){
 const key=tier+':'+action+':'+color;
 if(troopAtlases.has(key)){const value=troopAtlases.get(key);troopAtlases.delete(key);troopAtlases.set(key,value);return value;}
 if(troopPending.has(key))return troopPending.get(key);
 const job=(async()=>{const art=TROOP_ART[tier][action],[body,shade]=await Promise.all([loadTroopImage(art.body),loadTroopImage(art.shade)]),canvas=document.createElement('canvas');canvas.width=body.width;canvas.height=body.height;const ctx=canvas.getContext('2d');ctx.drawImage(shade,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));for(let k=0;k<pixels.data.length;k+=4)if(pixels.data[k+3]){const light=pixels.data[k]/255/.34;for(let c=0;c<3;c++)pixels.data[k+c]=Math.min(255,Math.round(rgb[c]*light));}ctx.putImageData(pixels,0,0);ctx.drawImage(body,0,0);troopAtlases.set(key,canvas);while(troopAtlases.size>24)troopAtlases.delete(troopAtlases.keys().next().value);return canvas;})();
 troopPending.set(key,job);try{return await job;}finally{troopPending.delete(key);}
}
export function troopFrame(action,time){
 const a=TROOP_ART.tier1[action],duration=a.durations.reduce((s,n)=>s+n,0);let t=a.loop?time%duration:time,acc=0,frame=9;
 for(let i=0;i<10;i++){acc+=a.durations[i];if(t<acc){frame=i;break;}}
 return {frame,opacity:action==='death'?Math.max(0,Math.min(1,1-(time-duration-450)/350)):1};
}
export class TroopAnimation {
 start(root,playback){this.root=root;this.playback=playback;this.entries=[...root.querySelectorAll('canvas[data-troop-action]')].map(node=>({node,action:node.dataset.troopAction,tiers:node.dataset.troopTiers.split(','),count:Number(node.dataset.troopCount),flip:node.dataset.troopFlip==='true',color:node.dataset.troopColor,images:new Map()}));
  for(const e of this.entries)for(const tier of new Set(e.tiers))void troopAtlas(tier,e.action,e.color).then(atlas=>{if(!e.node.isConnected)return;e.images.set(tier,atlas);e.last=null;this.draw(e);}).catch(()=>{});
 }
 draw(e){
  if(!e.node.isConnected)return;
  const now=Date.now();if(!e.visibilityAt||now-e.visibilityAt>250){const box=e.node.getBoundingClientRect();e.visible=box.right>=0&&box.bottom>=0&&box.left<=innerWidth&&box.top<=innerHeight;e.visibilityAt=now;}if(!e.visible)return;
  const p=this.playback,t=p.sceneProgress*Math.max(0,p.duration?.()||0),sample=troopFrame(e.action,t),key=sample.frame+':'+sample.opacity;
  if(e.last===key)return;e.last=key;const ctx=e.node.getContext('2d');ctx.clearRect(0,0,e.node.width,e.node.height);
  const x=troopPositions(e.count),height=TROOP_BODY_HEIGHT,scale=height/96;
  // Cheap layered ellipses create a soft contact shadow without SVG filters.
  for(const offset of x){for(let layer=3;layer>=0;layer--){ctx.save();ctx.scale(3,3);ctx.globalAlpha=sample.opacity*(layer===0?.17:.035);ctx.fillStyle="#101511";ctx.beginPath();ctx.ellipse(60+offset,58+TROOP_FOOT_Y,9+layer*1.5,2+layer*.65,0,0,Math.PI*2);ctx.fill();ctx.restore();}}
  for(let i=0;i<e.count;i++){const atlas=e.images.get(e.tiers[i%e.tiers.length]);if(!atlas)continue;ctx.save();ctx.scale(3,3);ctx.translate(60+x[i],58+TROOP_FOOT_Y);ctx.scale(e.flip?-scale:scale,scale);ctx.globalAlpha=sample.opacity;ctx.drawImage(atlas,sample.frame%5*165,Math.floor(sample.frame/5)*138,165,138,-174*96/224,-292*96/224,165,138);ctx.restore();}
 }
 tick(){if(!this.entries)return;for(const e of this.entries)this.draw(e);}
}
