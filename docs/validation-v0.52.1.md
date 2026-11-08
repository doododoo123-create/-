# v0.52.1 집단전 종료 후 지도 복귀 오류

사용자가 보고한 `nodes.countdowns is not iterable`을 v0.52.0에서 재현했다. 집단전 분기는 노드를 빈 객체로 보관했으며,다음 장면으로 전환할 때 앱의 카메라 restore/follow가 MapAnimation.start보다 먼저 동기 tick을 호출했다. 그 호출이 이전 집단전의 빈 객체를 지도 노드 목록으로 반복하면서 실패했다. 기존 검사는 주로 정지 후 수동 복귀여서 이 자동 시점 전환 경로를 놓쳤다.

## 수정

- 앱 render 시작 때 beginRender로 이전 root/playback/nodes 바인딩을 무효화한다. 새 DOM과 카메라가 준비된 뒤 start가 새 바인딩을 만든다.
- start가 현재 scene을 기록하고 tick이 다른 scene의 오래된 호출을 무시한다.
- 집단전 분기에도 countdowns/armies/rallies/formations/arrows를 빈 배열로 유지한다.
- stop은 같은 장면의 줌/팬 재그리기에 사용하므로 바인딩을 유지하며 beginRender와 구분한다. 공유 그림 캐시/전술/재생 시간/게임 RNG/병력/저장 형식은 유지한다.

## 검증

- 새 회귀 검사에서 수정 전 보고된 예외를 재현했다. 수정 후 이전 장면의 카메라 호출 무시,렌더 도중 콜백 차단,새 지도 바인딩 후 재그리기,같은 장면 줌/팬 재그리기를 확인했다.
- 관련31개 검사 통과:전환3개·집단전16개·지도/점령/카메라/화면 재사용 회귀 포함.
- 수정 JavaScript와 재현 자료 생성 스크립트 구문 검사·git diff --check 통과. 일반 단일HTML 생성 및루트/dist 바이트 일치.
- 실제 엔진에서 내보낸3개 차례의 역사를 오프라인 Chromium에서 재생했다. 시점 고정 ON/16배속에서 집단전 종료→지도 자동 복귀→2번/3번 차례 완료→방향키 이동이 통과했다. 앱 예외0이다. 가짜 시계로 진행한 기능 검사이며 FPS 측정은 아니다.

재현: `node tests/make-v52-fixtures.mjs`, `npm run build`, `python tests/map_transition_v521_smoke.py` (Playwright와 Chromium 필요).

[자동 복귀 후 화면](v521-auto-map-return.png).
