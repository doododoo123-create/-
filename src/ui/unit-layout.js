export const UNIT_CARD_WIDTH=32,UNIT_CARD_HEIGHT=54;
export const UNIT_PIN_GAP=12,UNIT_PIN_OFFSET=35;
// Deterministic display placement; station IDs and simulation coordinates stay unchanged.
export function arrangeUnits(units){
  return units.map(unit=>{const anchor=[unit.point[0],unit.point[1]-UNIT_PIN_GAP];return {...unit,point:[anchor[0],anchor[1]-UNIT_PIN_OFFSET],anchorPoint:anchor};});
}
