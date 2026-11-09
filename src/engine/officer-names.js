import {OFFICER_NAMES} from '../data/officer-names.js';
export function nextOfficerName(state,nation,slot,generation){
 const used=new Set(state.countries.flatMap(c=>[c.kingName,c.ministerName,...c.generals.filter(g=>g.appointed).map(g=>g.name),...(c.fallen||[]).map(g=>g.name)]).filter(Boolean).map(n=>n.replace(/·\d+대\d+$/u,'')));
 let h=2166136261;for(const ch of `${nation}:${slot}:${generation}:${state.turns}`)h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;
 for(let i=0;i<OFFICER_NAMES.length;i++){const name=OFFICER_NAMES[(h+i)%OFFICER_NAMES.length];if(!used.has(name))return name;}
 const base=OFFICER_NAMES[h%OFFICER_NAMES.length];let suffix=2;while(used.has(base+suffix))suffix++;return base+suffix;
}
