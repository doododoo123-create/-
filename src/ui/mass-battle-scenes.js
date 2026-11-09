import {battleEntry} from './battle-entry.js';
import {batchRetreats} from './batched-movement.js';
import {massBattleRecap} from './mass-battle-recap.js';
import {campaignGroups,isArmyCampaign} from './campaign-playback.js';
import {massBattlePlan,MASS_BATTLE_TIMING} from './mass-battle-plan.js';

export function massBattleScenes(original,record){
 const groups=campaignGroups(original,record).filter(isArmyCampaign),starts=new Map(groups.map(g=>[g.start,g])),out=[];let ledger=null;
 for(let i=0;i<original.length;i++){
  const group=starts.get(i);if(!group){let scene=original[i].kind==='movement'&&original[i].event?.type==='army_march'?{...original[i],battleEntry:true,entryMarch:true}:original[i];
   if(['territory','attack_roll','defense_roll','resolve','occupation'].includes(scene.event?.type))ledger=null;
   if(ledger){scene={...scene,mapReveal:ledger};if(scene.kind==='movement')ledger={...ledger,moves:[...ledger.moves,...scene.moves.map(m=>`${scene.event.index}:${m.personId}`)]};}
   out.push(scene);continue;}

  const plan=massBattlePlan(group,record),first=original[group.start],last=original[group.end];
  const entry=battleEntry(group,plan);out.push(...entry);
  const base={entryDuel:entry.at(-1).entryDuel,readySides:['attack','defense'],battleIndex:plan.engagements[0].index,entryArmyGroups:entry.at(-1).entryArmyGroups,mapReveal:ledger,massPlan:plan,campaign:group,campaignPhase:'mass',worldBefore:plan.before,worldAfter:plan.before,camps:first.campsBefore||first.camps,mapEventIndex:first.event.index-1};
  let cursor=0,part=0;
  const add=(start,end,event=null)=>{if(end<=start)return;out.push({...base,id:group.id+'-mass-'+part++,kind:'mass-battle',massStart:start,massEnd:end,massCritical:!!event,event:event||{type:'mass_combat',index:first.event.index-1},title:event?.title||'집단군 교전'});};
  for(const hold of plan.holds){add(cursor,hold.start);add(hold.start,hold.end,hold.event);cursor=hold.end;}
  add(cursor,plan.duration);
  out.push({...base,id:group.id+'-mass-summary',kind:'mass-battle',massPhase:'summary',massStart:plan.duration,massEnd:plan.duration+MASS_BATTLE_TIMING.report,worldBefore:plan.before,worldAfter:plan.before,camps:first.camps,mapEventIndex:first.event.index-1,event:{type:'mass_summary',index:last.event.index},title:plan.outcome});
  const recap=massBattleRecap(group,plan,ledger);out.push(...recap);ledger=recap.at(-1)?.mapAfterReveal||ledger;
  // One authoritative map handoff. No individual VS, roll, retreat or loss
  // scenes from this group are replayed a second time behind the new stage.
  out.push({id:group.id+'-map-return',kind:'focus',massReturn:true,mapReveal:ledger,event:{type:'mass_map_return',index:last.event.index},worldBefore:plan.after,worldAfter:plan.after,camps:last.camps,mapEventIndex:last.mapEventIndex??last.event.index,title:'지도 복귀'});
  i=group.end;
 }
 return batchRetreats(out);
}
export function massSceneTime(playback){const s=playback?.scene;return s?.massPlan?Math.min(s.massPlan.duration,s.massStart+(s.massEnd-s.massStart)*playback.sceneProgress):0;}
