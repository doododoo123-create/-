import {serializeWorld,loadWorld,saveWorld,STORAGE_KEY} from './world-store.js';
import {validateWorld} from '../model/world.js';
import {checkImportSignal} from './file-reader.js';
let worldEpoch=0,worldDb=null;
export function cancelWorldSave(){worldEpoch++;}
async function openWorldDb(){if(!globalThis.indexedDB)throw Error('이 브라우저에서 큰 세계 저장소를 사용할 수 없습니다.');if(!worldDb)worldDb=new Promise((resolve,reject)=>{const r=indexedDB.open('saguk-studio-worlds',1);r.onupgradeneeded=()=>r.result.createObjectStore('worlds');r.onsuccess=()=>resolve(r.result);r.onerror=r.onblocked=()=>reject(Error('세계 저장소를 열지 못했습니다.'));}).catch(e=>{worldDb=null;throw e;});return worldDb;}
function worldTransaction(db,mode,work){return new Promise((resolve,reject)=>{const tx=db.transaction('worlds',mode);let value;try{value=work(tx.objectStore('worlds'));}catch(e){tx.abort();reject(e);return;}tx.oncomplete=()=>resolve(typeof value==='function'?value():value);tx.onerror=tx.onabort=()=>reject(Error('세계 저장소 쓰기·읽기에 실패했습니다.'));});}
export async function loadStoredWorld(storage){const raw=storage.getItem(STORAGE_KEY);if(!raw)return null;const pointer=JSON.parse(raw);if(pointer.kind!=='saguk-studio-world-archive')return loadWorld(storage);if(pointer.version!==1||typeof pointer.id!=='string')throw Error('세계 저장 정보가 올바르지 않습니다.');const db=await openWorldDb(),data=await worldTransaction(db,'readonly',s=>{const r=s.get(pointer.id);return ()=>r.result;});if(!data)throw Error('저장한 세계를 읽지 못했습니다. 기존 저장 정보는 유지했습니다.');return validateWorld(data);}
export async function saveStoredWorld(storage,world,{signal,retainPrevious=false}={}){
 const epoch=++worldEpoch,text=serializeWorld(world);checkImportSignal(signal);
 if(text.length<=512*1024){try{saveWorld(storage,world);if(!retainPrevious)void pruneStoredWorlds(storage,epoch).catch(()=>{});return;}catch{/* Large worlds and low local quota use IndexedDB. */}}
 const id=crypto.randomUUID(),db=await openWorldDb();checkImportSignal(signal);if(epoch!==worldEpoch)return;
 await worldTransaction(db,'readwrite',s=>s.put(JSON.parse(text).world,id));checkImportSignal(signal);if(epoch!==worldEpoch)return;
 storage.setItem(STORAGE_KEY,JSON.stringify({kind:'saguk-studio-world-archive',version:1,id}));if(!retainPrevious)void pruneStoredWorlds(storage,epoch).catch(()=>{});
}
export async function pruneStoredWorlds(storage,epoch=worldEpoch){if(!globalThis.indexedDB)return;const db=await openWorldDb();if(epoch!==worldEpoch)return;const raw=storage.getItem(STORAGE_KEY),pointer=raw?JSON.parse(raw):null;await worldTransaction(db,'readwrite',s=>{const keys=s.getAllKeys();keys.onsuccess=()=>{if(epoch!==worldEpoch)return;for(const key of keys.result)if(key!==pointer?.id)s.delete(key);};});}
