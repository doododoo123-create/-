import {OFFICER_STYLES} from '../model/officer-traits.js';
export const TACTICAL_ROLES={front:'전열',flank:'측면',reserve:'예비대',guard:'방어선'};
// These assignments describe the reenactment only; no new combat bonus.
export function assignTacticalRoles(plan,groups){
 for(const side of ['attack','defense']){
  const members=plan.units.filter(u=>u.side===side),ranked=[...members].sort((a,b)=>b.startArmy-a.startArmy||a.id.localeCompare(b.id));
  for(const [index,u]of members.entries()){
   const p=plan.before.people.find(p=>p.id===u.id)||{},style=p.combatStyle||'balanced',mountain=side==='defense'&&plan.engagements.some(b=>b.terrain==='mountain');
   u.unitNumber=index+1;u.styleName=OFFICER_STYLES[style]?.name||'균형형';u.mobility=p.mobility??3;u.visualAbility=p.personalAbility??p.ability??0;
   u.tacticalRole=style==='mobile'?'flank':style==='cautious'?'reserve':style==='guardian'||u.role==='king'?'guard':'front';
   if(members.length>=3&&u===ranked.at(-1)&&style==='balanced')u.tacticalRole='reserve';
   if(mountain&&u.tacticalRole==='front')u.tacticalRole='guard';if(!u.battleIds.length)u.tacticalRole='reserve';
   u.roleReason=style==='mobile'?'기동형 장수의 측면 기동':style==='cautious'?'신중형 장수의 후열 엄호':style==='guardian'||u.role==='king'?'방어에 적합한 지휘관':style==='assault'?'돌격형 장수의 선두 공세':u.tacticalRole==='reserve'?'소규모 부대의 후열 대기':'주력 병력의 전열 유지';
   const own=groups.filter(g=>g.parentId===u.id);
   for(const [i,g]of own.entries()){g.unitNumber=u.unitNumber;g.role=own.length>=3&&i>=Math.ceil(own.length*.7)?'reserve':u.tacticalRole;g.initialRole=g.role;g.styleName=u.styleName;g.roleReason=u.roleReason;}
  }
 }
}
