import {entryPreparations,replayPreparation} from './entry-preparation.js';
import {battleEntry} from './battle-entry.js';
import {batchRetreats} from './batched-movement.js';
import {massBattleRecap} from './mass-battle-recap.js';
import {campaignGroups,isArmyCampaign} from './campaign-playback.js';
import {massBattlePlan,MASS_BATTLE_TIMING} from './mass-battle-plan.js';

export function massBattleScenes(original,record){
 const groups=campaignGroups(original,record).filter(isArmyCampaign),starts=new Map(groups.map(g=>[g.start,g])),out=[],preparation=entryPreparations(original,groups);let ledger=null,carry={};
 for(let i=0;i<original.length;i++){
  if(preparation.skip.has(original[i]))continue;const group=starts.get(i);if(!group){let scene=original[i].kind==='movement'&&original[i].event?.type==='army_march'?{...original[i],battleEntry:true,entryMarch:true}:original[i];
   if(['territory','attack_roll','defense_roll','resolve','occupation'].includes(scene.event?.type))ledger=null;
   if(ledger){scene={...scene,mapReveal:ledger};if(scene.kind==='movement')ledger={...ledger,moves:[...ledger.moves,...scene.moves.map(m=>`${scene.event.index}:${m.personId}`)]};}
   scene={...scene,camps:{...scene.camps,...Object.fromEntries(preparation.pending)},...(scene.campsBefore?{campsBefore:{...scene.campsBefore,...Object.fromEntries(preparation.pending)}}:{})};out.push(scene);carry=scene.camps;continue;}

  const plan=massBattlePlan(group,record),first=original[group.start],last=original[group.end];
  const prepared=replayPreparation(preparation.deferred.get(group.id)||[],first,record,carry,preparation.pending,ledger);out.push(...prepared);const entry=battleEntry(group,plan,record);for(const s of entry){s.camps={...(prepared.at(-1)?.camps||s.camps),...Object.fromEntries(preparation.pending)};s.mapReveal=ledger;}out.push(...entry);
  const base={entryArmyGroups:entry[0].entryArmyGroups,engagement:entry[0].engagement,battleIndex:entry[0].battleIndex,readySides:['attack','defense'],mapReveal:ledger,massPlan:plan,campaign:group,campaignPhase:'mass',worldBefore:plan.before,worldAfter:plan.before,camps:entry[0].camps,mapEventIndex:entry[0].mapEventIndex};
  let cursor=0,part=0;
  const add=(start,end,event=null)=>{if(end<=start)return;out.push({...base,id:group.id+'-mass-'+part++,kind:'mass-battle',massStart:start,massEnd:end,massCritical:!!event,event:event||{type:'mass_combat',index:first.event.index-1},title:event?.title||'집단군 교전'});};
  for(const hold of plan.holds){add(cursor,hold.start);add(hold.start,hold.end,hold.event);cursor=hold.end;}
  add(cursor,plan.duration);
  out.push({...base,id:group.id+'-mass-summary',kind:'mass-battle',massPhase:'summary',massStart:plan.duration,massEnd:plan.duration+MASS_BATTLE_TIMING.report,worldBefore:plan.before,worldAfter:plan.before,camps:entry[0].camps,mapEventIndex:entry[0].mapEventIndex,event:{type:'mass_summary',index:last.event.index},title:plan.outcome});
  const recap=massBattleRecap(group,plan,ledger);out.push(...recap.map(s=>({...s,camps:{...s.camps,...Object.fromEntries(preparation.pending)},...(s.campsBefore?{campsBefore:{...s.campsBefore,...Object.fromEntries(preparation.pending)}}:{})})));ledger=recap.at(-1)?.mapAfterReveal||ledger;
  // One authoritative map handoff. No individual VS, roll, retreat or loss
  // scenes from this group are replayed a second time behind the new stage.
  out.push({id:group.id+'-map-return',kind:'focus',massReturn:true,mapReveal:ledger,event:{type:'mass_map_return',index:last.event.index},worldBefore:plan.after,worldAfter:plan.after,camps:{...last.camps,...Object.fromEntries(preparation.pending)},mapEventIndex:last.mapEventIndex??last.event.index,title:'지도 복귀'});
  carry=last.camps;i=group.end;
 }
 return batchRetreats(out);
}
export function massSceneTime(playback){const s=playback?.scene;return s?.massPlan?Math.min(s.massPlan.duration,s.massStart+(s.massEnd-s.massStart)*playback.sceneProgress):0;}
