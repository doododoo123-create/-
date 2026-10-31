import {GENERAL_KEYS,LEADER_KEYS,resolvePersonPortraitKey} from './portrait-keys.js';
const allKeys=[...GENERAL_KEYS,...LEADER_KEYS];
const countryAlive=world=>new Set(world.territories.map(t=>t.ownerId));
// World-view data only: no army, RNG, identity or historical record is changed.
// Preserve surviving faces first. Freed portraits from fallen nations join the
// same global pool; the allocator never confines a successor to a tiny subset.
export function allocateWorldPortraits(world,previous=null){
 const alive=countryAlive(world),prior=new Map((previous?.people||[]).map(p=>[p.id,p])),countries=new Map(world.countries.map(c=>[c.id,c])),assigned=new Map(),used=new Set(),owners=new Map((world.portraitClaims||[]).map(p=>[p.key,p.id]));
 const people=world.people.filter(p=>alive.has(p.countryId)&&p.alive!==false),personIds=new Set(people.map(p=>p.id)),ordered=[...people].sort((a,b)=>world.portraitClaims?(a.id<b.id?-1:a.id>b.id?1:0):String(a.id).localeCompare(String(b.id),'en'));
 const claim=(p,key)=>{if(!allKeys.includes(key)||used.has(key)||owners.has(key)&&owners.get(key)!==p.id)return false;assigned.set(p.id,key);used.add(key);return true;};
 for(const p of ordered){const old=prior.get(p.id);if(old&&!old.portraitMissing)claim(p,old.portraitKey);}
 for(const p of ordered)if(!assigned.has(p.id))claim(p,resolvePersonPortraitKey(p,countries.get(p.countryId),p.role));
 for(const p of ordered){if(assigned.has(p.id))continue;
  let hash=0;for(const c of p.id)hash=(Math.imul(hash,31)+c.charCodeAt(0))>>>0;
  const pool=p.role==='general'?[...GENERAL_KEYS,...LEADER_KEYS]:[...LEADER_KEYS.filter(k=>k.startsWith(p.role+'-')),...GENERAL_KEYS,...LEADER_KEYS.filter(k=>!k.startsWith(p.role+'-'))];
  const preferred=pool.slice(0,p.role==='general'?70:10),rest=pool.slice(preferred.length),offset=hash%preferred.length;
  const key=[...preferred.slice(offset),...preferred.slice(0,offset),...rest].find(k=>!used.has(k)&&(!owners.has(k)||owners.get(k)===p.id));if(key)claim(p,key);
 }
 return {...world,people:world.people.map(p=>{if(!personIds.has(p.id)){const old=prior.get(p.id);return old&&allKeys.includes(old.portraitKey)?{...p,portraitKey:old.portraitKey}:p;}const key=assigned.get(p.id),{portraitMissing,...rest}=p;return key?{...rest,portraitKey:key}:{...p,portraitMissing:true};})};
}
