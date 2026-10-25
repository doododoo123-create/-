import { saveRun,loadRun,RUN_STORAGE_KEY } from './run-store.js';
import { ENGINE_VERSION,restoreRun } from '../engine/simulation.js';
const ARCHIVE_CHUNK=128,ARCHIVE_THRESHOLD=300;
let archiveDatabase=null,archiveQueue=Promise.resolve(),archiveEpoch=0;
const archiveSessions=new WeakMap();
function openRunArchive(){
 if(archiveDatabase)return archiveDatabase;
 archiveDatabase=new Promise((resolve,reject)=>{const request=indexedDB.open('saguk-studio-history',1);request.onupgradeneeded=()=>{request.result.createObjectStore('metadata');request.result.createObjectStore('chunks');};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('장기 역사 저장소를 열지 못했습니다.'));});return archiveDatabase;
}
function archiveTransaction(db,mode,work){return new Promise((resolve,reject)=>{const tx=db.transaction(['metadata','chunks'],mode);let value;try{value=work(tx);}catch(error){tx.abort();reject(error);return;}tx.oncomplete=()=>resolve(typeof value==='function'?value():value);tx.onerror=tx.onabort=()=>reject(Error('장기 역사 저장에 실패했습니다. 전체 역사를 파일로 내보내 주세요.'));});}
export function cancelArchivedSave(){archiveEpoch++;}
export function saveCompletedRun(storage,run){
 const epoch=archiveEpoch;
 if(run.history.length<=ARCHIVE_THRESHOLD){saveRun(storage,run);return Promise.resolve();}
 let session=archiveSessions.get(run.initialWorld);if(!session){session={id:crypto.randomUUID(),saved:0};archiveSessions.set(run.initialWorld,session);}
 // Only compact enumerable records are retained. Intermediate scene frames are reconstructed on demand.
 const count=run.history.length,from=Math.floor(session.saved/ARCHIVE_CHUNK),end=Math.ceil(count/ARCHIVE_CHUNK),chunks=[];
 for(let i=from;i<end;i++)chunks.push([i,run.history.slice(i*ARCHIVE_CHUNK,(i+1)*ARCHIVE_CHUNK).map(record=>({...record}))]);
 const metadata={kind:'saguk-studio-run',version:1,engineVersion:ENGINE_VERSION,seed:run.seed,initialWorld:run.initialWorld,engineState:{...run.engineState,history:[]},count,id:session.id};
 const job=async()=>{
  if(epoch!==archiveEpoch)return;const db=await openRunArchive();if(epoch!==archiveEpoch)return;
  await archiveTransaction(db,'readwrite',tx=>{if(!session.saved)tx.objectStore('chunks').clear();for(const [key,value] of chunks)tx.objectStore('chunks').put(value,key);tx.objectStore('metadata').put(metadata,'current');});
  if(epoch!==archiveEpoch)return;storage.setItem(RUN_STORAGE_KEY,JSON.stringify({kind:'saguk-studio-run-archive',version:1,id:session.id,count}));session.saved=count;
 };
 const result=archiveQueue.then(job);archiveQueue=result.catch(()=>{});return result;
}
export async function loadCompletedRun(storage){
 const raw=storage.getItem(RUN_STORAGE_KEY);if(!raw)return null;let pointer;try{pointer=JSON.parse(raw);}catch{return loadRun(storage);}
 if(pointer.kind!=='saguk-studio-run-archive')return loadRun(storage);
 if(pointer.version!==1||typeof pointer.id!=='string'||!Number.isSafeInteger(pointer.count)||pointer.count<1)throw Error('장기 역사 저장 정보가 올바르지 않습니다.');
 const db=await openRunArchive(),data=await archiveTransaction(db,'readonly',tx=>{let meta;const parts=[];const request=tx.objectStore('metadata').get('current');request.onsuccess=()=>{meta=request.result;if(!meta||meta.id!==pointer.id||meta.count<pointer.count)return;for(let i=0;i<Math.ceil(meta.count/ARCHIVE_CHUNK);i++){const part=tx.objectStore('chunks').get(i);part.onsuccess=()=>parts[i]=part.result;}};return ()=>({meta,parts});});
 const {meta,parts}=data;if(!meta||meta.id!==pointer.id||meta.count<pointer.count||parts.some(part=>!Array.isArray(part)))throw Error('장기 역사 기록을 읽지 못했습니다. 기존 저장은 보존했습니다.');
 const history=parts.flat();if(history.length!==meta.count)throw Error('장기 역사 기록의 차례 수가 일치하지 않습니다.');const restored=restoreRun({...meta,history});archiveSessions.set(restored.initialWorld,{id:meta.id,saved:meta.count});return restored;
}
