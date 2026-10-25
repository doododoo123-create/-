// Initial military assignments are scenario data, independent of visual anchors.
export function validateDeployment(input,countries,people,territories,maxRegion){
 if(input===undefined||input===null)return null;
 if(!input||input.version!==1||!Array.isArray(input.generals)||input.generals.length>2000)throw Error('초기 배치 파일 형식을 확인해 주세요.');
 const seen=new Set(),used=new Set(),generals=input.generals.map(entry=>{
  const p=people.find(p=>p.id===entry.personId&&p.role==='general'&&p.countryId);if(!p||seen.has(p.id))throw Error('초기 배치의 지휘관이 없거나 중복됩니다.');seen.add(p.id);
  const own=id=>territories.some(t=>t.id===id&&t.ownerId===p.countryId);
  if(!own(entry.stationId)||!own(entry.positionId)||!Array.isArray(entry.territoryIds)||entry.territoryIds.length>maxRegion||new Set(entry.territoryIds).size!==entry.territoryIds.length)throw Error('시작 위치·주둔지·관할 영토를 확인해 주세요.');
  for(const id of entry.territoryIds){if(!own(id)||used.has(id))throw Error('관할 영토는 자국 영토를 한 지휘관에게만 배정할 수 있습니다.');used.add(id);}
  if(entry.territoryIds.length&&!entry.territoryIds.includes(entry.stationId))throw Error('주둔지는 본인 관할 영토 안에 지정해 주세요.');
  return {personId:p.id,stationId:entry.stationId,positionId:entry.positionId,territoryIds:[...entry.territoryIds]};
 });
 const assignedCountries=new Set(generals.map(e=>people.find(p=>p.id===e.personId).countryId));
 for(const id of assignedCountries)if(territories.some(t=>t.ownerId===id&&!used.has(t.id)))throw Error('수동 배치 국가의 모든 영토에 담당 지휘관을 지정해 주세요.');
 return generals.length?{version:1,generals}:null;
}
export function synchronizeDeployment(next,previous){
 if(!next.deployment||!previous.deployment)return next;
 const valid=next.deployment.generals.filter(e=>{const p=previous.people.find(p=>p.id===e.personId),now=next.people.find(p=>p.id===e.personId&&p.role==='general'&&p.countryId===p?.countryId);if(!p||!now)return false;const before=previous.territories.filter(t=>t.ownerId===p.countryId).map(t=>t.id).sort(),after=next.territories.filter(t=>t.ownerId===p.countryId).map(t=>t.id).sort();return JSON.stringify(before)===JSON.stringify(after);});
 const invalidCountries=new Set(next.deployment.generals.filter(e=>!valid.includes(e)).map(e=>previous.people.find(p=>p.id===e.personId)?.countryId));
 const generals=valid.filter(e=>!invalidCountries.has(previous.people.find(p=>p.id===e.personId)?.countryId));return {...next,deployment:generals.length?{version:1,generals}:null};
}
