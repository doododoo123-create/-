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
test('all original body poses fit the non-overlapping grid and canvas sizing follows zoom and screen density even at a paused frame',()=>{
 for(const n of [1,2,3,6,12,24]){const g=troopGrid(n);assert.equal(g.positions.length,n);for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const a=g.positions[i],b=g.positions[j];assert(Math.abs(a.x-b.x)>=70||Math.abs(a.y-b.y)>=60);}}
 assert.deepEqual(troopCanvasSize(120,100,1,1),{width:120,height:100});assert.deepEqual(troopCanvasSize(120,100,3,2),{width:720,height:600});
});
