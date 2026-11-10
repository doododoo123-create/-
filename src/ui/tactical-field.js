// Tactical-only occupied-space planner. One cell contains the complete sprite
// footprint, not merely a commander point. No soldier AI or game-state writes.
export function tacticalFootprint(group,bodyScale=1){
 const columns=Math.min(group.columns,Math.max(1,group.figures)),rows=Math.max(1,Math.ceil(group.figures/columns));
 return {width:((columns-1)*8+302*32/224)*bodyScale,height:((rows-1)*8+233*32/224)*bodyScale,bodyScale};
}
export function createTacticalField(groups,width=1260,height=760){
 let bodyScale=1,grid;
 for(let attempt=0;attempt<20;attempt++){
  const footprints=groups.map(g=>tacticalFootprint(g,bodyScale)),cellWidth=Math.max(48,...footprints.map(f=>f.width+14)),cellHeight=Math.max(40,...footprints.map(f=>f.height+18)),cols=2*Math.floor((width-80)/cellWidth/2),rows=Math.floor((height-80)/cellHeight),homeRows=Math.ceil(Math.max(1,rows-2)/2),enough=['attack','defense'].every(side=>{const columns=Array.from({length:cols},(_,i)=>i).filter(c=>c>0&&c<cols-1&&c%2===0&&(side==='attack'?c<cols/2-1:c>cols/2));return columns.length*homeRows>=groups.filter(g=>g.side===side).length+1;});
  grid={width,height,cols,rows,cellWidth,cellHeight,bodyScale};if(enough)break;bodyScale*=.9;
 }
 const {cols,rows,cellWidth,cellHeight}=grid;grid.origin={x:(width-(cols-1)*cellWidth)/2,y:(height-(rows-1)*cellHeight)/2};
 const cells=new Map(),positions=new Map(),homes=new Map(),parkingSlots=new Map(),waitAge=new Map(),released=new Set();
 const key=(c,r)=>r*cols+c,point=id=>({x:grid.origin.x+(id%cols)*cellWidth,y:grid.origin.y+Math.floor(id/cols)*cellHeight}),valid=(c,r)=>c>=0&&c<cols&&r>=0&&r<rows;
 const neighbors=id=>{const c=id%cols,r=Math.floor(id/cols);return [[c-1,r],[c+1,r],[c,r-1],[c,r+1]].filter(([x,y])=>valid(x,y)).map(([x,y])=>key(x,y));};
 // Entry/return traffic follows a directed lane network, with a free outer
 // ring. Opposite flows cannot meet head-on in a one-cell corridor.
 const exits=id=>{const c=id%cols,r=Math.floor(id/cols),h=r===rows-1?-1:r%2===0?1:-1,v=c===0?-1:c===cols-1?1:c%2===0?-1:1;return [[c+h,r],[c,r+v]].filter(([x,y])=>valid(x,y)).map(([x,y])=>key(x,y));};
 const incoming=id=>neighbors(id).filter(n=>exits(n).includes(id));
 for(const side of ['attack','defense']){
  const list=groups.filter(g=>g.side===side),columns=Array.from({length:cols/2},(_,i)=>side==='attack'?cols/2-2-i:cols/2+1+i).filter(c=>c>0&&c<cols-1&&c%2===0),slots=[];
  // Leave the front column and outer two rows for approach and retreat traffic.
  for(const c of columns)for(let r=1;r<rows-1;r+=2)slots.push(key(c,r));
  parkingSlots.set(side,slots);
  list.forEach((g,i)=>{const id=slots[i];if(id===undefined)throw Error('전술 배치 공간 부족');positions.set(g.id,id);homes.set(g.id,id);cells.set(id,g.id);g.bodyScale=bodyScale;g.footprint=tacticalFootprint(g,bodyScale);g.home=point(id);g.motions=[];});
 }
 const distance=(a,b)=>Math.abs(a%cols-b%cols)+Math.abs(Math.floor(a/cols)-Math.floor(b/cols));
 function firstStep(from,to,occupied,avoidFirst=null){
  if(from===to)return from;
  const queue=[from],parent=new Map([[from,null]]);let found=null;
  for(let head=0;head<queue.length;head++){const id=queue[head];if(id===to){found=id;break;}const next=exits(id).sort((a,b)=>distance(a,to)-distance(b,to)||a-b);for(const n of next)if(!(id===from&&n===avoidFirst)&&!parent.has(n)&&(!occupied.has(n)||n===to)){parent.set(n,id);queue.push(n);}}
  if(found===null)return from;while(parent.get(found)!==from&&parent.get(found)!==null)found=parent.get(found);return found;
 }
 function step(requestedGoals,start,end,actions=new Map(),priority=new Set()){
  const goals=requestedGoals;
  const obstacles=id=>new Map([...cells].filter(([cell,other])=>other!==id&&(goals.get(other)===cell||(waitAge.get(other)||0)>=4)));
  const proposed=new Map();for(const g of groups){if(released.has(g.id))continue;const from=positions.get(g.id),to=goals.get(g.id)??from;proposed.set(g.id,firstStep(from,to,obstacles(g.id)));}

  const claims=new Map(),accepted=new Map();for(const [id,to]of proposed){const from=positions.get(id);if(to===from)continue;if(!claims.has(to))claims.set(to,[]);claims.get(to).push(id);}
  for(const list of claims.values())list.sort((a,b)=>(waitAge.get(b)||0)-(waitAge.get(a)||0)||a.localeCompare(b));
  const visit=(id,chain=new Set())=>{if(accepted.has(id))return accepted.get(id);const from=positions.get(id),to=proposed.get(id);if(to===from||claims.get(to)?.[0]!==id||chain.has(id)){accepted.set(id,false);return false;}const occupant=cells.get(to);if(occupant&&proposed.get(occupant)===from){accepted.set(id,false);return false;}const next=new Set(chain);next.add(id);const delta=id=>{const from=positions.get(id),to=proposed.get(id);return [to%cols-from%cols,Math.floor(to/cols)-Math.floor(from/cols)];};const same=!occupant||delta(id).every((v,i)=>v===delta(occupant)[i]);const ok=!occupant||same&&visit(occupant,next);accepted.set(id,ok);return ok;};
  for(const id of proposed.keys())visit(id);
  const next=new Map();for(const g of groups){const from=positions.get(g.id),to=accepted.get(g.id)?proposed.get(g.id):from;positions.set(g.id,to);waitAge.set(g.id,to===from?(waitAge.get(g.id)||0)+1:0);if(!released.has(g.id)){if(next.has(to))throw Error('전술 이동 예약 충돌');next.set(to,g.id);}const a=point(from),b=point(to),kind=to===from?'idle':actions.get(g.id)||'walk';g.motions.push({start,end,from:a,to:b,kind,formation:g.role==='flank'?'bent':'line',cellFrom:from,cellTo:to});}cells.clear();for(const [cell,id]of next)cells.set(cell,id);
 }
 return {...grid,key,point,valid,neighbors,exits,incoming,distance,positions,homes,parkingSlots,cells,step,released,routeCheck(id,to,ignore=[]){const skip=new Set(ignore);return firstStep(positions.get(id),to,new Map([...cells].filter(([,id])=>!skip.has(id))));},release(id){released.add(id);if(cells.get(positions.get(id))===id)cells.delete(positions.get(id));}};
}
