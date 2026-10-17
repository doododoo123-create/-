import {findCountry,landCount} from '../model/world.js';
import {renderAtlas,renderNationCards} from './atlas-view.js';
import {renderArena} from './arena-view.js';
import {icon,esc} from './icons.js';
// The full map shares the current presentation and controls; it never advances the engine.
export function renderMapStage({world,run,playback,auto=false,speed=1,showNames=true,focusedCountry=null}) {
  const state=playback.state,active=state&&!playback.complete,running=auto||playback.playing;
  const actor=findCountry(world,active?state.record.actorId:run?.schedule[run.scheduleIndex])||world.countries.find(c=>landCount(world,c.id)>0);
  const result=run?.result&&playback.complete?run.result:null;
  const history=(run?.history||[]).filter(r=>!active||r.turn!==state.record.turn).slice(-2).reverse();
  const round=active?state.record.round:run?.round||1,turn=active?state.record.turn:run?.turn||0;
  const control=(action,label,glyph,disabled=false,style='outline')=>`<button type="button" class="button ${style}" data-action="${action}" ${disabled?'disabled':''}>${icon(glyph,15)}${label}</button>`;
  return `<main class="map-stage simulation-page ${active&&!playback.playing?'playback-paused':''}" aria-label="지도 전체화면 녹화 화면">
    <header class="map-stage-header"><div class="map-stage-title">${icon('compass',23)}<div><h1>${esc(world.name)}</h1><span>ROUND ${String(round).padStart(2,'0')} / ${world.rules.roundLimit} <i>·</i> TURN ${String(turn).padStart(3,'0')}</span></div></div><div class="map-stage-heading-status"><i class="live-indicator ${running?'pulsing':''}"></i>${result?'역사 기록 완료':running?'역사 진행 중':active?'판정 일시정지':actor?`${esc(actor.name)} 행동 대기`:'세계 준비 중'}</div>${control('map-fullscreen-close','전체화면 나가기','x')}</header>
    <div class="map-stage-layout"><section class="map-stage-canvas" aria-label="지도와 국가 현황"><div class="map-stage-atlas">${renderAtlas(world,{observe:true,showNames,presentation:state,focusedCountry})}</div><div class="map-stage-nations">${renderNationCards(world,focusedCountry)}</div></section>
    <aside class="map-stage-sidebar" aria-label="현재 인물과 판정 요약"><span class="map-stage-section-label">지금 펼쳐지는 역사</span>${renderArena({world,run,playback,showControls:false})}
      ${result?`<div class="map-stage-outcome">${icon('crown',24)}<strong>${result.winnerIds.map(id=>esc(findCountry(world,id)?.name)).join(' · ')} ${result.winnerIds.length>1?'공동 승리':'승리'}</strong><span>${result.reason==='unification'?'천하 통일':'제한 라운드 종료'}</span></div>`:''}
      ${history.length?`<section class="map-stage-chronicle" aria-label="최근 완료 사건"><h2>최근의 역사</h2>${history.map(r=>`<p><span>${String(r.turn).padStart(3,'0')}</span>${esc(r.title)}</p>`).join('')}</section>`:''}
    </aside></div>
    <footer class="map-stage-controls"><span class="map-stage-shortcuts">Space 판정 묶음 <i>·</i> Enter 한 턴 <i>·</i> Esc 닫기</span><label class="map-stage-names"><input type="checkbox" id="show-names" ${showNames?'checked':''}>영토 이름</label><label class="speed-label">배속<select id="sim-speed" aria-label="자동 진행 배속">${[.5,1,2,4].map(v=>`<option value="${v}" ${speed===v?'selected':''}>${v}×</option>`).join('')}</select></label><div class="map-stage-buttons">${control('scene-step','한 단계','chevron',!!result)}${control('step',active?'이어서 보기':'한 턴 진행','play',running||!!result)}${control('auto',running?'일시정지':'자동 진행',running?'pause':'play',!!result,'primary')}${control('scene-skip','턴 결과','arrow',!active)}</div></footer><div class="map-stage-alert" role="alert" hidden></div>
  </main>`;
}
