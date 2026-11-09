export function tacticalPhases(units,tactics){
 const phases=[];
 for(const tactic of tactics.selected){
  const retreat=tactic.id.includes('retreat'),flank=['pincer','hook','oblique','wing-focus'].includes(tactic.id),reserve=['reserves','waves'].includes(tactic.id);
  const candidates=units.flatMap(u=>u.orders.filter(o=>retreat?o.kind==='retreat':flank?u.side==='attack'&&o.kind==='walk'&&o.start>=1700&&(Math.abs(o.curveY||0)>25||tactic.id==='wing-focus'&&Math.abs(o.to.y-o.from.y)>20):reserve?u.formationRole==='reserve'&&o.kind==='walk'&&o.start>=1700:tactic.id==='center-break'?u.formationRole==='center'&&o.kind==='attack':tactic.id==='breach'?o.kind==='walk'&&o.start>=u.visualContact:tactic.id==='local-counter'||tactic.id==='counter-break'?u.side==='defense'&&o.kind==='attack':tactic.id==='hold'?u.side==='defense'&&o.kind==='guard'&&o.start>=u.visualContact:o.kind==='attack'&&o.start>=u.visualContact).map(o=>({u,o})));
  const first=candidates.sort((a,b)=>a.o.start-b.o.start)[0];if(!first)continue;
  const involved=candidates.filter(v=>v.u.countryId===first.u.countryId&&Math.abs(v.o.start-first.o.start)<800),ids=[...new Set(involved.map(v=>v.u.id))];
  phases.push({id:tactic.id,name:tactic.name,at:first.o.start,end:Math.max(...involved.map(v=>v.o.end)),ids,countryId:first.u.countryId});
 }
 return phases.sort((a,b)=>a.at-b.at).filter((p,i,a)=>!i||p.at-a[i-1].at>150);
}
export function activeTacticAt(plan,time){return (plan.tacticalPhases||[]).filter(p=>p.at<=time&&p.end>time).at(-1)||null;}

export function activeCommandsAt(plan,time){return ['attack','defense'].map(side=>(plan.tacticalPhases||[]).filter(p=>p.side===side&&p.at<=time&&p.end>time).at(-1)).filter(Boolean);}
