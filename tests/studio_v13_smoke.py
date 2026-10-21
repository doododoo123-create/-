"""Normal/mobile standalone HTML: visual events, editing, replay, offline and comparative render timing."""
from pathlib import Path
import json,subprocess,statistics
from urllib.parse import quote
from playwright.sync_api import sync_playwright,expect

ROOT=Path(__file__).resolve().parents[1]
subprocess.run(['node','tests/make-v13-fixture.mjs'],cwd=ROOT,check=True)
fixture=json.loads((ROOT/'.artifacts/v13-browser-fixture.json').read_text())
errors=[];failed=[];timings={}

def setup(browser,mobile,data=None,phone=True):
    context=browser.new_context(viewport={'width':900,'height':600} if phone else {'width':1600,'height':1000},device_scale_factor=2 if phone else 1,is_mobile=phone,has_touch=phone)
    page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda r:failed.append(r.url));page.on('dialog',lambda d:d.accept())
    if data:
        page.add_init_script('if(!localStorage.getItem("saguk-studio.world.v1")){localStorage.setItem("saguk-studio.world.v1",'+json.dumps(json.dumps(data['world'],ensure_ascii=False))+');localStorage.setItem("saguk-studio.completed-run.v11",'+json.dumps(json.dumps(data['run'],ensure_ascii=False))+');}')
    name='사국쟁패 Studio 모바일 경량.html' if mobile else '사국쟁패 Studio.html'
    page.goto('http://127.0.0.1:3000/dist/'+quote(name),wait_until='networkidle')
    return context,page,name

def seek(page,predicate,limit=2200):
    for _ in range(limit):
        if page.evaluate(predicate):return
        page.clock.run_for(100)
    raise AssertionError('Missing playback event: '+page.locator('.arena-panel,.map-stage').first.get_attribute('data-event'))

