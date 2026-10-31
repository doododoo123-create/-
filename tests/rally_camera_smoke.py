"""Offline camera: rally holds, 300ms completed view at 1/16x, pause and replay."""
from pathlib import Path
import subprocess
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
subprocess.run(['node', '--input-type=module', '-'], cwd=ROOT, check=True, input="""
import {studio36Fixture,studio36Controls} from './tests/studio-v36-fixture.mjs';
import {nextTurn} from './src/engine/simulation.js';
import {exportHistoryData} from './src/storage/history-file.js';
import {writeFileSync} from 'node:fs';
const run=nextTurn(studio36Fixture({defense:true}),studio36Controls());
writeFileSync('.artifacts/v461-rally.history.json',JSON.stringify(await exportHistoryData(run)));
""", text=True)
errors, failed = [], []

def seek(page, kind, event=None, step=20):
    for _ in range(12000):
        stage = page.locator('.map-stage')
        if stage.get_attribute('data-kind') == kind and (not event or stage.get_attribute('data-event') == event):
            return
        if stage.get_attribute('data-playing') != 'true':
            page.keyboard.press('a')
        page.clock.run_for(step)
    raise AssertionError((kind, event, errors))

def camera(page):
    return page.locator('.atlas-map').evaluate('e=>{const b=e.viewBox.baseVal;return [b.x+b.width/2,b.y+b.height/2,b.width,b.height]}')

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    context = browser.new_context(viewport={'width':1600,'height':1000})
    context.route('**/game.html', lambda r:r.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist/사국쟁패 Studio.html')))
    context.set_offline(True)
    page = context.new_page()
    page.on('pageerror', lambda e:errors.append(str(e)))
    page.on('requestfailed', lambda r:failed.append(r.url) if not r.url.startswith('blob:') else None)
    page.goto('http://127.0.0.1:3000/game.html', wait_until='networkidle', timeout=90000)
    expect(page.locator('.page-footer')).to_contain_text('v0.46.1', timeout=90000)
    page.locator('#world-file').set_input_files(str(ROOT/'.artifacts/v461-rally.history.json'))
    expect(page.locator('[data-import-confirm]')).to_be_enabled(timeout=60000)
    page.locator('[data-import-confirm]').click()
    expect(page.locator('#file-import-dialog')).not_to_be_visible(timeout=60000)
    page.clock.install(time=0)
    page.clock.pause_at(1000)
    for speed in ['1','16']:
        page.locator('#sim-speed').select_option(speed)
        page.locator('.history-entry[data-id="1"]').click()
        page.locator('[data-action=map-fullscreen]').click()
        page.evaluate('document.activeElement?.blur()')
        if page.locator('[data-action=toggle-camera-follow]').get_attribute('aria-pressed') != 'true':
            page.keyboard.press('s')
        seek(page, 'movement', 'army_assembly')
        gather = camera(page)
        for _ in range(2000):
            assert camera(page) == gather
            if page.locator('.map-stage').get_attribute('data-kind') == 'army-forming':
                break
            page.clock.run_for(10)
        else:
            raise AssertionError('formation never started')
        seek(page, 'army-formed-hold', step=1)
        assert camera(page) == gather
        assert page.locator('.map-stage').get_attribute('data-effective-speed') == '1'
        assert page.locator('[data-army-forming=true]').count() == 0
        assert page.locator('.is-army-group').count() >= 1
        if speed == '16':
            page.screenshot(path=str(ROOT/'docs/v461-rally-hold.png'))
            page.clock.run_for(100)
            page.keyboard.press('a')
            page.clock.run_for(1000)
            assert page.locator('.map-stage').get_attribute('data-kind') == 'army-formed-hold'
            page.keyboard.press('a')
            page.clock.run_for(198)
        else:
            page.clock.run_for(298)
        assert page.locator('.map-stage').get_attribute('data-kind') == 'army-formed-hold'
        page.clock.run_for(2)
        assert page.locator('.map-stage').get_attribute('data-kind') == 'movement'
        assert page.locator('.map-stage').get_attribute('data-event') == 'army_march'
        assert page.locator('.map-stage').get_attribute('data-effective-speed') == speed
        assert camera(page) != gather
        # Continue to the defender gathering; its incoming cards use one view too.
        seek(page, 'movement', 'army_assembly', step=1)
        defense = camera(page)
        seek(page, 'army-formed-hold', step=1)
        assert camera(page) == defense
        page.keyboard.press('Escape')
        page.locator('[data-action=return-live]').click()
        print('PASS rally/formation/march and fixed 300ms at '+speed+'x', flush=True)
    assert not errors, errors
    assert not failed, failed
    browser.close()
    print('PASS offline history replay, pause/resume, app errors/external request failures: 0', flush=True)
