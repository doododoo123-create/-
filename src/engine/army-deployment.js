import {fieldPaths,expeditionRoute,expeditionChance} from './field-command.js';
import {battleReady} from './war-readiness.js';
import {campaignOfficerKey} from './advance-defenders.js';
import {chooseFrontier} from './frontier.js';
import {centralRally,formationPositions} from './unit-spacing.js';
import {prepareFrontCampaign} from './front-deployment.js';

// v35 commands plan acceptance once, then physically deploy both sides before D30.
// Older commands continue through army-assembly.js without changed RNG or paths.
export function prepareArmyCampaign(ctx){
 if(ctx.ctl.frontOperations)return prepareFrontCampaign(ctx);
 const {s,Atlas,actor,opponent,ctl,rules,helpers:h,emit,die,randomInt,defenderQueue}=ctx;
 const groups=[],bySlot=new Map(),travel=new Map(),decisions=new Map(),defenseRoster=new Map();
 const ready=g=>g?.active&&g.alive&&g.troops>0&&!g.stranded&&(!rules.warReadiness||battleReady(g));
 for(const e of ctx.events)for(const m of e.type==='unit_spacing'?e.moves||[]:[]){const key=`${m.nation}:${m.slot}:${m.generation}`;travel.set(key,(travel.get(key)||0)+m.path.length-1);}
 const generals=s.countries[actor].generals.filter(ready);
 for(const g of generals){
  const candidates=h.targets(s,actor,g.slot,opponent);if(!candidates.length)continue;
  const routes=new Map(candidates.map(id=>[id,expeditionRoute(s,Atlas,actor,g,id)]));
  let target=chooseFrontier(s,Atlas,actor,candidates,{paths:new Map([...routes].map(([id,r])=>[id,r.path])),supply:h.connectedSupply,recoveryPriority:rules.recoveryPriority,officer:rules.officerTraits?g:null,recoveryBonus:rules.finishStrategy?rules.recoveryScoreCap:0},randomInt);
  if(ctl.targetCells?.[g.slot]!==undefined){target=ctl.targetCells[g.slot];if(!candidates.includes(target))throw Error('인접하지 않은 대상 영지');}
  const distance=routes.get(target).distance,chance=expeditionChance(distance,rules),roll=die('expedition:'+g.slot,100),accepted=roll<=chance;
  decisions.set(g.slot,{target,distance,chance,roll,accepted});
  emit('expedition_roll',g.name+' 출전 판정',`현재 위치에서 목표까지 ${distance}칸 · 출전 확률 ${chance}%`,{nation:actor,slot:g.slot,role:'general',roll,faces:100,distance,chance,accepted,cellId:target});
  if(!accepted)emit('hold',g.name+' 출전하지 않음','집결에 참여하지 않고 현재 위치에서 대기해.',{nation:actor,slot:g.slot,role:'general',cellId:target});
 }
 const candidates=generals.filter(g=>decisions.get(g.slot)?.accepted),assigned=new Set(),deployedDefenders=new Set();
 const meta=group=>({id:group.id,nation:group.nation,location:group.location,leaderSlot:group.members[0].slot,members:group.members.map(g=>({slot:g.slot,generation:g.generation,troops:g.troops})),army:group.members.reduce((n,g)=>n+g.troops,0),formation:true});
 const deploy=(group,location,kind)=>{
  const from=group.location,route=fieldPaths(s,Atlas,group.nation,from).get(location)||[from],plans=formationPositions(s,Atlas,group.nation,group.members,location),moves=[];
  for(const {g,path} of plans)if(path.length>1){const key=campaignOfficerKey(group.nation,g);travel.set(key,(travel.get(key)||0)+path.length-1);moves.push({nation:group.nation,slot:g.slot,generation:g.generation,kind,from:g.position,to:path.at(-1),path});g.position=path.at(-1);g.stranded=false;}
  group.location=group.members[0].position;
  emit(kind==='assembly'?'army_assembly':'army_march',kind==='assembly'?'집단군 중앙 집결':'집단군 전선 배치',`${group.members.length}개 부대 · 총 ${group.members.reduce((n,g)=>n+g.troops,0)}만 · 영토당2명 우선`,{nation:group.nation,slot:group.members[0].slot,role:'general',armyGroup:{...meta(group),fromLocation:from,columnPath:fieldPaths(s,Atlas,group.nation,from).get(group.location)||route},moves,formation:true},true);
 };
 const form=(nation,members)=>{
  members.sort((a,b)=>b.troops-a.troops||a.slot-b.slot);
  const location=centralRally(s,Atlas,nation,members),group={id:`formation-${s.turns}-${nation}-${groups.length}`,nation,members,location};groups.push(group);
  deploy(group,location,'assembly');return group;
 };
 // Each friendly connected component forms independently; refusals never enter a group.
 for(const g of candidates.sort((a,b)=>b.troops-a.troops||a.slot-b.slot)){
  if(assigned.has(g.slot))continue;
  const paths=fieldPaths(s,Atlas,actor,g.position),members=candidates.filter(p=>!assigned.has(p.slot)&&paths.has(p.position));members.forEach(p=>assigned.add(p.slot));
  const group=form(actor,members);for(const p of members)bySlot.set(p.slot,group);
  const targets=[...new Set(members.map(p=>decisions.get(p.slot).target))],target=decisions.get(members.slice().sort((a,b)=>a.slot-b.slot)[0].slot).target;
  const route=expeditionRoute(s,Atlas,actor,group.members[0],target);if(route)deploy(group,route.from,'army-march');
  const defend=new Set();
  for(const cell of targets){const home=s.countries[opponent].generals[s.cells[cell].commander],queue=defenderQueue(opponent,cell,home,new Set()).queue;defenseRoster.set(cell,[...new Set([...(defenseRoster.get(cell)||[]),...queue.map(e=>e.general)])]);for(const e of queue)if(e.general.role!=='king')defend.add(e.general);}
  const defenders=[...defend].filter(g=>ready(g)&&!deployedDefenders.has(g)),seen=new Set();
  for(const d of defenders){if(seen.has(d))continue;const paths=fieldPaths(s,Atlas,opponent,d.position),members=defenders.filter(p=>!seen.has(p)&&paths.has(p.position));members.forEach(p=>{seen.add(p);deployedDefenders.add(p);});const defense=form(opponent,members);if(paths.has(target)||fieldPaths(s,Atlas,opponent,defense.members[0].position).has(target))deploy(defense,target,'army-march');}
 }
 return {groups,bySlot,travel,decisions,defenseRoster,prepared:true,march:()=>{},detach:()=>{},finish:()=>{for(const group of groups)emit('army_disband','집단군 해체','개별 전투 배치로 전환했어.',{nation:group.nation,armyGroup:{...meta(group),members:[],army:0}},false);}};
}
