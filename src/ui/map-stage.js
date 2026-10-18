import {renderAtlas} from './atlas-view.js';
import {renderJudgmentOverlay} from './judgment-overlay.js';
// A clean recording canvas. The persistent #app owns the browser fullscreen session.
export function renderMapStage({world,playback,speed=1,showNames=true,focusedCountry=null}) {
  const active=playback.state&&!playback.complete;
  return `<main class="map-stage simulation-page ${active&&!playback.playing?'playback-paused':''}" style="--playback-speed:${speed}" data-event="${playback.scene?.event?.type||'ready'}" data-phase="${playback.state?.phase||'ready'}" data-playing="${playback.playing}" data-finished="${playback.complete}" aria-label="지도 전체화면"><div class="map-stage-atlas">${renderAtlas(world,{observe:true,showNames,presentation:playback.state?{...playback.state,speed,movementProgress:playback.movementProgress}:null,focusedCountry})}</div>${renderJudgmentOverlay({world,playback})}<div class="map-stage-alert" role="alert" hidden></div></main>`;
}
