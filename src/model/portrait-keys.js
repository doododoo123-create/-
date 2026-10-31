// Lightweight portrait identifiers, independent of image bytes and game RNG.
export const GENERAL_KEYS=Array.from({length:70},(_,i)=>`general-${String(i+1).padStart(3,'0')}`);
export const LEADER_KEYS=['king','minister'].flatMap(role=>Array.from({length:10},(_,i)=>`${role}-${String(i+1).padStart(3,'0')}`));
const BUILTIN_KEYS=Array.from({length:4},(_,i)=>['king','minister','general'].map(role=>`n${i}-${role}`)).flat();
export function portraitKeyForGeneral(person,country){
  const roster=/^general-(\d+)-(\d+)$/.exec(person?.id||'');
  if(roster)return `general-${String((Number(roster[1])*5+Number(roster[2]))%50+1).padStart(3,'0')}`;
  let hash=0;for(const char of String(person?.id||`${country?.id||person?.countryId}:${person?.slot??0}:${person?.generation??0}`))hash=(Math.imul(hash,31)+char.charCodeAt(0))>>>0;
  return `general-${String((person?.generation>0?50+hash%20:hash%50)+1).padStart(3,'0')}`;
}
export function legacyPortraitKey(countryId, role = 'king') {
  const preset = /^nation-(\d)$/.exec(countryId || '');
  const legacyMapping = [0, 1, 2, 3, 0, 3, 1];
  let index = preset && legacyMapping[Number(preset[1])];
  if (!Number.isInteger(index)) {
    let hash = 0; for (const char of String(countryId || 'unassigned')) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
    index = hash % 4;
  }
  return `n${index}-${role}`;
}
export function resolvePersonPortraitKey(person,country,role='king'){
  if(LEADER_KEYS.includes(person?.portraitKey||''))return person.portraitKey;
  if(GENERAL_KEYS.includes(person?.portraitKey||''))return person.portraitKey;
  if((person?.role||role)==='general'&&(!person?.portraitKey||person.portraitKey.endsWith('-general')))return portraitKeyForGeneral(person,country);
  const leaderRole=person?.role||role;if(['king','minister'].includes(leaderRole)&&(!person?.portraitKey||/^n[0-3]-(king|minister)$/.test(person.portraitKey))){const preset=/^nation-(\d+)$/.exec(country?.id||person?.countryId||'');let hash=0;for(const c of String(country?.id||person?.countryId||person?.id||'world'))hash=(Math.imul(hash,31)+c.charCodeAt(0))>>>0;return `${leaderRole}-${String((preset?Number(preset[1]):hash)%10+1).padStart(3,'0')}`;}
  return BUILTIN_KEYS.includes(person?.portraitKey||'')?person.portraitKey:legacyPortraitKey(country?.id,leaderRole);
}
