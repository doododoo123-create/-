// View-only geometry. Original soldier pixels remain 224 high.
export const TROOP_BODY_HEIGHT=40.5,TROOP_FOOT_Y=35,COMMANDER_SCALE=.75;
export const COMMANDER_LIFT=-36,TROOP_FOOTPRINT=8;
export const TROOP_COLUMN_PITCH=56,TROOP_ROW_PITCH=48;
// Space for each action's widest original pose, including mirrored weapons.
// Standing troops do not reserve the full width of an extended attack/death pose.
const troopActionPitch={idle:36,walk:38,retreat:42,guard:48,attack:56,hurt:36,death:54};
export function troopGrid(count,soldiers=[]){const pitch=soldiers.length?Math.max(...soldiers.map(s=>troopActionPitch[s.action]||TROOP_COLUMN_PITCH)):TROOP_COLUMN_PITCH,columns=Math.min(4,Math.max(1,count)),rows=Math.max(1,Math.ceil(count/columns));return {columns,rows,pitch,width:columns*pitch+24,height:rows*TROOP_ROW_PITCH+24,positions:Array.from({length:count},(_,i)=>({x:(i%columns-(Math.min(columns,count-Math.floor(i/columns)*columns)-1)/2)*pitch,y:-Math.floor(i/columns)*TROOP_ROW_PITCH}))};}
export function commanderTransform(count=1){return `translate(0,${COMMANDER_LIFT-(troopGrid(count).rows-1)*TROOP_ROW_PITCH}) scale(${COMMANDER_SCALE})`;}
export function troopPositions(count){return troopGrid(count).positions.map(p=>p.x);}
export function troopCanvasSize(width,height,screenScale,dpr){return {width:Math.max(1,Math.ceil(width*screenScale*dpr)),height:Math.max(1,Math.ceil(height*screenScale*dpr))};}
