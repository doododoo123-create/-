import { validateWorld } from '../model/world.js';
export const STORAGE_KEY = 'saguk-studio.world.v1';
export const serializeWorld = world => JSON.stringify({ kind: 'saguk-studio-world', version: 2, world: validateWorld(world) }, null, 2);
export function parseWorld(text) {
  if (typeof text !== 'string' || text.length > 5 * 1024 * 1024) throw new Error('세계 파일은 5MB 이하의 JSON이어야 합니다.');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('JSON 파일을 읽을 수 없습니다. 내보낸 세계 파일을 선택해 주세요.'); }
  if (data?.kind !== 'saguk-studio-world' || ![1,2].includes(data.version)) throw new Error('Studio v11에서 내보낸 세계 JSON 파일이 아닙니다. 기존 HTML은 직접 가져올 수 없습니다.');
  return validateWorld(data.world);
}
export function saveWorld(storage, world) {
  try {
    const previous=storage.getItem?.(STORAGE_KEY);
    if(previous&&!storage.getItem(STORAGE_KEY+'.before-v11')) { let parsed;try{parsed=JSON.parse(previous);}catch{} if(parsed?.world?.schemaVersion===1)storage.setItem(STORAGE_KEY+'.before-v11',previous); }
    storage.setItem(STORAGE_KEY, serializeWorld(world));
  }
  catch (error) { throw new Error(`브라우저 저장에 실패했습니다. JSON 파일로 내보내 주세요. (${error.name})`); }
}
export function loadWorld(storage) {
  const text = storage.getItem(STORAGE_KEY);
  return text ? parseWorld(text) : null;
}
export function downloadFile(name, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const fileName = name => name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 70) || '세계';
