import {STORAGE_KEY} from './world-store.js';
import {RUN_STORAGE_KEY,clearRun} from './run-store.js';
import {saveStoredWorld,cancelWorldSave} from './world-archive.js';
import {saveCompletedRun,cancelArchivedSave} from './run-archive.js';
import {checkImportSignal} from './file-reader.js';
// A file is fully prepared before touching storage; memory/UI changes happen in the caller afterwards.
export async function commitFileImport(storage,prepared,{signal}={}){
 checkImportSignal(signal);cancelArchivedSave();cancelWorldSave();
 const previousWorld=storage.getItem(STORAGE_KEY),previousRun=storage.getItem(RUN_STORAGE_KEY);
 try{await saveStoredWorld(storage,prepared.world,{signal,retainPrevious:true});checkImportSignal(signal);if(prepared.run)await saveCompletedRun(storage,prepared.run);else clearRun(storage);checkImportSignal(signal);}
 catch(error){cancelArchivedSave();cancelWorldSave();try{storage.removeItem(STORAGE_KEY);storage.removeItem(RUN_STORAGE_KEY);if(previousWorld!==null)storage.setItem(STORAGE_KEY,previousWorld);if(previousRun!==null)storage.setItem(RUN_STORAGE_KEY,previousRun);}catch{throw Error('불러오기를 중단했습니다. 기존 화면의 경기는 유지되지만 자동 저장 정보를 복구하지 못했습니다. 현재 경기를 파일로 내보내 주세요.');}throw error;}
}
