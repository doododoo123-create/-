import test from 'node:test';
import assert from 'node:assert/strict';
import {guessSeaColor,recognizeLand,prepareLand,maskComponents,partitionLand,vectorizePartition} from '../src/model/map-generation.js';
import {generatedWorld,moveFreeTerritory,boundaryLinks} from '../src/model/free-map.js';
import {validateWorld} from '../src/model/world.js';
import {pointInShape,validateCartography,defaultCartography,shapeAnchor} from '../src/model/cartography.js';
import {createDemoWorld} from '../src/data/demo-world.js';
import {createRun,nextTurn,engineFor} from '../src/engine/simulation.js';
import {geometryFor,designedBorders} from '../src/ui/cartography-geometry.js';
import {serializeWorld,parseWorld} from '../src/storage/world-store.js';
const maskOf=(w,h,fn)=>Uint8Array.from({length:w*h},(_,i)=>fn(i%w,Math.floor(i/w))?1:0);
const shapeMask=()=>maskOf(48,32,(x,y)=>x>2&&x<45&&y>2&&y<29&&!(x>18&&x<28&&y>18)&&!(x>10&&x<15&&y>8&&y<13));

test('image recognition separates blue sea, green land and white mountains with deterministic edge sampling',()=>{
 const w=12,h=8,rgba=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=x>2&&x<9&&y>1&&y<6?[45,90,25]:[15,55,90];rgba.set([...c,255],(y*w+x)*4);}const sea=guessSeaColor(rgba,w,h);assert.deepEqual(sea,[15,55,90]);const a=recognizeLand(rgba,w,h,sea);assert.equal(a[4*w+5],1);assert.equal(a[0],0);assert.deepEqual(a,recognizeLand(rgba,w,h,sea));assert.throws(()=>recognizeLand([],w,h,sea));
});
test('island options preserve the mask and report impossible territory counts clearly',()=>{
 const mask=maskOf(24,16,(x,y)=>x>1&&x<12&&y>1&&y<14||x===21&&y===10||x>18&&x<23&&y>2&&y<6),copy=mask.slice();assert.equal(prepareLand(mask,24,16,0).components.length,3);assert.equal(prepareLand(mask,24,16,8).components.length,2);assert.equal(prepareLand(mask,24,16,-1).components.length,1);assert.deepEqual(mask,copy);assert.throws(()=>partitionLand(mask,24,16,1,{islandMinimum:0}),/3개/);assert.equal(partitionLand(mask,24,16,1,{islandMinimum:-1}).count,1);assert.throws(()=>partitionLand(new Uint8Array(20),5,4,2),/육지가 없습니다/);
});
test('requested count is exact, every land cell belongs to one connected province and water stays empty',()=>{
 const mask=shapeMask();for(const count of [1,2,8,40,100]){const p=partitionLand(mask,48,32,count),again=partitionLand(mask,48,32,count);assert.deepEqual(p,again);assert.equal(new Set([...p.labels].filter(n=>n>=0)).size,count);for(let id=0;id<count;id++){const region=Uint8Array.from(p.labels,n=>n===id?1:0);assert.equal(maskComponents(region,48,32).length,1);}p.labels.forEach((id,i)=>assert.equal(id>=0,!!p.mask[i]));}
});
test('vectorized regions preserve lake holes, ownership boundaries and land centers',()=>{
 const mask=shapeMask();for(const count of [1,8,40]){const p=partitionLand(mask,48,32,count),shapes=vectorizePartition(p),w=generatedWorld(createDemoWorld(),shapes,p.links,null);assert.equal(w.territories.length,count);for(let id=0;id<count;id++){assert(pointInShape(shapes[id].center,shapes[id]));assert.equal(geometryFor(w).cells[id].path.includes(' Z'),true);}
 for(let i=0;i<p.labels.length;i+=7){const point=[(i%48+.5)*1200/48,(Math.floor(i/48)+.5)*800/32],hits=shapes.flatMap((s,id)=>pointInShape(point,s)?[id]:[]);assert.deepEqual(hits,p.labels[i]<0?[]:[p.labels[i]],`pixel ${i}, count ${count}`);}
 assert.equal(designedBorders(w,geometryFor(w)).length,designedBorders(generatedWorld(createDemoWorld(),vectorizePartition(partitionLand(mask,48,32,1)),[],null),geometryFor(generatedWorld(createDemoWorld(),vectorizePartition(partitionLand(mask,48,32,1)),[],null))).length);
 }
 const one=vectorizePartition(partitionLand(mask,48,32,1))[0];assert(one.holes?.length);assert(!pointInShape([12*25,10*25],one));
});
test('raster and geometric adjacency agree; shared partial edges do not create false country borders',()=>{
 const p=partitionLand(shapeMask(),48,32,12),w=generatedWorld(createDemoWorld(),vectorizePartition(p),p.links,null);const key=p=>[...p].sort().join(':');assert.deepEqual(new Set(boundaryLinks(w).map(key)),new Set(w.cartography.links.map(key)));
 const custom={...w,territories:w.territories.slice(0,2),cartography:{...defaultCartography(),links:[],polygons:{[w.territories[0].id]:{points:[[0,0],[100,0],[100,100],[0,100]],center:[50,50]},[w.territories[1].id]:{points:[[100,0],[200,0],[200,100],[100,100],[100,50]],center:[150,50]}}}};
 assert(!designedBorders(custom,geometryFor(custom)).some(e=>/^M100,/.test(e.path)&&/ L100,/.test(e.path)));
});
test('generated map replaces only territory data, round trips and runs after countries are assigned',()=>{
 const source=createDemoWorld(),copy=structuredClone(source),p=partitionLand(shapeMask(),48,32,12),w=generatedWorld(source,vectorizePartition(p),p.links,null);assert.deepEqual(source,copy);assert.deepEqual(w.people,source.people);assert.deepEqual(w.rules,source.rules);assert(w.territories.every(t=>t.ownerId===null));assert(w.countries.every(c=>c.capitalId===null));assert.deepEqual(parseWorld(serializeWorld(w)),w);
 w.territories.forEach((t,i)=>t.ownerId=i<6?'nation-0':'nation-1');let r=createRun(validateWorld(w),123456);for(let i=0;i<16&&!r.result;i++)r=nextTurn(r);assert(engineFor(r.initialWorld).engine.validState(r.engineState));assert.equal(r.engineState.cells.length,12);
});
test('lake geometry is validated, movable and retained without sharing imported center arrays',()=>{
 const p=partitionLand(shapeMask(),48,32,1),w=generatedWorld(createDemoWorld(),vectorizePartition(p),[],null),id=w.territories[0].id,shape=w.cartography.polygons[id],moved=moveFreeTerritory(w,id,[shape.center[0]+1,shape.center[1]+1]);assert.equal(moved.cartography.polygons[id].holes[0][0][0],shape.holes[0][0][0]+1);const normalized=validateWorld(w);normalized.cartography.polygons[id].center[0]+=2;assert.notDeepEqual(normalized.cartography.polygons[id].center,shape.center);
 const bad=structuredClone(w.cartography);bad.polygons[id].holes=[[[0,0],[80,0],[80,80],[0,80]]];assert.throws(()=>validateCartography(bad,w.territories),/바다/);assert(pointInShape(shapeAnchor(shape.points,shape.holes),shape));
});
test('bad counts and small disconnected scraps never mutate the input mask',()=>{const mask=shapeMask(),before=mask.slice();for(const n of [0,481,1.5,NaN])assert.throws(()=>partitionLand(mask,48,32,n),/영토 수/);assert.deepEqual(mask,before);});
