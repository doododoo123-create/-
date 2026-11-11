// Reorder only the viewer's preparations, never engine events or travelled edges.
export function entryPreparations(original,groups){
 const deferred=new Map(groups.map(g=>[g.id,[]])),skip=new Set(),pending=new Map();
 for(const scene of original){const meta=scene.event?.armyGroup;if(!meta||!['army_assembly','army_march'].includes(scene.event.type))continue;
  const owner=groups.find(g=>meta.frontId?g.frontId===meta.frontId:meta.id===g.armyId||g.defenseMetadata?.some(d=>d.id===meta.id));if(!owner)continue;
  deferred.get(owner.id).push(scene);skip.add(scene);
  if(scene.event.type==='army_assembly'){const w=scene.worldBefore,country=w.countries[meta.nation];for(const m of meta.members){const p=w.people.find(p=>p.countryId===country?.id&&p.role==='general'&&p.slot===m.slot&&p.generation===m.generation);if(p&&!pending.has(p.id))pending.set(p.id,{territoryId:p.positionId||p.stationId,homeId:p.stationId});}}
 }
 return {deferred,skip,pending};
}
export function replayPreparation(scenes,first,record,carry,pending,ledger){
 const out=[],active=new Map(),ownIds=new Set(),world=first.worldBefore,limit=first.event.index-1;
 for(const scene of scenes){const meta=scene.event.armyGroup,country=world.countries[meta.nation],ids=meta.members.flatMap(m=>{const p=world.people.find(p=>p.countryId===country?.id&&p.role==='general'&&p.slot===m.slot&&p.generation===m.generation);return p?[p.id]:[];});for(const id of ids){ownIds.add(id);pending.delete(id);}
  const overlay=source=>{const result={...carry,...Object.fromEntries(pending)};for(const id of ownIds){const p=world.people.find(p=>p.id===id);result[id]=source?.[id]||carry?.[id]||{territoryId:p.positionId||p.stationId,homeId:p.stationId};}return result;};
  if(scene.event.type==='army_assembly'&&scene.kind==='movement')active.delete(meta.id);else active.set(meta.id,meta);
  out.push({...scene,id:'entry-'+scene.id,battleEntry:true,entryMarch:scene.event.type==='army_march',worldBefore:world,worldAfter:world,mapEventIndex:limit,mapReveal:ledger,campsBefore:overlay(scene.campsBefore||scene.camps),camps:overlay(scene.camps),entryArmyGroups:[...active.values()]});
 }
 return out;
}
