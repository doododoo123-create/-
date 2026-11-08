// View-only geometry. Original soldier pixels remain 224 high.
export const TROOP_BODY_HEIGHT=40.5,TROOP_FOOT_Y=35,COMMANDER_SCALE=.75;
export const COMMANDER_LIFT=-36,TROOP_FOOTPRINT=4.5;
export const TROOP_COLUMN_PITCH=18,TROOP_ROW_PITCH=28;
// Dense ranks intentionally overlap weapons and the lower bodies of rear ranks.
// Padding still contains each complete original pose; actions never spread the ranks.
export function troopGrid(count){const pitch=TROOP_COLUMN_PITCH,columns=Math.min(4,Math.max(1,count)),rows=Math.max(1,Math.ceil(count/columns));return {columns,rows,pitch,width:columns*pitch+56,height:rows*TROOP_ROW_PITCH+36,positions:Array.from({length:count},(_,i)=>({x:(i%columns-(Math.min(columns,count-Math.floor(i/columns)*columns)-1)/2)*pitch,y:-Math.floor(i/columns)*TROOP_ROW_PITCH}))};}
export function commanderTransform(count=1){return `translate(0,${COMMANDER_LIFT-(troopGrid(count).rows-1)*TROOP_ROW_PITCH}) scale(${COMMANDER_SCALE})`;}
export function troopPositions(count){return troopGrid(count).positions.map(p=>p.x);}
export function troopCanvasSize(width,height,screenScale,dpr){return {width:Math.max(1,Math.ceil(width*screenScale*dpr)),height:Math.max(1,Math.ceil(height*screenScale*dpr))};}
