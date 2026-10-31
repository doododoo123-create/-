import {neighbors} from '../model/world.js';
// This file compresses recorded presentation only. It never calculates a battle.
const campaignWinner=b=>b.winner===null?null:b.winner===b.actor?b.actorId:b.defenderId;
export function campaignPerson(world,b,side){
 const countryId=side==='attack'?b.actorId:b.defenderId,slot=side==='attack'?b.slot:b.defenseSlot,role=side==='attack'?'general':b.defenseRole||'general';
 return world.people.find(p=>p.id===(side==='attack'?b.attackerPersonId:b.defenderPersonId))||world.people.find(p=>p.countryId===countryId&&p.slot===slot&&p.role===role);
}
function knownDefenseGroups(scenes,record,ranges,start){
 const first=scenes[start],world=first.worldBefore;
 return record.events.filter(e=>{
  if(e.type!=='army_assembly'||e.index>=first.event.index||!e.armyGroup)return false;
  const id=world.countries[e.armyGroup.nation]?.id;if(!id||id===record.actorId)return false;
  return e.armyGroup.members.some(m=>ranges.some(({b})=>(b.defenderId===id&&b.defenseSlot===m.slot)||(b.actorId===id&&b.slot===m.slot)));
 }).map(e=>e.armyGroup);
}
export function campaignGroups(scenes,record){
 const ranges=(record.battles||[]).map(b=>{
  const indexes=scenes.flatMap((s,i)=>s.battleIndex===b.index?[i]:[]);
  return indexes.length?{b,start:indexes[0],end:indexes.at(-1)}:null;
 }).filter(Boolean).sort((a,b)=>a.start-b.start),clusters=[];
 for(const range of ranges){
  const last=clusters.at(-1),previous=last?.at(-1),world=scenes[range.start].worldBefore;
  const samePair=previous&&[previous.b.actorId,previous.b.defenderId].sort().join('|')===[range.b.actorId,range.b.defenderId].sort().join('|');
  const connected=previous&&(range.b.armyGroupId||previous.b.armyGroupId?!!range.b.armyGroupId&&range.b.armyGroupId===previous.b.armyGroupId:range.b.territoryId===previous.b.territoryId||neighbors(world,world.territories.find(t=>t.id===previous.b.territoryId)).some(t=>t.id===range.b.territoryId));
  const gap=previous?scenes.slice(previous.end+1,range.start):[];
  if(last&&range.start>previous.end&&samePair&&connected&&!gap.some(s=>['king','minister','war_target','war_recovery','round_end','season_recovery'].includes(s.event?.type)))last.push(range);
  else clusters.push([range]);
 }
 return clusters.filter(c=>c.length>=2||c[0].b.armyGroupId).map((c,i)=>{
  let start=c[0].start;
  if(c[0].b.frontId){for(let k=start-1;k>=0;k--){const e=scenes[k].event;if(e?.type==='army_release'&&e.armyGroup?.frontId===c[0].b.frontId)start=k;else if(scenes[k].battleIndex!==undefined||['army_assembly','army_march','war_target'].includes(e?.type))break;}}
  if(c[0].b.armyGroupId&&!c[0].b.armyPrepared){for(let k=start-1;k>=0;k--){const e=scenes[k].event;if(e?.type==='army_assembly'||['king','war_target','army_disband'].includes(e?.type))break;if(['army_march','army_detach'].includes(e?.type)&&e.armyGroup?.id===c[0].b.armyGroupId)start=k;else if(scenes[k].battleIndex!==undefined)break;}}
  return ({
  frontId:c[0].b.frontId,frontName:c[0].b.frontName,id:'campaign-'+record.turn+'-'+i,actorId:record.actorId,opponentId:c[0].b.actorId===record.actorId?c[0].b.defenderId:c[0].b.actorId,
  start,end:c.at(-1).end,ranges:c,battles:c.map(v=>v.b),
  originalScenes:scenes.slice(start,c.at(-1).end+1),defenseMetadata:knownDefenseGroups(scenes,record,c,start),armyId:c[0].b.armyGroupId,assemblyMetadata:record.events.filter(e=>e.armyGroup?.id===c[0].b.armyGroupId).find(e=>e.type==='army_assembly')?.armyGroup,
 });});
}
// All combat dice first, on one frozen assembled map; original map scenes follow.
export function isArmyCampaign(group){
 const people=new Map();for(const b of group.battles){if(b.automatic)continue;for(const [country,key] of [[b.actorId,b.attackerPersonId||b.actorId+':'+b.slot],[b.defenderId,b.defenderPersonId||b.defenderId+':'+(b.defenseRole||'general')+':'+b.defenseSlot]]){if(!people.has(country))people.set(country,new Set());people.get(country).add(key);}}
 return [...people.values()].some(p=>p.size>1);
}
export function compactCampaignScenes(scenes,record,{modern=false,reportAfterMap=false}={}){
 const groups=campaignGroups(scenes,record).filter(g=>!modern||isArmyCampaign(g)),starts=new Map(groups.map(g=>[g.start,g])),out=[];
 for(let i=0;i<scenes.length;i++){
  const g=starts.get(i);if(g){g.modern=modern;g.reportAfterMap=reportAfterMap;}if(!g){out.push(scenes[i]);continue;}
  const first=scenes[g.start],last=scenes[g.end],frozen={campaign:g,rapidMovement:modern,camps:first.campsBefore||first.camps,mapEventIndex:first.event.index-1,worldBefore:first.worldBefore,worldAfter:first.worldBefore};
  if(!reportAfterMap){out.push({...frozen,id:g.id+'-approach',kind:'campaign',campaignPhase:'approach',campaignRow:0,battleIndex:g.battles[0].index,rapidMovement:modern,completedBattles:0,event:{type:'campaign_start',index:first.event.index-1},title:'집단군 전체 전투 판정'});
  for(let j=0;j<g.ranges.length;j++){
   const range=g.ranges[j],original=scenes.slice(range.start,range.end+1),rolls=original.filter(s=>s.kind==='roll'&&['attack_roll','defense_roll'].includes(s.event.type));
   if(!rolls.length)out.push({...frozen,id:g.id+'-automatic-'+j,kind:'campaign',campaignPhase:'automatic',campaignRow:j,completedBattles:j+1,battleIndex:range.b.index,event:{type:'campaign_battle',index:first.event.index-1},title:'무방비 영토 진입 판정'});
   for(const roll of rolls)out.push({...roll,...frozen,campaignPhase:'dice',campaignRow:j,completedBattles:j});
  }
  }
  if(modern)out.push({...frozen,id:g.id+'-dissolve',kind:'focus',campaignPhase:'map',campaignRow:0,completedBattles:g.battles.length,battleIndex:g.battles[0].index,rapidMovement:true,dissolveArmies:true,event:{type:'army_dissolve',index:first.event.index-1},title:'양측 집단군 해체 · 개별 전투 배치'});
  for(const original of g.originalScenes){
   if(original.kind==='roll'&&(['attack_roll','defense_roll'].includes(original.event.type)||reportAfterMap&&original.event.type==='death_roll'))continue;
   const row=g.ranges.findIndex(r=>r.b.index===original.battleIndex),upcoming=g.ranges.findIndex(r=>scenes.indexOf(original)<r.start);
   out.push({...original,campaign:g,campaignPhase:'map',campaignRow:row>=0?row:upcoming>=0?upcoming:g.ranges.length-1,battleIndex:original.battleIndex??g.battles[upcoming>=0?upcoming:g.ranges.length-1].index,completedBattles:g.battles.length,...(modern?{dissolveArmies:true}:{} )});
  }
  if(reportAfterMap)out.push({...last,id:g.id+'-report',kind:'campaign',campaign:g,campaignPhase:'report',campaignRow:0,completedBattles:g.battles.length,dissolveArmies:true,mapEventIndex:last.mapEventIndex??last.event.index,event:{type:'campaign_report',index:last.event.index},worldBefore:last.worldAfter,worldAfter:last.worldAfter,camps:last.camps,title:'집단군 공세 결과 보고'});
  if(!modern)out.push({id:g.id+'-summary',kind:'campaign',campaign:g,campaignPhase:'summary',campaignRow:g.battles.length-1,completedBattles:g.battles.length,camps:last.camps,event:{type:'campaign_summary',index:last.event.index},worldBefore:first.worldBefore,worldAfter:last.worldAfter,title:'공세 종료'});
  i=g.end;
 }
 return out;
}
export function campaignSceneDuration(scene){return (scene.campaignPhase==='approach'?100:scene.campaignPhase==='report'?3200:scene.campaignPhase==='summary'?1800:160)/(scene.rapidMovement?1.5:1);}
export function judgedCampaignBattles(scene,phase){return (scene?.completedBattles||0)+(scene?.campaignPhase==='dice'&&scene.event?.type==='defense_roll'&&['locked','departing'].includes(phase)?1:0);}
export function campaignSummary(scene){
 const g=scene.campaign,completed=scene.completedBattles||0,seen=g.battles.slice(0,completed),visible=g.battles.slice(0,Math.max(completed,(scene.campaignRow??-1)+1)),before=g.originalScenes[0].worldBefore,after=scene.worldAfter;
 const actor=new Map(),enemy=new Map();let wins=0,losses=0,draws=0,automatic=0,ownLoss=0,enemyLoss=0;
 const assembled=g.assemblyMetadata||g.originalScenes.find(s=>s.event?.armyGroup)?.event.armyGroup;
 if(assembled)for(const m of assembled.members){const p=before.people.find(p=>p.countryId===g.actorId&&p.role==='general'&&p.slot===m.slot&&p.generation===m.generation);if(p)actor.set(p.id+':'+(p.generation||0),{...p,startArmy:p.troops});}
 for(const meta of g.defenseMetadata||[])for(const m of meta.members){const p=before.people.find(p=>p.countryId===g.opponentId&&p.role==='general'&&p.slot===m.slot&&p.generation===m.generation);if(p)enemy.set(p.id+':'+(p.generation||0),{...p,startArmy:p.troops});}
 for(const b of visible){
  const frame=g.originalScenes.find(s=>s.battleIndex===b.index)?.worldBefore||before;
  for(const side of ['attack','defense']){
   if(side==='defense'&&b.automatic)continue;
   const p=campaignPerson(frame,b,side);if(!p)continue;
   const allied=p.countryId===g.actorId,map=allied?actor:enemy,key=p.id+':'+(p.generation||0);
   if(!map.has(key))map.set(key,{...p,startArmy:b[side].army});
   const amount=seen.includes(b)?b.losses?.[side]?.amount||0:0;if(allied)ownLoss+=amount;else enemyLoss+=amount;
  }
  if(!seen.includes(b))continue;
  if(b.automatic)automatic++;else if(b.winner===null)draws++;else if(campaignWinner(b)===g.actorId)wins++;else losses++;
 }
 const initial=campaignPerson(before,g.battles[0],g.battles[0].actorId===g.actorId?'attack':'defense');
 const representative=[...actor.values()].sort((a,b)=>b.startArmy-a.startArmy||a.slot-b.slot)[0]||initial;
 let gained=0,lost=0;
 const oldOwners=new Map(before.territories.map(t=>[t.id,t.ownerId]));
 for(const t of after.territories){if(t.ownerId===g.actorId&&oldOwners.get(t.id)!==g.actorId)gained++;if(t.ownerId!==g.actorId&&oldOwners.get(t.id)===g.actorId)lost++;}
 const limit=scene.mapEventIndex??scene.event.index;
 const noteworthy=g.originalScenes.filter(s=>s.event?.index<=limit&&['death','capital_fall','elimination'].includes(s.event?.type));
 const uniqueNotices=[...new Map(noteworthy.map(s=>[s.event.index,s.event.title])).values()];
 return {representative,actor:[...actor.values()],enemy:[...enemy.values()],wins,losses,draws,automatic,combats:wins+losses+draws,completed,
  ownLoss:Math.round(ownLoss*10000)/10000,enemyLoss:Math.round(enemyLoss*10000)/10000,gained,lost,net:gained-lost,notices:uniqueNotices,
  ownArmy:[...actor.values()].reduce((n,p)=>n+p.startArmy,0),enemyArmy:[...enemy.values()].reduce((n,p)=>n+p.startArmy,0)};
}
