export const officerKey=(nation,g)=>`${nation}:${g.role||'general'}:${g.slot}:${g.generation}`;
export const fieldOfficers=c=>c.royal?[...c.generals,c.royal]:c.generals;
export const battleReady=g=>!!g&&g.active&&g.alive&&g.troops>0&&!g.stranded&&!g.readiness?.resting;
export function beginReadiness(g){if(!g.readiness)g.readiness={firstArmy:g.troops,defeats:0,resting:false,reasons:[]};return g.readiness;}
export function recordDefeat(g,margin,rules){
 const r=beginReadiness(g);r.defeats++;g.confusion=rules.seasonRestConfusion&&g.restedThisSeason?6:Math.min(rules.confusionCap,(g.confusion||0)+rules.confusionStep);
 r.reasons=[...(margin>=rules.restMargin?['score']:[]),...(g.troops<=rules.restTroops?['troops']:[]),...(g.troops<=r.firstArmy*rules.restFraction?['fraction']:[]),...(g.confusion>=rules.confusionCap&&rules.confusionCap>0?['confusion']:[])];
 r.resting=!!r.reasons.length;
 if(rules.seasonRestConfusion&&r.resting){g.restedThisSeason=true;g.confusion=6;return {...r,confusion:6,reasons:[...r.reasons],restedThisSeason:true};}
 const clearedConfusion=r.resting&&rules.resetConfusionOnRest?g.confusion:0;if(clearedConfusion)g.confusion=0;return {...r,confusion:g.confusion,reasons:[...r.reasons],...(clearedConfusion?{clearedConfusion}:{})};
}
export function clearReadiness(state){let changed=false;for(const c of state.countries)for(const g of fieldOfficers(c))if(g.readiness){delete g.readiness;changed=true;}return changed;}
export function clearSeasonConfusion(state){const recovered=[];for(const c of state.countries)for(const g of fieldOfficers(c))if(g.confusion||g.restedThisSeason){recovered.push({nation:c.id,slot:g.slot,role:g.role||'general',amount:g.confusion});g.confusion=0;delete g.restedThisSeason;}return recovered;}

export function validOfficerConfusion(g,rules){return Number.isInteger(g.confusion)&&g.confusion>=0&&g.confusion<=Math.max(rules.confusionCap,rules.seasonRestConfusion&&g.restedThisSeason?6:0)&&(g.restedThisSeason===undefined||rules.seasonRestConfusion&&typeof g.restedThisSeason==='boolean')&&(!g.restedThisSeason||g.confusion===6);}
