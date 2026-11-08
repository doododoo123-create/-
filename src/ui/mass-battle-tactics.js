// These are reusable movement policies, not additional combat rules or scripts.
export const MASS_TACTICS=[
 {id:'center-break',name:'중앙 집중 돌파'}, {id:'wing-focus',name:'편익 집중 공세'},
 {id:'oblique',name:'사선 진격'}, {id:'pincer',name:'양익 협공'},
 {id:'hook',name:'편익 포위'}, {id:'breach',name:'돌출부 확대'},
 {id:'waves',name:'파상 공세'}, {id:'pressure',name:'집중 압박'},
 {id:'reserves',name:'후속대 투입'}, {id:'hold',name:'전선 유지'},
 {id:'staged-retreat',name:'단계적 후퇴'}, {id:'local-counter',name:'국지 역습'},
 {id:'counter-break',name:'반격 돌파'}, {id:'split-retreat',name:'분리된 철수'},
];
export function massSeed(value){let h=2166136261;for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
export function chooseMassTactics(a,seed){
 let rng=massSeed(seed+':'+a.id+':tactics');const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
 const attacks=a.units.filter(u=>u.side==='attack'),defenses=a.units.filter(u=>u.side==='defense');
 const pairs=new Map();for(const b of a.battles.filter(b=>!b.automatic)){if(!pairs.has(b.defenseId))pairs.set(b.defenseId,new Set());pairs.get(b.defenseId).add(b.attackId);}
 const repeated=[...pairs.values()].some(v=>v.size>=2),winningAttackers=a.winners.filter(u=>u.side==='attack'),gained=a.changes.filter(c=>c.to===a.actorId).length,lost=a.changes.filter(c=>c.from===a.actorId).length;
 const conditions={
  'center-break':a.advancers.some(b=>!b.automatic), 'wing-focus':winningAttackers.length>=1&&attacks.length>=2,
  oblique:a.advancers.length>=2&&new Set(a.advancers.map(b=>b.attackId)).size>=2,
  pincer:winningAttackers.length>=2&&defenses.length>=2&&gained>=lost,
  hook:winningAttackers.length>=1&&attacks.length>=2&&defenses.length>=2&&gained>=lost,
  breach:a.battles.some(b=>b.continuation==='advance'&&b.takenTerritoryIds?.length),
  waves:repeated,pressure:repeated,
  reserves:a.battles.some(b=>b.relief)||a.units.some(u=>u.firstBattle!==null&&u.firstBattle>a.battles[0].index),
  hold:a.defenseWins.length>0,
  'staged-retreat':a.events.some(e=>e.moves?.some(m=>m.kind==='retreat'))&&a.battles.length>1,
  'local-counter':a.defenseWins.length>0,
  'counter-break':a.battles.some(b=>b.continuation==='counter'&&b.takenTerritoryIds?.length),
  'split-retreat':a.defeated.length>=2,
 };
 const eligible=MASS_TACTICS.filter(t=>conditions[t.id]);
 const ranked=eligible.map(t=>({...t,rank:random()})).sort((a,b)=>b.rank-a.rank);
 // Counterattack and a real follow-on advance must remain readable regardless
 // of cosmetic selection. The remaining policies vary with a separate seed.
 const selected=ranked.slice(0,4);for(const id of ['counter-break','breach'])if(conditions[id]&&!selected.some(t=>t.id===id)){selected.pop();selected.push(eligible.find(t=>t.id===id));}
 return {eligible:eligible.map(({id,name})=>({id,name})),selected:selected.map(({id,name})=>({id,name})),wing:random()<.5?-1:1};
}
