// Recording preferences affect presentation only, and are captured once for
// the selected-turn queue. Ordinary observation/history playback stays intact.
export function selectedBattleOptions(session){
 return {massBattleMapOnly:session?.film===true&&session.massBattlePresentation===false};
}
export function renderSelectedBattleMode(settings){
 return `<label class="selected-battle-mode" title="끄면 전술창을 건너뛰고 지도에서 이동·퇴각·점령 결과를 재생합니다."><input type="checkbox" data-selected-battle-mode ${settings.massBattlePresentation!==false?'checked':''}> 집단군 전술화면</label>`;
}
