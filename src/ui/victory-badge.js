import {filmBattlePerson} from './filming-playback.js';
import {FILM_CUTOUTS,FILM_FRAME,FILM_WREATH} from '../data/filming-art.js';
import {portraitSource,resolvedPortraitKey} from './portraits.js';
import {localImageURL} from './local-image-url.js';
import {mapAnchor} from '../model/cartography-geometry.js';
import {displayName} from './display-names.js';
import {esc} from './icons.js';
export function renderVictoryBadge(playback){
 const scene=playback.scene,meta=scene?.victoryMeta,b=playback.state?.record.battles?.[scene?.battleIndex];
 if(scene?.kind!=='apply'||scene.event?.type!=='resolve'||!meta||!b||b.automatic||!['outcome','all'].includes(playback.state.effectStage))return '';
 const side=meta.winnerSide,p=filmBattlePerson(scene.worldBefore,b,side),world=scene.worldBefore,country=world.countries.find(c=>c.id===(side==='attack'?b.actorId:b.defenderId)),key=resolvedPortraitKey(p,country,p?.role||'general'),cutout=!p?.portraitMissing&&FILM_CUTOUTS[key],image=cutout?localImageURL(cutout):portraitSource(p,country,p?.role||'general'),point=mapAnchor(world,b.territoryId,'battle');
 return `<aside class="victory-badge battlefield-honor ${cutout?'has-cutout':'has-portrait'}" data-victory-anchor="${point}" data-victory-territory="${esc(b.territoryId)}" style="--honor-frame:url('${localImageURL(FILM_FRAME)}');--honor-wreath:url('${localImageURL(FILM_WREATH)}');--honor-country:${country?.color||'#fff'}" aria-label="주요 승리"><img class="honor-hero" src="${esc(image||'')}" alt="${esc(displayName(p,b[side].name))}"><div class="honor-copy"><strong>${esc(displayName(p,b[side].name))} 승리</strong><div class="honor-laurels">${meta.upset?'<span>3배 병력 격파</span>':''}${meta.streak?`<span>${meta.end[side]}연승</span>`:''}</div><small>${b[side].army}만 vs ${b[side==='attack'?'defense':'attack'].army}만</small></div></aside>`;
}
export function placeVictoryBadge(root=globalThis.document,progress=null){
 const badge=root?.querySelector?.('.battlefield-honor');if(!badge)return;const svg=root?.querySelector?.('.atlas-map'),stage=root?.querySelector?.('.map-stage')||badge?.closest('.map-stage'),matrix=svg?.getScreenCTM?.();if(!badge||!stage||!matrix)return;
 const [x,y]=badge.dataset.victoryAnchor.split(',').map(Number),point=new DOMPoint(x,y).matrixTransform(matrix),bounds=stage.getBoundingClientRect(),left=point.x-bounds.left,top=point.y-bounds.top;
 if(Number.isFinite(progress))badge.style.opacity=String(Math.max(0,Math.min(1,progress/.125,(1-progress)/.125)));badge.style.left=left+'px';badge.style.top=(top-16)+'px';badge.classList.toggle('honor-below',top<badge.offsetHeight+24&&top<bounds.height/2);
}
