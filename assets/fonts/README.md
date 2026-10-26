# 내장 글꼴과 상업 이용

이 실행본의 화면 글꼴은 아래 공식 Google Fonts 저장소에서 받은 **SIL Open Font License 1.1** 글꼴을 바탕으로 만들었습니다. 수익화 유튜브 영상 녹화·상업 사용이 허용됩니다. 글꼴을 사용해 만든 영상 자체에 OFL을 적용할 필요는 없습니다. 글꼴 파일을 포함한 프로그램을 다시 배포할 때는 저작권·라이선스 고지를 함께 보존해야 합니다. 실행 HTML에 원문과 출처를 포함하고 화면 아래 ‘글꼴 라이선스’에서도 열 수 있습니다.

| 내장 이름 | 공식 원본·출처 | 준비 내용 | 라이선스 |
|---|---|---|---|
| Studio Sans | [Noto Sans KR](https://github.com/google/fonts/tree/main/ofl/notosanskr) | 원본 글자 범위, 가변 굵기 | [OFL](notosanskr-OFL.txt) |
| Studio Serif | [Noto Serif KR](https://github.com/google/fonts/tree/main/ofl/notoserifkr) | 원본 글자 범위, 굵기600 고정 | [OFL](notoserifkr-OFL.txt) |
| Studio Symbols | [Noto Sans Symbols 2](https://github.com/google/fonts/tree/main/ofl/notosanssymbols2) | 원본 기호 범위, 굵기400 | [OFL](notosanssymbols2-OFL.txt) |
| Studio Emoji | [Noto Emoji](https://github.com/google/fonts/tree/main/ofl/notoemoji) | 현재 UI의 왕관·방패에 필요한 글자만 포함 | [OFL](notoemoji-OFL.txt) |

WOFF2 변환·고정 굵기 생성·부분 글자 추출을 거쳐 내부 이름을 Studio 계열로 바꿨습니다. 원래 저작권·라이선스 정보는 보존합니다. [manifest.json](manifest.json)은 공식 출처, 원본 TTF 해시, 파생 WOFF2 해시·크기, 동봉 OFL 원문 해시를 기록합니다. 다이스의 SVG 글자도 내장 글꼴을 사용하고, 지도 그림 안의 네 영문은 같은 Serif를 윤곽선으로 변환했습니다. 사용자 원본 지도는 수정하지 않았습니다.

일반 빌드와 실행에는 Python·인터넷·설치 글꼴이 필요 없습니다. `npm run build`는 동봉된 파일의 해시를 검사하고 두 HTML에 내장합니다. 재생성할 때만 공식 TTF를 manifest의 sourceFile 이름으로 `/tmp`에 준비하고 `fonttools[woff]`를 설치한 Python에서 `python scripts/prepare-fonts.py`를 실행합니다. 지도 글자 윤곽선 재생성은 `scripts/outline-map-labels.py`, 모바일 지도 갱신은 `scripts/mobile-map.py`입니다. 원본·라이선스가 바뀌면 출처와 해시를 함께 검토합니다.

이 문서는 글꼴의 사용 조건입니다. 사용자가 추가하는 지도·초상화·음악 등의 권리까지 판정하지 않습니다.
