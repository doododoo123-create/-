import { ENGINE_VERSION,restoreRun } from '../engine/simulation.js';
export const RUN_STORAGE_KEY='saguk-studio.completed-run.v11';
export function saveRun(storage,run){
  const data={kind:'saguk-studio-run',version:1,engineVersion:ENGINE_VERSION,seed:run.seed,initialWorld:run.initialWorld,engineState:{...run.engineState,history:[]},history:run.history};
  try{storage.setItem(RUN_STORAGE_KEY,JSON.stringify(data));}catch{throw new Error('완료된 턴 자동 저장에 실패했습니다. 전체 역사 기록을 파일로 내보내 주세요.');}
}
export function loadRun(storage){const raw=storage.getItem(RUN_STORAGE_KEY);if(!raw)return null;let data;try{data=JSON.parse(raw);}catch{throw new Error('실행 저장 파일을 읽을 수 없습니다.');}if(data.kind!=='saguk-studio-run'||data.version!==1)throw new Error('지원하지 않는 실행 저장 버전입니다.');return restoreRun(data);}
export function clearRun(storage){storage.removeItem(RUN_STORAGE_KEY);}
