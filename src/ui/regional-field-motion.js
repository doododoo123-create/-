import {regionalFieldLayout,regionalSlot} from './regional-field-layout.js';
const last=(u,at)=>u.regionSteps.filter(s=>s.at<=at+1e-6).at(-1)?.territoryId;
const center=n=>({x:n.x+n.width/2,y:n.y+n.height/2});
export function recordedFieldMoves(a,u,plan){
 const ids=a.before.territories.map(t=>t.id),result=[];
 for(const e of a.events)for(const m of e.moves||[]){
  const country=m.nationId||a.before.countries[m.nation]?.id,role=m.role||'general';
  if(m.personId?m.personId!==u.id:country!==u.countryId||m.slot!==u.personSlot||role!==u.role)continue;
  const path=(m.pathIds||m.path||[]).map(id=>typeof id==='number'?ids[id]:id),from=m.fromId||ids[m.battlefieldFrom??m.from],to=m.toId||ids[m.to];
  if(to)result.push({at:plan.eventTimes.get(e.index)??0,battleIndex:e.battleIndex,from,to,path,teleport:['redeploy','isolated-return','evacuation'].includes(m.kind)||e.relocation===true});
 }
 for(const e of a.events){const f=a.record.frames?.[e.index],before=f?.before.people.find(p=>p.id===u.id),after=f?.after.people.find(p=>p.id===u.id),at=plan.eventTimes.get(e.index)??0;if(before?.positionId&&after?.positionId&&before.positionId!==after.positionId&&!result.some(m=>m.at===at&&m.to===after.positionId))result.push({at,battleIndex:e.battleIndex,from:before.positionId,to:after.positionId,path:[before.positionId,after.positionId],teleport:true});}
 return result.sort((a,b)=>a.at-b.at);
}
export function spatialBattlefield(plan,a){
 const field=plan.field=regionalFieldLayout(plan,a.before);plan.width=field.width;plan.height=field.height;plan.center=field.height/2;
 for(const u of plan.units){
  const old=u.orders,moves=recordedFieldMoves(a,u,plan),initial=u.regionSteps[0]?.territoryId||plan.regions[0].battles[0].fromId;
  u.home=regionalSlot(field,initial,u,plan.units);u.orders=[];u.fieldStart=initial;let position={...u.home},area=initial;
  const add=(o,to,extra={})=>{if(o.end<=o.start)return;u.orders.push({...o,from:{...position},to:{...to},curve:0,curveY:0,fromRegion:area,toRegion:area,...extra});position={...to};};
  const travel=(o,toId,side=null,record=null)=>{
   const to=regionalSlot(field,toId,u,plan.units,side),r=plan.regions.find(r=>o.start>=r.start&&o.start<r.end);
   const move=record||moves.find(m=>m.to===toId&&r?.battles.some(b=>b.index===m.battleIndex)&&(m.from===area||m.path.includes(area)));
   const adjacent=field.edges.some(e=>e.from===area&&e.to===toId||e.to===area&&e.from===toId);
   const explicit=r?.battles.some(b=>b.actorId===u.countryId&&b.attackerPersonId===u.id&&b.fromId===area&&b.territoryId===toId);
   const teleport=area!==toId&&(move?.teleport||(!move&&!adjacent)||(!move&&!explicit&&o.kind==='walk'&&!adjacent));
   const route=move?.path||[area,toId],middle=route.slice(1,-1).filter(id=>id!==area&&id!==toId).map(id=>field.byId.get(id)).filter(Boolean).map(center);
   add(o,to,{territoryPath:route,path:teleport?undefined:[{...position},...middle,to],teleport,fromRegion:area,toRegion:toId});area=toId;
  };
  for(const o of old){
   const r=plan.regions.find(r=>o.start>=r.start-1e-6&&o.start<r.end-1e-6),side=r?.attackIds.includes(u.id)?'attack':r?.defenseIds.includes(u.id)?'defense':null;
   if(o.combat&&r){add(o,regionalSlot(field,r.territoryId,u,plan.units,side),{fromRegion:r.territoryId,toRegion:r.territoryId});area=r.territoryId;}
   else if((o.kind==='walk'||o.kind==='retreat')&&r){
    const entering=o.start<r.contact-1e-6,toId=entering?r.territoryId:last(u,r.end)||r.territoryId;
    const retreat=o.kind==='retreat'?moves.find(m=>r.battles.some(b=>b.index===m.battleIndex)&&m.at>=r.contact&&m.at<=r.end):null;
    travel(o,retreat?.to||toId,entering?side:null,retreat);
   }else{
    let cursor=o.start;
    for(const m of moves.filter(m=>m.at>=o.start&&m.at<o.end&&m.to!==area)){
     if(m.at>cursor)add({...o,start:cursor,end:m.at},position);
     const start=Math.max(cursor,m.at),end=Math.min(o.end,start+450);travel({...o,kind:'walk',start,end},m.to,null,m);cursor=end;
    }
    if(cursor<o.end)add({...o,start:cursor},position);
   }
  }
 }
}
