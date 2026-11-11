import {neighbors} from '../model/world.js';
// Stable schematic, not new geography: links only describe real adjacency/routes.
export function regionalFieldLayout(plan,world){
 const ids=new Set(plan.territories.map(t=>t.id));
 const list=world.territories.filter(t=>ids.has(t.id)).map(t=>({id:t.id,name:t.name,ownerId:t.ownerId,row:t.row??0,col:t.col??0,center:world.cartography?.polygons?.[t.id]?.center})).sort((a,b)=>(a.center?.[1]??a.row)-(b.center?.[1]??b.row)||(a.center?.[0]??a.col)-(b.center?.[0]??b.col)||a.id.localeCompare(b.id));
 const cols=Math.max(1,Math.ceil(Math.sqrt(list.length*1.6))),rows=Math.ceil(list.length/cols),cellWidth=650,cellHeight=460,gap=55;
 const nodes=list.map((t,i)=>({...t,x:35+(i%cols)*(cellWidth+gap),y:35+Math.floor(i/cols)*(cellHeight+gap),width:cellWidth,height:cellHeight}));
 const byId=new Map(nodes.map(n=>[n.id,n])),edges=[];
 for(const t of world.territories.filter(t=>ids.has(t.id)))for(const next of neighbors(world,t))if(ids.has(next.id)&&t.id<next.id)edges.push({from:t.id,to:next.id});
 return {nodes,byId,edges,width:70+cols*cellWidth+(cols-1)*gap,height:70+rows*cellHeight+(rows-1)*gap};
}
export function regionalSlot(field,territoryId,unit,units,side=null){
 const node=field.byId.get(territoryId)||field.nodes[0],country=unit.countryId;
 const members=units.filter(u=>u.countryId===country).sort((a,b)=>a.id.localeCompare(b.id)),index=Math.max(0,members.findIndex(u=>u.id===unit.id)),columns=Math.max(1,Math.ceil(members.length/5)),row=index%5,col=Math.floor(index/5),sign=(side||unit.side)==='attack'?-1:1;
 return {x:node.x+node.width/2+sign*(75+(col+.5)*Math.min(140,(node.width/2-90)/columns)),y:node.y+115+row*66};
}
