import {neighbors} from '../model/world.js';
// This file compresses recorded presentation only. It never calculates a battle.
const campaignWinner=b=>b.winner===null?null:b.winner===b.actor?b.actorId:b.defenderId;
export function campaignPerson(world,b,side){
 const countryId=side==='attack'?b.actorId:b.defenderId,slot=side==='attack'?b.slot:b.defenseSlot,role=side==='attack'?'general':b.defenseRole||'general';
 return world.people.find(p=>p.id===(side==='attack'?b.attackerPersonId:b.defenderPersonId))||world.people.find(p=>p.countryId===countryId&&p.slot===slot&&p.role===role);
}
export function campaignGroups(scenes,record){
 const ranges=(record.battles||[]).map(b=>{
  const indexes=scenes.flatMap((s,i)=>s.battleIndex===b.index?[i]:[]);
  return indexes.length?{b,start:indexes[0],end:indexes.at(-1)}:null;
 }).filter(Boolean).sort((a,b)=>a.start-b.start),clusters=[];
 for(const range of ranges){
  const last=clusters.at(-1),previous=last?.at(-1),world=scenes[range.start].worldBefore;
  const samePair=previous&&[previous.b.actorId,previous.b.defenderId].sort().join('|')===[range.b.actorId,range.b.defenderId].sort().join('|');
  const connected=previous&&(range.b.territoryId===previous.b.territoryId||neighbors(world,world.territories.find(t=>t.id===previous.b.territoryId)).some(t=>t.id===range.b.territoryId));
  const gap=previous?scenes.slice(previous.end+1,range.start):[];
  if(last&&range.start>previous.end&&samePair&&connected&&!gap.some(s=>['king','minister','war_target','war_recovery','round_end','season_recovery'].includes(s.event?.type)))last.push(range);
  else clusters.push([range]);
 }
 return clusters.filter(c=>c.length>=2).map((c,i)=>({
  id:'campaign-'+record.turn+'-'+i,actorId:record.actorId,opponentId:c[0].b.actorId===record.actorId?c[0].b.defenderId:c[0].b.actorId,
  start:c[0].start,end:c.at(-1).end,ranges:c,battles:c.map(v=>v.b),
  originalScenes:scenes.slice(c[0].start,c.at(-1).end+1),
 }));
}
// Keep the original map sequence; only the two combat rolls move into the shared table.
export function compactCampaignScenes(scenes,record){
 const groups=campaignGroups(scenes,record),starts=new Map(groups.map(g=>[g.start,g])),out=[];
 for(let i=0;i<scenes.length;i++){
  const g=starts.get(i);if(!g){out.push(scenes[i]);continue;}
  const first=scenes[g.start],last=scenes[g.end],base={campaign:g,camps:first.campsBefore||first.camps,mapEventIndex:first.event.index-1};
  out.push({...base,id:g.id+'-approach',kind:'campaign',campaignPhase:'approach',campaignRow:0,battleIndex:g.battles[0].index,completedBattles:0,event:{type:'campaign_start',index:first.event.index-1},worldBefore:first.worldBefore,worldAfter:first.worldBefore,title:'집단군 전투 판정'});
  let cursor=g.start;
  for(let j=0;j<g.ranges.length;j++){
   const range=g.ranges[j],a=scenes[range.start];
   for(;cursor<range.start;cursor++)out.push({...scenes[cursor],campaign:g,campaignPhase:'map',campaignRow:Math.max(0,j-1),completedBattles:j});
   const original=scenes.slice(range.start,range.end+1),rolls=original.filter(s=>s.kind==='roll'&&['attack_roll','defense_roll'].includes(s.event.type));
   if(!rolls.length)out.push({...base,id:g.id+'-automatic-'+j,kind:'campaign',campaignPhase:'automatic',campaignRow:j,completedBattles:j+1,battleIndex:range.b.index,event:{type:'campaign_battle',index:a.event.index-1},mapEventIndex:a.event.index-1,worldBefore:a.worldBefore,worldAfter:a.worldBefore,camps:a.campsBefore||a.camps,title:'무방비 영토 진입 판정'});
   for(const roll of rolls)out.push({...roll,campaign:g,campaignPhase:'dice',campaignRow:j,completedBattles:j,mapEventIndex:a.event.index-1,worldBefore:a.worldBefore,worldAfter:a.worldBefore,camps:a.campsBefore||a.camps});
   for(const originalScene of original)if(!rolls.includes(originalScene))out.push({...originalScene,campaign:g,campaignPhase:'map',campaignRow:j,completedBattles:j+1});
   cursor=range.end+1;
  }
  for(;cursor<=g.end;cursor++)out.push({...scenes[cursor],campaign:g,campaignPhase:'map',campaignRow:g.ranges.length-1,completedBattles:g.ranges.length});
  out.push({id:g.id+'-summary',kind:'campaign',campaign:g,campaignPhase:'summary',campaignRow:g.battles.length-1,completedBattles:g.battles.length,camps:last.camps,event:{type:'campaign_summary',index:last.event.index},worldBefore:first.worldBefore,worldAfter:last.worldAfter,title:'공세 종료'});
  i=g.end;
 }
 return out;
}
export function campaignSceneDuration(scene){return scene.campaignPhase==='approach'?100:scene.campaignPhase==='summary'?1800:160;}
export function judgedCampaignBattles(scene,phase){return (scene?.completedBattles||0)+(scene?.campaignPhase==='dice'&&scene.event?.type==='defense_roll'&&['locked','departing'].includes(phase)?1:0);}
export function campaignSummary(scene){
 const g=scene.campaign,completed=scene.completedBattles||0,seen=g.battles.slice(0,completed),visible=g.battles.slice(0,Math.max(completed,(scene.campaignRow??-1)+1)),before=g.originalScenes[0].worldBefore,after=scene.worldAfter;
 const actor=new Map(),enemy=new Map();let wins=0,losses=0,draws=0,automatic=0,ownLoss=0,enemyLoss=0;
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
