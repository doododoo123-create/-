import {FILM_CUTOUTS,FILM_FRAME,FILM_WREATH} from '../data/filming-art.js';
import {filmSummaryInfo,filmBattlePerson} from './filming-playback.js';
import {atlasGeometry} from './atlas-cache.js';
import {localImageURL} from './local-image-url.js';
import {portraitSource,resolvedPortraitKey} from './portraits.js';
import {displayName} from './display-names.js';
import {calendarAtRound} from '../model/calendar.js';
import {renderDie} from './die-view.js';
import {esc,format} from './icons.js';

const filmPhases=['situation','judgment','result','map'],phaseNames={camera:'전선 이동',situation:'상황',judgment:'판정',result:'결과',map:'지도 변화',summary:'공세 요약'};
export function filmCutout(person,country){
 const key=resolvedPortraitKey(person,country,person?.role||'general');
 return {source:!person?.portraitMissing&&FILM_CUTOUTS[key]?localImageURL(FILM_CUTOUTS[key]):portraitSource(person,country,person?.role||'general'),cutout:!person?.portraitMissing&&!!FILM_CUTOUTS[key]};
}
function filmButton(action,label,extra=''){return `<button type="button" data-action="${action}" ${extra}>${label}</button>`;}
export function renderFilmingSettings(settings){
 return `<div class="filming-settings" aria-label="촬영 설정"><label><input type="checkbox" data-film-setting="enabled" ${settings.enabled?'checked':''}> 촬영 모드</label><label><input type="checkbox" data-film-setting="kingChoiceNormalSpeed" ${settings.kingChoiceNormalSpeed?'checked':''}> 국왕 첫 행동 1배속</label>${settings.enabled?filmButton('film-open','촬영 화면 열기'):''}<span>연승·3배 병력 격파 자동 강조 · 전투 결과와 밸런스 유지</span></div>`;
}
function filmMiniMap(world,cameraBox){
 const geometry=atlasGeometry(world),colors=new Map(world.countries.map(c=>[c.id,c.color]));
 return `<aside class="film-minimap" data-film-key="minimap" aria-label="전체 지도와 촬영 위치"><svg viewBox="0 0 1200 800" role="img" aria-label="현재 전선 위치">${world.territories.map((t,i)=>`<path d="${geometry.cells[i].path}" fill="${esc(colors.get(t.ownerId)||'#54616a')}" fill-rule="evenodd" stroke="#14242b" stroke-width="3"/>`).join('')}<rect data-film-viewport x="${cameraBox[0]}" y="${cameraBox[1]}" width="${cameraBox[2]}" height="${cameraBox[3]}" fill="#e6ba5f22" stroke="#ffe6a2" stroke-width="12"/></svg><span>현재 전선</span></aside>`;
}
function filmFighter(world,b,side,scene){
 const person=filmBattlePerson(scene.worldBefore||world,b,side),country=world.countries.find(c=>c.id===(side==='attack'?b.actorId:b.defenderId)),info=b[side]||{},name=displayName(person,info.name||'방어 부대');
 const resolved=['result','map'].includes(scene.filmPhase),loss=resolved?b.losses?.[side]?.amount||0:0,start=info.army||0,after=Math.max(0,start-loss),streak=resolved?scene.filmMeta?.end?.[side]:scene.filmMeta?.start?.[side];
 const portrait=portraitSource(person,country,person?.role||'general');
 return `<article class="film-fighter ${side}" data-film-key="${side}" data-film-person="${esc(person?.id||side)}" style="--film-country:${esc(country?.color||'#a7b6ba')}"><figure>${portrait?`<img src="${esc(portrait)}" alt="${esc(name)}" width="100" height="150">`:`<span>${esc(name.slice(0,2))}</span>`}</figure><div class="film-fighter-copy"><span class="film-role">${side==='attack'?'공격':'수비'} · ${esc(country?.name||'무방비')}${streak?` · ${streak}연승`:''}</span><button type="button" data-action="focus-unit" data-id="${esc(person?.id||'')}" ${!person?'disabled':''}>${esc(name)}</button><strong class="film-troops">${format(start)}만${resolved?` <i>→</i> ${format(after)}만`:''}</strong><span class="film-loss">${resolved?`손실 −${format(loss)}만`:'교전 전 병력'}</span></div></article>`;
}
function filmDuel(world,scene,playback){
 const b=scene.filmBattle,phase=scene.filmPhase,meta=scene.filmMeta,resolved=['result','map'].includes(phase),locked=resolved||phase==='judgment'&&scene.filmJudgment==='locked',sides=b.sides||(scene.worldBefore.rules.battleMode==='additive30'?30:10);
 const scores=locked&&!b.automatic?`${b.attack.score} <span>:</span> ${b.defense.score}`:phase==='judgment'?'판정 중':'VS';
 const winner=b.winner===null?'무승부':`${b.winner===b.actor?b.attack.name:b.defense.name} 승리`;
 const scoreText=side=>`${b[side].raw} + 보정 ${b[side].bonus??b[side].score-b[side].raw} = ${b[side].score}`;
 const growth=resolved?['attack','defense'].flatMap(side=>{const p=filmBattlePerson(scene.worldBefore,b,side),n=world.people.find(v=>v.id===p?.id);return p&&n&&n.capacity>p.capacity?[`${displayName(p)} 지휘한도 +${format(n.capacity-p.capacity)}만`]:[];}).join(' · '):'';
 return `<section class="film-hud" data-film-key="hud" data-film-phase="${phase}" aria-label="전투 촬영 정보"><header><span>${esc(b.territoryName)}${scene.filmRepeat?' · 연속 교전':''}${meta?.capital?' · 수도전':''}</span><small>${phaseNames[phase]||'전투 진행'}</small>${filmButton('film-details','상세 보기')}</header><div class="film-duel">${filmFighter(world,b,'attack',scene)}<div class="film-verdict"><div class="film-score">${scores}</div><div class="film-result ${resolved?'is-revealed':''}">${resolved?(b.automatic?'무방비 영토 진입':esc(winner)):'전투 진행'}</div><div class="film-bonus">${locked&&!b.automatic?`공격 ${scoreText('attack')}<br>수비 ${scoreText('defense')}`:phase==='judgment'?'양측 주사위와 보정 판정':'병력 · 전장 확인'}</div></div>${filmFighter(world,b,'defense',scene)}</div>${phase==='judgment'&&scene.filmJudgment==='rolling'?`<div class="film-dice-pair" data-film-key="dice">${renderDie(null,sides,'rolling','공격')}${renderDie(null,sides,'rolling','수비')}</div>`:''}${growth?`<p class="film-growth">${esc(growth)}</p>`:''}<footer class="film-phase-track">${filmPhases.map(p=>`<span class="${p===phase?'active':''}">${phaseNames[p]}</span>`).join('')}<i data-film-progress></i></footer></section>`;
}
function filmReport(world,scene){
 const info=filmSummaryInfo(scene.filmSummary,world);
 return `<section class="film-hud film-report" data-film-key="hud" data-film-phase="summary" aria-label="공세 결과 요약"><header><span>${esc(scene.filmSummary.frontName||'공세')} · ${scene.filmSummary.final?'전체 결과':'구간 결과'}</span>${filmButton('film-details','상세 대결표')}</header><div class="film-report-numbers"><strong>${info.combats}전 <b>${info.wins}승 ${info.losses}패${info.draws?` ${info.draws}무`:''}</b></strong><strong>영토 <b>${info.net>0?'+':''}${info.net}</b><small>확보 ${info.gained} · 상실 ${info.lost}</small></strong><strong>병력 손실 <b>아군 ${format(info.ownLoss)}만 · 적군 ${format(info.enemyLoss)}만</b>${info.automatic?`<small>무전투 점령 ${info.automatic}회</small>`:''}</strong></div><i class="film-report-progress" data-film-progress></i></section>`;
}
function filmHighlight(world,scene){
 if(!['result','map'].includes(scene.filmPhase)||!scene.filmMeta?.highlightResult||scene.filmBattle?.automatic)return '';
 const b=scene.filmBattle,meta=scene.filmMeta,side=meta.winnerSide;if(!side)return '';
 const p=filmBattlePerson(scene.worldBefore,b,side),country=world.countries.find(c=>c.id===(side==='attack'?b.actorId:b.defenderId)),art=filmCutout(p,country);
 const badges=[...(meta.streak?[`${meta.end[side]}연승`]:[]),...(meta.upset?['3배 병력 격파']:[])];
 if(!badges.length)return '';
 return `<aside class="film-highlight ${art.cutout?'has-cutout':'has-portrait'}" data-film-key="highlight" data-film-person="${esc(p?.id||'')}" aria-label="주요 전투"><img class="film-hero" src="${esc(art.source||'')}" alt="${esc(displayName(p,b[side].name))}" width="800" height="1200"><div class="film-honor"><div>${badges.map(text=>`<span style="--film-wreath:url('${localImageURL(FILM_WREATH)}')">${esc(text)}</span>`).join('')}</div><strong>${esc(displayName(p,b[side].name))} 승리</strong><small>교전 전 ${format(b[side].army)}만 vs ${format(b[side==='attack'?'defense':'attack'].army)}만</small></div></aside>`;
}
function filmDetails(world,scene){
 const battles=scene.filmSummary?.battles||(scene.filmBattle?[scene.filmBattle]:[]);
 const resolved=!!scene.filmSummary||['result','map'].includes(scene.filmPhase);
 return `<aside class="film-details" data-film-key="details" role="dialog" aria-modal="true" aria-label="전투 상세"><header><strong>전투 상세</strong>${filmButton('film-details','닫기')}</header><div class="film-details-scroll">${battles.map(b=>`<article><h3>${esc(b.territoryName)} · ${esc(b.attack.name)} / ${esc(b.defense.name||'무방비')}</h3><p>교전 전 병력 ${format(b.attack.army)}만 / ${format(b.defense.army)}만</p>${resolved&&!b.automatic?['attack','defense'].map(side=>`<p>${side==='attack'?'공격':'수비'}: 눈금 ${b[side].raw} · 보정 ${b[side].bonus??b[side].score-b[side].raw} · 최종 ${b[side].score} · 손실 ${format(b.losses?.[side]?.amount||0)}만</p>`).join(''):'<p>판정 결과 공개 전</p>'}${resolved?`<p>${b.automatic?'무전투 진입':b.winner===null?'무승부':esc(b.winner===b.actor?b.attack.name:b.defense.name)+' 승리'}</p>`:''}</article>`).join('')||'<p>전투 장면에서 확인할 수 있습니다.</p>'}</div></aside>`;
}
export function renderFilmingLayer({world,playback,settings,cameraBox=[0,0,1200,800],replaying=false,range={},details=false}){
 const scene=playback.scene,record=playback.state?.record,calendar=calendarAtRound(record?.round||1),battle=scene?.filmBattle,phase=scene?.filmPhase;
 const hud=scene?.filmSummary?filmReport(world,scene):battle&&phase&&phase!=='camera'?filmDuel(world,scene,playback):'';
 const current=playback.state?.index||0,total=playback.state?.scenes.length||1;
 return `<div class="film-layer ${settings.clean?'is-clean':''}" data-film-key="layer" style="--film-info-scale:${settings.infoScale};--film-frame:url('${localImageURL(FILM_FRAME)}')"><div class="film-heading" data-film-key="heading"><small>${record?.turn||0}턴 · ${calendar.year}년차 · ${calendar.season}</small><strong>${esc(scene?.filmCampaign?.frontName||battle?.territoryName||'전선 관찰')}</strong><span>${phaseNames[phase]||'역사 진행'}${replaying&&!settings.clean?' · 재촬영':''}</span></div>${filmMiniMap(world,cameraBox)}${hud}${scene?filmHighlight(world,scene):''}<div class="film-toolbar" data-film-key="toolbar" aria-label="촬영 조작"><div class="film-transport">${filmButton('auto',playback.playing?'Ⅱ 정지':'▶ 재생')}<input type="range" min="0" max="${total-1}" value="${current}" data-film-seek aria-label="촬영 구간 이동"><output>${current+1} / ${total}</output></div><div class="film-edit-controls">${filmButton('film-retake-campaign','↶ 공세 다시')}${filmButton('film-retake-battle','⚔ 전투 다시')}${filmButton('film-hold','✓ 결과 유지')}${filmButton('film-save-camera','▣ 구도 저장')}${filmButton('film-mark-in','시작점')}${filmButton('film-mark-out','끝점')}${filmButton('film-play-range','▶ 구간 재생')}${replaying?filmButton('return-live','현재로'):''}${filmButton('film-clean','▣ 촬영 화면 · H')}<label>배속<select data-film-speed>${[.5,1,2,4,8,16].map(v=>`<option value="${v}" ${playback.speed()===v?'selected':''}>${v}×</option>`).join('')}</select></label><label>정보<select data-film-setting="infoScale">${[1,1.25,1.5].map(v=>`<option value="${v}" ${settings.infoScale===v?'selected':''}>${v*100}%</option>`).join('')}</select></label><label>카드<select data-film-setting="cardScale">${[1,1.25,1.5].map(v=>`<option value="${v}" ${settings.cardScale===v?'selected':''}>${v*100}%</option>`).join('')}</select></label>${filmButton('toggle-camera-follow','전선 추적 · S')}${filmButton('sound-settings','소리')}${filmButton('film-disable','촬영 끄기')}</div><small>${range.start!==undefined?`선택 구간 ${range.start+1} → ${(range.end??current)+1} · `:''}H: 조작부 숨김/표시 · A: 재생/정지 · S: 전선 추적</small></div>${details&&scene?filmDetails(world,scene):''}</div>`;
}
export function refreshFilmingProgress(root,playback,cameraBox){
 const progress=Number.isFinite(playback.sceneProgress)?playback.sceneProgress:1;
 for(const el of root.querySelectorAll('[data-film-progress]'))el.style.transform=`scaleX(${progress})`;
 const rect=root.querySelector('[data-film-viewport]');if(rect&&cameraBox)for(const [i,key] of ['x','y','width','height'].entries())rect.setAttribute(key,String(cameraBox[i]));
 const slider=root.querySelector('[data-film-seek]');if(slider&&globalThis.document?.activeElement!==slider)slider.value=String(playback.state?.index||0);
}
export function refreshFilmingLayout(root){
 const layer=root.querySelector('.film-layer'),hud=layer?.querySelector('.film-hud');
 if(layer&&hud){const bounds=hud.getBoundingClientRect();layer.style.setProperty('--film-hud-clearance',`${Math.max(0,globalThis.innerHeight-bounds.top)+24}px`);}
}
