// Display coordinates only. The former card pin remains the ground anchor.
export const TROOP_BODY_HEIGHT=54,TROOP_FOOT_Y=35,COMMANDER_SCALE=.75;
export const COMMANDER_LIFT=-50,TROOP_FOOTPRINT=4;
export function commanderTransform(){return `translate(0,${COMMANDER_LIFT}) scale(${COMMANDER_SCALE})`;}
export function troopPositions(count){return count===1?[0]:count===2?[-13,13]:[-20,0,20];}
