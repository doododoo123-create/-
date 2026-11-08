import test from 'node:test';import assert from 'node:assert/strict';
import {TROOP_BODY_HEIGHT,TROOP_FOOT_Y,COMMANDER_SCALE,COMMANDER_LIFT,commanderTransform,troopPositions,TROOP_FOOTPRINT} from '../src/ui/troop-layout.js';
import {renderAtlas} from '../src/ui/atlas-view.js';
import {fourArmyFixture} from './studio-v41-fixture.mjs';
import {TurnPlayback} from '../src/ui/playback.js';
test('compact soldiers retain their ground pin with a 75 percent caption above their bodies',()=>{
 assert.equal(TROOP_BODY_HEIGHT,54*.75);assert.equal(TROOP_FOOT_Y,35);assert.equal(COMMANDER_SCALE,.75);
 const top=TROOP_FOOT_Y-292/224*TROOP_BODY_HEIGHT,bottom=COMMANDER_LIFT+35*COMMANDER_SCALE;assert(bottom<TROOP_FOOT_Y-TROOP_BODY_HEIGHT-4);
 assert.equal(commanderTransform(),'translate(0,-36) scale(0.75)');assert(TROOP_FOOTPRINT>=4);
 for(const count of [1,2,3]){const xs=troopPositions(count);assert.equal(xs.length,count);assert.equal(xs.reduce((a,b)=>a+b,0),0);}
});
test('raised commander captions preserve original content, nation, status, group companions and authoritative data',()=>{
 const f=fourArmyFixture(),snapshot=JSON.stringify(f.run),p=new TurnPlayback({options:()=>({armyPresentation:true,compactCampaigns:true})});p.load(f.record,f.start.world,f.run.world,false);
 p.state.index=p.state.scenes.findIndex(s=>s.kind==='army-forming');const html=renderAtlas(p.displayWorld,{presentation:p.state});
 assert(html.includes('class="commander-caption" transform="'+commanderTransform()+'"'));assert(html.includes('class="army-companion-caption"'));assert(html.includes('token-army-caption'));assert(html.includes('data-action="focus-unit"'));assert(html.includes('data-troop-width="'));assert(html.includes('token-copy'));assert.equal(JSON.stringify(f.run),snapshot);
});
