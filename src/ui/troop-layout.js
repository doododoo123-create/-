// View-only geometry. Original soldier pixels remain 224 high.
export const TROOP_BODY_HEIGHT=40.5,TROOP_FOOT_Y=35,COMMANDER_SCALE=.75;
export const COMMANDER_LIFT=-18,TROOP_FOOTPRINT=4.5;
export const TROOP_COLUMN_PITCH=18,TROOP_ROW_PITCH=28;
// Dense ranks intentionally overlap weapons and the lower bodies of rear ranks.
// Padding still contains each complete original pose; actions never spread the ranks.
export function troopGrid(count){const pitch=TROOP_COLUMN_PITCH,columns=Math.min(4,Math.max(1,count)),rows=Math.max(1,Math.ceil(count/columns));return {columns,rows,pitch,width:columns*pitch+56,height:rows*TROOP_ROW_PITCH+36,positions:Array.from({length:count},(_,i)=>({x:(i%columns-(Math.min(columns,count-Math.floor(i/columns)*columns)-1)/2)*pitch,y:-Math.floor(i/columns)*TROOP_ROW_PITCH}))};}
export function commanderTransform(count=1){return `translate(0,${COMMANDER_LIFT-(troopGrid(count).rows-1)*TROOP_ROW_PITCH/2}) scale(${COMMANDER_SCALE})`;}
export function troopPositions(count){return troopGrid(count).positions.map(p=>p.x);}
export function troopCanvasSize(width,height,screenScale,dpr){return {width:Math.max(1,Math.ceil(width*screenScale*dpr)),height:Math.max(1,Math.ceil(height*screenScale*dpr))};}
// Stable union of all 210 supplied body/shade frame pairs, in original pixels.
// Mirror-symmetric horizontal bounds and fixed vertical bounds prevent wobble.
export const TROOP_VISUAL_BOUNDS=Object.freeze({left:23,top:62,right:325,bottom:295,pivotX:174,pivotY:292});
export function troopCenterOffset(count,body=TROOP_BODY_HEIGHT,pitch=TROOP_ROW_PITCH){const rows=Math.max(1,Math.ceil(count/4));return (TROOP_VISUAL_BOUNDS.pivotY-(TROOP_VISUAL_BOUNDS.top+TROOP_VISUAL_BOUNDS.bottom)/2)*body/224+(rows-1)*pitch/2;}
