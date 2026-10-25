# 사국쟁패 — 고전 전략 효과음 v2

기본 효과음 **36종을 모두 새로 제작**하고 주사위 변형 **6종을 추가**했습니다.
총 **42종**, MP3·OGG 두 형식입니다. 같은 ID의 v1 효과음도 소리는 모두 새 버전입니다.

압축을 모두 푼 뒤 **preview.html**을 열어 미리 들어보세요.
상단 **주사위 4종 비교**에서 기본·짧은 나무판·다른 굴림·천 깐 판을 차례로 들을 수 있습니다.

## 이번 음색

마른 목재와 장기말, 종이·가죽 마찰, 절제된 가죽 북, 거친 금속 충돌,
낮은 징과 바람으로 구성했습니다. 음정이 올라가는 성공 알림, 전자음,
멜로디·화음·통통 튀는 음색 대신 재질의 짧은 접촉과 군례의 울림을 사용했습니다.
주사위는 컵 안의 불규칙한 충돌 → 나무판 착지 → 간격이 짧아지는 튀김 → 잔구름 순서입니다.
실물 녹음이나 기존 게임 음원을 사용하지 않고 직접 합성했습니다.

## 파일 구성

- `audio/mp3/`: MP3 42개. 112 kbps / 44.1 kHz / 스테레오.
- `audio/ogg/`: OGG Vorbis 42개. q3 / 44.1 kHz / 스테레오.
- 두 폴더는 같은 소리의 다른 형식입니다. 게임에는 지원하는 한 형식만 넣어도 됩니다.
- `preview.html`: 별도 설치·인터넷 없이 여는 미리듣기 페이지.
- `manifest.json`: 용도, 권장 볼륨, 재생 간격, 우선순위, 원본 해시.
- `soundpack.js`, `soundpack-data.js`: 게임 연결용 선택 사용 플레이어.
- `rebuild_audio.py`: 42종을 새로 합성하는 Python 소스.
- `LICENSE_사용안내.txt`: 상업적 사용·수정·배포 안내, 출처 표기 요구 없음.
- `SHA256SUMS.json`: 완성 MP3·OGG의 무결성 확인용 해시.

## 주사위 선택

| ID | 용도 |
| --- | --- |
| `dice_roll` | 가죽 컵에 흔든 뒤 나무판에 던지는 기본 굴림 |
| `dice_roll_wood_short` | 컵 없이 바로 구르는 짧은 판정 |
| `dice_roll_wood_alt` | 기본과 번갈아 쓰는 불규칙한 다른 굴림 |
| `dice_roll_cloth` | 천을 깐 판에서 구르는 부드러운 대안 |
| `dice_cup_shake` | 컵 안에서 흔드는 부분만 |
| `dice_drop_single` | 한 알만 던지는 짧은 효과 |
| `dice_settle` | 잔구름 마무리 부분만 |
| `dice_tick` | 한 번의 작은 충돌; 회전 연출 시 최대 초당 약 10번 |
| `dice_land` | 최종 눈금에 맞추는 마지막 착지 |

`dice_roll`에는 마지막 잔구름도 들어 있습니다. 전체 굴림과 dice_tick을
동시에 재생하면 주사위가 너무 많아진 듯 들리므로 둘 중 하나를 쓰세요.
전체 굴림 바로 뒤에는 dice_land를 생략해도 됩니다. 화면 판정이 짧으면
오디오 재생 속도를 올리기보다 dice_roll_wood_short로 교체하세요.

## 게임 v25 적용

기존 기본 36종의 ID·상대 경로를 유지해서 기존 soundpack 목록을 교체하기 편하게 했습니다.
이 ZIP에는 원본 게임을 넣지 않았으며 게임 이벤트와 효과음은 별도로 연결해야 합니다.

