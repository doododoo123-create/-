import {fieldPaths,expeditionRoute,expeditionChance} from './field-command.js';
import {battleReady} from './war-readiness.js';
import {campaignOfficerKey} from './advance-defenders.js';
import {chooseFrontier} from './frontier.js';
import {centralRally,formationPositions} from './unit-spacing.js';
import {planFrontOperations,coLocatedPlans} from './front-operations.js';

// v37: a border sector is an operation, not the whole friendly road network.
export function prepareFrontCampaign(ctx){
 const {s,Atlas,actor,opponent,ctl,rules,helpers:h,emit,die,randomInt,defenderQueue}=ctx;
 const groups=[],bySlot=new Map(),travel=new Map(),decisions=new Map(),defenseRoster=new Map(),officerFront=new Map();
 const ready=g=>g?.active&&g.alive&&g.troops>0&&!g.stranded&&(!rules.warReadiness||battleReady(g));
 const generals=s.countries[actor].generals.filter(ready),fronts=planFrontOperations(s,Atlas,actor,opponent,generals,ctl.targetCells);
 for(const e of ctx.events)for(const m of e.type==='unit_spacing'?e.moves||[]:[]){const key=`${m.nation}:${m.slot}:${m.generation}`;travel.set(key,(travel.get(key)||0)+m.path.length-1);}
 for(const g of generals){
  const all=h.targets(s,actor,g.slot,opponent),candidates=fronts.targets(g.slot,all);
  if(ctl.targetCells?.[g.slot]!==undefined&&!candidates.includes(ctl.targetCells[g.slot]))throw Error('인접하지 않은 대상 영지');
  if(!candidates.length)continue;
  const routes=new Map(candidates.map(id=>[id,expeditionRoute(s,Atlas,actor,g,id)]));
  const target=ctl.targetCells?.[g.slot]??chooseFrontier(s,Atlas,actor,candidates,{paths:new Map([...routes].map(([id,r])=>[id,r.path])),supply:h.connectedSupply,recoveryPriority:rules.recoveryPriority,recoveryBonus:rules.finishStrategy?rules.recoveryScoreCap:0},randomInt);
  const distance=routes.get(target).distance,chance=expeditionChance(distance,rules),roll=die('expedition:'+g.slot,100),accepted=roll<=chance;
  decisions.set(g.slot,{target,distance,chance,roll,accepted});
  emit('expedition_roll',g.name+' 출전 판정',`현재 위치에서 목표까지 ${distance}칸 · 출전 확률 ${chance}%`,{nation:actor,slot:g.slot,role:'general',roll,faces:100,distance,chance,accepted,cellId:target});
  if(!accepted)emit('hold',g.name+' 출전하지 않음','집결에 참여하지 않고 현재 위치에서 대기해.',{nation:actor,slot:g.slot,role:'general',cellId:target});
 }
 const meta=g=>({id:g.id,nation:g.nation,location:g.location,leaderSlot:g.members[0].slot,members:g.members.map(p=>({slot:p.slot,generation:p.generation,troops:p.troops})),army:g.members.reduce((n,p)=>n+p.troops,0),formation:true,frontId:g.front.id,frontName:g.front.name});
 const relocate=(group,plans,kind)=>{
  const moves=[];for(const {g,path} of plans)if(path.length>1){const key=campaignOfficerKey(group.nation,g);travel.set(key,(travel.get(key)||0)+path.length-1);moves.push({nation:group.nation,slot:g.slot,generation:g.generation,kind,from:g.position,to:path.at(-1),path});g.position=path.at(-1);g.stranded=false;}return moves;
 };
 const deploy=(group,location,kind)=>{
  const from=group.location,columnPath=fieldPaths(s,Atlas,group.nation,from).get(location)||[from],moves=relocate(group,coLocatedPlans(s,Atlas,group.nation,group.members,location),kind);group.location=location;
  emit(kind==='assembly'?'army_assembly':'army_march',kind==='assembly'?'전선 집결':'집단군 전선 배치',`${group.front.name} · ${group.members.length}개 부대 · 전원 같은 영토 도착`,{nation:group.nation,slot:group.members[0].slot,role:'general',armyGroup:{...meta(group),fromLocation:from,columnPath},moves,formation:true},true);
 };
 const form=(nation,members,front)=>{
  members.sort((a,b)=>b.troops-a.troops||a.slot-b.slot);
  const location=centralRally(s,Atlas,nation,members),group={id:`formation-${s.turns}-${nation}-${groups.length}`,nation,members,location,front,released:false};groups.push(group);
  for(const g of members)officerFront.set(campaignOfficerKey(nation,g),front.id);
  deploy(group,location,'assembly');return group;
 };
 const candidates=generals.filter(g=>decisions.get(g.slot)?.accepted),assigned=new Set(),deployed=new Set();
 for(const g of candidates.sort((a,b)=>b.troops-a.troops||a.slot-b.slot)){
  if(assigned.has(g.slot))continue;
  const front=fronts.assignments.get(g.slot),paths=fieldPaths(s,Atlas,actor,g.position),members=candidates.filter(p=>!assigned.has(p.slot)&&fronts.assignments.get(p.slot)===front&&paths.has(p.position));members.forEach(p=>assigned.add(p.slot));
  const group=form(actor,members,front);for(const p of members)bySlot.set(p.slot,group);
  const target=decisions.get([...members].sort((a,b)=>a.slot-b.slot)[0].slot).target,route=expeditionRoute(s,Atlas,actor,group.members[0],target);if(route)deploy(group,route.from,'army-march');
  const defenders=new Set();
  for(const cell of new Set(members.map(p=>decisions.get(p.slot).target))){
   const home=s.countries[opponent].generals[s.cells[cell].commander],queue=defenderQueue(opponent,cell,home,new Set()).queue.filter(e=>e.general.role==='king'||!officerFront.has(campaignOfficerKey(opponent,e.general))||officerFront.get(campaignOfficerKey(opponent,e.general))===front.id);
   defenseRoster.set(cell,queue.map(e=>e.general));for(const e of queue)if(e.general.role!=='king'&&!deployed.has(e.general))defenders.add(e.general);
  }
  const seen=new Set();for(const d of defenders){if(seen.has(d)||!ready(d))continue;const paths=fieldPaths(s,Atlas,opponent,d.position),members=[...defenders].filter(p=>ready(p)&&!seen.has(p)&&paths.has(p.position));members.forEach(p=>{seen.add(p);deployed.add(p);});const defense=form(opponent,members,front);if(fieldPaths(s,Atlas,opponent,defense.location).has(target))deploy(defense,target,'army-march');}
 }
 const releaseGroup=group=>{
  if(group.released)return;group.released=true;
  const members=group.members.filter(g=>g.active&&g.alive&&s.cells[g.position]?.owner===group.nation),moves=ctl.directArmyRelease?[]:relocate(group,formationPositions(s,Atlas,group.nation,members,group.location),'formation-release');
  emit('army_release','집단군 개별 전투 배치',group.front.name,{nation:group.nation,armyGroup:{...meta(group),released:true},moves,formation:true},true);
 };
 return {groups,bySlot,travel,decisions,defenseRoster,prepared:true,fronts,
  targets:(slot,ids)=>fronts.targets(slot,ids),advance:(slot,id)=>fronts.advance(slot,id),
  canDefend:(nation,g,target,frontId)=>!frontId||g.role==='king'||g.position===target||!officerFront.has(campaignOfficerKey(nation,g))||officerFront.get(campaignOfficerKey(nation,g))===frontId,
  release:g=>{const group=bySlot.get(g.slot);if(group)for(const other of groups)if(other.front===group.front)releaseGroup(other);},
  heldMembers:()=>groups.filter(g=>ctl.directArmyRelease||!g.released).flatMap(g=>g.members),march:()=>{},detach:()=>{},
  finish:()=>{for(const group of groups){releaseGroup(group);emit('army_disband','집단군 해체','개별 전투 배치로 전환했어.',{nation:group.nation,armyGroup:{...meta(group),members:[],army:0}},false);}}
 };
}
