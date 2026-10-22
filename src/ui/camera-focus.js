import { mapAnchor } from '../model/cartography-geometry.js';
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
