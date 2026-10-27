import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {randomBytes} from 'node:crypto';
import {encode91,decode91,packStandalone,unpackStandalone} from '../scripts/standalone-pack.mjs';
test('offline packing round-trips binary data and uses a JSON/HTML-safe alphabet',()=>{
 for(const n of [0,1,2,3,7,255,4096,65536]){
  const source=randomBytes(n),encoded=encode91(source);
  assert(!/["\\<]/.test(encoded));assert.deepEqual(decode91(encoded),source);
 }
});
test('a standalone game opens automatically with identical inner HTML and no external requests',async()=>{
 const original='<!doctype html><html lang="ko"><head><title>사국쟁패</title></head><body>한글 테스트 ⚔<script>globalThis.gameReady=true;<'+'/script></body></html>';
 const packed=packStandalone(original);assert.equal(unpackStandalone(packed),original);
 const data=packed.match(/type="application\/octet-stream">([^<]*)<\/script>/)[1];
 const scripts=[...packed.matchAll(/<script>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,1);
 let opened=false,loaded=null,closed=false;
 const document={getElementById:()=>({textContent:data}),open:()=>{opened=true;},write:text=>{loaded=text;},close:()=>{closed=true;}};
 await vm.runInNewContext(scripts[0][1],{document,Blob,Response,DecompressionStream,Uint8Array});
 assert(opened&&closed);assert.equal(loaded,original);assert(!/<(?:link|script)[^>]+(?:src|href)=["']https?:/.test(packed));
});
