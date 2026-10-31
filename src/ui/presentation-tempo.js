// UI timing only. Reel cadence and game/RNG time remain independent.
export const PRESENTATION_RATE=1.2;
export const movementRate=scene=>scene?.rapidMovement&&!['roll','reel','season','summary'].includes(scene.kind)&&!['death','elimination','capital_fall','finish'].includes(scene.event?.type)?1.5:1;
export function criticalScene(scene){
 if(!scene||['roll','reel'].includes(scene.kind))return false;
 if(['death','appointment'].includes(scene.event?.type))return scene.kind==='apply';
 if(['capital_fall','elimination'].includes(scene.event?.type))return true;
 return scene.event?.type==='roster'&&scene.kind==='apply'&&scene.worldAfter?.people.some(p=>p.role==='general'&&p.active&&p.alive&&!scene.worldBefore.people.some(old=>old.id===p.id&&old.countryId===p.countryId&&old.active&&old.alive));
}
export const armyMovementDurationScale=scene=>scene?.kind==='movement'&&!scene.singleOfficer&&(scene.armyGroup?.members?.length>1||scene.campaign?.modern||scene.event?.formation&&['army_assembly','army_march','army_release'].includes(scene.event.type))?1.4:1;
export const animationRate=scene=>criticalScene(scene)||scene?.kind==='reel'?1:PRESENTATION_RATE*movementRate(scene)/armyMovementDurationScale(scene);
export const routeOpacity=(turn,current)=>Math.max(.25,Math.pow(.8,Math.max(0,(current||turn||0)-(turn||current||0))));
