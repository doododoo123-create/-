export const VIVID_COLORS=['#006BFF','#EF2028','#FFC400','#00B550','#903CFF','#00CADB','#FF7700'];
const oldPalette=['#6da9ff','#ef8179','#eac66b','#6bceb4','#be9aeb','#6fd4e6','#e9a65e'];
export function vividColor(color){const i=oldPalette.indexOf(String(color).toLowerCase());return i<0?color:VIVID_COLORS[i];}
export function vividWorld(world){return world.countries.some(c=>vividColor(c.color)!==c.color)?{...world,countries:world.countries.map(c=>({...c,color:vividColor(c.color)}))}:world;}
