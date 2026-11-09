// Preserve recorded assembled column marches before replacing dice/map duels.
export function battleEntry(group,plan){
 const firstBattle=plan.story?.beats[0]?.source||group.battles[0],defenseArmy=(group.defenseMetadata||[]).find(g=>g.nation===firstBattle.target&&g.members.some(m=>m.slot===firstBattle.defenseSlot));
 const entryArmyGroups=[group.assemblyMetadata,defenseArmy].filter(Boolean);
 const first=group.originalScenes[0],territory=plan.engagements[0]?.territoryId,out=[];
 const marches=group.originalScenes.filter(s=>s.kind==='movement'&&s.event?.type==='army_march');
 for(const s of marches)out.push({...s,id:'entry-'+s.id,battleEntry:true,entryMarch:true,entryArmyGroups});
 // Older records may have only the members' territory approach. Show it in one
 // map phase rather than hiding it inside the tactical arena.
 if(!marches.length){const approaches=group.originalScenes.filter(s=>s.kind==='movement'&&s.event?.type==='territory'),byId=new Map();for(const s of approaches)for(const m of s.moves||[])if(!m.presentationOnly&&!byId.has(m.personId))byId.set(m.personId,m);
  if(byId.size)out.push({...approaches[0],id:group.id+'-entry',battleEntry:true,entryMarch:true,entryArmyGroups,moves:[...byId.values()],campsBefore:first.campsBefore||first.camps,camps:approaches.at(-1).camps});
 }
 out.push({...first,id:group.id+'-battle-location',kind:'route',battleEntry:true,entryLocation:true,battleIndex:plan.engagements[0].index,event:{type:'territory',index:first.event.index,battleIndex:plan.engagements[0].index},entryArmyGroups,entryDuel:{attackId:group.assemblyMetadata?null:plan.engagements[0].attackId,defenseId:defenseArmy?null:plan.engagements[0].defenseId,actorId:group.actorId},readySides:['attack','defense'],title:'전장 도착',worldBefore:first.worldBefore,worldAfter:first.worldBefore,camps:out.at(-1)?.camps||first.camps});
 return out;
}
