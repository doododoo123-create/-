import test from 'node:test';import assert from 'node:assert/strict';
import {troopCount,troopGroups,renderTroopToken} from '../src/ui/troop-presentation.js';
import {troopGrid,troopCanvasSize} from '../src/ui/troop-layout.js';
import {fourArmyFixture} from './studio-v41-fixture.mjs';
function canvasData(html){return JSON.parse(html.match(/data-troop-soldiers="([^"]+)"/)[1].replaceAll('&quot;','"').replaceAll('&amp;','&'));}
test('garrison and real army retain each commanders soldier count, tier and identity without recalculating from the combined army',()=>{
 const f=fourArmyFixture(),w=f.start.world,ps=w.people.filter(p=>p.countryId==='a'&&p.role==='general'&&p.active).slice(0,3).map((p,i)=>({...p,troops:[8,7,20][i]})),c=w.countries[0],markers=ps.map(person=>({person,country:c,territory:w.territories[0]}));
 const groups=troopGroups(markers,null),g=groups.get(ps[0].id),html=renderTroopToken(ps[0],c,w,null,f.record,g),soldiers=canvasData(html);assert.equal(soldiers.length,2+1+3);
 for(const p of ps)assert.equal(soldiers.filter(s=>s.personId===p.id).length,troopCount(p.troops));assert.equal(renderTroopToken(ps[1],c,w,null,f.record,g),'');
 const army=troopGroups([markers[0]],null,new Map([[ps[0].id,{members:ps}]]));assert.equal(canvasData(renderTroopToken(ps[0],c,w,null,f.record,army.get(ps[0].id))).length,6);
 const moving=troopGroups(markers,{kind:'movement',moves:[{personId:ps[0].id}]});assert.equal(moving.get(ps[0].id).members.length,1);assert.equal(moving.get(ps[1].id).members.length,2);
 const enemy={...markers[2],country:{...c,id:'other'},person:{...ps[2],countryId:'other'}};assert.notEqual(troopGroups([markers[0],enemy],null).get(ps[0].id),troopGroups([markers[0],enemy],null).get(ps[2].id));
});
test('dense ranks retain all figures and full pose padding while zoom and screen density remain adaptive',()=>{
 // Original full-pose bounds including mirrored weapons, at 40.5-unit body height.
 for(const n of [1,2,3,6,12,24]){
  const g=troopGrid(n);assert.equal(g.positions.length,n);
  for(const p of g.positions){const x=g.width/2+p.x,y=g.height-10+p.y;assert(x-27.303>=0&&x+27.303<=g.width);assert(y-41.586>=0&&y+.543<=g.height);}
  if(n>1)assert(g.positions[1].x-g.positions[0].x<=18);
  if(n>4)assert(Math.abs(g.positions[4].y-g.positions[0].y)<=28);
 }
 // Ranks stay compact even with mixed attacks; a spear's outer silhouette may overlap.
 const idle=troopGrid(12,[{action:'idle'}]),attack=troopGrid(12,[{action:'attack'}]);
 assert.deepEqual(idle,attack);assert(idle.pitch<30.38);assert(idle.width<4*36+24);
 assert.deepEqual(troopCanvasSize(120,100,1,1),{width:120,height:100});assert.deepEqual(troopCanvasSize(120,100,3,2),{width:720,height:600});
});
