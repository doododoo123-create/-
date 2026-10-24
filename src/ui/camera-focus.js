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
export function adjacentDuelPlacement(bounds,pair,pane,obstacle=null){
 const gap=10,above=Math.max(0,pair.top-bounds.top-gap-8),below=Math.max(0,bounds.bottom-pair.bottom-gap-8);
 const sides=above>=pane.height?['above','below']:below>=pane.height?['below','above']:above>=below?['above','below']:['below','above'];
 const candidates=sides.map(side=>{const available=side==='above'?above:below,scale=Math.min(1,available/Math.max(1,pane.height)),width=pane.width*scale,height=pane.height*scale,x=Math.max(bounds.left+8,Math.min(bounds.right-width-8,(pair.left+pair.right-width)/2)),y=side==='above'?pair.top-gap-height:pair.bottom+gap;return {x,y,width,height,scale,side};});
 const overlaps=(a,b)=>b&&a.x<b.right&&a.x+a.width>b.left&&a.y<b.bottom&&a.y+a.height>b.top;
 return candidates.find(p=>p.scale>=.99&&!overlaps(p,obstacle))||candidates[0];
}
export function placeCompactDuel(){
 const root=globalThis.document?.querySelector?.('.map-stage'),pane=root?.querySelector('.is-compact-duel'),ring=root?.querySelector('.battle-emblem .target-ring');
 if(!pane||!ring)return;
 const bounds=root.getBoundingClientRect(),cards=[...root.querySelectorAll('.map-unit-position[data-combat-side]')],boxes=cards.flatMap(c=>[...c.querySelectorAll('foreignObject,.card-label-badge,.unit-combat-role')].map(e=>e.getBoundingClientRect()));if(!boxes.length)boxes.push(ring.getBoundingClientRect());
 const pair={left:Math.min(...boxes.map(b=>b.left)),right:Math.max(...boxes.map(b=>b.right)),top:Math.min(...boxes.map(b=>b.top)),bottom:Math.max(...boxes.map(b=>b.bottom))};
 const chosen=adjacentDuelPlacement(bounds,pair,{width:pane.offsetWidth,height:pane.offsetHeight},root.querySelector('.map-play-toggle')?.getBoundingClientRect());
 pane.style.left=`${chosen.x-bounds.left}px`;pane.style.top=`${chosen.y-bounds.top}px`;pane.style.transform=`scale(${chosen.scale})`;pane.style.transformOrigin='top left';pane.dataset.adjacent=chosen.side;
 const attack=cards.find(c=>c.dataset.combatSide==='attack'),defense=cards.find(c=>c.dataset.combatSide==='defense');
 if(attack&&defense){const first=Number(attack.dataset.combatScreenX)<Number(defense.dataset.combatScreenX);pane.style.setProperty('--attack-order',first?'0':'1');pane.style.setProperty('--defense-order',first?'1':'0');}
}
export function placeRoyalChoice(){
 const root=globalThis.document?.querySelector?.('.map-stage'),pane=root?.querySelector('.is-royal-choice,.is-royal-die');if(!pane)return;
 const role=pane.dataset.anchorRole||'king',unit=[...root.querySelectorAll('.map-unit-position')].find(c=>c.dataset.unitRole===role&&c.dataset.country===pane.dataset.nation&&(role!=='general'||c.querySelector('.map-unit-token')?.dataset.slot===pane.dataset.anchorSlot)),card=unit?.querySelector('foreignObject');if(!card)return;
 const r=root.getBoundingClientRect(),b=card.getBoundingClientRect(),width=pane.offsetWidth,height=pane.offsetHeight;
 const left=Math.max(8,Math.min(r.width-width-8,b.x+b.width/2-r.x-width/2));
 let top=b.y-r.y-height-8;if(top<8)top=b.bottom-r.y+8;
 const control=root.querySelector('.map-play-toggle')?.getBoundingClientRect();if(control&&left+width>control.left-r.left&&left<control.right-r.left&&top<control.bottom-r.top)top=control.bottom-r.top+8;
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
