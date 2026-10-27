import {fieldPaths} from './field-command.js';
import {battleReady} from './war-readiness.js';
import {campaignOfficerKey} from './advance-defenders.js';

// Actual, friendly-land movement. Group membership lives for this war command;
// positions and every travelled edge are recorded, not inferred by the viewer.
export function assembleArmies({s,Atlas,actor,opponent,ctl,rules,helpers:h,emit}){
 const groups=[],bySlot=new Map(),travel=new Map();
 if(ctl.armyAssembly!==true)return {groups,bySlot,travel};
 const ready=g=>g.active&&g.alive&&g.troops>0&&!g.stranded&&(!rules.warReadiness||battleReady(g));
 const candidates=s.countries[actor].generals.filter(g=>ready(g)&&h.targets(s,actor,g.slot,opponent).length).sort((a,b)=>b.troops-a.troops||a.slot-b.slot);
 const meta=group=>({id:group.id,nation:actor,location:group.location,leaderSlot:[...group.members].sort((a,b)=>b.troops-a.troops||a.slot-b.slot)[0]?.slot,members:group.members.map(g=>({slot:g.slot,generation:g.generation,troops:g.troops})),army:group.members.reduce((n,g)=>n+g.troops,0)});
 const move=(g,path,kind)=>{
  if(!path||path.length<2)return null;
  const key=campaignOfficerKey(actor,g);travel.set(key,(travel.get(key)||0)+path.length-1);g.position=path.at(-1);g.stranded=false;
  return {nation:actor,slot:g.slot,generation:g.generation,kind,from:path[0],to:path.at(-1),path:[...path]};
 };
 const assigned=new Set();
 for(const leader of candidates){
  if(assigned.has(leader.slot))continue;
  const reachable=fieldPaths(s,Atlas,actor,leader.position),members=candidates.filter(g=>!assigned.has(g.slot)&&reachable.has(g.position));
  members.forEach(g=>assigned.add(g.slot));if(members.length<2)continue;
  const group={id:`army-${s.turns}-${actor}-${groups.length}`,location:leader.position,members:[...members]};groups.push(group);
  const moves=members.map(g=>move(g,fieldPaths(s,Atlas,actor,g.position).get(group.location),'assembly')).filter(Boolean);
  for(const g of members)bySlot.set(g.slot,group);
  emit('army_assembly','집단군 집결',`${members.length}개 부대가 ${leader.name}의 위치에 실제로 집결해. 집결 거리도 피로에 포함돼.`,{nation:actor,slot:leader.slot,role:'general',armyGroup:meta(group),moves},true);
 }
 const march=(g,path)=>{
  const group=bySlot.get(g.slot);if(!group||path.length<2)return;
  // Only the still-formed column moves; officers already sent to battle are detached.
  group.members=group.members.filter(p=>ready(p)&&p.position===group.location);
  if(!group.members.includes(g))return;
  const moves=group.members.map(p=>move(p,path,'army-march')).filter(Boolean);group.location=path.at(-1);
  if(moves.length)emit('army_march','집단군 진군',`${group.members.length}개 부대 · 합계 ${group.members.reduce((n,p)=>n+p.troops,0)}만명`,{nation:actor,armyGroup:meta(group),moves},true);
 };
 const detach=g=>{const group=bySlot.get(g.slot);if(!group)return;group.members=group.members.filter(p=>p!==g);emit('army_detach',g.name+' · 개별 출전','집단군에서 분리해 전투를 진행해.',{nation:actor,slot:g.slot,role:'general',armyGroup:meta(group)},false);};
 const finish=()=>{for(const group of groups)emit('army_disband','집단군 분산','이번 전쟁 명령의 집결을 마쳤어.',{nation:actor,armyGroup:{...meta(group),members:[],army:0}},false);};
 return {groups,bySlot,travel,march,detach,finish};
}
