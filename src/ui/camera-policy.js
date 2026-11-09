// Administrative snapshots have no location to follow. In particular, hold and
// roster events can run only milliseconds apart immediately after occupation.
export function followsMapScene(scene){
 if(!scene)return false;
 if(['hold','roster','war_recovery','season_recovery','empty_return','unit_spacing','army_release','army_disband'].includes(scene.event?.type))return false;
 if(scene.massRecap||scene.battleEntry||['movement','capture','arrival','route','roll','reel','result'].includes(scene.kind))return true;
 if(['season','round-settle','summary'].includes(scene.kind))return false;
 return ['territory','attack_roll','defense_roll','resolve','death','appointment','capital_fall','elimination','king','minister','war_target','domestic_roll'].includes(scene.event?.type);
}
