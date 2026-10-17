"""Optional end-to-end checks: start npm start, then python3 tests/browser_smoke.py.
Requires the Python playwright package and a local Chromium installation.
No browser download or external site is required.
"""
from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / '.artifacts'
ARTIFACTS.mkdir(exist_ok=True)
results, errors = [], []

def passed(name):
    results.append(name)
    print('PASS:', name, flush=True)

with sync_playwright() as p:
    executable = os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium')
    browser = p.chromium.launch(executable_path=executable, headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('dialog', lambda dialog: dialog.accept())
    page.goto(os.environ.get('STUDIO_TEST_URL', 'http://127.0.0.1:3000'), wait_until='networkidle')
    expect(page.locator('h1')).to_have_text('세계 개요')
    assert page.locator('.territory').count() == 80
    page.screenshot(path=str(ARTIFACTS / 'overview-desktop.png'), full_page=True)
    passed('기본 세계: 7개 국가·36명·80개 영토 렌더링, 화면 오류 없음')

    page.locator('nav [data-page="countries"]').click()
    page.locator('[data-action="add-country"]').first.click()
    dialog = page.locator('#editor-dialog')
    dialog.locator('[name="name"]').fill('테스트 신국')
    dialog.locator('[name="troops"]').fill('23')
    dialog.locator('[name="recruitment"]').fill('2')
    dialog.locator('[name="personality"]').select_option('aggressive')
    dialog.locator('button[type="submit"]').click()
    expect(page.locator('.country-card')).to_have_count(8)
    card = page.locator('.country-card').filter(has_text='테스트 신국')
    card.locator('[data-action="edit-country"]').first.click()
    dialog.locator('[name="name"]').fill('수정 신국')
    dialog.locator('button[type="submit"]').click()
    expect(page.locator('.country-card').filter(has_text='수정 신국')).to_have_count(1)
    page.screenshot(path=str(ARTIFACTS / 'countries-desktop.png'), full_page=True)
    passed('국가 추가·이름/병력/충원/성향 수정')

    page.locator('nav [data-page="people"]').click()
    page.locator('[data-action="add-person"]').click()
    dialog.locator('[name="name"]').fill('새 장군')
    nation_id = page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.world.v1')).world.countries.at(-1).id")
    dialog.locator('[name="countryId"]').select_option(nation_id)
    dialog.locator('[name="ability"]').fill('3')
    dialog.locator('button[type="submit"]').click()
    page.locator('#person-search').fill('새 장군')
    expect(page.locator('.person-card')).to_have_count(1)
    page.locator('.person-card [data-action="edit-person"]').first.click()
    dialog.locator('[name="name"]').fill('수정 장군')
    dialog.locator('button[type="submit"]').click()
    page.locator('#person-search').fill('수정 장군')
    expect(page.locator('.person-card h2')).to_have_text('수정 장군')
    page.locator('#person-search').fill('')
    page.locator('#person-role-filter').select_option('king')
    expect(page.locator('.person-card')).to_have_count(7)
    page.locator('[data-action="add-person"]').click()
    dialog.locator('[name="name"]').fill('중복 국왕')
    dialog.locator('[name="role"]').select_option('king')
    dialog.locator('button[type="submit"]').click()
    expect(page.locator('#dialog-error')).to_contain_text('1명만')
    assert dialog.evaluate('(el) => el.open')
    dialog.locator('[data-action="close-dialog"]').first.click()
    passed('인물 추가·수정·검색·필터 및 중복 국왕 입력 방지')

    page.locator('nav [data-page="map"]').click()
    page.locator('[data-territory="tile-0"]').click()
    page.locator('#territory-form [name="name"]').fill('새 수도')
    page.locator('#territory-form [name="ownerId"]').select_option(nation_id)
    page.locator('#territory-form button[type="submit"]').click()
    expect(page.locator('[data-territory="tile-0"]')).to_have_attribute('title', '새 수도 · 수정 신국')
    page.locator('[data-action="paint-mode"]').click()
    page.locator('#paint-owner').select_option(nation_id)
    page.locator('[data-territory="tile-1"]').click()
    expect(page.locator('[data-territory="tile-1"]')).to_have_attribute('title', '운원 · 수정 신국')
    page.locator('#show-names').uncheck()
    expect(page.locator('.territory-grid')).to_have_class('territory-grid hide-names')
    page.locator('#show-names').check()
    page.screenshot(path=str(ARTIFACTS / 'map-editor-desktop.png'), full_page=True)
    passed('영토 이름·소유권 편집, 빠른 칠하기, 이름 표시 설정')

    page.reload(wait_until='networkidle')
    expect(page.locator('[data-territory="tile-0"]')).to_have_attribute('title', '새 수도 · 수정 신국')
    exported = ARTIFACTS / 'roundtrip.world.json'
    with page.expect_download() as download_info:
        page.locator('[data-action="export"]').click()
    download_info.value.save_as(str(exported))
    data = json.loads(exported.read_text())
    assert data['world']['territories'][0]['name'] == '새 수도'
    assert len(data['world']['countries']) == 8
    before = page.evaluate("localStorage.getItem('saguk-studio.world.v1')")
    page.locator('#world-file').set_input_files({'name': 'broken.json', 'mimeType': 'application/json', 'buffer': b'{invalid'})
    expect(page.locator('#toast')).to_contain_text('JSON 파일을 읽을 수 없습니다')
    assert page.evaluate("localStorage.getItem('saguk-studio.world.v1')") == before
    page.locator('#world-file').set_input_files(str(exported))
    expect(page.locator('#toast')).to_contain_text('모두 불러왔습니다')
    expect(page.locator('[data-territory="tile-0"]')).to_have_attribute('title', '새 수도 · 수정 신국')
    passed('새로고침 복구·세계 파일 왕복·잘못된 파일의 덮어쓰기 방지')

    page.locator('nav [data-page="countries"]').click()
    page.locator('.country-card').filter(has_text='수정 신국').locator('[data-action="delete-country"]').click()
    expect(page.locator('.country-card')).to_have_count(7)
    world = page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.world.v1')).world")
    assert world['territories'][0]['ownerId'] is None
    assert next(person for person in world['people'] if person['name'] == '수정 장군')['countryId'] is None
    page.locator('nav [data-page="people"]').click()
    page.locator('#person-search').fill('수정 장군')
    page.locator('.person-card [data-action="delete-person"]').click()
    expect(page.locator('.person-card')).to_have_count(0)
    passed('국가 삭제 시 영토 무주지 전환·인물 보존, 인물 삭제')

    page.locator('nav [data-page="rules"]').click()
    page.locator('[name="roundLimit"]').fill('2')
    page.locator('#rules-form button[type="submit"]').click()
    expect(page.locator('#toast')).to_contain_text('규칙을 저장')
    page.locator('nav [data-page="simulation"]').click()
    page.locator('#sim-seed').fill('ui-test')
    page.locator('[data-action="step"]').click()
    expect(page.locator('.history-entry')).to_have_count(1)
    expect(page.locator('.round-display>strong')).to_have_text('01')
    page.locator('[data-action="scene-skip"]').click()
    page.locator('#sim-speed').select_option('4')
    page.locator('[data-action="auto"]').click()
    expect(page.locator('[data-action="auto"]')).to_contain_text('일시정지')
    page.wait_for_timeout(800)
    page.locator('[data-action="auto"]').click()
    count = page.locator('.history-entry').count()
    page.wait_for_timeout(500)
    assert page.locator('.history-entry').count() == count
    expect(page.locator('[data-action="step"]')).to_be_enabled()
    page.screenshot(path=str(ARTIFACTS / 'simulation-desktop.png'), full_page=True)
    page.locator('[data-action="recording"]').click()
    expect(page.locator('.sidebar')).to_be_hidden()
    page.screenshot(path=str(ARTIFACTS / 'observation-desktop.png'), full_page=True)
    page.keyboard.press('Escape')
    expect(page.locator('.sidebar')).to_be_visible()
    page.locator('[data-action="auto"]').click()
    expect(page.locator('.result-banner')).to_be_visible(timeout=45000)
    expect(page.locator('[data-action="step"]')).to_be_disabled()
    with page.expect_download() as history_download:
        page.locator('[data-action="export-history"]').click()
    history_download.value.save_as(str(ARTIFACTS / 'history.json'))
    history = json.loads((ARTIFACTS / 'history.json').read_text())
    assert history['result'] is not None and len(history['history']) > 0 and history['seed'] == 'ui-test'
    passed('규칙 변경·시드 실행·자동 진행/일시정지·배속·종료·전체 기록 내보내기·관찰 화면')

    page.locator('[data-action="new-run"]').click()
    dialog.locator('[name="seed"]').fill('다른 역사')
    dialog.locator('button[type="submit"]').click()
    expect(page.locator('.history-entry')).to_have_count(0)
    expect(page.locator('[data-action="step"]')).to_be_enabled()
    page.locator('nav [data-page="overview"]').click()
    for width in [1920, 1280, 1024, 768, 390]:
        page.set_viewport_size({'width': width, 'height': 900})
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), f'overflow at {width}'
        for screen in ['overview', 'countries', 'people', 'map', 'rules', 'simulation']:
            page.locator(f'nav [data-page="{screen}"]').click()
            assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), f'overflow {screen} at {width}'
        if width == 390:
            page.locator('nav [data-page="overview"]').click()
            page.screenshot(path=str(ARTIFACTS / 'overview-mobile.png'), full_page=True)
    passed('새 실행 초기화, 390~1920px의 6개 화면 가로 넘침 없음')

    page.set_viewport_size({'width': 1440, 'height': 1000})
    page.locator('nav [data-page="overview"]').click()
    page.locator('[data-action="new-world"]').click()
    dialog.locator('[name="name"]').fill('완전히 새로운 대륙')
    dialog.locator('[name="rows"]').fill('3')
    dialog.locator('[name="cols"]').fill('4')
    dialog.locator('button[type="submit"]').click()
    expect(page.locator('.territory')).to_have_count(12)
    page.locator('[data-action="go-simulation"]').click()
    page.locator('[data-action="step"]').click()
    expect(page.locator('#toast')).to_contain_text('2개 이상')
    passed('빈 세계와 다른 지도 크기 생성, 국가 부족 시 실행 차단')

    # Escaped imported user text must remain text, not executable markup.
    data['world']['name'] = '<img src=x onerror=window.__xss=1>'
    data['world']['territories'][0]['name'] = '<script>1</script>'
    page.locator('#world-file').set_input_files({'name': 'safe.world.json', 'mimeType': 'application/json', 'buffer': json.dumps(data).encode()})
    expect(page.locator('#toast')).to_contain_text('모두 불러왔습니다')
    assert page.evaluate('window.__xss === undefined')
    assert page.locator('.world-switch img').count() == 0
    passed('가져온 이름의 HTML을 실행하지 않고 문자열로 표시')

    assert not errors, errors
    passed('모든 화면에서 브라우저 JavaScript 예외 0건')
    context.close()
    browser.close()
(ARTIFACTS / 'browser-results.json').write_text(json.dumps({'passed': results, 'errors': errors}, ensure_ascii=False, indent=2))
print(f'{len(results)}개 브라우저 시나리오 통과')
