// Temporary minister presence is display-only; it has no army, station or engine slot.
export function royalRoleForScene(scene,record){
 if(!scene||['season','summary','movement','route','arrival','capture','round-settle'].includes(scene.kind))return null;
 const event=scene.event||{};
 if(scene.kind==='reel')return event.type==='minister'?'minister':'king';
 if(record?.type==='domestic'&&['domestic_roll','supply_roll','resolve'].includes(event.type))return 'minister';
 return null;
}

// A vacant throne issues commands through a regent; it is not a revived army.
export function royalCommandPerson(person,world){if(person?.role!=='king'||person.alive!==false)return person;const minister=world.people.find(p=>p.role==='minister'&&p.countryId===person.countryId);return {...person,wins:0,underdogWins:0,confusion:0,readiness:null,name:'섭정',portraitKey:minister?.portraitKey||'minister-001',feature:'왕위 공석 · 기존 국가 성향으로 명령 유지'};}
