"""Verify the single-file distributable after initial HTTP load with networking offline.
The managed cloud browser blocks file:// URLs; desktop file opening is not verified here.
"""
from pathlib import Path
import os, io, json
from PIL import Image
from playwright.sync_api import sync_playwright, expect
root = Path(__file__).resolve().parents[1]
ROOT = root
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('dialog', lambda d: d.accept())
    seed=json.dumps(json.loads((ROOT/'examples/칠국의 여명.world.json').read_text()))
    page.add_init_script("if(!localStorage.getItem('saguk-studio.world.v1'))localStorage.setItem('saguk-studio.world.v1',"+json.dumps(seed)+");")
    page.goto('http://127.0.0.1:3000/dist/' + '사국쟁패%20Studio.html', wait_until='networkidle')
    context.set_offline(True)
    expect(page.locator('h1')).to_have_text('세계 개요')
    expect(page.locator('.territory')).to_have_count(80)
    page.locator('nav [data-page="people"]').click()
    expect(page.locator('.person-card img[data-portrait-kind="general"]')).to_have_count(35)
    page.locator('[data-action="edit-person"][data-id="general-0-0"]').first.click()
    expect(page.locator('.portrait-options input[value^="general-"]')).to_have_count(50)
    assert page.locator('.portrait-options img').evaluate_all('async imgs=>{await Promise.all(imgs.map(i=>i.decode()));return imgs.every(i=>i.naturalWidth>0)}')
    page.locator('[name="portraitKey"][value="general-050"]').check()
    page.locator('#editor-dialog button[type="submit"]').click()
    page.locator('nav [data-page="map"]').click()
    expect(page.locator('.terrain-art')).to_have_count(1)
    assert page.evaluate("async()=>{const i=new Image();i.src=document.querySelector('.terrain-art').getAttribute('href');await i.decode();return i.naturalWidth>1000}")
    page.locator('[data-action="map-edit-trace"]').click()
    for x,y in [(100,100),(220,100),(220,200),(100,200)]:
        point=page.locator('#geographic-editor .atlas-map').evaluate('(svg,p)=>{const q=new DOMPoint(...p).matrixTransform(svg.getScreenCTM());return {x:q.x,y:q.y}}',[x,y])
        page.mouse.click(point['x'],point['y'])
    page.locator('[data-action="map-edit-apply"]').click()
    expect(page.locator('.map-edit-layer')).to_have_count(0)
    assert len(page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.world.v1')).world.cartography.polygons['tile-0'].points"))==4
    buffer=io.BytesIO();Image.new('RGB',(200,100),(80,120,90)).save(buffer,format='PNG')
    page.locator('#map-background-file').set_input_files({'name':'offline-map.png','mimeType':'image/png','buffer':buffer.getvalue()})
    expect(page.locator('.map-background-image')).to_have_count(1)
    page.locator('nav [data-page="countries"]').click()
    page.locator('[data-action="add-country"]').first.click()
    page.locator('#editor-dialog [name="name"]').fill('오프라인 국가')
    page.locator('#editor-dialog button[type="submit"]').click()
    expect(page.locator('.country-card')).to_have_count(8)
    with page.expect_download() as download:
        page.locator('[data-action="export"]').click()
    root.joinpath('.artifacts').mkdir(exist_ok=True)
    download.value.save_as(str(root / '.artifacts/offline.world.json'))
    context.set_offline(False)
    page.reload(wait_until='networkidle')
    context.set_offline(True)
    assert page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.world.v1')).world.cartography.background.startsWith('data:image/jpeg;base64,')")
    expect(page.locator('.map-background-image')).to_have_count(1)
    page.locator('nav [data-page="countries"]').click()
    expect(page.locator('.country-card')).to_have_count(8)
    page.locator('nav [data-page="simulation"]').click()
    page.locator('[data-action="step"]').click()
    expect(page.locator('.history-entry')).to_have_count(1)
    expect(page.locator('.arena-panel')).to_have_attribute('data-phase','locked',timeout=2500)
    page.locator('[data-action="scene-skip"]').click()
    expect(page.locator('.arena-panel')).to_have_attribute('data-scene','result')
    page.locator('[data-action="map-fullscreen"]').click()
    expect(page.locator('.map-stage')).to_have_count(1)
    assert page.evaluate('document.fullscreenElement?.id') == 'app'
    expect(page.locator('.map-stage header,.map-stage footer,.map-stage-sidebar,.map-stage-nations')).to_have_count(0)
    expect(page.locator('.map-judgment')).to_have_count(0)
    page.keyboard.press('Enter')
    expect(page.locator('.map-judgment')).to_have_attribute('data-phase','locked',timeout=3000)
    assert page.locator('.visual-die-block').first.evaluate('(el)=>getComputedStyle(el).getPropertyValue("--die-ink").trim().startsWith("rgb(")')
    page.keyboard.press('s')
    expect(page.locator('.map-judgment')).to_have_count(0)
    page.keyboard.press('Escape')
    expect(page.locator('.history-entry')).to_have_count(2)
    assert page.locator('img').evaluate_all('(imgs)=>imgs.every(i=>i.complete&&i.naturalWidth>0)')
    assert not errors, errors
    print('PASS: 단일 HTML을 HTTP로 연 뒤 오프라인 동작·새 초상화 50개/선택·삽화/배경 이미지·경계 편집/복구·국가 추가·파일 내보내기·새로고침 복구·실제 타이머·초상화·턴 연출·지도 단독 전체화면/중앙 판정/주사위 색; JavaScript 예외 0건')
    context.close()
    browser.close()
