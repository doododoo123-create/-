import test from 'node:test';
import assert from 'node:assert/strict';
import {createContinent160World} from '../src/data/continent160-world.js';
import {createReferenceWorld} from '../src/data/reference-world.js';
import {blankWorld,neighbors} from '../src/model/world.js';
import {geometryFor} from '../src/model/cartography-geometry.js';
import {pointInShape} from '../src/model/cartography.js';
import {createRun,nextTurn} from '../src/engine/simulation.js';
import {makeTurnScenes,TurnPlayback} from '../src/ui/playback.js';
import {applicationSteps,applicationWorld} from '../src/ui/observer-flow.js';
import {roundCampaign,completedRoundPresentation,sharedFrontSegments} from '../src/ui/round-campaign.js';
import {seasonFronts,renderSeasonFronts} from '../src/ui/season-front.js';
import {renderAtlas} from '../src/ui/atlas-view.js';
import {renderJudgmentOverlay} from '../src/ui/judgment-overlay.js';
import {mapEffects,unitFeedback} from '../src/ui/map-effects.js';
import {royalRoleForScene} from '../src/ui/royal-presentation.js';
import {mapUnitScale,duelDirection} from '../src/ui/battle-presentation.js';
const w19=createContinent160World();w19.countries.forEach(c=>c.troops=50);
let seasonRun=createRun(w19,777);const seasonFrames=[];
for(let i=0;i<8;i++){
 const before=seasonRun.world,rolls={king:i%7===4?1:10};for(let slot=0;slot<40;slot++){rolls['expedition:'+slot]=1;rolls['attack:'+slot]=i%3===1?1:30;rolls['defense:'+slot]=i%3===1?30:1;}
 seasonRun=nextTurn(seasonRun,{rolls});seasonFrames.push({before,after:seasonRun.world,record:seasonRun.history.at(-1),history:[...seasonRun.history]});
}
test('every revealed occupation survives all summaries, production, pauses and next-country transitions until the next season',()=>{
 let last=new Map(),round=1,summaries=0,production=0;
 for(const f of seasonFrames){
  const scenes=makeTurnScenes(f.record,f.before),p={record:f.record,before:f.before,scenes,roundRecords:f.history.filter(r=>r.round===f.record.round&&r.turn<f.record.turn),phase:'holding'};
  if(f.record.round!==round){last=new Map();round=f.record.round;assert.equal(scenes[0].kind,'season');assert.equal(roundCampaign(f.before,{...p,index:0}).captures.size,0);}
  for(let index=0;index<scenes.length;index++){
   const scene=scenes[index];assert.notEqual(scene.kind,'round-settle');
   for(const effectStage of scene.kind==='apply'?applicationSteps(scene,f.record):[null]){
    const world=scene.kind==='apply'?applicationWorld(scene,effectStage):scene.worldAfter,c=roundCampaign(world,{...p,index,effectStage});
    for(const [id,owner] of last)if(world.territories.find(t=>t.id===id)?.ownerId===owner)assert.equal(c.captures.get(id)?.ownerId,owner,`${f.record.turn}/${scene.id}/${effectStage}: lost ${id}`);
    if(scene.kind==='summary'){summaries++;assert.deepEqual([...c.captures],[...roundCampaign(f.after,completedRoundPresentation({history:f.history})).captures]);}
    if(scene.event?.type==='round_end'&&c.captures.size)production++;
    last=new Map([...c.captures].map(([id,v])=>[id,v.ownerId]));
   }
  }
 }
 assert(summaries===8&&production>0);
});
test('season front teeth follow only currently hostile shared edges beside revealed incidents, point inside owned land, and never change world state',()=>{
 const f=seasonFrames[5],snapshot=JSON.stringify(f.after),campaign=roundCampaign(f.after,completedRoundPresentation({history:f.history})),geometry=geometryFor(f.after),fronts=seasonFronts(f.after,geometry,campaign);
 assert(fronts.length>0);let teeth=0;
 for(const front of fronts){
  const t=f.after.territories.find(t=>t.id===front.territoryId),n=f.after.territories.find(t=>t.id===front.neighborId);assert(t.ownerId&&n.ownerId&&t.ownerId!==n.ownerId);assert(neighbors(f.after,t).some(v=>v.id===n.id));
  assert(campaign.captures.has(t.id)||campaign.battleSites.some(s=>s.territoryId===t.id));
  const shape=f.after.cartography.polygons[t.id];for(const tick of front.teeth){assert(pointInShape(tick.from,shape));assert(pointInShape(tick.to,shape));teeth++;}
 }
 assert(teeth>0);assert(renderSeasonFronts(f.after,geometry,campaign).includes('season-front-color'));assert.equal(JSON.stringify(f.after),snapshot);
 const start=seasonFrames[7],scenes=makeTurnScenes(start.record,start.before),empty=roundCampaign(start.before,{record:start.record,before:start.before,scenes,index:0,roundRecords:start.history});assert.equal(seasonFronts(start.before,geometryFor(start.before),empty).length,0);
});
test('front generation ignores same-country, neutral and graph-only links that share no physical border',()=>{
 const w=blankWorld({rows:2,cols:2});w.countries=[{id:'a',color:'#ff0000'},{id:'b',color:'#0000ff'}];w.territories.forEach(t=>t.ownerId='a');const g=geometryFor(w),c={captures:new Map([[w.territories[0].id,{}]]),battleSites:[]};
 assert.equal(seasonFronts(w,g,c).length,0);w.territories[1].ownerId=null;assert.equal(seasonFronts(w,g,c).length,0);w.territories[3].ownerId='b';assert.equal(seasonFronts(w,g,c).length,0);
 w.territories[1].ownerId='b';assert(seasonFronts(w,g,c).length>0);assert.equal(sharedFrontSegments(g,g.cells[0],g.cells[3]).length,0);
});
test('territory direction chooses left-right order only, including north-south attacks, with exactly 1.2 times former map-pin width',()=>{
 for(const [a,b,sign] of [[[0,50],[100,50],-1],[[200,50],[100,50],1],[[100,0],[100,100],-1],[[100,200],[100,100],-1]]){const d=duelDirection(a,b);assert.equal(d.x,sign);assert.equal(d.y,0);assert.equal(d.axis,'horizontal');}
 for(const zoom of [.5,1,2,5]){const width=32*zoom*mapUnitScale(zoom),old=Math.max(24,Math.min(80,32*zoom**.6));assert(Math.abs(width/old-1.2)<1e-9);}
});
test('minister has a temporary real-portrait card only during its own choices, judgments and application, never an added army or station',()=>{
 const r=createRun(createReferenceWorld(),777),n=nextTurn(r,{rolls:{king:1,minister:10,domestic:10}}),record=n.history[0],scenes=makeTurnScenes(record,r.world),snapshot=JSON.stringify(n),p=new TurnPlayback();p.load(record,r.world,n.world,false);
 for(let index=0;index<scenes.length;index++){
  const scene=scenes[index],expected=royalRoleForScene(scene,record)==='minister',html=renderAtlas(scene.worldBefore,{presentation:{record,scenes,index,phase:'holding'}});
  assert.equal(html.includes('data-unit-role="minister"'),expected);
  if(expected){const id=scene.worldBefore.people.find(p=>p.countryId===record.actorId&&p.role==='minister').id;assert(html.includes(`data-person="${id}"`));assert(!html.includes('null만'));assert(!html.includes('undefined만'));}
  p.state.index=index;p.state.phase='locked';const overlay=renderJudgmentOverlay({world:scene.worldBefore,playback:p});
  if(expected&&scene.kind!=='apply'){assert(overlay.includes('data-anchor-role="minister"'));assert(!overlay.includes('judgment-person'));}
 }
 assert.equal(JSON.stringify(n),snapshot);
});
test('army gains and upgrades are attached to each actual recipient card with precise recorded values and no detached boxes',()=>{
 const r=createRun(createReferenceWorld(),777),n=nextTurn(r,{rolls:{king:1,minister:1,domestic:10}}),record=n.history[0],scenes=makeTurnScenes(record,r.world),index=scenes.findIndex(s=>s.kind==='apply'&&s.event.type==='resolve'),scene=scenes[index],effects=mapEffects(scene),html=renderAtlas(scene.worldAfter,{presentation:{record,scenes,index,phase:'holding'}});
 const gains=effects.units.filter(e=>e.type==='army');assert(gains.length>0);assert.equal((html.match(/class="unit-feedback-text"/g)||[]).length,effects.units.length);assert(!html.includes('class="map-unit-feedback'));
 for(const e of gains){const person=scene.worldAfter.people.find(p=>p.countryId===e.countryId&&p.role===e.role&&(e.role==='king'||p.slot===e.slot));assert(unitFeedback(effects,{country:{id:e.countryId},person,role:e.role}).includes(e));assert(html.includes(`data-delta="${e.delta}"`));}
});
test('both battle results appear in the center of washed cards while each exact loss remains above and future rolls reveal no outcome',()=>{
 const f=seasonFrames[0],record=f.record,b=record.battles.find(b=>!b.automatic&&b.winner!==null);assert(b);const scenes=makeTurnScenes(record,f.before),index=scenes.findIndex(s=>s.kind==='apply'&&s.battleIndex===b.index&&s.event.type==='resolve'),html=renderAtlas(scenes[index].worldBefore,{presentation:{record,scenes,index,phase:'holding',effectStage:'outcome'}});
 assert.equal((html.match(/class="unit-result-wash"/g)||[]).length,2);assert(html.includes('y="2">승리</text>'));assert(html.includes('y="2">패배</text>'));assert(html.includes(`data-battle-loss="${b.losses.attack.amount}"`));assert(html.includes(`data-battle-loss="${b.losses.defense.amount}"`));assert(!html.includes('y="-46">승리'));
 const roll=scenes.findIndex(s=>s.event.type==='attack_roll'&&s.battleIndex===b.index),early=renderAtlas(scenes[roll].worldBefore,{presentation:{record,scenes,index:roll,phase:'rolling'}});assert(!early.includes('unit-result-wash'));assert(!early.includes('unit-loss-label'));
});
test('a same-season recapture replaces the hatch owner with the latest revealed nation and keeps the original season base color',()=>{
 const w=blankWorld({rows:2,cols:2});w.countries=[{id:'a',color:'#ff0000'},{id:'b',color:'#0000ff'}];w.people=[];w.territories.forEach((t,i)=>t.ownerId=i?'b':'a');const id=w.territories[1].id;
 const first={turn:1,round:1,actorId:'a',events:[{type:'territory',battleIndex:0,index:0},{type:'resolve',battleIndex:0,index:1}],changes:[{territoryId:id,from:'b',to:'a'}],battles:[{index:0,actorId:'a',defenderId:'b',actor:0,target:1,captureOwner:0,winner:0,fromId:w.territories[0].id,territoryId:id,takenTerritoryIds:[id],automatic:true}]};
 const second={...first,turn:2,actorId:'b',changes:[{territoryId:id,from:'a',to:'b'}],battles:[{...first.battles[0],actorId:'b',defenderId:'a',actor:1,target:0,captureOwner:1,winner:1}]},before={...w,territories:w.territories.map(t=>({...t,ownerId:t.id===id?'a':t.ownerId}))};
 const p={record:second,before,roundRecords:[first],scenes:[{kind:'summary'}],index:0},c=roundCampaign(w,p);assert.equal(c.captures.get(id).ownerId,'b');assert.equal(c.baseOwners.get(id),'b');
 p.scenes=[{kind:'focus',event:{type:'king',index:-1}}];const earlier=roundCampaign(before,p);assert.equal(earlier.captures.get(id).ownerId,'a');
});
test('restoring a completed turn without transient frames preserves all season hatches and the same battle/front locations',()=>{
 const f=seasonFrames[5],live=roundCampaign(f.after,completedRoundPresentation({history:f.history})),stored=JSON.parse(JSON.stringify(f.history));
 for(const r of stored)delete r.frames;
 const rebuilt=roundCampaign(f.after,completedRoundPresentation({history:stored}));assert.deepEqual([...rebuilt.captures],[...live.captures]);assert.deepEqual([...rebuilt.baseOwners],[...live.baseOwners]);assert.deepEqual(rebuilt.battleSites,live.battleSites);
 const g=geometryFor(f.after);assert.equal(renderSeasonFronts(f.after,g,rebuilt),renderSeasonFronts(f.after,g,live));
});
