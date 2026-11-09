import { unitOutcome } from './unit-outcomes.js';
// Keep the bundle tip on the label anchor. Back cards expose only a narrow right edge.
export function stackUnits(markers,{focus={},battle=null,scene=null,record=null}={}){
 const groups=new Map();for(const marker of markers){const id=marker.role==='minister'?'minister:'+marker.country.id:marker.combatSide?'duel:'+marker.combatSide:marker.territory.id;if(!groups.has(id))groups.set(id,[]);groups.get(id).push(marker);}
 const output=[];
 for(const [id,group] of groups){
  if(group.length>1&&!battle&&!group.some(m=>m.combatSide)&&!scene?.moves?.length){const columns=Math.min(3,Math.ceil(Math.sqrt(group.length)));group.forEach((m,i)=>{const row=Math.floor(i/columns),n=Math.min(columns,group.length-row*columns);output.push({...m,point:[m.point[0]+(i%columns-(n-1)/2)*82,m.point[1]+row*100],stackCount:1,stackFront:true,stackOffset:0});});continue;}
  const active=group.find(m=>m.ghost)||group.find(m=>unitOutcome(scene,record,m.person)==='appointment')||group.find(m=>scene?.kind==='movement'&&scene.moves?.some(v=>v.personId===m.person?.id))
   ||group.find(m=>battle&&Number.isInteger(m.person?.slot)&&((m.country.id===battle.actorId&&m.person.slot===battle.slot)||(m.country.id===battle.defenderId&&m.person.slot===battle.defenseSlot)));
  const front=active||group.find(m=>(m.person?.id||'king-marker:'+m.country.id)===focus[id])||group[0];
  const behind=group.filter(m=>m!==front);
  behind.reverse().forEach((m,i)=>output.push({...m,stackCount:group.length,stackFront:false,stackOffset:(behind.length-i)*24}));
  output.push({...front,stackCount:group.length,stackFront:true,stackOffset:0});
 }
 return output;
}
