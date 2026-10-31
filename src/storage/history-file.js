import {createRun,nextTurn,removeRunLimit,restoreRun,definitionForVersion,ENGINE_VERSION} from '../engine/simulation.js';
import {replayFingerprint} from '../engine/replay.js';
import {validateWorld} from '../model/world.js';
import {checkImportSignal} from './file-reader.js';
export function plainSnapshot(value){return JSON.parse(JSON.stringify(value));}
const canonical=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
async function historyDigest(data){if(!globalThis.crypto?.subtle)return null;const {integrity,...body}=data,bytes=new TextEncoder().encode(JSON.stringify(body));return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function exportHistoryData(run){
 const data=plainSnapshot({kind:'saguk-studio-history',version:2,engineVersion:ENGINE_VERSION,seed:run.seed,world:run.initialWorld,...(run.limitRemovedAt!==undefined?{limitRemovedAt:run.limitRemovedAt}:{}),history:run.history,result:run.result,finalWorld:run.world,portraitWorld:{people:run.world.people.map(p=>({id:p.id,portraitKey:p.portraitKey,portraitMissing:p.portraitMissing}))},engineState:{...run.engineState,history:[]}}),digest=await historyDigest(data);
 if(digest)data.integrity={algorithm:'SHA-256',value:digest};return data;
}
function finalFactsMatch(imported,run){
 if(imported.result!==undefined&&canonical(imported.result)!==canonical(run.result))throw Error('역사 파일의 최종 승패가 기록과 일치하지 않습니다.');
 const final=imported.finalWorld;if(!final)return;
 for(const c of final.countries||[]){const actual=run.world.countries.find(n=>n.id===c.id);if(!actual||['troops','reserve','recruitment','supplyBonus','capitalId'].some(k=>c[k]!==undefined&&c[k]!==actual[k]))throw Error('역사 파일의 최종 국가 상태가 기록과 일치하지 않습니다.');}
 for(const t of final.territories||[]){if(run.world.territories.find(n=>n.id===t.id)?.ownerId!==t.ownerId)throw Error('역사 파일의 최종 영토가 기록과 일치하지 않습니다.');}
}
export async function prepareFileImport(data,{signal,onProgress=()=>{},yieldFrame=()=>new Promise(r=>setTimeout(r,0))}={}){
 checkImportSignal(signal);
 if(data?.kind==='saguk-studio-world'){if(![1,2].includes(data.version))throw Error('지원하지 않는 세계 파일 버전입니다.');return {kind:'world',world:validateWorld(data.world),run:null};}
 if(!['saguk-studio-history','saguk-studio-run'].includes(data?.kind))throw Error('지원하는 세계·역사·진행 저장 JSON 파일이 아닙니다.');
 if(data.kind==='saguk-studio-run'&&data.version!==1||data.kind==='saguk-studio-history'&&data.version!==undefined&&![1,2].includes(data.version))throw Error('지원하지 않는 역사 파일 버전입니다.');
 if(!Array.isArray(data.history))throw Error('역사 기록이 없습니다.');
 const initialWorld=definitionForVersion(data.world||data.initialWorld,data.engineVersion),seed=data.seed;
 const saved={...data,initialWorld};
 if(data.integrity){if(data.integrity.algorithm!=='SHA-256'||!/^[0-9a-f]{64}$/.test(data.integrity.value||''))throw Error('역사 파일의 무결성 정보가 올바르지 않습니다.');onProgress({stage:'verify',done:0,total:1});const digest=await historyDigest(data);checkImportSignal(signal);if(digest&&digest!==data.integrity.value)throw Error('역사 파일이 변경되었거나 손상되었습니다. 기존 경기는 유지합니다.');if(digest&&data.engineState){const run=restoreRun(saved);finalFactsMatch(data,run);onProgress({stage:'verify',done:1,total:1});return {kind:'history',world:run.initialWorld,run};}}
 let run=createRun(initialWorld,seed);const count=data.history.length;
 if(data.limitRemovedAt!==undefined&&(!Number.isSafeInteger(data.limitRemovedAt)||data.limitRemovedAt<0||data.limitRemovedAt>count))throw Error('진행 제한 해제 기록이 올바르지 않습니다.');
 for(let i=0;i<count;i++){
  checkImportSignal(signal);const record=data.history[i];if(record?.turn!==i+1||!Array.isArray(record.rolls)||!Array.isArray(record.events)||!Array.isArray(record.battles))throw Error('역사 기록의 차례나 판정 형식이 올바르지 않습니다.');
  if(data.limitRemovedAt===run.turn)run=removeRunLimit(run);if(run.result)throw Error('완료된 경기 뒤에 추가 기록이 있어 복원할 수 없습니다.');
  run=nextTurn({...run,history:[]},record.controls);const actual=run.history[0];if(replayFingerprint(actual)!==replayFingerprint(record))throw Error(`${i+1}차례의 주사위·전투·이동 결과가 저장된 역사와 다릅니다. 현재 경기는 유지합니다.`);
  if(i%8===0||i===count-1){onProgress({stage:'rebuild',done:i+1,total:count});await yieldFrame();}
 }
 checkImportSignal(signal);if(data.limitRemovedAt===run.turn)run=removeRunLimit(run);
 if(data.engineState&&canonical({...data.engineState,history:[]})!==canonical(run.engineState))throw Error('저장된 게임 상태가 역사 기록과 일치하지 않습니다.');
 const result=restoreRun({...saved,engineState:run.engineState});finalFactsMatch(data,result);return {kind:'history',world:result.initialWorld,run:result};
}
