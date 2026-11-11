// A viewer-only formation survives the engine's individual-combat release.
export function battleEntry(group,plan,record){
 const first=group.originalScenes[0],b=group.battles[0],world=first.worldBefore,territory=b.territoryId;
 const eligible=p=>p&&p.active!==false&&p.alive!==false&&p.troops>0,peopleFor=meta=>meta.members.flatMap(m=>{const p=world.people.find(p=>p.countryId===world.countries[meta.nation]?.id&&p.role==='general'&&p.slot===m.slot&&p.generation===m.generation);return eligible(p)?[p]:[];});
 const attack=[...new Map([...(group.assemblyMetadata?peopleFor(group.assemblyMetadata):[]),...group.battles.filter(v=>v.territoryId===territory).map(v=>world.people.find(p=>p.id===v.attackerPersonId))].filter(p=>eligible(p)&&p.countryId===b.actorId).map(p=>[p.id,p])).values()];
 const defense=[...new Map([...(group.defenseMetadata||[]).flatMap(peopleFor),...group.battles.filter(v=>v.territoryId===territory).map(v=>world.people.find(p=>p.id===v.defenderPersonId))].filter(p=>eligible(p)&&p.countryId===b.defenderId).map(p=>[p.id,p])).values()];
 const armies=[],leaders=[];
 for(const [side,members]of [['attack',attack],['defense',defense]]){members.sort((a,b)=>b.troops-a.troops||a.id.localeCompare(b.id));if(!members.length)continue;leaders.push(members[0]);if(members.length>1){const leader=members[0],nation=world.countries.findIndex(c=>c.id===leader.countryId);armies.push({id:group.id+'-entry-'+side,nation,location:world.territories.findIndex(t=>t.id===territory),leaderSlot:leader.slot,members:members.map(p=>({personId:p.id,slot:p.slot,generation:p.generation,role:p.role})),formation:true});}}
 const duel={...b,attackerPersonId:attack[0]?.id,defenderPersonId:defense[0]?.id};
 return [{...first,id:group.id+'-battle-location',kind:'route',battleEntry:true,entryLocation:true,battleIndex:b.index,event:{type:'territory',index:first.event.index,battleIndex:b.index},mapEventIndex:first.event.index,readySides:['attack','defense'],title:'양군 전장 대치',worldBefore:world,worldAfter:world,camps:first.campsBefore||first.camps,entryArmyGroups:armies,engagement:{id:group.id+'-entry',first:duel,people:leaders,battles:[]}}];
}
