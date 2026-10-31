import {GENERAL_KEYS,LEADER_KEYS} from '../model/portrait-keys.js';
import {personalAbility} from '../model/officer-traits.js';
const ownLand=(s,id)=>s.cells.some(c=>c.owner===id);
// A recorded boundary supplies existing immutable identities and their actual
// portraits. No draw is consumed and no old world or historic event is edited.
export function bindOfficerIdentities(state,identities,countryIds){
 if(!Array.isArray(identities)||identities.length>10000)throw Error('장수 신원 배정을 확인해 주세요.');
 const known=new Map(),ids=new Set();for(const p of identities){if(!p||!Number.isInteger(p.nation)||!state.countries[p.nation]?.generals[p.slot]||typeof p.id!=='string'||!p.id||p.id.length>300||p.portraitKey!==undefined&&!/^(general-(?:00[1-9]|0[1-6][0-9]|070)|(king|minister)-(?:00[1-9]|010))$/.test(p.portraitKey))throw Error('장수 신원 배정이 올바르지 않습니다.');const key=p.nation+':'+p.slot;if(known.has(key)||ids.has(p.id))throw Error('장수 신원이 중복됩니다.');ids.add(p.id);known.set(key,p);}
 for(const c of state.countries)for(const g of c.generals){const p=known.get(c.id+':'+g.slot);if(!p&&!g.appointed&&!g.active)continue;let id=p?.id;if(!id){const base=`officer-${c.id}-${g.slot}-${g.generation}`;id=base;let suffix=0;while(ids.has(id))id=base+'-'+(++suffix);ids.add(id);}g.identity={id,...(p?.portraitKey?{portraitKey:p.portraitKey}:{}),...(p?.personality?{personality:p.personality}:{})};}
 // Older saves could lend an exile's face to a later generic character.
 // Resolve that legacy collision once, preferring the original named officer.
 const officers=state.countries.flatMap(c=>c.generals.filter(g=>g.alive&&g.identity)),priority=new Map(identities.map(p=>[p.id,p.original?1:0])),used=new Set(),pending=[];
 officers.sort((a,b)=>(priority.get(b.identity.id)||0)-(priority.get(a.identity.id)||0)||(a.identity.id<b.identity.id?-1:a.identity.id>b.identity.id?1:0));
 for(const g of officers){const key=g.identity.portraitKey;if(key&&!used.has(key))used.add(key);else pending.push(g);}
 for(const g of pending){const key=[...GENERAL_KEYS,...LEADER_KEYS].find(k=>!used.has(k));if(key){g.identity.portraitKey=key;used.add(key);}else delete g.identity.portraitKey;}
 state.exileRecruitment=true;
}
export function recruitExile(state,nation,target){
 if(!state.exileRecruitment)return null;
 const donor=state.countries.filter(c=>!ownLand(state,c.id)).flatMap(c=>c.generals.filter(g=>g.alive&&g.appointed&&!g.transferredTo&&g.identity).map(g=>({c,g}))).sort((a,b)=>(b.g.underdogWins||0)-(a.g.underdogWins||0)||(b.g.wins||0)-(a.g.wins||0)||a.c.id-b.c.id||a.g.slot-b.g.slot)[0];
 if(!donor)return null;const {c,g}=donor,from=c.id,id=g.identity.id,copy=structuredClone(g),slot=target.slot,station=target.station,position=target.position;
 // The old slot is an archived service record, never another live appearance.
 g.transferredTo={nation,slot,turn:state.turns+1};g.active=false;g.troops=0;g.station=null;g.position=null;g.stranded=false;
 for(const key of Object.keys(target))delete target[key];Object.assign(target,copy,{slot,station,position:Number.isInteger(position)?position:station,troops:0,active:true,alive:true,appointed:true,waited:0,stranded:false,confusion:0,personalAbility:personalAbility(copy),recruitedFrom:{nation:from,turn:state.turns+1},serviceHistory:[...(copy.serviceHistory||[]),{from,to:nation,turn:state.turns+1}]});delete target.readiness;delete target.restedThisSeason;delete target.transferredTo;
 return {from,id,name:target.name,slot};
}
export function validOfficerIdentities(state){
 const seen=new Set();for(const c of state.countries)for(const g of c.generals){if(state.exileRecruitment&&(g.active||g.appointed)&&!g.identity)return false;if(g.identity!==undefined){const p=g.identity;if(!p||typeof p.id!=='string'||!p.id||p.id.length>300||p.portraitKey!==undefined&&!/^(general-(?:00[1-9]|0[1-6][0-9]|070)|(king|minister)-(?:00[1-9]|010))$/.test(p.portraitKey))return false;if(g.alive&&!g.transferredTo){if(seen.has(p.id))return false;seen.add(p.id);}}if(g.transferredTo&&(g.active||g.troops||g.position!==null||g.station!==null||!state.countries[g.transferredTo.nation]))return false;}
 return true;
}

export function successorIdentity(state,nation,slot,countryId){const used=new Set(state.countries.flatMap(c=>c.generals.map(g=>g.identity?.id))),base=`recruit-${nation}-${slot}-${state.turns+1}`;let id=base,suffix=0;while(used.has(id))id=base+'-'+(++suffix);return {id};}
