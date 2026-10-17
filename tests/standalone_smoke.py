"""Verify the single-file distributable after initial HTTP load with networking offline.
The managed cloud browser blocks file:// URLs; desktop file opening is not verified here.
"""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright, expect
root = Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('dialog', lambda d: d.accept())
    page.goto('http://127.0.0.1:3000/dist/' + '사국쟁패%20Studio.html', wait_until='networkidle')
    context.set_offline(True)
    expect(page.locator('h1')).to_have_text('세계 개요')
    expect(page.locator('.territory')).to_have_count(80)
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
    page.locator('nav [data-page="countries"]').click()
    expect(page.locator('.country-card')).to_have_count(8)
    page.locator('nav [data-page="simulation"]').click()
    page.locator('[data-action="step"]').click()
    expect(page.locator('.history-entry')).to_have_count(1)
    expect(page.locator('.arena-panel')).to_have_attribute('data-phase','locked',timeout=2500)
    page.locator('[data-action="scene-skip"]').click()
    expect(page.locator('.scene-result')).to_be_visible()
    assert page.locator('img').evaluate_all('(imgs)=>imgs.every(i=>i.complete&&i.naturalWidth>0)')
    assert not errors, errors
    print('PASS: 단일 HTML을 HTTP로 연 뒤 오프라인 동작·국가 추가·파일 내보내기·새로고침 복구·실제 타이머·초상화·1턴 연출; JavaScript 예외 0건')
    context.close()
    browser.close()
