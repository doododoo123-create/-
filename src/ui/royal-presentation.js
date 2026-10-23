// Temporary minister presence is display-only; it has no army, station or engine slot.
export function royalRoleForScene(scene,record){
 if(!scene||['season','summary','movement','round-settle'].includes(scene.kind))return null;
 const event=scene.event||{};
 if(scene.kind==='reel')return event.type==='minister'?'minister':'king';
 if(record?.type==='domestic'&&['domestic_roll','supply_roll','resolve'].includes(event.type))return 'minister';
 return null;
}
