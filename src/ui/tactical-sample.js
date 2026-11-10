import {tacticalPoint,tacticalCombatClock} from './tactical-motion.js';
export const tacticalPosition=tacticalPoint;
export function sampleTacticalStory(plan,time,clock){
 const t=clock.base,story=plan.story,parents=new Map(),contacts=story.contacts.filter(c=>t>=c.start&&t<c.end),groups=[];
 for(const u of plan.units){
  let troops=u.startArmy,alive=u.initialAlive,confusion=0;
  for(const step of u.troops){if(step.at>t)break;troops=step.value;}
  for(const step of u.status){if(step.at>t)break;alive=step.alive!==false;confusion=step.confusion??confusion;}
  const dead=u.deathAt!==undefined&&t>=u.deathAt,deathAge=dead?Math.max(0,time-u.deathAt-plan.holds.filter(h=>h.base<u.deathAt).reduce((n,h)=>n+h.end-h.start,0)):0,labels=u.labels.filter(l=>t>=l.at&&t<l.end);
  parents.set(u.id,{...u,troops,alive,confusion,labels:dead?[{text:'전사',kind:'death'}]:labels,visible:!dead||deathAge<1850,action:dead?'death':'idle',actionTime:dead?deathAge:0,figures:0,x:0,y:0});
 }
 for(const g of story.groups){
  const u=parents.get(g.parentId),pos=tacticalPoint(g,u.alive?t:u.deathAt??t),c=contacts.find(c=>c.attackGroupId===g.id||c.defenseGroupId===g.id),isAttack=c?.attackGroupId===g.id,dead=!u.alive;
  const loss=story.reveals.findLast(r=>r.kind==='combat'&&r.id===u.id&&r.at<=t&&t-r.at<330),combat=tacticalCombatClock(g,t);
  const action=dead?'death':u.troops<=0?'idle':loss?'hurt':c?combat.action:pos.motion?.kind||'idle';
  const actionTime=dead?u.actionTime:loss?t-loss.at:c?combat.time:Math.max(0,t-(pos.motion?.animationAt??pos.motion?.start??0));
  const figures=dead?Math.min(1,g.figures):Math.max(0,Math.round(g.figures*u.troops/Math.max(u.visualArmy,.0001)));
  const flip=c?(isAttack?c.normal.x<0:c.normal.x>=0):pos.motion&&Math.abs(pos.motion.to.x-pos.motion.from.x)>1?(action==='retreat'?pos.motion.to.x>pos.motion.from.x:pos.motion.to.x<pos.motion.from.x):u.side==='defense';
  const result={...g,...pos,tier:u.tier,color:u.color,troops:u.troops,alive:u.alive,visible:u.visible,figures,action,actionTime,flip,contactId:c?.id,hit:!!loss,lossAge:loss?t-loss.at:null,role:pos.motion?.role||g.initialRole||g.role,formation:pos.motion?.formation||'line'};
  groups.push(result);u.figures+=figures;u.x+=pos.x*g.weight;u.y+=pos.y*g.weight;
  if(c){u.action=action;u.actionTime=actionTime;}else if(u.action==='idle'&&['walk','retreat'].includes(action))u.action=action;
 }
 // A commander's label follows an actual block, never empty space between
 // separated subsections. The matching numbered pennant stays on every block.
 const units=[...parents.values()].map(u=>{const own=groups.filter(g=>g.parentId===u.id),anchor=own.find(g=>g.contactId)||own.find(g=>g.figures>0)||own[0];return {...u,labelX:anchor?.x??u.x,labelY:anchor?.y??u.y,labelGroupId:anchor?.id,withdrawn:u.troops<=0||u.labels.some(l=>l.text==='패배')};}),totals={attack:0,defense:0};
 for(const u of units)totals[u.side]+=u.troops;
 const owners=new Map(plan.before.territories.map(t=>[t.id,t.ownerId])),territories=[];
 for(const r of story.reveals){if(r.at>t)break;if(r.kind==='territory'){owners.set(r.id,r.to);territories.push(r);}}
 const results=story.reveals.filter(r=>r.kind==='result'&&t>=r.at&&t<r.end),result=results.at(-1)||null,currentBeat=(result?story.beats.find(b=>b.index===result.beatIndex):story.beats.find(b=>b.resolve>t))||story.beats.at(-1);
 const activeContacts=contacts.filter(c=>parents.get(c.attackId)?.alive&&parents.get(c.defenseId)?.alive).map(c=>{const a=groups.find(g=>g.id===c.attackGroupId),d=groups.find(g=>g.id===c.defenseGroupId);return {...c,point:{x:(a.x+d.x)/2,y:(a.y+d.y)/2-9*(a.bodyScale||1)},strikers:[a,d].map(g=>({id:g.id,...tacticalCombatClock(g,t)}))};});
 const phase=story.phases.find(p=>t>=p.at&&t<p.end)||story.phases.at(-1);
 return {time,base:t,hold:clock.hold,units,groups,totals,contacts:activeContacts,phase,engagements:plan.engagements.filter(e=>t>=e.start&&t<e.end),currentBeat,result,notice:story.reveals.filter(r=>['result','territory'].includes(r.kind)&&t>=r.at&&t<(r.end??r.at+2400)).at(-1)||null,territories,owners,complete:t>=plan.baseDuration};
}
