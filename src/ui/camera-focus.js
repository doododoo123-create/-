import { mapAnchor } from '../model/cartography-geometry.js';
import { neighbors } from '../model/world.js';
export function nationFraming(world,id,viewport={width:1200,height:800}){
 const own=world.territories.filter(t=>t.ownerId===id);if(!own.length)return null;
 const points=own.map(t=>mapAnchor(world,t.id,'reference'));
 const mean=points.reduce((p,q)=>[p[0]+q[0]/points.length,p[1]+q[1]/points.length],[0,0]);
 const center=[...points].sort((a,b)=>Math.hypot(a[0]-mean[0],a[1]-mean[1])-Math.hypot(b[0]-mean[0],b[1]-mean[1]))[0];
 // Every adjacent frontier is included, so framing cannot disclose the future selected target.
 const frontier=new Set(own.flatMap(t=>neighbors(world,t).map(n=>n.id))),all=[...points,...[...frontier].map(v=>mapAnchor(world,v,'reference'))];
 const rx=Math.max(...all.map(p=>Math.abs(p[0]-center[0])))+75,ry=Math.max(...all.map(p=>Math.abs(p[1]-center[1])))+110;
 const [w,h]=cameraExtent(viewport.width,viewport.height);
 return {x:center[0],y:center[1],zoom:Math.max(.5,Math.min(3.2,w*.88/(2*rx),h*.86/(2*ry)))};
}
const paneOverlap=(a,b)=>Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
export function placeCompactDuel(){
 const root=globalThis.document?.querySelector?.('.map-stage'),pane=root?.querySelector('.is-compact-duel'),ring=root?.querySelector('.battle-emblem .target-ring');
 if(!pane||!ring)return;
 const r=root.getBoundingClientRect(),b=ring.getBoundingClientRect(),width=pane.offsetWidth,height=pane.offsetHeight;
 const cards=[...root.querySelectorAll('.map-unit-position[data-combat-side]')],boxes=[b,...cards.flatMap(c=>[...c.querySelectorAll('foreignObject,.unit-combat-role,.unit-status-label,.unit-loss-label')].map(e=>e.getBoundingClientRect()))].map(v=>({x:v.x-r.x-5,y:v.y-r.y-5,width:v.width+10,height:v.height+10}));
 const left=Math.min(...boxes.map(v=>v.x)),right=Math.max(...boxes.map(v=>v.x+v.width)),top=Math.min(...boxes.map(v=>v.y)),bottom=Math.max(...boxes.map(v=>v.y+v.height)),x=b.x+b.width/2-r.x,y=b.y+b.height/2-r.y;
 const candidates=[[x-width/2,top-height-8],[x-width/2,bottom+8],[left-width-8,y-height/2],[right+8,y-height/2],[8,8],[r.width-width-8,8],[8,r.height-height-8],[r.width-width-8,r.height-height-8]].map(([px,py],i)=>({x:Math.max(8,Math.min(r.width-width-8,px)),y:Math.max(8,Math.min(r.height-height-8,py)),width,height,i}));
 const chosen=candidates.map(p=>({...p,overlap:boxes.reduce((n,v)=>n+paneOverlap(p,v),0)})).sort((a,b)=>a.overlap-b.overlap||a.i-b.i)[0];
 pane.style.left=`${chosen.x}px`;pane.style.top=`${chosen.y}px`;
 const attack=cards.find(c=>c.dataset.combatSide==='attack'),defense=cards.find(c=>c.dataset.combatSide==='defense');
 if(attack&&defense){const ax=Number(attack.dataset.combatScreenX),dx=Number(defense.dataset.combatScreenX),first=Math.abs(ax-dx)>10?ax<dx:Number(attack.dataset.combatScreenY)<Number(defense.dataset.combatScreenY);pane.style.setProperty('--attack-order',first?'0':'1');pane.style.setProperty('--defense-order',first?'1':'0');}
}
export function placeRoyalChoice(){
 const root=globalThis.document?.querySelector?.('.map-stage'),pane=root?.querySelector('.is-royal-choice,.is-royal-die');if(!pane)return;
 const role=pane.dataset.anchorRole||'king',unit=[...root.querySelectorAll('.map-unit-position')].find(c=>c.dataset.unitRole===role&&c.dataset.country===pane.dataset.nation),card=unit?.querySelector('foreignObject');if(!card)return;
 const r=root.getBoundingClientRect(),b=card.getBoundingClientRect(),width=pane.offsetWidth,height=pane.offsetHeight;
 const left=Math.max(8,Math.min(r.width-width-8,b.x+b.width/2-r.x-width/2));
 let top=b.y-r.y-height-8;if(top<8)top=b.bottom-r.y+8;
 pane.style.left=`${left}px`;pane.style.top=`${Math.max(8,Math.min(r.height-height-8,top))}px`;
}
export function cameraExtent(width=1200,height=800){const ratio=Math.max(.1,width/height);return ratio<1.5?[1200,1200/ratio]:[800*ratio,800];}
export function battleFraming(scene,record,viewport={width:1200,height:800}){
 const battle=record.battles?.[scene?.battleIndex],world=scene.worldBefore||scene.worldAfter;if(!battle||!world)return null;
 const target=mapAnchor(world,battle.territoryId,'battle');if(!target)return null;
 const people=world.people.filter(p=>p.role==='general'&&((p.countryId===battle.actorId&&p.slot===battle.slot)||!battle.automatic&&(p.countryId===battle.defenderId&&p.slot===battle.defenseSlot)));
 const points=[target,...people.map(p=>mapAnchor(world,scene.camps?.[p.id]?.territoryId||p.positionId||p.stationId,'label')).filter(Boolean)];
 const left=Math.min(...points.map(p=>p[0]))-46,right=Math.max(...points.map(p=>p[0]))+46,top=Math.min(...points.map(p=>p[1]))-116,bottom=Math.max(...points.map(p=>p[1]))+30;
 const [width,height]=cameraExtent(viewport.width,viewport.height),scale=Math.min(viewport.width/1200,viewport.height/800);
 const reserved=Math.max(viewport.reservedTop||0,viewport.height<=540?.56:viewport.height<=700?.50:.45),targetY=Math.min(.93,Math.max(viewport.height<=540?.76:.72,reserved+.12));
 const zoom=Math.max(.5,Math.min(4.2,1.6/scale,width*.8/(right-left),height*(targetY-reserved)/Math.max(1,target[1]-top),height*(.96-targetY)/Math.max(1,bottom-target[1])));
 return {zoom,x:(left+right)/2,y:target[1]-(targetY-.5)*height/zoom};
}
export function sceneFocus(scene,record){
 if(!scene?.event||scene.kind==='summary')return null;const world=scene.worldAfter||scene.worldBefore;if(!world)return null;
 if(scene.kind==='movement'&&scene.moves?.length)return mapAnchor(world,scene.moves[0].toId,'station');
 const battle=record.battles?.[scene.battleIndex];if(battle)return mapAnchor(world,battle.territoryId,'battle');
 if(scene.event.type==='round_end')return [600,400];
 const id=scene.event.nationId||record.actorId,country=world.countries.find(c=>c.id===id);if(!country)return null;
 const general=scene.event.role==='general'||Number.isInteger(scene.event.slot),person=general?world.people.find(p=>p.countryId===id&&p.role==='general'&&p.slot===scene.event.slot):null;
 const previous=general?scene.worldBefore?.people.find(p=>p.countryId===id&&p.role==='general'&&p.slot===scene.event.slot):null;
 return mapAnchor(world,scene.camps?.[person?.id]?.territoryId||person?.positionId||person?.stationId||previous?.positionId||previous?.stationId||country.capitalId,'station');
}
