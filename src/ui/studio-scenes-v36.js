// Recorded worlds, paths, results and RNG remain authoritative. Only the visible
// entry/arrival choreography is combined so an empty province is visited once.
export function directUnopposedScenes(scenes,record){
 let result=[...scenes];
 for(const battle of record.battles||[]){
  if(!battle.automatic||!battle.takenTerritoryIds?.length)continue;
  const original=result.filter(s=>s.battleIndex===battle.index),territory=original.find(s=>s.event?.type==='territory');
  const resolve=original.find(s=>s.kind==='apply'&&s.event?.type==='resolve');if(!territory||!resolve)continue;
  const person=territory.worldBefore.people.find(p=>p.id===battle.attackerPersonId);if(!person)continue;
  const outbound=original.find(s=>s.kind==='movement'&&s.event?.type==='territory'),occupation=original.find(s=>s.kind==='movement'&&s.moves?.some(m=>m.personId===person.id&&m.kind==='occupation'));
  const start=outbound?.moves.find(m=>m.personId===person.id),arrival=occupation?.moves.find(m=>m.personId===person.id),target=battle.takenTerritoryIds[0];
  const fromId=start?.fromId||territory.campsBefore?.[person.id]?.territoryId||person.positionId||person.stationId||battle.fromId;
  const path=[...(start?.path||[fromId])];for(const id of arrival?.path||[battle.fromId,target])if(path.at(-1)!==id)path.push(id);if(path.at(-1)!==target)path.push(target);
  const campsBefore=outbound?.campsBefore||territory.campsBefore||territory.camps||{},camps={...campsBefore,[person.id]:{territoryId:target,homeId:person.stationId}};
  const entry={...territory,id:'unopposed-entry-'+battle.index,kind:'movement',title:'무방비 영토 진입',automaticEntry:true,visitorIds:[person.id],worldAfter:territory.worldBefore,campsBefore,camps,movementSide:'attack',readySides:[],revealedRoutes:[],moves:[{personId:person.id,countryId:person.countryId,slot:person.slot,kind:'outbound',fromId,toId:target,path}]};
  const captureSource=original.find(s=>s.kind==='capture')||resolve,capture={...captureSource,id:'unopposed-capture-'+battle.index,kind:'capture',title:'무방비 영토 즉시 점령',automaticEntry:true,visitorIds:[person.id],camps,worldBefore:resolve.worldBefore,worldAfter:captureSource.worldAfter};
  const remove=new Set(original.filter(s=>['territory','battle_auto','resolve','occupation'].includes(s.event?.type))),first=result.findIndex(s=>remove.has(s));
  if(first<0)continue;const next=[];for(let i=0;i<result.length;i++){if(i===first)next.push(entry,capture);if(!remove.has(result[i]))next.push(result[i]);}result=next;
 }
 return result;
}

export function formationScenes(scenes){
 const result=[];
 for(let i=0;i<scenes.length;i++){
  const scene=scenes[i],e=scene.event,group=e?.armyGroup;
  // A singleton has no group to form. Keep its real individual forward movement.
  if(group?.members.length===1&&['army_assembly','army_march'].includes(e.type)){
   if(scene.kind==='focus'&&!e.moves?.length)continue;
   result.push({...scene,singleOfficer:true,title:e.type==='army_march'?'지휘관 전선 이동':'출전 위치 정렬'});continue;
  }
  result.push(scene);
  if(e?.type==='army_assembly'&&group?.members.length>=2&&scenes[i+1]?.event?.index!==e.index){
   result.push({...scene,id:'army-formed-'+group.id,kind:'army-forming',title:'집단군 결성',formationGroup:group,worldBefore:scene.worldAfter,worldAfter:scene.worldAfter,campsBefore:scene.camps,moves:[]});
  }
 }
 return result;
}
