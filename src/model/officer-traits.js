export const OFFICER_STYLES=Object.freeze({
 balanced:{name:'균형형',attack:1,defense:1,mobility:3,description:'현재 전선과 목표를 고르게 고려'},
 assault:{name:'돌격형',attack:3,defense:-1,mobility:3,description:'적 지휘관이 지키는 주요 전장 공략 선호'},
 guardian:{name:'수비형',attack:-1,defense:3,mobility:3,description:'아군 수도와 주요 영지에 가까운 전선 우선'},
 mobile:{name:'기동형',attack:0,defense:0,mobility:5,description:'가까운 빈틈 공략 · 이동 피로 완화'},
 cautious:{name:'신중형',attack:1,defense:2,mobility:2,description:'병력이 적고 수비가 약한 영토 선호'},
});
export function assignedOfficerStyle(key){let h=0;for(const c of String(key))h=(Math.imul(h,31)+c.charCodeAt(0))>>>0;return Object.keys(OFFICER_STYLES)[h%5];}
export function officerProfile(person,key=person.id){
 const combatStyle=Object.hasOwn(OFFICER_STYLES,person.combatStyle||'')?person.combatStyle:assignedOfficerStyle(key),base=OFFICER_STYLES[combatStyle],adjust=Math.sign(person.ability||0);
 return {...(person.personalAbility!==undefined?{personalAbility:person.personalAbility}:{}),combatStyle,attackAbility:person.attackAbility??Math.max(-4,Math.min(4,base.attack+adjust)),defenseAbility:person.defenseAbility??Math.max(-4,Math.min(4,base.defense+adjust)),mobility:person.mobility??base.mobility};
}
export function enableOfficerTraits(input){
 if(input.rules.battleMode!=='additive30')return input;
 const world=structuredClone(input);world.rules.officerTraits=true;world.rules.ministerWeights.producer=[2,6,2];
 world.people=world.people.map(p=>p.role==='general'?{...p,...officerProfile(p,p.id)}:p);return world;
}
export function officerAbility(g,side,rules){return rules.officerTraits&&g?.role!=='king'?(g?.[side==='attack'?'attackAbility':'defenseAbility']??g?.ability??0):g?.ability||0;}
export function officerFatigue(base,g,rules){return rules.officerTraits&&g?.role!=='king'&&base<0?Math.min(0,base+(g.mobility??3)-3):base;}
export function officerTargetPreference(style,{defenders,distance,nearest,nearCapital}){
 const army=defenders.reduce((n,g)=>n+g.troops,0);
 return style==='assault'?(defenders.length?4:0):style==='guardian'?(nearCapital?5:0):style==='mobile'?Math.max(0,4-(distance-nearest)*2)+(defenders.length?0:2):style==='cautious'?Math.max(-5,3-army*.4):0;
}

// Existing named officers retain their authored aptitude; neutral/new officers
// get a deterministic personal rating without using simulation randomness.
export function personalAbility(g){
 if(Number.isInteger(g?.personalAbility))return Math.max(-4,Math.min(4,g.personalAbility));
 if(g?.ability)return Math.max(-4,Math.min(4,g.ability));
 let hash=0;for(const c of String(g?.name||g?.id||'officer')+':'+(g?.generation||0))hash=(Math.imul(hash,31)+c.charCodeAt(0))>>>0;
 return hash%5-2;
}
export function addPersonalBonus(side,g,rules){
 if(!rules.personalAbility||g?.role==='king')return;
 side.personalAbility=personalAbility(g);side.bonus+=side.personalAbility;
}
export function enablePersonalAbilities(input){
 if(input.rules.battleMode!=='additive30')return input;
 return {...input,people:input.people.map(p=>p.role==='general'?{...p,personalAbility:personalAbility(p)}:p)};
}