| 게임 장면 | 효과음 | 연결 시점 |
| --- | --- | --- |
| 주사위 roll/reel | dice_roll 또는 short | phase=rolling에 처음 들어갈 때 |
| 원래 눈금 공개 | dice_land | phase=raw 또는 보정 없는 locked; 선택 사용 |
| 보정 합산 | bonus_add / bonus_penalty | merging의 mergeIndex가 바뀔 때 |
| 점수 확정 | score_lock | locked 최초 진입 |
| 출정·이동 | army_march | movement 장면 시작 한 번 |
| 전투 결과 | battle_victory / defeat / draw | resolve 결과에 맞춰 한 종류만 |
| 영토 점령 | territory_capture | 소유 확정 시 한 번 |
| 수도 함락 / 국가 멸망 | capital_fall / country_eliminated | 멸망과 겹치면 중요 결과 한 종류만 |
| 모병·충원·보급 | recruit / production / supply | 성공한 작업에 맞게 한 종류만 |
| 내정 결과 | domestic_success / failure | 세부 작업음 대신 쓸 수 있는 공통 알림 |
| 장군 임명 / 전사 | general_appointed / general_fallen | appointment / death 확정; death_roll 도중 생략 |
| 계절 | season_spring / summer / autumn / winter | seasonIndex 0~3, 계절 등장 최초 한 번 |
| 저장 / 통일 | save / campaign_complete | 성공 시 한 번 |

`onChange`나 프레임마다 소리를 호출하지 마세요. `record.turn + scene.id + phase +
mergeIndex/effectStage` 등으로 재생한 순간을 기억하면 일시정지·재개 때의 중복도 막습니다.
매우 빠른 모드에서는 굴림·보정·행군을 생략하고 최종 점수·전사·멸망 같은 결과만 사용하세요.

## 플레이어 예시

오디오 폴더와 두 JS를 게임 HTML 옆에 둡니다. 상대 경로 음원을 사용하므로
게임을 다른 사람에게 보낼 때 폴더도 함께 보내야 합니다.

```html
<script src="soundpack-data.js"></script>
<script src="soundpack.js"></script>
<script>
const sfx = new SagukSoundPack(SAGUK_SOUNDS, {base: '.', volume: 0.6});
// 첫 재생은 사용자 클릭 안에서 호출하세요.
// sfx.play('dice_roll');
// sfx.play('battle_victory');
// sfx.setMuted(true);
// sfx.stop(); // 일시정지·탐색 때
</script>
```

기본 플레이어는 동시 재생 4개, 동일 음원의 재생 간격 제한, 중요 이벤트 우선 재생을 지원합니다.
미리듣기는 슬라이더 볼륨만 적용합니다. 실제 게임에서는 전역 volume과 음원별 volume을 곱해
더 낮게 재생하며 시작 전역 볼륨 40~60%를 권장합니다. 짧은 조작음은 작게 사용하세요.

## 전체 목록

