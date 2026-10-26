export const importAborted=()=>new DOMException('불러오기를 취소했습니다.','AbortError');
export function checkImportSignal(signal){if(signal?.aborted)throw importAborted();}
async function readFileJson(file,progress,signal){
 const parts=[],decoder=new TextDecoder();let loaded=0;
 if(file.stream){const reader=file.stream().getReader(),abort=()=>{void reader.cancel();};signal?.addEventListener('abort',abort,{once:true});try{for(;;){checkImportSignal(signal);const {value,done}=await reader.read();if(done)break;parts.push(decoder.decode(value,{stream:true}));loaded+=value.byteLength;progress(loaded,file.size);}}finally{signal?.removeEventListener('abort',abort);reader.releaseLock();}parts.push(decoder.decode());}
 else parts.push(await file.text());
 checkImportSignal(signal);progress(file.size,file.size);try{return JSON.parse(parts.join(''));}catch{throw Error('JSON 파일을 읽을 수 없습니다. 내보낸 세계·역사 파일을 선택해 주세요.');}
}
export async function readImportFile(file,{signal,onProgress=()=>{}}={}){
 checkImportSignal(signal);if(!file)throw Error('불러올 파일을 선택해 주세요.');
 // Parsing runs outside the drawing thread when supported; there is no file-size gate.
 if(typeof Worker==='undefined')return readFileJson(file,(done,total)=>onProgress({stage:'read',done,total}),signal);
 const code=`const checkImportSignal=()=>{};const readFileJson=${readFileJson.toString()};onmessage=async e=>{try{const data=await readFileJson(e.data,(done,total)=>postMessage({progress:{stage:'read',done,total}}));postMessage({data});}catch(error){postMessage({error:error.message});}};`,url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));let worker;
 try{worker=new Worker(url);}catch{URL.revokeObjectURL(url);return readFileJson(file,(done,total)=>onProgress({stage:'read',done,total}),signal);}
 return new Promise((resolve,reject)=>{const finish=(error,data)=>{signal?.removeEventListener('abort',abort);worker.terminate();URL.revokeObjectURL(url);error?reject(error):resolve(data);},abort=()=>finish(importAborted());signal?.addEventListener('abort',abort,{once:true});worker.onmessage=e=>{if(e.data.progress)onProgress(e.data.progress);else if(e.data.error)finish(Error(e.data.error));else finish(null,e.data.data);};worker.onerror=()=>finish(Error('파일을 읽지 못했습니다. JSON 형식과 브라우저의 남은 메모리를 확인해 주세요.'));worker.postMessage(file);if(signal?.aborted)abort();});
}
