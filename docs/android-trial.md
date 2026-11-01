# Android 시험판1

v0.46.1 게임을 포함하는 오프라인 Android WebView APK다. 패키지는 `kr.saguk.studio`, versionCode46101, 최소 Android8.0(API26), target35이며 가로 화면을 사용한다. 첫 실행에 게임을 다운로드하지 않는다.

Android 기본 SDK만 사용하며 앱 프레임워크/원격 웹사이트에 의존하지 않는다. 실행 HTML은 빌드 때 복원하여 앱에 포함한다. 게임 계산/자산/파일 형식은 원본과 같고 Android 내보내기 및 앱 전환 이벤트만 연결한다. 브라우저용 기존 HTML은 수정하지 않는다.

- `https://app.saguk.local` 고정 로컬 origin에서 APK assets를 제공하여 IndexedDB와 보안 문맥을 유지한다. 외부 리소스 요청은 차단하고 외부 링크는 시스템 브라우저로 연다.
- JSON 및 배경 이미지 불러오기는 Android 파일 선택창을 사용한다. 내보내기는 ACTION_CREATE_DOCUMENT로 사용자가 고른 URI에 기록한다. 광범위한 저장소 권한은 요청하지 않는다.
- 앱 전환은 진행/소리를 정지한다. 기존 게임의 마지막 완료 턴 자동 저장을 유지하며 미완료 연출을 완료된 것으로 저장하지 않는다.
- 뒤로가기는 열린 대화창/지도 전체화면을 먼저 닫고,기본 화면에서 앱을 뒤로 보낸다.
- 앱 저장과 HTML 브라우저 저장은 분리되어 있다. 기존 경기는 전체 역사 JSON을 내보내 앱에서 불러온다.
- 업데이트는 동일 앱 ID와 서명을 유지한다. 서명키는 저장소 밖의 전용 디렉터리에 보관하며 소스에 넣지 않는다.

## 검증

Java 컴파일·DEX 변환·Android 리소스 패키징·zipalign·APK v2/v3 서명 검사 및 ZIP 무결성 검사를 수행했다. 패키징한 게임을 네트워크 차단 Chromium에서 실행하여160영토 화면,보안 저장소,Android 내보내기 어댑터,한 턴 진행,역사 내보내기,앱 일시정지,새로고침 복원을 확인했다. 브라우저 예외0건이다.

실물 Android 또는 Android 에뮬레이터의 설치/실행,시스템 파일 선택창,기기별 성능은 아직 검증하지 못했다. 해당 APK는 시험판이다.

## 개발자 재빌드

Android SDK platform35와 build-tools35.0.0,Java21(컴파일러 모듈),Python3 및 Node22 이상이 필요하다. `ANDROID_SDK_ROOT`로 SDK 경로를 지정하고 `python scripts/build-android.py`를 실행한다. `SAGUK_SIGNING_DIR` 및 `SAGUK_APK_OUTPUT`으로 전용 서명키 디렉터리와 결과 경로를 지정할 수 있다. 서명자료를 삭제하거나 공개 저장소에 넣지 않는다. 일반 사용자는 제공 APK를 설치하면 되며 빌드를 할 필요가 없다.
