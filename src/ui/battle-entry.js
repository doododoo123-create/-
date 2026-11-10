// Preserve recorded assembled column marches before replacing dice/map duels.
export function battleEntry(group,plan){
 const first=group.originalScenes[0],territory=plan.engagements[0]?.territoryId,out=[];
 const marches=group.originalScenes.filter(s=>s.kind==='movement'&&s.event?.type==='army_march');
 for(const s of marches)out.push({...s,id:'entry-'+s.id,battleEntry:true,entryMarch:true});
 // Older records may have only the members' territory approach. Show it in one
 // map phase rather than hiding it inside the tactical arena.
 if(!marches.length){const approaches=group.originalScenes.filter(s=>s.kind==='movement'&&s.event?.type==='territory'),byId=new Map();for(const s of approaches)for(const m of s.moves||[])if(!m.presentationOnly&&!byId.has(m.personId))byId.set(m.personId,m);
  if(byId.size)out.push({...approaches[0],id:group.id+'-entry',battleEntry:true,entryMarch:true,moves:[...byId.values()],campsBefore:first.campsBefore||first.camps,camps:approaches.at(-1).camps});
 }
 out.push({...first,id:group.id+'-battle-location',kind:'route',battleEntry:true,entryLocation:true,battleIndex:plan.engagements[0].index,event:{type:'territory',index:first.event.index,battleIndex:plan.engagements[0].index},readySides:[],title:'전장 도착',worldBefore:first.worldBefore,worldAfter:first.worldBefore,camps:out.at(-1)?.camps||first.camps});
 return out;
}
