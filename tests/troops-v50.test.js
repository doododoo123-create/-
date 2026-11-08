import test from 'node:test';import assert from 'node:assert/strict';
import {troopTier,troopState,renderTroopToken} from '../src/ui/troop-presentation.js';
import {troopFrame} from '../src/ui/troop-animation.js';
import {TROOP_ART} from '../src/data/troop-art.js';
import {fourArmyFixture} from './studio-v41-fixture.mjs';
import {TurnPlayback} from '../src/ui/playback.js';
import {renderVictoryBadge,placeVictoryBadge} from '../src/ui/victory-badge.js';
import {mapAnchor} from '../src/model/cartography-geometry.js';
test('three visual ranks use existing points without mutating troops, abilities or RNG',()=>{
 const f=fourArmyFixture(),r=f.start.world.rules,p={attackAbility:0,defenseAbility:0,personalAbility:0,underdogWins:0};
 assert.equal(troopTier(p,7,r),'tier1');assert.equal(troopTier(p,25,r),'tier2');assert.equal(troopTier({...p,attackAbility:2,defenseAbility:2,personalAbility:3,underdogWins:6},25,r),'tier3');
});
test('complete soldier frames cover all seven actions, loops and death fade',()=>{
 for(const tier of ['tier1','tier2','tier3'])for(const action of ['idle','walk','attack','guard','hurt','retreat','death']){const a=TROOP_ART[tier][action];assert.equal(a.durations.length,10);assert(a.body.startsWith('data:image/webp;base64,'));assert(a.shade.startsWith('data:image/webp;base64,'));}
 assert.equal(troopFrame('walk',950).frame,troopFrame('walk',50).frame);assert.equal(troopFrame('attack',9999).frame,9);assert.equal(troopFrame('death',1850).opacity,0);
});
test('recorded side, casualties, retreat and real death drive actions; ministers and empty resting units have no soldiers',()=>{
 const f=fourArmyFixture(),b=f.record.battles[0],world=f.record.frames[0].before,p=world.people.find(p=>p.id===b.attackerPersonId),c=world.countries.find(c=>c.id===p.countryId),snapshot=JSON.stringify(f.run);
 const s={worldBefore:world,battleIndex:0,kind:'roll',event:{type:'attack_roll'}};assert.equal(troopState(p,s,f.record).action,'attack');
 const loss={...s,kind:'apply',event:{type:'resolve'},effectStage:'troops'};assert.equal(troopState(p,loss,{battles:[{...b,losses:{attack:{amount:1}}}]}).action,'hurt');
 assert.equal(troopState(p,{...s,kind:'movement',moves:[{personId:p.id,kind:'retreat'}]},f.record).action,'retreat');
 assert.equal(renderTroopToken({...p,role:'minister'},c,world,s,f.record),'');assert.equal(renderTroopToken({...p,troops:0},c,world,null,f.record),'');assert(renderTroopToken(p,c,world,s,f.record).includes('data-troop-action="attack"'));assert.equal(JSON.stringify(f.run),snapshot);
});
test('honor uses the editable battlefield point and follows camera projection instead of the screen edge',()=>{
 const f=fourArmyFixture(),p=new TurnPlayback({speed:()=>16,options:()=>({armyPresentation:true})});p.load(f.record,f.start.world,f.run.world,false);
 p.state.index=p.state.scenes.findIndex(s=>s.kind==='apply'&&s.event?.type==='resolve');p.scene.victoryMeta={winnerSide:'attack',upset:true};p.state.effectStage='outcome';
 const b=f.record.battles[p.scene.battleIndex],point=mapAnchor(p.scene.worldBefore,b.territoryId,'battle'),html=renderVictoryBadge(p);
 assert(html.includes('data-victory-anchor="'+point+'"'));assert(html.includes('honor-laurels'));assert(html.includes('honor-frame'));assert.equal(p.duration(),1200);assert.equal(p.effectiveSpeed,1);
 const old=globalThis.DOMPoint;globalThis.DOMPoint=class{constructor(x,y){Object.assign(this,{x,y});}matrixTransform(m){return {x:this.x*m.a+m.e,y:this.y*m.d+m.f};}};
 try{const badge={dataset:{victoryAnchor:'100,200'},style:{},offsetHeight:200,classList:{toggle(){}}},matrix={a:2,d:2,e:10,f:20},stage={getBoundingClientRect:()=>({left:0,top:0,height:800})},svg={getScreenCTM:()=>matrix},root={querySelector:s=>s==='.battlefield-honor'?badge:s==='.atlas-map'?svg:stage};placeVictoryBadge(root);assert.equal(badge.style.left,'210px');matrix.e=40;placeVictoryBadge(root);assert.equal(badge.style.left,'240px');}finally{globalThis.DOMPoint=old;}
 p.state.effectStage='troops';assert.equal(renderVictoryBadge(p),'');
});