| 파일 ID | 이름 | 길이(초) | 소리·용도 |
| --- | --- | ---: | --- |
| `ui_click` | 목패 클릭 | 0.120 | 마른 나무 명령패를 살짝 놓는 소리 |
| `ui_confirm` | 명령패 확정 | 0.320 | 탁자 위에 명령패를 단단히 놓기 |
| `ui_cancel` | 명령 취소 | 0.190 | 목패를 거두는 짧은 스침과 탁음 |
| `panel_open` | 두루마리 펼침 | 0.550 | 종이를 펴는 바스락 소리 |
| `panel_close` | 두루마리 접기 | 0.440 | 종이를 접고 가볍게 내려놓기 |
| `map_select` | 지도 위 말 놓기 | 0.130 | 지도에 작은 장기말을 얹는 소리 |
| `dice_tick` | 주사위 한 번 구름 | 0.065 | 짧고 건조한 주사위 모서리 충돌 |
| `dice_roll` | 주사위 굴림 · 기본 | 2.050 | 컵 안에서 흔든 뒤 나무판에 던져 구르고 멎기 |
| `dice_land` | 주사위 마지막 착지 | 0.280 | 최종 눈금 공개용 짧은 착지; 전체 굴림 뒤에는 선택 사용 |
| `bonus_add` | 보정패 가산 | 0.180 | 점수패를 더하는 목재 접촉음 |
| `bonus_penalty` | 보정패 감산 | 0.220 | 점수패를 거두는 스침과 둔탁한 클릭 |
| `score_lock` | 점수 낙인 | 0.360 | 인장을 탁 찍어 최종 점수 확정 |
| `turn_start` | 군령 시작 | 1.000 | 절제된 북 한 타와 명령패 |
| `season_spring` | 봄 · 깃발과 바람 | 1.700 | 가벼운 바람과 천이 펄럭이는 소리 |
| `season_summer` | 여름 · 군영의 북 | 1.700 | 절제된 가죽 북과 군영의 바람 |
| `season_autumn` | 가을 · 낙엽 스침 | 1.800 | 종이처럼 마른 잎과 바람의 마찰음 |
| `season_winter` | 겨울 · 낮은 바람 | 2.000 | 차분한 저역 바람과 멀리 울리는 북 |
| `army_march` | 갑옷 행군 | 1.650 | 흙을 밟는 발·가죽·작은 쇠 마찰 |
| `attack_whoosh` | 칼을 휘두름 | 0.520 | 공기와 천을 가르는 짧은 마찰 |
| `sword_clash` | 쇠붙이 맞부딪침 | 0.780 | 조밀하고 거친 금속 충돌·짧은 잔향 |
| `battle_impact` | 전열 충돌 | 1.100 | 방패·가죽·쇠가 한 번 무겁게 부딪힘 |
| `battle_victory` | 승전 북과 징 | 2.400 | 짧은 승전 북 세 타와 넓은 청동 울림 |
| `battle_defeat` | 패전의 낮은 울림 | 2.200 | 낮은 북과 무겁게 잦아드는 청동 울림 |
| `battle_draw` | 교착·정지 | 0.900 | 울림을 누른 북과 목재 탁음 |
| `territory_capture` | 깃발 꽂기 | 1.150 | 깃발 천이 펼쳐지고 말뚝이 단단히 박힘 |
| `capital_fall` | 성문 함락 | 2.500 | 큰 목재 충격과 무거운 북·징의 여운 |
| `country_eliminated` | 국가 멸망 | 2.800 | 한 번 울리는 낮은 청동판과 잦아드는 북 |
| `recruit` | 모병 군령 | 1.020 | 훈련용 북 두 타와 군령패 |
| `production` | 충원 장부 정리 | 0.850 | 장부 위 목패와 자루를 다루는 소리 |
| `supply` | 보급품 내려놓기 | 0.950 | 가죽 자루와 나무 상자를 내려놓는 소리 |
| `domestic_success` | 내정 승인 | 0.870 | 문서에 인장을 찍고 작은 북 한 타 |
| `domestic_failure` | 내정 실패·출정 거부 | 0.560 | 문서를 거두고 명령패를 내려놓기 |
| `general_appointed` | 장군 임명 | 1.550 | 군령패 수여와 절제된 북·갑옷 마찰 |
| `general_fallen` | 장군 전사 | 2.500 | 먹먹한 북 한 타와 낮은 청동 잔향 |
| `save` | 장부 저장 | 0.510 | 종이를 넘기고 도장을 한 번 찍기 |
| `campaign_complete` | 천하통일 군례 | 3.450 | 다섯 번의 군례 북과 넓고 긴 징의 울림 |
| `dice_roll_wood_short` | 주사위 · 짧은 나무판 | 1.120 | 컵 없이 곧바로 굴림; 빠른 판정용 |
| `dice_roll_wood_alt` | 주사위 · 나무판 다른 굴림 | 2.120 | 기본 굴림과 충돌 간격이 다른 변형 |
| `dice_roll_cloth` | 주사위 · 천 깐 판 | 1.900 | 천을 깐 판에 던져 한층 낮고 부드럽게 구름 |
| `dice_cup_shake` | 주사위 · 가죽 컵 흔들기 | 1.150 | 던지기 없이 컵 안에서만 달그락거림 |
| `dice_drop_single` | 주사위 · 한 알 떨어뜨리기 | 0.650 | 단일 주사위가 짧게 튀고 멎기 |
| `dice_settle` | 주사위 · 잔구름 마무리 | 0.380 | 최종 판정 직전 작은 연속 충돌 |
