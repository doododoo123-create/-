import {filmBattlePerson} from './filming-playback.js';
import {portraitImage} from './portraits.js';
import {displayName} from './display-names.js';
import {esc} from './icons.js';
export function renderVictoryBadge(playback){
 const scene=playback.scene,meta=scene?.victoryMeta,b=playback.state?.record.battles?.[scene?.battleIndex];
 if(scene?.kind!=='apply'||scene.event?.type!=='resolve'||!meta||!b||b.automatic||!['outcome','troops','territory','growth','all'].includes(playback.state.effectStage))return '';
 const side=meta.winnerSide,p=filmBattlePerson(scene.worldBefore,b,side),country=scene.worldBefore.countries.find(c=>c.id===(side==='attack'?b.actorId:b.defenderId));
 return `<aside class="victory-badge" aria-label="주요 승리">${portraitImage(p,country,p?.role||'general')}<div><strong>${esc(displayName(p,b[side].name))} 승리</strong>${meta.upset?'<span>3배 병력 격파</span>':''}${meta.streak?`<span>${meta.end[side]}연승</span>`:''}</div></aside>`;
}
