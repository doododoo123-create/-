import { runSaveData,saveRun,loadRun,RUN_STORAGE_KEY } from './run-store.js';
import { ENGINE_VERSION,restoreRun } from '../engine/simulation.js';
const ARCHIVE_CHUNK=128,ARCHIVE_THRESHOLD=300,LOCAL_CHARACTER_LIMIT=512*1024;
let archiveDatabase=null,archiveQueue=Promise.resolve(),archiveEpoch=0;
const archiveSessions=new WeakMap();
function openRunArchive(){
 if(archiveDatabase)return archiveDatabase;
 if(!globalThis.indexedDB?.open)return Promise.reject(Error('이 브라우저에서 큰 역사 저장소를 사용할 수 없습니다. 전체 역사를 파일로 내보내 주세요.'));
 archiveDatabase=new Promise((resolve,reject)=>{let failed=false;const request=indexedDB.open('saguk-studio-history',1);request.onupgradeneeded=()=>{request.result.createObjectStore('metadata');request.result.createObjectStore('chunks');};request.onsuccess=()=>{const db=request.result;if(failed){db.close();return;}db.onversionchange=()=>{db.close();archiveDatabase=null;};resolve(db);};request.onerror=()=>reject(Error('장기 역사 저장소를 열지 못했습니다. 기존 기록을 유지하고 전체 역사를 파일로 내보내 주세요.'));request.onblocked=()=>{failed=true;reject(Error('장기 역사 저장소가 다른 창에서 사용 중입니다. 다른 창을 닫고 다시 저장해 주세요.'));};}).catch(error=>{archiveDatabase=null;throw error;});return archiveDatabase;
}
function archiveTransaction(db,mode,work){return new Promise((resolve,reject)=>{const tx=db.transaction(['metadata','chunks'],mode);let value;try{value=work(tx);}catch(error){tx.abort();reject(error);return;}tx.oncomplete=()=>resolve(typeof value==='function'?value():value);tx.onerror=tx.onabort=()=>reject(Error('장기 역사 저장에 실패했습니다. 전체 역사를 파일로 내보내 주세요.'));});}
export function cancelArchivedSave(){archiveEpoch++;}
export function saveCompletedRun(storage,run){
 const epoch=archiveEpoch;
 let session=archiveSessions.get(run.initialWorld);
 if(!session&&run.history.length<=ARCHIVE_THRESHOLD){
  const value=JSON.stringify(runSaveData(run));
  if(value.length<=LOCAL_CHARACTER_LIMIT){try{storage.setItem(RUN_STORAGE_KEY,value);return Promise.resolve();}catch{/* Promote immediately when the small store rejects even a short history. */}}
 }
 if(!session){session={id:crypto.randomUUID(),saved:0};archiveSessions.set(run.initialWorld,session);}
 // Only compact enumerable records are retained. Intermediate scene frames are reconstructed on demand.
 const count=run.history.length,from=session.namespaced?Math.floor(session.saved/ARCHIVE_CHUNK):0,end=Math.ceil(count/ARCHIVE_CHUNK),chunks=[];
 for(let i=from;i<end;i++)chunks.push([i,run.history.slice(i*ARCHIVE_CHUNK,(i+1)*ARCHIVE_CHUNK).map(record=>({...record}))]);
 const metadata={kind:'saguk-studio-run',version:1,engineVersion:ENGINE_VERSION,seed:run.seed,initialWorld:run.initialWorld,portraitWorld:{people:run.world.people.map(p=>({id:p.id,portraitKey:p.portraitKey,portraitMissing:p.portraitMissing}))},engineState:{...run.engineState,history:[]},...(run.limitRemovedAt!==undefined?{limitRemovedAt:run.limitRemovedAt}:{}),count,id:session.id,namespaced:true};
 const job=async()=>{
  if(epoch!==archiveEpoch)return;const db=await openRunArchive();if(epoch!==archiveEpoch)return;
  await archiveTransaction(db,'readwrite',tx=>{for(const [key,value] of chunks)tx.objectStore('chunks').put(value,[session.id,key]);tx.objectStore('metadata').put(metadata,session.id);});
  if(epoch!==archiveEpoch)return;try{storage.setItem(RUN_STORAGE_KEY,JSON.stringify({kind:'saguk-studio-run-archive',version:2,id:session.id,count}));}catch(cause){throw Error('역사는 큰 저장소에 기록했지만 자동 저장 정보를 갱신하지 못했습니다. 전체 역사를 파일로 내보내 주세요.',{cause});}session.saved=count;session.namespaced=true;
 };
 const result=archiveQueue.then(job);archiveQueue=result.catch(()=>{});return result.catch(error=>{if(epoch!==archiveEpoch)return;if(!session.saved&&count<=ARCHIVE_THRESHOLD){try{saveRun(storage,run);archiveSessions.delete(run.initialWorld);return;}catch{}}throw error;});
}
export async function loadCompletedRun(storage){
 const raw=storage.getItem(RUN_STORAGE_KEY);if(!raw)return null;let pointer;try{pointer=JSON.parse(raw);}catch{return loadRun(storage);}
 if(pointer.kind!=='saguk-studio-run-archive')return loadRun(storage);
 if(![1,2].includes(pointer.version)||typeof pointer.id!=='string'||!Number.isSafeInteger(pointer.count)||pointer.count<0)throw Error('장기 역사 저장 정보가 올바르지 않습니다.');
 const db=await openRunArchive(),data=await archiveTransaction(db,'readonly',tx=>{let meta;const parts=[];const read=key=>{const request=tx.objectStore('metadata').get(key);request.onsuccess=()=>{meta=request.result;if(!meta&&key!=='current'){read('current');return;}if(!meta||meta.id!==pointer.id||meta.count<pointer.count)return;for(let i=0;i<Math.ceil(meta.count/ARCHIVE_CHUNK);i++){const part=tx.objectStore('chunks').get(meta.namespaced?[meta.id,i]:i);part.onsuccess=()=>parts[i]=part.result;}};};read(pointer.id);return ()=>({meta,parts});});
 const {meta,parts}=data;if(!meta||meta.id!==pointer.id||meta.count<pointer.count||parts.some(part=>!Array.isArray(part)))throw Error('장기 역사 기록을 읽지 못했습니다. 기존 저장은 보존했습니다.');
 const history=parts.flat();if(history.length!==meta.count)throw Error('장기 역사 기록의 차례 수가 일치하지 않습니다.');const restored=restoreRun({...meta,history});archiveSessions.set(restored.initialWorld,{id:meta.id,saved:meta.count,namespaced:!!meta.namespaced});return restored;
}

// Called only after a successful import/boot, never while rollback may need the old run.
export async function pruneArchivedRuns(storage){
 const epoch=archiveEpoch,raw=storage.getItem(RUN_STORAGE_KEY),pointer=raw?JSON.parse(raw):null;if(!globalThis.indexedDB)return;
 const db=await openRunArchive();if(epoch!==archiveEpoch)return;
 await archiveTransaction(db,'readwrite',tx=>{let legacy;const old=tx.objectStore('metadata').get('current');old.onsuccess=()=>{legacy=old.result;const meta=tx.objectStore('metadata').getAllKeys(),chunks=tx.objectStore('chunks').getAllKeys();meta.onsuccess=()=>{if(epoch!==archiveEpoch)return;for(const key of meta.result)if(key!==pointer?.id&&!(key==='current'&&legacy?.id===pointer?.id))tx.objectStore('metadata').delete(key);};chunks.onsuccess=()=>{if(epoch!==archiveEpoch)return;for(const key of chunks.result)if(Array.isArray(key)?key[0]!==pointer?.id:legacy?.id!==pointer?.id)tx.objectStore('chunks').delete(key);};};});
}
