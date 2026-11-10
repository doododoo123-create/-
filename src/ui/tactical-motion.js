// Presentation clocks never reset at a route cell or at a new opponent.
export const TACTICAL_CYCLE=1600;
export const TACTICAL_ATTACK=770;
export const TACTICAL_IMPACT=340;
export function tacticalCombatClock(group,time){
 const phase=((time-(group.combatAt??0)+(group.combatOffset||0))%TACTICAL_CYCLE+TACTICAL_CYCLE)%TACTICAL_CYCLE;
 return phase<TACTICAL_ATTACK?{action:'attack',time:phase}:{action:'guard',time:phase-TACTICAL_ATTACK};
}
export function tacticalImpactBefore(group,time){
 const first=(group.combatAt??0)-(group.combatOffset||0)+TACTICAL_IMPACT;
 return first+Math.floor((time-first)/TACTICAL_CYCLE)*TACTICAL_CYCLE;
}
export function tacticalPoint(group,time){
 const motion=group.motions.find(m=>time>=m.start&&time<m.end),past=group.motions.findLast(m=>m.end<=time);
 if(!motion)return {...past?.to||group.home,motion:null};
 const p=Math.max(0,Math.min(1,(time-motion.start)/Math.max(1,motion.end-motion.start))),q=1-p;
 return motion.control?{x:q*q*motion.from.x+2*q*p*motion.control.x+p*p*motion.to.x,y:q*q*motion.from.y+2*q*p*motion.control.y+p*p*motion.to.y,motion}:{x:motion.from.x+(motion.to.x-motion.from.x)*p,y:motion.from.y+(motion.to.y-motion.from.y)*p,motion};
}
const bounds=(m,f)=>({left:Math.min(m.from.x,m.to.x,m.control?.x??Infinity)-f.width/2,right:Math.max(m.from.x,m.to.x,m.control?.x??-Infinity)+f.width/2,top:Math.min(m.from.y,m.to.y,m.control?.y??Infinity)-f.height/2,bottom:Math.max(m.from.y,m.to.y,m.control?.y??-Infinity)+f.height/2});
const intersects=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
// Round an isolated corner only when its entire swept body rectangle is free
// for the full interval. Contacts/occupied corridors retain their reserved path.
export function prepareTacticalMotion(groups,contacts){
 for(const g of groups){const result=[];for(let i=0;i<g.motions.length;i++){
  const a=g.motions[i],b=g.motions[i+1],moving=['walk','retreat'].includes(a.kind),turn=b&&moving&&b.kind===a.kind&&a.end===b.start&&(a.to.x-a.from.x)*(b.to.y-b.from.y)!==(a.to.y-a.from.y)*(b.to.x-b.from.x);
  if(turn&&!contacts.some(c=>[c.attackGroupId,c.defenseGroupId].includes(g.id)&&c.start<b.end&&c.end>a.start)){
   const candidate={...a,end:b.end,to:b.to,control:a.to},box=bounds(candidate,g.footprint),free=groups.every(other=>other===g||!other.motions.some(m=>m.start<candidate.end&&m.end>candidate.start&&intersects(box,bounds(m,other.footprint))));
   if(free){result.push(candidate);i++;continue;}
  }result.push({...a});
 }
 let run=null;for(const m of result){if(['walk','retreat'].includes(m.kind)){if(!run||run.end!==m.start||run.kind!==m.kind)run={at:m.start,kind:m.kind};m.animationAt=run.at;run.end=m.end;}else run=null;}g.motions=result;
 }
}