with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'],headless=True)
    for mobile in [False,True]:
        label='mobile' if mobile else 'normal'
        context,page,name=setup(b,mobile)
        assert page.locator('html').get_attribute('data-performance')==('mobile' if mobile else 'normal')
        expect(page.locator('.atlas-cell')).to_have_count(160)
        names=page.locator('.atlas-name').all_text_contents();assert len(set(names))==160 and all(not any(c.isdigit() for c in n) for n in names)
        href=page.locator('.map-background-image').get_attribute('href');assert href.startswith('data:image/webp;base64,' if mobile else 'data:image/svg+xml;base64,')
        expect(page.locator('.map-unit-token').first).to_have_css('width','40px');expect(page.locator('.map-unit-token').first).to_have_css('height','68px')
        page.evaluate('window.oldBackground=document.querySelector(".unified-map-background");window.oldUnit=document.querySelector(".map-unit-position")')
        page.locator('nav [data-page="overview"]').click()
        assert page.evaluate('window.oldBackground===document.querySelector(".unified-map-background")')==mobile
        assert page.evaluate('window.oldUnit===document.querySelector(".map-unit-position")')==mobile
        cdp=context.new_cdp_session(page);cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
        samples=page.evaluate('''()=>{const times=[];for(let i=0;i<12;i++){const t=performance.now();document.querySelector('nav [data-page="overview"]').click();times.push(performance.now()-t);}return times;}''')
        cdp.send('Emulation.setCPUThrottlingRate',{'rate':1});timings[label]={'medianMs':round(statistics.median(samples[2:]),2),'samplesMs':[round(n,2) for n in samples],'htmlBytes':(ROOT/'dist'/name).stat().st_size}
        page.locator('nav [data-page="rules"]').click();expect(page.locator('[name="experienceWinStep"]')).to_have_value('3');expect(page.locator('[name="experienceCap"]')).to_have_value('3')
        page.locator('nav [data-page="map"]').click();page.locator('.atlas-cell[data-territory="territory-001"]').evaluate('e=>e.dispatchEvent(new MouseEvent("click",{bubbles:true}))');page.locator('#territory-form [name="name"]').fill('직접 지은 성');page.locator('#territory-form button[type="submit"]').click();page.reload(wait_until='networkidle');page.locator('nav [data-page="map"]').click();expect(page.locator('#territory-form [name="name"]')).to_have_value('직접 지은 성')
        page.locator('[data-action="map-generate"]').click();page.locator('[data-generate="current"]').click();expect(page.locator('[data-generate="generate"]')).to_be_enabled(timeout=20000);expect(page.locator('#generator-count')).to_have_value('160');page.locator('[data-generate="close"]').click()
        page.locator('nav [data-page="simulation"]').click();page.locator('[data-action="map-fullscreen"]').click();expect(page.locator('.atlas-cell')).to_have_count(160);assert page.locator('.map-stage-sidebar,.map-stage .visual-nations,.map-stage .map-camera-controls').count()==0
        view=page.locator('.atlas-map').get_attribute('viewBox');page.keyboard.press('ArrowRight');assert page.locator('.atlas-map').get_attribute('viewBox')!=view
        page.screenshot(path=str(ROOT/f'docs/v13-{label}-map.png'));page.keyboard.press('Escape')
        context.route('**/dist/**',lambda r:r.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist'/name)));context.set_offline(True);page.reload(wait_until='networkidle');expect(page.locator('.atlas-cell')).to_have_count(160);context.close()
        print(f'PASS {label}: unique160 names, compact cards, background/DOM profile, rule editor, saved name, generator source, pan/fullscreen and offline reload',flush=True)

        context,page,name=setup(b,mobile,fixture['history'],phone=mobile)
        page.locator('nav [data-page="simulation"]').click();saved=page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")');page.locator('#sim-speed').select_option('8');page.clock.install(time=0);page.clock.pause_at(1000)
        page.locator(f'.history-entry[data-id="{fixture["turn"]}"]').click();seek(page,"()=>['attack_roll','defense_roll'].includes(document.querySelector('.arena-panel')?.dataset.event)")
        if page.locator('[data-action="auto"]').inner_text().strip()=='일시정지':page.locator('[data-action="auto"]').click()
        page.locator('[data-action="map-fullscreen"]').click();page.clock.run_for(650);expect(page.locator('.unit-battle-glow')).to_have_count(2);expect(page.locator('.battle-alert-label')).to_have_text('전투 발생');expect(page.locator('.map-judgment .judgment-person')).to_have_count(2)
        page.screenshot(path=str(ROOT/f'docs/v13-{label}-battle.png'))
        page.keyboard.press('KeyA');seek(page,"()=>!!document.querySelector('.unit-status-label.victory')&&!!document.querySelector('.unit-status-label.defeat')")
        page.keyboard.press('KeyA');expect(page.locator('.unit-status-label.victory')).to_have_text('승');expect(page.locator('.unit-status-label.defeat')).to_have_text('패');assert page.locator('.unit-battle-glow').count()==0
        losses=page.locator('.map-unit-feedback[data-effect="army"][data-delta^="-"]');assert losses.count()>0
        assert all('만명' in text for text in losses.all_text_contents());assert losses.first.locator('text').evaluate('e=>getComputedStyle(e).fill')=='rgb(255, 70, 84)'
        page.screenshot(path=str(ROOT/f'docs/v13-{label}-result.png'))
        page.keyboard.press('Escape');page.locator('[data-action="auto"]').click();seek(page,"()=>document.querySelector('.replay-banner')?.textContent.includes('50 / 50턴')&&document.querySelector('.arena-panel')?.dataset.scene==='result'&&document.querySelector('.arena-panel')?.dataset.playing==='false'")
        owners=page.locator('.atlas-cell').evaluate_all('els=>Object.fromEntries(els.map(e=>[e.dataset.territory,e.dataset.owner]))');assert owners==fixture['expected'];assert page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')==saved
        production_turn=next(r['turn'] for r in reversed(fixture['history']['run']['history']) if r['production'] and r['turn']<fixture['turn'])
        page.locator(f'.history-entry[data-id="{production_turn}"]').click();seek(page,"()=>!!document.querySelector('.map-unit-feedback.positive[data-effect=army]')")
        if page.locator('[data-action="auto"]').inner_text().strip()=='일시정지':page.locator('[data-action="auto"]').click()
        gains=page.locator('.map-unit-feedback.positive[data-effect="army"]');assert gains.first.locator('text').evaluate('e=>getComputedStyle(e).fill')=='rgb(85, 173, 255)';assert all('만명' in text for text in gains.all_text_contents());assert page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')==saved
        page.locator('[data-action="return-live"]').click();page.locator('[data-action="new-run"]').click();page.locator('#dialog-form button[type="submit"]').click()
        page.locator('[data-action="step"]').click();page.locator('[data-action="scene-skip"]').click()
        assert page.evaluate('JSON.parse(localStorage.getItem("saguk-studio.completed-run.v11")).engineVersion')=='studio-v11-19'
        context.close();print(f'PASS {label}: two active duel borders, battle/win/loss labels, exact red casualties, 8x replay through final saved state, live save protected and new turn',flush=True)
    assert not errors,errors;assert not failed,failed
    (ROOT/'.artifacts/v13-performance.json').write_text(json.dumps(timings,indent=2));print('TIMINGS (4x CPU, same 900×600 viewport, overview redraw only): '+json.dumps(timings),flush=True)
    b.close();print('PASS JavaScript exceptions/request failures: 0',flush=True)
