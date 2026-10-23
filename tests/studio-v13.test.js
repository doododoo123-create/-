import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createContinent160World } from '../src/data/continent160-world.js';
import { CONTINENT160_CELLS } from '../src/data/continent160-map.js';
import { CONTINENT160_NAMES } from '../src/data/continent160-names.js';
import { prepareV13World } from '../src/model/world-v13.js';
import { validateWorld, clone } from '../src/model/world.js';
import { combatBonuses, ADDITIVE_COMBAT_DEFAULTS } from '../src/model/combat-rules.js';
import { createRun, nextTurn, restoreRun, engineFor } from '../src/engine/simulation.js';
import { replayTurn } from '../src/engine/replay.js';
import { makeTurnScenes } from '../src/ui/playback.js';
import { unitBattling } from '../src/ui/unit-outcomes.js';
import { renderAtlas } from '../src/ui/atlas-view.js';
import { mapEffects } from '../src/ui/map-effects.js';
import { commandCapacity } from '../src/engine/command-reform.js';
import { renderRulesEditor, rulesFromForm } from '../src/ui/rules-view.js';
import { atlasGeometry, atlasBorders } from '../src/ui/atlas-cache.js';
import { designedBorders } from '../src/model/cartography-geometry.js';

test('160 unique place names retain the original IDs, boundaries, owners and customized editor names',()=>{
 const w=createContinent160World();assert.equal(new Set(w.territories.map(t=>t.name)).size,160);assert.equal(Object.keys(CONTINENT160_NAMES).length,160);
 for(const t of w.territories){const source=CONTINENT160_CELLS.find(s=>s.id===t.id);assert.deepEqual(w.cartography.polygons[t.id].points,source.points);assert.equal(t.name,CONTINENT160_NAMES[t.id]);assert(!/\d/.test(t.name));}
 const old=clone(w);old.territories.forEach((t,i)=>t.name='영지 '+(i+1));old.territories[4].name='내가 만든 성';old.rules.experienceCap=9;old.rules.experienceWinStep=1;
 const snapshot=JSON.stringify(old),upgraded=prepareV13World(old);assert.equal(JSON.stringify(old),snapshot);assert.equal(upgraded.territories[4].name,'내가 만든 성');assert.equal(upgraded.territories[0].name,w.territories[0].name);assert.deepEqual(upgraded.cartography,old.cartography);assert.deepEqual(upgraded.territories.map(t=>t.ownerId),old.territories.map(t=>t.ownerId));assert.equal(upgraded.rules.experienceWinStep,3);assert.equal(upgraded.rules.experienceCap,3);
});
test('experience points grow only at 3/6/9 victories and stop at +3, independently of ability and command capacity',()=>{
 const r=ADDITIVE_COMBAT_DEFAULTS;
 for(const [wins,bonus]of [[0,0],[1,0],[2,0],[3,1],[5,1],[6,2],[8,2],[9,3],[10,3],[100,3]]){
  const score=combatBonuses(10,10,4,wins,'mountain',r);assert.equal(score.experienceBonus,bonus);assert.equal(score.bonus,4+8+bonus);
  assert.equal(commandCapacity({commandBonus:0,supplyBonus:0},{commandBonus:0,wins},r,7),7+bonus);
 }
 const w=createContinent160World();for(const value of [0,1.5,101]){const bad=clone(w);bad.rules.experienceWinStep=value;assert.throws(()=>validateWorld(bad));}
 const html=renderRulesEditor(w.rules);assert(html.includes('name="experienceWinStep" value="3"'));const entries=[...html.matchAll(/<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"/g)].map(m=>[m[1],m[2]]);const form=new Map(entries);assert.equal(rulesFromForm(form,w.rules).experienceWinStep,3);
});
test('only the two current duel participants gain battle borders and victory/defeat labels follow recorded results',()=>{
 let run=createRun(createContinent160World(),777),before,record;
 for(let i=0;i<40;i++){before=run.world;run=nextTurn(run);record=run.history.at(-1);if(record.battles.some(b=>!b.automatic&&b.winner!==null&&(b.losses.attack.amount+b.losses.defense.amount)>0))break;}
 const snapshot=JSON.stringify(run),battle=record.battles.find(b=>!b.automatic&&b.winner!==null&&(b.losses.attack.amount+b.losses.defense.amount)>0);assert(battle);const scenes=makeTurnScenes(record,before),scene=scenes.find(s=>s.battleIndex===battle.index&&s.event?.type==='attack_roll');assert(scene);
 const engaged=scene.worldBefore.people.filter(p=>unitBattling(scene,record,p));assert.equal(engaged.length,2);assert(engaged.some(p=>p.id===battle.attackerPersonId));assert(engaged.some(p=>p.id===battle.defenderPersonId));
 const render=s=>renderAtlas(s.worldAfter,{presentation:{record,scenes:[s],index:0,phase:'holding',speed:1,sceneProgress:.4}});
 const html=render(scene);assert.equal((html.match(/class="unit-battle-glow"/g)||[]).length,2);assert(!html.includes('>전투 발생</text>'));assert(html.includes('data-combat-side="attack"'));
 const result=scenes.find(s=>s.kind==='apply'&&s.event?.type==='resolve'&&s.battleIndex===battle.index),resolved=render(result);assert(resolved.includes('y="-46">승리</text>'));assert(resolved.includes('y="-46">패배</text>'));assert.equal((resolved.match(/class="unit-battle-glow"/g)||[]).length,1);assert(resolved.includes('unit-loss-label'));
 const settled=renderAtlas(result.worldAfter,{presentation:{record,scenes:[result],index:0,phase:'settled'}});assert(!settled.includes('unit-status-label victory'));assert(!settled.includes('unit-status-label defeat'));assert.equal(JSON.stringify(run),snapshot);
 const effects=mapEffects(result).units.filter(e=>e.type==='army');assert(effects.length);assert(effects.every(e=>e.delta<0&&e.tone==='negative'&&e.label.endsWith('만명')));
});
test('new and pre-v0.13 experience rules remain deterministic after save/restore and history playback',async()=>{
 for(const old of [false,true]){const w=createContinent160World();if(old){w.rules.experienceWinStep=1;w.rules.experienceCap=9;}
  let r=createRun(w,777);for(let i=0;i<45;i++)r=nextTurn(r);const save=JSON.parse(JSON.stringify(r));if(old){save.engineVersion='studio-v11-18';delete save.initialWorld.rules.experienceWinStep;}
  const restored=restoreRun(save);assert.equal(restored.initialWorld.rules.experienceWinStep,old?1:3);assert.equal(restored.initialWorld.rules.territoriesPerCommander,8);assert.deepEqual(nextTurn(restored).engineState,nextTurn(r).engineState);
  const replay=await replayTurn(restored,40);assert.deepEqual(replay.record.battles,r.history[39].battles);assert(engineFor(restored.initialWorld).engine.validState(restored.engineState));
 }
});
test('mobile background has the exact full-plate aspect ratio and is derived from the unchanged source artwork',()=>{
 const meta=JSON.parse(readFileSync(new URL('../assets/maps/continent_160.mobile.json',import.meta.url)));assert.equal(meta.width/meta.height,5400/3600);assert.equal(meta.sourceSha256,createHash('sha256').update(readFileSync(new URL('../assets/maps/continent_160.art.svg',import.meta.url))).digest('hex'));const raster=readFileSync(new URL('../assets/maps/continent_160.mobile.webp',import.meta.url));assert.equal(raster.toString('ascii',0,4),'RIFF');assert.equal(raster.toString('ascii',8,12),'WEBP');assert(raster.byteLength<300000);
});
test('mobile display cache reuses shared geometry while invalidating borders after capture and geometry after editing',()=>{
 const previous=globalThis.document;globalThis.document={documentElement:{dataset:{performance:'mobile'}}};
 try{
  const w=createContinent160World(),snapshot=JSON.stringify(w),g=atlasGeometry(w),edges=atlasBorders(w,g),frame={...w,countries:w.countries.map(c=>({...c,troops:c.troops+1}))};
  assert.equal(atlasGeometry(frame),g);assert.equal(atlasBorders(frame,g),edges);
  const changed={...frame,territories:frame.territories.map((t,i)=>i? t:{...t,ownerId:frame.countries.find(c=>c.id!==t.ownerId).id})};
  assert.equal(atlasGeometry(changed),g);assert.notEqual(atlasBorders(changed,g),edges);assert.deepEqual(atlasBorders(changed,g),designedBorders(changed,g));
  const edited=clone(changed);edited.cartography.polygons[edited.territories[0].id].points[0][0]+=.1;assert.notEqual(atlasGeometry(edited),g);assert.equal(JSON.stringify(w),snapshot);
 }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});
