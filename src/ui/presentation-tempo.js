// UI timing only. Reel cadence and game/RNG time remain independent.
export const PRESENTATION_RATE=1.2;
export const movementRate=scene=>scene?.rapidMovement&&!['roll','reel','season','summary'].includes(scene.kind)&&!['death','elimination','capital_fall','finish'].includes(scene.event?.type)?1.5:1;
export const animationRate=scene=>scene?.kind==='reel'?1:PRESENTATION_RATE*movementRate(scene);
export const routeOpacity=(turn,current)=>Math.max(.25,Math.pow(.8,Math.max(0,(current||turn||0)-(turn||current||0))));
