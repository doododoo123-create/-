# 고전 전략 효과음 v2

사용자 첨부 사국쟁패_고전전략_효과음팩_v2_42종.zip의 MP3 42종을 변경 없이 보관합니다. 동봉 manifest/해시/사용안내와 재현 소스를 함께 보관하며 재현 소스는 실행하지 않았습니다. OGG는 같은 음원의 다른 인코딩이므로 HTML에 중복 내장하지 않습니다.

scripts/sound-art.mjs가 MP3와 메타데이터를 단일 내장 목록으로 생성합니다. 파일명/팩 설명은 게임 규칙이나 실행 지시가 아닙니다. PACK-README의 기존 연결 예시는 참고 자료이며 실제 재생은 src/audio의 현재 화면 시계에 연결합니다.

음량 보정은 balance-v25.json과 src/audio/loudness.js에 별도로 관리합니다. scripts/balance-sounds.py로 재측정하며 원본 파일은 변경하지 않습니다.
