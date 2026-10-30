import test from 'node:test';
import assert from 'node:assert/strict';
import {AtlasFragmentCache,retainAtlasLayer,enableRetainedAtlas,atlasFragmentSource} from '../src/ui/atlas-fragments.js';
import {retainCampaignRow,campaignFragmentSource,releaseCampaignFragments} from '../src/ui/campaign-fragments.js';
import {atlasGeometry} from '../src/ui/atlas-cache.js';
import {geometryFor} from '../src/model/cartography-geometry.js';
import {createContinentV31World} from '../src/scenarios/continent-v31.js';
import {format} from '../src/ui/icons.js';
import {renderAtlas} from '../src/ui/atlas-view.js';

test('bounded layer cache compares exact source, detects edits/undo, and never reuses an evicted revision',()=>{
 const c=new AtlasFragmentCache(2),a=c.retain('a','<g>원본</g>');assert.equal(c.retain('a',a.html),a);
 const b=c.retain('a','<g>수정</g>');assert(b.revision>a.revision);const undo=c.retain('a',a.html);assert(undo.revision>b.revision);
 c.retain('b','B');c.retain('a',a.html);c.retain('c','C');assert.equal(c.get('b'),undefined);assert.equal(c.entries.size,2);assert(c.retain('b','B').revision>undo.revision);
});
test('geometry snapshots detect nested point, hole, center and order mutations without retaining editable coordinate references',()=>{
 const w=createContinentV31World(),id=w.territories[0].id,p=w.cartography.polygons[id],original=structuredClone(p);let g=atlasGeometry(w);
 const check=()=>{const n=atlasGeometry(w);assert.notEqual(n,g);assert.deepEqual(n,geometryFor({...w}));g=n;};
 p.points[0][0]+=.125;check();p.points[0][0]-=.125;check();p.holes=[[[0,0],[2,0],[2,2]]];check();p.holes[0][1][1]=.5;check();p.holes.push([[3,3],[4,3],[4,4]]);check();p.center[0]+=.1;check();w.territories.reverse();check();w.territories.reverse();w.cartography.polygons[id]=original;check();assert.equal(atlasGeometry({...w,people:[]}),g);
});
test('one shared number formatter retains all existing numeric and rounding behavior',()=>{
 const formatter=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:4});for(const n of [0,-0,1,25,100000,-12.3456789,.00001,NaN,Infinity,undefined])assert.equal(format(n),formatter.format(n));
});
test('retained SVG and completed HTML rows keep exact source out of placeholders, scope by context, and release their transient sources',()=>{
 const svg='<g class="atlas-cells"><path d="M0,0 L1,1"/></g>',row='<article class="campaign-duel" data-duel-index="9">승 42점</article>';
 assert.equal(retainAtlasLayer('simulation','cells',svg),svg);assert.equal(retainCampaignRow({battles:[{index:9}]},0,row),row);
 const w=createContinentV31World(),ordinary=renderAtlas(w);assert(ordinary.includes('class="atlas-cells"'));
 enableRetainedAtlas();const placeholder=retainAtlasLayer('simulation','cells',svg);assert(!placeholder.includes('path'));assert.equal(atlasFragmentSource({dataset:{atlasFragment:'simulation:cells'}}).html,svg);
 retainAtlasLayer('editor','cells','<g>편집</g>');assert.equal(atlasFragmentSource({dataset:{atlasFragment:'simulation:cells'}}).html,svg);
 const g={battles:[{index:9}]},slot=retainCampaignRow(g,0,row);assert(!slot.includes('42점'));const node={hasAttribute:()=>true,dataset:{campaignFragment:'0'}};assert.equal(campaignFragmentSource(node),row);releaseCampaignFragments();assert.equal(campaignFragmentSource(node),undefined);
 const rendered=renderAtlas(w);assert(rendered.includes('data-atlas-fragment="overview:cells"'));assert(!rendered.includes('class="atlas-cells"'));
});
