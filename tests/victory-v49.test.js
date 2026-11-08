import test from 'node:test';import assert from 'node:assert/strict';
import {TurnPlayback} from '../src/ui/playback.js';
import {renderVictoryBadge} from '../src/ui/victory-badge.js';
import {fourArmyFixture} from './studio-v41-fixture.mjs';
test('compact honor is revealed at result only, keeps readable time at16x and renders when paused',()=>{
 const f=fourArmyFixture(),b=f.record.battles[0];b.attack.army=7;b.defense.army=21;b.winner=b.actor;
 const p=new TurnPlayback({speed:()=>16,options:()=>({armyPresentation:true})});p.load(f.record,f.start.world,f.run.world,false);
 const index=p.state.scenes.findIndex(s=>s.battleIndex===0&&s.kind==='apply'&&s.event?.type==='resolve');p.state.index=index;
 p.state.effectStage=null;assert.equal(renderVictoryBadge(p),'');p.state.effectStage='outcome';assert.match(renderVictoryBadge(p),/3배 병력 격파/);assert.equal(p.effectiveSpeed,1);assert.equal(p.duration(),1200);assert(!p.playing);
 p.state.index=0;assert.equal(renderVictoryBadge(p),'');
});
