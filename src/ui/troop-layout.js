// View-only geometry. Original soldier pixels remain 224 high.
export const TROOP_BODY_HEIGHT=54,TROOP_FOOT_Y=35,COMMANDER_SCALE=.75;
export const COMMANDER_LIFT=-50,TROOP_FOOTPRINT=10.5;
export function troopGrid(count){const columns=Math.min(4,Math.max(1,count)),rows=Math.max(1,Math.ceil(count/columns));return {columns,rows,width:columns*76+28,height:rows*72+28,positions:Array.from({length:count},(_,i)=>({x:(i%columns-(Math.min(columns,count-Math.floor(i/columns)*columns)-1)/2)*76,y:-Math.floor(i/columns)*72}))};}
export function commanderTransform(count=1){return `translate(0,${COMMANDER_LIFT-(troopGrid(count).rows-1)*72}) scale(${COMMANDER_SCALE})`;}
export function troopPositions(count){return troopGrid(count).positions.map(p=>p.x);}
export function troopCanvasSize(width,height,screenScale,dpr){return {width:Math.max(1,Math.ceil(width*screenScale*dpr)),height:Math.max(1,Math.ceil(height*screenScale*dpr))};}
