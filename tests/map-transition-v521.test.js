import test from 'node:test';import assert from 'node:assert/strict';
import {MapAnimation} from '../src/ui/map-animation.js';
import {fourArmyFixture} from './studio-v41-fixture.mjs';
function setup(){
 const a=new MapAnimation(),root={isConnected:true,querySelector:()=>null,querySelectorAll:()=>[]},p={scene:{id:'mass',massPlan:{}},displayWorld:fourArmyFixture().start.world,playing:false,sceneProgress:0,movementProgress:0};
 a.massBattle={canvas:{},start(_r,p){this.canvas=p.scene.massPlan?{}:null;},tick(){}};a.troops={entries:[],start(){},tick(){}};
 return {a,root,p};
}
test('camera redraw between army completion and map binding never uses old army bindings',()=>{
 const {a,root,p}=setup();a.start(root,p);p.scene={id:'map-return',kind:'focus'};let draws=0;a.onFrame=()=>draws++;
 assert.doesNotThrow(()=>a.tick());assert.equal(draws,0,'stale camera callback must not draw');
 a.start(root,p);assert.equal(draws,1);assert(Array.isArray(a.nodes.countdowns));
});
test('render invalidation blocks synchronous camera callbacks until new map bindings are ready',()=>{
 const {a,root,p}=setup();a.start(root,p);assert.equal(typeof a.beginRender,'function');a.beginRender();p.scene={id:'next-country',kind:'focus'};assert.doesNotThrow(()=>a.tick());assert.equal(a.nodes,null);a.start(root,p);assert.doesNotThrow(()=>a.tick());
});
test('same-scene camera updates still redraw a fully initialized map',()=>{
 const {a,root,p}=setup();p.scene={id:'map',kind:'focus'};a.start(root,p);let draws=0;a.onFrame=()=>draws++;a.tick();assert.equal(draws,1);
});
