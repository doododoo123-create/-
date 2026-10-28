import {gzipSync,gunzipSync} from 'node:zlib';
const alphabet=Array.from({length:94},(_,i)=>String.fromCharCode(i+33)).filter(c=>!['"','\\','<'].includes(c)).join('');
export function encode91(bytes){
 const out=Buffer.alloc(Math.ceil(bytes.length*16/13)+4);let at=0,b=0,n=0;
 for(const byte of bytes){
  b|=byte<<n;n+=8;
  if(n>13){let v=b&8191;if(v>88){b>>>=13;n-=13;}else{v=b&16383;b>>>=14;n-=14;}
   out[at++]=alphabet.charCodeAt(v%91);out[at++]=alphabet.charCodeAt(Math.floor(v/91));}
 }
 if(n){out[at++]=alphabet.charCodeAt(b%91);if(n>7||b>90)out[at++]=alphabet.charCodeAt(Math.floor(b/91));}
 return out.subarray(0,at).toString('ascii');
}
export function decode91(text){
 const out=Buffer.alloc(Math.ceil(text.length*14/16)+4);let at=0,b=0,n=0,v=-1;
 for(const c of text){const d=alphabet.indexOf(c);if(d<0)throw Error('Invalid standalone data');
  if(v<0)v=d;else{v+=d*91;b|=v<<n;n+=(v&8191)>88?13:14;do{out[at++]=b&255;b>>>=8;n-=8;}while(n>7);v=-1;}}
 if(v>=0)out[at++]=(b|v<<n)&255;return out.subarray(0,at);
}
export function unpackStandalone(html){
 const match=html.match(/<script id="saguk-standalone-data" type="application\/octet-stream">([^<]*)<\/script>/);
 return match?gunzipSync(decode91(match[1])).toString('utf8'):html;
}
export function packStandalone(html,mobile=false){
 const data=encode91(gzipSync(Buffer.from(html),{level:9}));
 const loader=String.raw`(async()=>{
try{
const text=document.getElementById('saguk-standalone-data').textContent;
const alphabet=Array.from({length:94},(_,i)=>String.fromCharCode(i+33)).filter(c=>!['"','\\','<'].includes(c)).join('');
const out=new Uint8Array(Math.ceil(text.length*14/16)+4);let at=0,b=0,n=0,v=-1;
for(let i=0;i<text.length;i++){const d=alphabet.indexOf(text[i]);if(d<0)throw Error('Invalid game data');if(v<0)v=d;else{v+=d*91;b|=v<<n;n+=(v&8191)>88?13:14;do{out[at++]=b&255;b>>>=8;n-=8;}while(n>7);v=-1;}}
if(v>=0)out[at++]=(b|v<<n)&255;
if(typeof DecompressionStream!=='function')throw Error('이 게임은 최신 Chrome, Edge 또는 Safari에서 실행해 주세요.');
const stream=new Blob([out.subarray(0,at)]).stream().pipeThrough(new DecompressionStream('gzip'));
const html=await new Response(stream).text();document.open();document.write(html);document.close();
}catch(error){document.getElementById('saguk-load-status').textContent='게임을 불러오지 못했습니다. '+error.message;}
})();`;
 return '<!doctype html><html lang="ko" data-performance="'+(mobile?'mobile':'normal')+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>사국쟁패 Studio v0.37.0</title></head><body style="margin:0;background:#10212a;color:#e9d4a7;display:grid;place-items:center;min-height:100vh"><p id="saguk-load-status">사국쟁패 Studio v0.37.0 · 세계를 준비하고 있습니다.</p><script id="saguk-standalone-data" type="application/octet-stream">'+data+'<'+'/script><script>'+loader+'<'+'/script></body></html>';
}
