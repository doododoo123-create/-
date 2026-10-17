import test from 'node:test';import assert from 'node:assert/strict';
import {createDemoWorld} from '../src/data/demo-world.js';import {createRun,nextTurn} from '../src/engine/simulation.js';
import {saveRun,loadRun,RUN_STORAGE_KEY} from '../src/storage/run-store.js';
import {saveWorld,loadWorld,STORAGE_KEY} from '../src/storage/world-store.js';
const storage=()=>{const map=new Map();return {setItem:(k,v)=>map.set(k,v),getItem:k=>map.get(k)||null,removeItem:k=>map.delete(k)};};
test('completed turn save resumes the exact original RNG and unit state',()=>{
 const s=storage();let r=createRun(createDemoWorld(),123456);for(let i=0;i<14;i++)r=nextTurn(r);
 saveRun(s,r);const restored=loadRun(s);assert.deepEqual(restored.engineState,r.engineState);assert.deepEqual(restored.history,JSON.parse(JSON.stringify(r.history)));
 assert.deepEqual(nextTurn(restored).referenceRecord,nextTurn(r).referenceRecord);
 const data=JSON.parse(s.getItem(RUN_STORAGE_KEY));data.engineState.countries[0].generals[0].troops=-1;s.setItem(RUN_STORAGE_KEY,JSON.stringify(data));assert.throws(()=>loadRun(s),/상태/);
});
test('old Studio worlds retain edits, gain v11 traits and back up the original browser save',()=>{
 const s=storage(),w=createDemoWorld();w.schemaVersion=1;w.id='seven-realms-grid-demo';w.name='사용자 편집 세계';w.people[0].name='바꾼 이름';w.people=w.people.filter(p=>p.role!=='general'||p.slot<Math.ceil(w.territories.filter(t=>t.ownerId===p.countryId).length/4));
 const raw=JSON.stringify({kind:'saguk-studio-world',version:1,world:w});s.setItem(STORAGE_KEY,raw);
 const upgraded=loadWorld(s);assert.equal(upgraded.name,w.name);assert.equal(upgraded.people[0].name,'바꾼 이름');assert.equal(upgraded.schemaVersion,2);assert.equal(upgraded.people.length,49);assert.equal(upgraded.mapKind,'v11');saveWorld(s,upgraded);assert.equal(s.getItem(STORAGE_KEY+'.before-v11'),raw);
});
test('failed migration backup never overwrites an existing old browser world',()=>{
 const s=storage(),w=createDemoWorld();w.schemaVersion=1;
 const raw=JSON.stringify({kind:'saguk-studio-world',version:1,world:w});s.setItem(STORAGE_KEY,raw);
 const upgraded=loadWorld(s),safe={getItem:s.getItem,setItem:(key,value)=>{if(key.endsWith('.before-v11'))throw new DOMException('full','QuotaExceededError');s.setItem(key,value);}};
 assert.throws(()=>saveWorld(safe,upgraded),/파일로 내보내/);assert.equal(s.getItem(STORAGE_KEY),raw);
});
