import test from 'node:test';
import assert from 'node:assert/strict';
import { createReferenceWorld } from '../src/data/reference-world.js';
import { createRun,nextTurn } from '../src/engine/simulation.js';
import { validateWorld } from '../src/model/world.js';
import { serializeWorld,parseWorld } from '../src/storage/world-store.js';
import { mapAnchor } from '../src/model/cartography-geometry.js';
import { moveFreeTerritory } from '../src/model/free-map.js';
import { sceneFocus } from '../src/ui/camera-focus.js';
import { MapCamera } from '../src/ui/map-camera.js';
import { LEADER_PORTRAITS,DICE_ART } from '../src/data/studio-art.js';
import { portraitChoices,resolvedPortraitKey,portraitSource } from '../src/ui/portraits.js';
import { renderDie } from '../src/ui/die-view.js';
import { renderAtlas } from '../src/ui/atlas-view.js';
test('separate display anchors survive file round trips and movement without changing battle states or random draws',()=>{
 const original=createReferenceWorld(),w=structuredClone(original),id=w.territories[12].id,p=w.cartography.polygons[id].center;w.cartography.polygons[id].anchors={battle:[p[0]+.2,p[1]+.2],label:[Math.round((p[0]-.2)*1000)/1000,Math.round((p[1]-.2)*1000)/1000],station:[...p]};const saved=parseWorld(serializeWorld(w));assert.deepEqual(saved.cartography.polygons[id].anchors,w.cartography.polygons[id].anchors);assert.deepEqual(mapAnchor(saved,id,'battle'),[p[0]+.2,p[1]+.2]);
 let a=createRun(original,92),b=createRun(saved,92);for(let i=0;i<10;i++){a=nextTurn(a);b=nextTurn(b);assert.deepEqual(a.engineState,b.engineState);}
 const moved=moveFreeTerritory(w,id,[p[0]+1,p[1]+1]);assert.deepEqual(moved.cartography.polygons[id].anchors.battle,[Math.round((p[0]+1.2)*1000)/1000,Math.round((p[1]+1.2)*1000)/1000]);
 const bad=structuredClone(w);bad.cartography.polygons[id].anchors.battle=[0,0];assert.throws(()=>validateWorld(bad),/表示|표시 위치/);
});
test('event camera targets the configured battlefield, movement destination and capital without changing zoom or the world',()=>{
 const w=createRun(createReferenceWorld(),1).world,id=w.territories[10].id,p=w.cartography.polygons[id].center;w.cartography.polygons[id].anchors={battle:[...p]};assert.deepEqual(sceneFocus({worldBefore:w,event:{index:0},battleIndex:0},{battles:[{territoryId:id}]}),p);
 assert.deepEqual(sceneFocus({worldBefore:w,kind:'movement',moves:[{toId:id}],event:{}},{battles:[]}),mapAnchor(w,id,'station'));assert.equal(sceneFocus({worldBefore:w,kind:'summary',event:{}},{}),null);
 const previous=globalThis.document;globalThis.document={querySelectorAll:()=>[],querySelector:()=>null};try{const c=new MapCamera();c.view('simulation').zoom=2;c.keyboard({key:'ArrowRight',shiftKey:false},'simulation');assert.equal(c.view('simulation').x,635);c.keyboard({key:'ArrowDown',shiftKey:true},'simulation');assert.equal(c.view('simulation').y,505);assert.equal(c.view('simulation').zoom,2);}finally{globalThis.document=previous;}
});
test('all sixty attached dice and twenty new leader portraits are available offline, deterministic and selectable',()=>{
 assert.equal(Object.keys(DICE_ART).length,60);assert.equal(Object.keys(LEADER_PORTRAITS).length,20);assert(DICE_ART[60].includes('>60</text>'));assert.equal(portraitChoices().filter(k=>/^(king|minister)-/.test(k)).length,20);
 const w=createReferenceWorld();for(const role of ['king','minister']){const keys=w.countries.map(c=>resolvedPortraitKey(w.people.find(p=>p.countryId===c.id&&p.role===role),c,role));assert.equal(new Set(keys).size,7);assert(keys.every(k=>k.startsWith(role+'-')));}
 assert(portraitSource({portraitKey:'king-010'}).startsWith('data:image/jpeg;base64,'));assert.equal(resolvedPortraitKey({portraitKey:'general-050'},null),'general-050');
});
test('dice preserve scores above sixty and negative totals; rolling markup does not expose the pending result',()=>{
 const art=renderDie(30,30,'locked','공격',49);assert(art.includes('data-die-value="79"'));assert(art.includes('>79</span>'));assert(art.includes('custom-die-value'));
 assert(renderDie(1,10,'locked','내정',-2).includes('data-die-value="-1"'));assert(renderDie(60,60,'locked').includes('>60</text>'));
 const rolling=renderDie(18,30,'rolling');assert(rolling.includes('data-die-value=""'));assert(rolling.includes('die-art-stack'));assert(!rolling.includes('>18</span>'));
});
test('map pins show only the requested face, name, army and capped veteran stars with a location tip',()=>{
 const w=createRun(createReferenceWorld(),3).world,g=w.people.find(p=>p.role==='general'&&p.active);g.wins=9;const html=renderAtlas(w);assert(html.includes('unit-pin-tip'));assert(html.includes('★★★'));assert(html.includes('data-camp='));assert(!html.includes('map-edit-anchors'));
 const edited=renderAtlas(w,{editing:true,selected:w.territories[0].id,showUnits:false});for(const key of ['reference','label','station','battle'])assert(edited.includes(`data-map-anchor="${key}"`));
});
