import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createContinentV31World} from '../src/scenarios/continent-v31.js';
import {atlasGeometry} from '../src/ui/atlas-cache.js';
import {buildFrontWave,frontWaveAt} from '../src/ui/front-wave.js';
import {pointInPolygon} from '../src/model/cartography.js';
import {captureFlow,captureFlowDefs} from '../src/ui/capture-transition.js';
import {MapAnimation} from '../src/ui/map-animation.js';
import {MapCamera} from '../src/ui/map-camera.js';
import {chooseRasterLevel,visibleRasterTiles,HAN_VISIBLE_BYTES} from '../src/ui/han-raster.js';
const data=JSON.parse(readFileSync(new URL('../assets/maps/han/raster.json',import.meta.url),'utf8'));
const rings=path=>[...path.matchAll(/M([^Z]+)Z/g)].map(m=>[...m[1].matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map(n=>[Number(n[1]),Number(n[2])]));
const covered=(parts,p)=>parts.reduce((v,r)=>v!==pointInPolygon(p,r),false);
test('closed front contours match the original interpolated field without triangle seams or disappearing occupied regions',()=>{
 const w=createContinentV31World(),g=atlasGeometry(w);
 for(const index of [0,80,159]){
  const id=w.territories[index].id,link=w.cartography.links.find(l=>l.includes(id)),from=link.find(v=>v!==id),m=buildFrontWave(w,g,index,from),samples=[];
  for(let y=0;y<m.rows-1;y+=2)for(let x=0;x<m.cols-1;x+=2){const a=y*m.cols+x,ids=[a,a+1,a+m.cols+1],p=[0,1].map(k=>ids.reduce((sum,i)=>sum+m.nodes[i][k]/3,0)),value=ids.reduce((sum,i)=>sum+m.distance[i]/3,0);samples.push({p,value,seen:false});}
  for(const progress of [.07,.2,.45,.7,.92]){const shape=frontWaveAt(m,progress),parts=rings(shape.fill);assert(parts.length<25);for(const sample of samples){if(Math.abs(sample.value-progress*m.maximum)<.02)continue;const inside=covered(parts,sample.p);assert.equal(inside,sample.value<progress*m.maximum,JSON.stringify({index,progress,p:sample.p}));if(sample.seen)assert(inside,'previously occupied area must remain occupied');sample.seen=inside;}}
  assert.equal(frontWaveAt(m,0).fill,'');assert.equal(frontWaveAt(m,1).fill,g.cells[index].path);assert(frontWaveAt(m,.7).fill.length<12000);
 }
});
test('capture masks are bounded to each territory and game area, retaining even-odd holes',()=>{
 const w=createContinentV31World(),g=atlasGeometry(w),capture={territoryId:w.territories[80].id,fromId:w.territories[79].id,revealing:true,sequenceCount:3,sequenceIndex:1},f=captureFlow(w,g,capture,80),html=captureFlowDefs(w,g,{captures:new Map([[capture.territoryId,capture]])});assert(f.bounds.width<1200);assert(f.bounds.height<800);assert(html.includes('clip-rule="evenodd"'));assert(!html.includes('width="3600"'));assert(html.includes('width="'+f.bounds.width+'"'));
});
test('baked art keeps original source provenance, three resolutions, overlapped local WebP tiles and an independent geometry layer',()=>{
 const source=JSON.parse(readFileSync(new URL('../assets/maps/han/manifest.json',import.meta.url))),font=readFileSync(new URL('../assets/fonts/NotoSerifKR.woff2',import.meta.url));assert.equal(data.manifest.sourceSha256,source.sourceSha256);assert.equal(data.manifest.sourceSvgSha256,source.svgSha256);assert.equal(data.manifest.fontSha256,createHash('sha256').update(font).digest('hex'));assert.equal(data.manifest.previewWidth,1536);assert.deepEqual(data.levels.map(l=>l.width),[3072,6144]);assert.equal(data.manifest.territories,160);assert.equal(data.manifest.landLinks,357);
 for(const l of data.levels){const ids=new Set();for(const t of l.tiles){assert(!ids.has(t.id));ids.add(t.id);assert(t.width<=514&&t.height<=514);assert(t.x>=0&&t.y>=0&&t.x+t.width<=l.width&&t.y+t.height<=l.height);const b=Buffer.from(t.data,'base64');assert.equal(b.subarray(0,4).toString(),'RIFF');assert.equal(b.subarray(8,12).toString(),'WEBP');}assert.equal(l.tiles.length,Math.ceil(l.width/512)*Math.ceil(l.height/512));}
 assert(!('svg' in data));assert(!('textures' in data));assert(readFileSync(new URL('../assets/maps/han/raster.json',import.meta.url)).length<8*1024*1024);
});
test('raster quality follows the viewport with a visible decoding budget and excludes offscreen tiles',()=>{
 assert.equal(chooseRasterLevel(data,[0,0,1800,1060],.8),null);const zoomed=chooseRasterLevel(data,[500,300,900,700],3);assert.equal(zoomed.width,6144);assert(visibleRasterTiles(zoomed,[500,300,900,700]).length<zoomed.tiles.length);const high=chooseRasterLevel(data,[0,0,1800,1060],8);assert.equal(high.width,3072);assert(visibleRasterTiles(high,[0,0,1800,1060]).reduce((s,t)=>s+t.width*t.height*4,0)<=HAN_VISIBLE_BYTES);
});
test('camera coalesces repeated gesture updates, preserves the zoom anchor before painting, and cancels old queued views on reset',()=>{
 const oldRaf=globalThis.requestAnimationFrame,oldCancel=globalThis.cancelAnimationFrame,oldPoint=globalThis.DOMPoint,callbacks=new Map();let seq=0;
 try{globalThis.requestAnimationFrame=fn=>{callbacks.set(++seq,fn);return seq;};globalThis.cancelAnimationFrame=id=>callbacks.delete(id);globalThis.DOMPoint=class{constructor(x,y){this.x=x;this.y=y;}matrixTransform(){return this;}};const camera=new MapCamera();let painted=0;camera.update=()=>painted++;
  camera.zoom('simulation',2,[480,320],true);const svg={getScreenCTM:()=>({inverse:()=>({})}),viewBox:{baseVal:{x:0,y:0,width:1200,height:800}}};assert.deepEqual(camera.point({clientX:480,clientY:320},svg,'simulation'),[480,320]);camera.zoom('simulation',3,[480,320],true);for(let i=0;i<80;i++)camera.queueUpdate('simulation');assert.equal(callbacks.size,1);assert.equal(painted,0);const fn=callbacks.values().next().value;callbacks.clear();fn();assert.equal(painted,1);assert.equal(camera.view('simulation').zoom,3);camera.queueUpdate('simulation');camera.resetAll();assert.equal(callbacks.size,0);assert.equal(camera.view('simulation').zoom,1);
 }finally{if(oldRaf===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=oldRaf;if(oldCancel===undefined)delete globalThis.cancelAnimationFrame;else globalThis.cancelAnimationFrame=oldCancel;if(oldPoint===undefined)delete globalThis.DOMPoint;else globalThis.DOMPoint=oldPoint;}
});

test('completed capture masks are written once while the following territory advances',()=>{
 const w=createContinentV31World(),g=atlasGeometry(w),model=buildFrontWave(w,g,80,w.territories[79].id),writes=[],wave={element:{isConnected:true,dataset:{},setAttribute:(...args)=>writes.push(args)},model,index:80,order:0,count:3,span:100,lines:[],glows:[]},animation=new MapAnimation();animation.root={isConnected:true};animation.playback={sceneProgress:.7,movementProgress:.7,scene:{kind:'capture',id:'c',battleIndex:0},state:{record:{turn:1,battles:[{takenTerritoryIds:['a','b','c']}]}}};animation.nodes={svg:null,countdowns:[],arrows:[],formations:[],armies:[],rallies:[]};animation.waves=[wave];animation.tick();animation.tick();animation.playback.sceneProgress=.8;animation.tick();assert.equal(writes.filter(([key])=>key==='d').length,1);assert.equal(wave.progress,1);
});
