import {campaignGroups,campaignPerson} from './campaign-playback.js';
import {observerDuration} from './observer-flow.js';

// Editorial metadata only. Never write to a record, a world, or the engine RNG.
const streakCache=new WeakMap(),recentStreaks=[];
export function applyFilmStreak(streaks,battle){
 if(battle.automatic)return;
 const attack=battle.attackerPersonId,defense=battle.defenderPersonId;
 if(battle.winner===null){if(attack)streaks.set(attack,0);if(defense)streaks.set(defense,0);return;}
 const won=battle.winner===battle.actor,winner=won?attack:defense,loser=won?defense:attack;
 if(winner)streaks.set(winner,(streaks.get(winner)||0)+1);if(loser)streaks.set(loser,0);
}
export function filmStreaksBefore(history,turn){
 const past=history.filter(r=>r.turn<turn);let start=0,streaks=new Map();
 for(let i=past.length-1;i>=0;i--)if(streakCache.has(past[i])){streaks=new Map(streakCache.get(past[i]));start=i+1;break;}
 for(let i=start;i<past.length;i++){
  for(const b of past[i].battles||[])applyFilmStreak(streaks,b);
  if(past[i].turn%25===0)streakCache.set(past[i],new Map(streaks));
 }
 const last=past.at(-1);if(last&&!streakCache.has(last)){streakCache.set(last,new Map(streaks));recentStreaks.push(last);if(recentStreaks.length>8){const old=recentStreaks.shift();if(old.turn%25!==0)streakCache.delete(old);}}
 return streaks;
}
export function filmBattleMetadata(record,history=[]){
 const streaks=filmStreaksBefore(history,record.turn),result=new Map();
 for(const b of record.battles||[]){
  const start={attack:streaks.get(b.attackerPersonId)||0,defense:streaks.get(b.defenderPersonId)||0};
  const entry=record.events.find(e=>e.type==='territory'&&e.battleIndex===b.index),world=record.frames?.[entry?.index]?.before;
  const capital=!!world?.countries.some(c=>c.capitalId===b.territoryId),smaller=Math.min(b.attack?.army||0,b.defense?.army||0),challenging=!b.automatic&&smaller>0&&Math.max(b.attack.army,b.defense.army)/smaller>=3;
  const winnerSide=b.winner===null?null:b.winner===b.actor?'attack':'defense',loserSide=winnerSide==='attack'?'defense':'attack';
  const ratio=winnerSide&&b[winnerSide]?.army>0?(b[loserSide]?.army||0)/b[winnerSide].army:0;
  applyFilmStreak(streaks,b);
  const end={attack:streaks.get(b.attackerPersonId)||0,defense:streaks.get(b.defenderPersonId)||0};
  const upset=!b.automatic&&!!winnerSide&&ratio>=3,streak=!b.automatic&&!!winnerSide&&end[winnerSide]>=5;
  result.set(b.index,{start,end,capital,challenging,winnerSide,ratio,upset,streak,highlightBefore:capital||challenging||Math.max(start.attack,start.defense)>=4,highlightResult:capital||upset||streak});
 }
 return result;
}
export function filmResultWorld(before,after){
 const people=new Map(after.people.map(p=>[p.id,p]));
 return {...before,countries:before.countries.map(c=>{const n=after.countries.find(v=>v.id===c.id);return {...c,troops:n?.troops??c.troops,reserve:n?.reserve??c.reserve,...(n?.royalTroops!==undefined?{royalTroops:n.royalTroops}:{})};}),people:before.people.map(p=>{const n=people.get(p.id);return n?{...p,troops:n.troops,capacity:n.capacity,wins:n.wins,underdogWins:n.underdogWins}:p;})};
}
const interrupts=new Set(['death','capital_fall','elimination','finish']);
export function makeFilmingScenes(original,record,history=[]){
 const metadata=filmBattleMetadata(record,history),groups=campaignGroups(original,record),byIndex=new Map();
 for(const group of groups)for(let i=group.start;i<=group.end;i++)byIndex.set(i,group);
 const out=[],seen=new Set(),judged=new Set();let segment=null,segmentBattles=[];
 const close=(final=false)=>{
  if(!segment||!segmentBattles.length){segment=null;segmentBattles=[];return;}
  const last=out.at(-1),battles=final?segment.battles:segmentBattles,indexes=new Set(battles.map(b=>b.index)),source=segment.originalScenes.filter(s=>indexes.has(s.battleIndex));
  const report={...segment,final,sourceCampaignId:segment.id,id:`film-${record.turn}-${source[0]?.event?.index??segment.start}-${last.event?.index??segment.end}`,battles:[...battles],originalScenes:source};
  const world=last.worldAfter;
  out.push({...last,id:report.id+'-report',kind:'film-summary',filmAtomic:true,filmPhase:'summary',filmBattle:null,filmCampaign:report,event:{type:'film_campaign_report',index:last.mapEventIndex??last.event?.index??-1},mapEventIndex:last.mapEventIndex??last.event?.index??-1,worldBefore:world,worldAfter:world,title:'공세 구간 요약',filmSummary:report});
  segment=null;segmentBattles=[];
 };
 for(let i=0;i<original.length;i++){
  const s=original[i],b=record.battles?.[s.battleIndex],group=byIndex.get(i),type=s.event?.type;
  const interrupt=interrupts.has(type)&&s.kind!=='roll';
  if(segment&&(segment!==group||interrupt))close(!interrupt);
  // A focus immediately followed by its application has no separate information.
  if(s.kind==='focus'&&original[i+1]?.kind==='apply'&&original[i+1]?.event===s.event&&type!=='army_release')continue;
  if(group&&!interrupt&&!segment)segment=group;
  const meta=b?metadata.get(b.index):null;
  const repeat=!!group&&group.battles[0]?.index!==b?.index&&!meta?.highlightBefore;
  const extra={film:true,filmBattle:b||null,filmMeta:meta,filmCampaign:interrupt?null:group||null,filmRepeat:repeat,filmPhase:b?'situation':null};
  if(b&&!seen.has(b.index)){
   seen.add(b.index);
   out.push({...s,...extra,id:`film-camera-${b.index}`,kind:'film-camera',filmAtomic:true,filmPhase:'camera',filmCamera:null,event:{type:'film_front',index:(s.mapEventIndex??s.event?.index??0)-1},mapEventIndex:(s.mapEventIndex??s.event?.index??0)-1,worldAfter:s.worldBefore,camps:s.campsBefore||s.camps,moves:[]});
  }
  if(s.kind==='roll'&&['attack_roll','defense_roll'].includes(type)){
   if(judged.has(b.index))continue;judged.add(b.index);
   const resolve=original.find(v=>v.kind==='apply'&&v.event?.type==='resolve'&&v.battleIndex===b.index);
   if(!resolve)continue;
   const common={...s,...extra,filmAtomic:true,kind:'focus',worldAfter:s.worldBefore};
   out.push({...common,id:`film-situation-${b.index}`,filmPhase:'situation'});
   if(!repeat||meta.highlightBefore){
    out.push({...common,id:`film-dice-${b.index}`,filmPhase:'judgment',filmJudgment:'rolling'});
    out.push({...common,id:`film-score-${b.index}`,filmPhase:'judgment',filmJudgment:'locked'});
   }
   out.push({...resolve,...extra,id:`film-result-${b.index}`,kind:'apply',filmAtomic:true,filmOneStep:true,filmPhase:'result',mapEventIndex:resolve.event.index-1,worldAfter:filmResultWorld(resolve.worldBefore,resolve.worldAfter)});
   out.push({...resolve,...extra,id:`film-map-${b.index}`,kind:'apply',filmAtomic:true,filmOneStep:true,filmPhase:'map'});
   if(segment&&!segmentBattles.some(v=>v.index===b.index))segmentBattles.push(b);
   continue;
  }
  if(b&&type==='resolve'&&!b.automatic)continue;
  if(s.kind==='roll'&&type==='death_roll')continue;
  let phase=null;
  if(b)phase=judged.has(b.index)||b.automatic?'map':'situation';
  // Keep a confirmed result on screen through retreat and occupation, but never
  // carry it into an unrelated support event or a major interruption.
  if(interrupt)phase=null;
  out.push({...s,...extra,filmPhase:phase,...(s.kind==='apply'?{filmOneStep:true}:{}),...(b?.automatic&&s.kind==='capture'?{filmAutomaticResult:true}:{})});
  if(b?.automatic&&s.kind==='capture'&&segment&&!segmentBattles.some(v=>v.index===b.index))segmentBattles.push(b);
  if(i===group?.end)close(true);
 }
 close(true);
 // If the last duel ends in death, its interruption closes the segment before
 // the notice. Still provide the whole offensive's report after that notice.
 for(const group of groups){
  if(out.some(s=>s.filmSummary?.sourceCampaignId===group.id&&s.filmSummary.final))continue;
  const ids=new Set(group.battles.map(b=>b.index)),limit=group.originalScenes.at(-1)?.event?.index??Infinity;
  const at=out.findLastIndex(s=>s.kind!=='film-summary'&&ids.has(s.battleIndex)&&(s.event?.index??-1)<=limit);
  if(at<0)continue;const last=out[at],report={...group,final:true,sourceCampaignId:group.id,id:`film-${record.turn}-${group.id}-final`};
  out.splice(at+1,0,{...last,id:report.id+'-report',kind:'film-summary',filmAtomic:true,filmPhase:'summary',filmBattle:null,filmCampaign:report,event:{type:'film_campaign_report',index:last.mapEventIndex??last.event?.index??-1},mapEventIndex:last.mapEventIndex??last.event?.index??-1,worldBefore:last.worldAfter,worldAfter:last.worldAfter,title:'공세 전체 요약',filmSummary:report});
 }
 return out;
}
export function filmingDuration(scene,record,phase,speed=1,reduced=false){
 const rate=Math.max(.5,Number(speed)||1),meta=scene.filmMeta,highlight=scene.filmPhase==='result'||scene.filmPhase==='map'?meta?.highlightResult:meta?.highlightBefore;
 if(scene.kind==='film-camera')return scene.filmCamera?.needed===false?0:reduced?0:320;
 if(scene.kind==='film-summary')return Math.max(1100,1600/rate);
 if(scene.filmAtomic){
  const ordinary={situation:300,judgment:400,result:700,map:600},important={situation:600,judgment:800,result:1400,map:1200},quick={situation:100,judgment:0,result:350,map:300};
  const floor=highlight?{situation:250,judgment:320,result:950,map:700}:{situation:100,judgment:220,result:450,map:350};
  const key=scene.filmPhase,base=(highlight?important:scene.filmRepeat?quick:ordinary)[key]||0;
  const split=key==='judgment'?(scene.filmJudgment==='rolling'?.6:.4):1;
  return Math.max((floor[key]||0)*split,base*split/rate);
 }
 if(phase==='departing')return 0;
 if(scene.kind==='movement')return Math.max(80,(scene.event?.type==='army_assembly'||scene.event?.type==='army_march'?650:260)/rate);
 if(scene.kind==='capture')return Math.max(300,600/rate);
 if(scene.kind==='route')return Math.max(30,60/rate);
 if(scene.kind==='arrival')return 0;
 if(scene.kind==='army-formed-hold')return 300;
 if(scene.kind==='army-forming')return Math.max(220,600/rate);
 if(['death','capital_fall','elimination','finish'].includes(scene.event?.type))return observerDuration(scene,record,phase,reduced);
 if(scene.kind==='apply')return Math.max(100,250/rate);
 return observerDuration(scene,record,phase,reduced)/rate;
}
export function filmSummaryInfo(group,world){
 const before=group.originalScenes[0]?.worldBefore||world,actorId=group.actorId,old=new Map(before.territories.map(t=>[t.id,t.ownerId]));
 let wins=0,losses=0,draws=0,automatic=0,ownLoss=0,enemyLoss=0,gained=0,lost=0;
 for(const b of group.battles){
  if(b.automatic){automatic++;continue;}
  const allied=b.actorId===actorId?'attack':'defense',enemy=allied==='attack'?'defense':'attack';
  ownLoss+=b.losses?.[allied]?.amount||0;enemyLoss+=b.losses?.[enemy]?.amount||0;
  if(b.winner===null)draws++;else if((b.winner===b.actor?b.actorId:b.defenderId)===actorId)wins++;else losses++;
 }
 for(const t of world.territories){if(t.ownerId===actorId&&old.get(t.id)!==actorId)gained++;if(t.ownerId!==actorId&&old.get(t.id)===actorId)lost++;}
 return {wins,losses,draws,automatic,combats:wins+losses+draws,ownLoss,enemyLoss,gained,lost,net:gained-lost};
}
export function filmBattlePerson(world,battle,side){return campaignPerson(world,battle,side);}
