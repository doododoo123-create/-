// A defensive victory may push back across the actual battle frontier.
// The defeated attacker has already fought; every other living enemy commander blocks automatic capture.
export function counterCaptureLimit(battle,rules){
 if(!rules.defenderCounterattack||battle.automatic||battle.winner!==battle.target)return 0;
 const margin=battle.defense.score-battle.attack.score,[one,two]=rules.counterCaptureThresholds;
 return margin>=two?2:margin>=one?1:0;
}
export function counterCapture(s,atlas,battle,rules){
 const limit=counterCaptureLimit(battle,rules),taken=[];
 if(!limit)return taken;
 const enemy=s.countries[battle.actor],front=[battle.cellId];
 while(taken.length<limit){
  const candidates=s.cells.filter(c=>c.owner===battle.actor&&front.some(id=>atlas.cells[id].neighbors.includes(c.id))
   &&!enemy.generals.some(g=>g.active&&g.alive&&g.position===c.id&&g.slot!==battle.slot));
  candidates.sort((a,b)=>Number(b.id===battle.from)-Number(a.id===battle.from)||a.id-b.id);
  const next=candidates[0];if(!next)break;
  next.owner=battle.target;next.commander=battle.defenseSlot;taken.push(next.id);front.push(next.id);
 }
 return taken;
}
