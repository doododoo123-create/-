export function renderFilmingSettings(settings){
 return `<div class="filming-settings"><label><input type="checkbox" data-film-setting="kingChoiceNormalSpeed" ${settings.kingChoiceNormalSpeed?'checked':''}> 국왕 첫 행동 1배속</label><span>촬영: 아래 역사 목록에서 원하는 턴을 체크하고 ‘선택한 턴 재생’을 누르세요.</span></div>`;
}
export function renderFilmingLayer({playback,session,cameraFollow=false,loading=false}){
 const index=session.queue.indexOf(session.turn),ended=playback.complete&&index===session.queue.length-1;
 return `<div class="selected-film-controls" aria-label="선택 턴 촬영"><strong>${session.turn}턴 · ${index+1}/${session.queue.length}${loading?' · 복원 중':ended?' · 재생 완료':''}</strong><button type="button" data-action="auto" ${loading||ended?'disabled':''}>${playback.playing?'Ⅱ 일시정지':'▶ 재생'}</button><button type="button" data-action="film-previous" ${loading||index===0?'disabled':''}>이전 선택 턴</button><button type="button" data-action="film-next" ${loading||index===session.queue.length-1?'disabled':''}>다음 선택 턴</button><label>배속 <select data-film-speed aria-label="촬영 재생 배속">${[.5,1,2,4,8,16].map(v=>`<option value="${v}" ${playback.speed()===v?'selected':''}>${v}×</option>`).join('')}</select></label><button type="button" data-action="toggle-camera-follow" aria-pressed="${cameraFollow}">시점 고정 ${cameraFollow?'켜짐':'꺼짐'}</button><button type="button" data-action="return-live">현재 경기로 돌아가기</button></div>`;
}
