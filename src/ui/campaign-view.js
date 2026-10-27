import {campaignSummary} from './campaign-playback.js';
import {portraitImage} from './portraits.js';
import {displayName} from './display-names.js';
import {esc,format} from './icons.js';
export function renderCampaignOverlay({playback,inline=false}){
 const scene=playback?.scene;if(scene?.kind!=='campaign')return '';
 const info=campaignSummary(scene),end=scene.campaignPhase==='summary',approach=scene.campaignPhase==='approach';
 const country=scene.worldBefore.countries.find(c=>c.id===scene.campaign.actorId),other=scene.worldBefore.countries.find(c=>c.id===scene.campaign.opponentId);
 const title=displayName(info.representative,country?.name||'')+' 집단군',progress=playback.sceneProgress||0;
 return '<aside class="campaign-popup '+(inline?'is-inline ':'')+(end?'is-summary':'is-processing')+'" data-action="campaign-pause" data-campaign-phase="'+scene.campaignPhase+'" aria-live="polite" style="--campaign-color:'+(country?.color||'#7399ca')+'">'+
 '<header><div class="campaign-face">'+(info.representative?portraitImage(info.representative,country,info.representative.role):'⚔')+'</div><div><small>'+esc(country?.name||'')+' · '+esc(other?.name||'')+'</small><h2>'+esc(title)+'</h2><p>'+(approach?'전장 진입':end?'공세 종료':'교전 중 · '+info.completed+'회 처리')+'</p></div></header>'+
 (approach?'<div class="campaign-approaching">⚔ <span>전장에 접근하고 있습니다</span></div>':
 '<div class="campaign-counts"><strong>'+info.combats+'<small>전</small></strong><b class="is-win">'+info.wins+'<small>승</small></b><b class="is-loss">'+info.losses+'<small>패</small></b><b>'+info.draws+'<small>무</small></b></div>'+
 '<p class="campaign-participants">참전 장수 '+info.actor.length+'명 · 상대 '+info.enemy.length+'명'+(info.automatic?' · 무방비 진입 '+info.automatic+'회':'')+'</p>'+
 '<div class="campaign-casualties"><span>아군 손실 <b>−'+format(info.ownLoss)+'만</b></span><span>적군 손실 <b>−'+format(info.enemyLoss)+'만</b></span></div>'+
 (end?'<div class="campaign-territory">영토 순증 <strong>'+(info.net>0?'+':'')+info.net+'칸</strong><small>획득 '+info.gained+' · 상실 '+info.lost+'</small></div>':'')+
 info.notices.map(n=>'<p class="campaign-important">'+esc(n)+'</p>').join(''))+
 (end?'<footer><button type="button" data-action="campaign-detail" class="button outline">상세 보기</button><button type="button" data-action="campaign-continue" class="button primary">계속 ▶</button></footer><div class="campaign-countdown"><i data-campaign-countdown style="transform:scaleX('+(1-progress)+')"></i></div><small class="campaign-auto">'+(playback.playing?'자동 진행 · 누르면 잠시 멈출 수 있습니다':'일시정지 · 계속을 누르면 진행합니다')+'</small>':'')+'</aside>';
}
