// Continuous army-wide tracks are independent of the ordered accounting clock.
// One body of soldiers per real commander; no cloned opponent or tactical bonus.
export function choreographMassArmy(units,engagements,tactics,{width,center,baseDuration,prepare}){
 const policies=new Set(tactics.selected.map(t=>t.id)),byId=new Map(units.map(u=>[u.id,u])),contact=prepare+900;
 const bound=x=>Math.max(80,Math.min(width-80,x)),lane=y=>Math.max(80,Math.min(center*2-80,y));
 for(const u of units){
  const rounds=engagements.filter(e=>e.attackId===u.id||e.defenseId===u.id),last=rounds.at(-1),sign=u.side==='attack'?1:-1,wing=u.formationRole==='left'?-1:u.formationRole==='right'?1:0;
  const opponents=[...new Set(rounds.map(e=>e.attackId===u.id?e.defenseId:e.attackId).filter(Boolean))].map(id=>byId.get(id)).filter(Boolean);
  const oppositeY=opponents.length?opponents.reduce((n,v)=>n+v.home.y,0)/opponents.length:center;
  const flank=u.role!=='king'&&u.side==='attack'&&wing&&(policies.has('pincer')||policies.has('hook')&&wing===tactics.wing);
  const reserve=u.formationRole==='reserve'&&(policies.has('reserves')||policies.has('waves'));
  const weight=policies.has('pressure')?.5:.72;
  const line={x:width/2-sign*60+(policies.has('oblique')?tactics.wing*(u.home.y-center)*.18:0),y:lane(u.home.y*weight+oppositeY*(1-weight)+(policies.has('wing-focus')&&u.side==='attack'?tactics.wing*65:0))};
  if(flank){line.y=lane(line.y+wing*90);line.x=width/2+sign*30;}
  u.orders=[];let at=0,point={...u.home,x:u.home.x-sign*65};
  const add=(kind,end,to,curve=0)=>{if(end<=at)return;u.orders.push({kind,start:at,end,from:{...point},to:{...to},curve:0,curveY:curve});at=end;point={...to};};
  add('walk',prepare*.8,u.home);add('guard',prepare+(reserve?(policies.has('waves')?450+units.filter(v=>v.side===u.side).indexOf(u)*110:650):0),point);
  if(!rounds.length){add('guard',baseDuration,point);continue;}
  const arrival=Math.min(last.resolve-80,contact+(reserve?(policies.has('waves')?350+units.filter(v=>v.side===u.side).indexOf(u)*110:500):flank?350:0));
  if(flank){const side={x:width/2-sign*125,y:lane(line.y+wing*100)};add('walk',prepare+500,side,wing*90);add('walk',arrival,line,wing*60);}
  else add('walk',arrival,line,policies.has('oblique')?tactics.wing*35:0);
  u.visualContact=arrival;u.contactPoint={...line};
  // Several units remain in contact together; intermediate duels never send
  // a commander home or reset that unit's approach animation.
  for(const e of rounds){
   if(e.resolve<=at)continue;
   const win=e.winner===u.id,draw=e.winner===null,final=e===last;
   const push=win?(policies.has('center-break')&&u.formationRole==='center'?42:policies.has('pressure')?32:18):draw?0:-12;
   const target={x:flank?point.x:sign===1?Math.min(width/2-52,bound(point.x+sign*push)):Math.max(width/2+52,bound(point.x+sign*push)),y:lane(point.y+(flank?wing*-8:0))};
   add(e.automatic?'walk':u.side==='attack'||policies.has('local-counter')&&win?'attack':'guard',e.resolve,target,flank?wing*15:0);
   if(!final)continue;
   let retreat=e.winner!==u.id;
   let finish=Math.min(baseDuration-200,Math.max(e.end,e.resolve+650));
   if(u.role==='king'){add('retreat',finish,u.home);}
   else if(retreat){
    const dest={x:bound(point.x-sign*155),y:lane(point.y+(policies.has('split-retreat')?wing*140:wing*45))};
    if(policies.has('staged-retreat')){add('retreat',e.resolve+(finish-e.resolve)*.55,{x:(point.x+dest.x)/2,y:(point.y+dest.y)/2});add('retreat',finish,dest);}
    else add('retreat',finish,dest,wing*30);
   }else{
    const captured=rounds.some(r=>r.winner===u.id&&r.captured);
    add(captured||policies.has('pressure')?'walk':'guard',finish,{x:captured?width/2+sign*(policies.has('counter-break')?145:policies.has('breach')?160:110):policies.has('hold')&&u.side==='defense'?point.x:point.x+sign*18,y:point.y},flank?wing*30:0);
   }
  }
  add('guard',baseDuration,point);
 }
 for(const e of engagements){const a=byId.get(e.attackId),d=byId.get(e.defenseId);e.visualContact=Math.max(a?.visualContact||contact,d?.visualContact||contact);e.visualEnd=e.resolve;if(a?.contactPoint){const other=d?.contactPoint||a.contactPoint;e.point={x:(a.contactPoint.x+other.x)/2,y:(a.contactPoint.y+other.y)/2};}}
}

export function massPersonalStreaks(engagements,units){
 const current=new Map(),best=new Map();
 for(const e of engagements){if(e.automatic)continue;for(const id of [e.attackId,e.defenseId].filter(Boolean)){const count=e.winner===id?(current.get(id)||0)+1:0;current.set(id,count);best.set(id,Math.max(best.get(id)||0,count));}}
 return units.filter(u=>(best.get(u.id)||0)>=5).map(u=>({id:u.id,name:u.name,color:u.color,count:best.get(u.id)}));
}
