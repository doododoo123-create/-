"""Standalone offline map: actual victory, no early reveal, pause/speed/reload/history."""
from pathlib import Path
import json,subprocess
from playwright.sync_api import sync_playwright,expect

ROOT=Path(__file__).resolve().parents[1]
VERSION=json.loads((ROOT/'package.json').read_text())['version']
if not (ROOT/'.artifacts/v0442-full-complete.history.json').exists():
    subprocess.run(['node','tests/make-v0442-fixtures.mjs'],cwd=ROOT,check=True)
errors=[];failed=[];results=[]
def open_game(browser):
    context=browser.new_context(viewport={'width':1440,'height':1000})
    context.route('**/game.html',lambda route:route.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist/사국쟁패 Studio.html')))
    context.set_offline(True)
    page=context.new_page()
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('requestfailed',lambda request:failed.append(request.url) if not request.url.startswith('blob:') else None)
    page.goto('http://127.0.0.1:3000/game.html',wait_until='networkidle',timeout=90000)
    expect(page.locator('.page-footer')).to_contain_text('v'+VERSION,timeout=90000)
    return context,page
def import_history(page,name):
    page.locator('#world-file').set_input_files(str(ROOT/'.artifacts'/name))
    expect(page.locator('[data-import-confirm]')).to_be_enabled(timeout=60000)
    page.locator('[data-import-confirm]').click()
    expect(page.locator('#file-import-dialog')).not_to_be_visible(timeout=60000)
def check_banner(page):
    notice=page.locator('.unification-announcement');expect(notice).to_have_count(1)
    expect(notice.locator('strong')).to_have_text('천하통일')
    rect=notice.bounding_box();viewport=page.viewport_size
    assert rect and rect['x']>=0 and rect['y']>=0 and rect['x']+rect['width']<=viewport['width']+.5 and rect['y']+rect['height']<=viewport['height']+.5,rect
    assert notice.evaluate('e=>getComputedStyle(e).pointerEvents')=='none'
    return notice
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    for speed in [1,16]:
        context,page=open_game(browser);import_history(page,'v0442-start.history.json')
        page.locator('#sim-speed').select_option(str(speed));page.locator('[data-action=map-fullscreen]').click()
        page.clock.install(time=0);page.clock.pause_at(1000)
        page.locator('.map-play-toggle').click()
        assert page.locator('.unification-announcement').count()==0
        for _ in range(1000):
            if page.locator('.map-stage').get_attribute('data-kind')=='unification':break
            assert page.locator('.unification-announcement').count()==0
            page.clock.run_for(50)
        assert page.locator('.map-stage').get_attribute('data-kind')=='unification'
        page.locator('.map-play-toggle').click();check_banner(page)
        assert page.locator('.map-stage').get_attribute('data-playing')=='false'
        page.clock.run_for(3000);assert page.locator('.map-stage').get_attribute('data-kind')=='unification'
        page.screenshot(path=str(ROOT/f'.artifacts/v0442-announcement-{speed}x.png'))
        page.set_viewport_size({'width':390,'height':844});check_banner(page)
        page.screenshot(path=str(ROOT/f'.artifacts/v0442-announcement-{speed}x-portrait.png'))
        page.set_viewport_size({'width':1440,'height':1000})
        page.locator('.map-play-toggle').click();page.clock.run_for(5000)
        expect(page.locator('.map-stage')).to_have_attribute('data-finished','true')
        expect(check_banner(page)).to_have_attribute('data-unification-phase','complete')
        page.clock.resume();page.reload(wait_until='networkidle',timeout=90000)
        expect(page.locator('.page-footer')).to_contain_text('v'+VERSION,timeout=90000)
        page.locator('nav [data-page=simulation]').click();page.locator('[data-action=map-fullscreen]').click()
        expect(check_banner(page)).to_have_attribute('data-unification-phase','complete')
        # The live game is complete, but replaying the winning turn starts before capture.
        page.keyboard.press('Escape');page.clock.pause_at(page.evaluate('Date.now()')+1000)
        page.locator('.history-entry[data-id="1"]').click();page.locator('[data-action=map-fullscreen]').click()
        assert page.locator('.unification-announcement').count()==0
        page.keyboard.press('Escape');page.locator('[data-action=return-live]').click();page.locator('[data-action=map-fullscreen]').click()
        check_banner(page);results.append({'speed':speed,'liveVictory':True,'pause':True,'portrait':True,'reload':True,'replayNoEarlyReveal':True})
        print('PASS',json.dumps(results[-1]),flush=True);context.close()
    context,page=open_game(browser);import_history(page,'v0442-full-complete.history.json')
    page.locator('[data-action=map-fullscreen]').click();notice=check_banner(page)
    expect(notice.locator('small')).to_contain_text('160개 영토')
    assert page.locator('.atlas-cell').count()==160
    page.screenshot(path=str(ROOT/'.artifacts/v0442-full-unification.png'))
    results.append({'fullDefaultMap':160,'completedSave':True,'notice':notice.inner_text()})
    context.close();browser.close()
assert not errors,errors
assert not failed,failed
(ROOT/'.artifacts/v0442-browser.json').write_text(json.dumps({'results':results,'errors':errors,'externalRequestFailures':failed},ensure_ascii=False,indent=2))
print('PASS offline standalone unification, real160-territory save and zero browser errors',flush=True)
