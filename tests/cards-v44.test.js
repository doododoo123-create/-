import test from 'node:test';
import assert from 'node:assert/strict';
import {ARMY_CARD_SCALE,ARMY_HEADER_HEIGHT,armyLeaderTransform} from '../src/ui/army-presentation.js';
import {armySafeTranslation} from '../src/ui/army-camera.js';
import {fourArmyFixture} from './studio-v41-fixture.mjs';
import {TurnPlayback} from '../src/ui/playback.js';
import {renderAtlas} from '../src/ui/atlas-view.js';
import {renderCampaignOverlay} from '../src/ui/campaign-view.js';
test('army body scales by1.4 around the same pin; its title remains in the same button above the unchanged portrait/name/army rows',()=>{
 assert.equal(ARMY_CARD_SCALE,1.4);assert.equal(ARMY_HEADER_HEIGHT,8);assert.equal(armyLeaderTransform(),'translate(0,-14) scale(1.4)');assert.equal(armyLeaderTransform(1),'translate(0,0) scale(1)');
 const x=fourArmyFixture(),p=new TurnPlayback({options:()=>({compactCampaigns:true,armyPresentation:true})});p.load(x.record,x.start.world,x.run.world,false);p.state.index=p.state.scenes.findIndex(s=>s.campaignPhase==='dice');const before=JSON.stringify(x.run),html=renderAtlas(p.displayWorld,{presentation:p.state});assert(html.includes('scale(1.4)'));assert(!html.includes('scale(1.7)'));assert(html.includes('width="32" height="66"'));assert(html.includes('<span class="token-army-caption">집단군</span><span class="token-portraits">'));assert(!html.includes('<span class="token-copy"><span class="token-army-caption">'));
 const overlay=renderCampaignOverlay({playback:p});for(const g of p.scene.campaign.defenseMetadata)assert(overlay.includes(g.id));assert(overlay.includes('data-map-army-primary="'+p.scene.campaign.assemblyMetadata.id+'"'));assert.equal(JSON.stringify(x.run),before);
});
test('army framing translates the camera below the current pane and is stable once the same card bounds are placed',()=>{
 for(const [width,height,paneBottom,armyHeight] of [[1600,1000,427,140],[1280,720,427,160],[900,600,350,180]]){
  const view={left:0,right:width,top:0,bottom:height},pane={bottom:paneBottom},army={left:100,right:400,top:80,bottom:80+armyHeight,height:armyHeight},delta=armySafeTranslation(view,pane,army);assert(army.top+delta.y>=pane.bottom+18);assert(army.bottom+delta.y<=height-12);assert.equal((army.left+army.right)/2+delta.x,width/2);const placed={...army,left:army.left+delta.x,right:army.right+delta.x,top:army.top+delta.y,bottom:army.bottom+delta.y};assert.deepEqual(armySafeTranslation(view,pane,placed),{x:0,y:0});
 }
});
