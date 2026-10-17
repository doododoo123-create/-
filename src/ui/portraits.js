import { BUILTIN_PORTRAITS } from '../data/portraits.js';
import { esc } from './icons.js';
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
export function portraitSource(person, country, role = 'king') {
  return BUILTIN_PORTRAITS[person?.portraitKey] || BUILTIN_PORTRAITS[defaultPortraitKey(country?.id, person?.role || role)];
}
export function portraitImage(person, country, role = 'king', className = '') {
  const label = person?.name || (role === 'king' ? '국왕 미배치' : role === 'minister' ? '승상 미배치' : '장군 미배치');
  return `<img class="${className}" src="${portraitSource(person, country, role)}" alt="${esc(label)}" width="120" height="156" decoding="async">`;
}
export const portraitLabel = key => `${['청람','적연','금휘','백록'][Number(key[1])]} ${key.endsWith('king')?'국왕':key.endsWith('minister')?'승상':'장군'}`;
export const portraitChoices = () => Object.keys(BUILTIN_PORTRAITS);
