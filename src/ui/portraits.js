import { BUILTIN_PORTRAITS } from '../data/portraits.js';
import { GENERAL_PORTRAITS, GENERAL_PORTRAIT_LABELS } from '../data/general-portraits.js';
import { esc } from './icons.js';
import { displayName } from './display-names.js';
export function generalPortraitKey(person,country){
  const roster=/^general-(\d+)-(\d+)$/.exec(person?.id||'');
  if(roster)return `general-${String((Number(roster[1])*5+Number(roster[2]))%50+1).padStart(3,'0')}`;
  let hash=0;for(const char of String(person?.id||`${country?.id||person?.countryId}:${person?.slot??0}:${person?.generation??0}`))hash=(Math.imul(hash,31)+char.charCodeAt(0))>>>0;
  return `general-${String(hash%50+1).padStart(3,'0')}`;
}
export function defaultPortraitKey(countryId, role = 'king') {
  const preset = /^nation-(\d)$/.exec(countryId || '');
  const legacyMapping = [0, 1, 2, 3, 0, 3, 1];
  let index = preset && legacyMapping[Number(preset[1])];
  if (!Number.isInteger(index)) {
    let hash = 0; for (const char of String(countryId || 'unassigned')) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
    index = hash % 4;
  }
  return `n${index}-${role}`;
}
export function resolvedPortraitKey(person,country,role='king'){
  if(Object.hasOwn(GENERAL_PORTRAITS,person?.portraitKey||''))return person.portraitKey;
  if((person?.role||role)==='general'&&(!person?.portraitKey||person.portraitKey.endsWith('-general')))return generalPortraitKey(person,country);
  return Object.hasOwn(BUILTIN_PORTRAITS,person?.portraitKey||'')?person.portraitKey:defaultPortraitKey(country?.id,person?.role||role);
}
export function portraitSource(person, country, role = 'king') {
  const key=resolvedPortraitKey(person,country,role);return GENERAL_PORTRAITS[key]||BUILTIN_PORTRAITS[key];
}
export function portraitImage(person, country, role = 'king', className = '') {
  const label = displayName(person,role === 'king' ? '국왕 미배치' : role === 'minister' ? '승상 미배치' : '장군 미배치');
  const key=resolvedPortraitKey(person,country,role);
  return `<img class="${className}" data-portrait-key="${key}" data-portrait-kind="${key.startsWith('general-')?'general':'leader'}" src="${portraitSource(person, country, role)}" alt="${esc(label)}" width="120" height="156" decoding="async">`;
}
export const portraitLabel = key => Object.hasOwn(GENERAL_PORTRAITS,key)?`장수 ${Number(key.slice(-3))} · ${GENERAL_PORTRAIT_LABELS[key]||''}`:`${['청람','적연','금휘','백록'][Number(key[1])]} ${key.endsWith('king')?'국왕':key.endsWith('minister')?'승상':'장군'}`;
export const portraitChoices = () => [...Object.keys(GENERAL_PORTRAITS),...Object.keys(BUILTIN_PORTRAITS).filter(key=>!key.endsWith('-general'))];
