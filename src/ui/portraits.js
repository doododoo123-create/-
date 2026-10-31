import { LEADER_PORTRAITS } from '../data/studio-art.js';
import { BUILTIN_PORTRAITS } from '../data/portraits.js';
import { GENERAL_PORTRAITS, GENERAL_PORTRAIT_LABELS } from '../data/general-portraits.js';
import { esc } from './icons.js';
import { displayName } from './display-names.js';
import {localImageURL} from './local-image-url.js';
import {portraitKeyForGeneral,legacyPortraitKey,resolvePersonPortraitKey} from '../model/portrait-keys.js';
export const generalPortraitKey=portraitKeyForGeneral,defaultPortraitKey=legacyPortraitKey,resolvedPortraitKey=resolvePersonPortraitKey;
export function portraitSource(person, country, role = 'king') {
  if(person?.portraitMissing)return '';
  const key=resolvedPortraitKey(person,country,role);return localImageURL(LEADER_PORTRAITS[key]||GENERAL_PORTRAITS[key]||BUILTIN_PORTRAITS[key]);
}
export function portraitImage(person, country, role = 'king', className = '') {
  const label = displayName(person,role === 'king' ? '국왕 미배치' : role === 'minister' ? '승상 미배치' : '장군 미배치');
  if(person?.portraitMissing)return `<span class="portrait-initials ${className}" role="img" aria-label="${esc(label)}">${esc(label.slice(0,2))}</span>`;
  const key=resolvedPortraitKey(person,country,role);
  return `<img class="${className}" data-portrait-key="${key}" data-portrait-kind="${key.startsWith('general-')?'general':'leader'}" src="${portraitSource(person, country, role)}" alt="${esc(label)}" width="120" height="156" decoding="async">`;
}
export const portraitLabel = key => Object.hasOwn(LEADER_PORTRAITS,key)?`${key.startsWith('king-')?'국왕':'승상'} ${Number(key.slice(-3))}`: Object.hasOwn(GENERAL_PORTRAITS,key)?`장수 ${Number(key.slice(-3))} · ${GENERAL_PORTRAIT_LABELS[key]||''}`:`${['청람','적연','금휘','백록'][Number(key[1])]} ${key.endsWith('king')?'국왕':key.endsWith('minister')?'승상':'장군'}`;
export const portraitChoices = () => [...Object.keys(LEADER_PORTRAITS),...Object.keys(GENERAL_PORTRAITS)];
