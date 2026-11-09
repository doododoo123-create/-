"""Offline standalone, real engine history, live battle clock and map handoff."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];errors=[];requests=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 context=b.new_context(viewport={'width':1600,'height':1000},device_scale_factor=2)
 context.route('**/game.html',lambda r:r.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist/사국쟁패 Studio.html')));context.set_offline(True)
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda r:requests.append(r.url) if not r.url.startswith('blob:') else None)
 page.goto('http://127.0.0.1:3000/game.html',wait_until='networkidle',timeout=120000);expect(page.locator('.page-footer')).to_contain_text('v0.54.0',timeout=90000)
 page.locator('#world-file').set_input_files(str(ROOT/'.artifacts/v52-10.history.json'));expect(page.locator('[data-import-confirm]')).to_be_enabled(timeout=90000);page.locator('[data-import-confirm]').click();expect(page.locator('#file-import-dialog')).not_to_be_visible(timeout=90000)
 page.locator('#sim-speed').select_option('16');page.clock.install(time=0);page.clock.pause_at(1000);page.locator('.history-entry[data-id="1"]').click();page.locator('[data-action=map-fullscreen]').click();page.evaluate('document.activeElement?.blur()')
 for i in range(2000):
  if page.locator('.mass-battle').count():break
  page.clock.run_for(100)
 else:raise AssertionError('no mass scene '+str(errors))
 page.keyboard.press('a')
 for _ in range(4):page.keyboard.press('Minus')
 page.wait_for_timeout(1200);page.clock.run_for(1)
 labels=page.locator('[data-mass-unit]');assert labels.count()==8
 expect(page.locator('.map-stage-atlas')).to_be_visible()
 assert page.locator('.map-stage-atlas').get_attribute('inert') is None
 panel=page.locator('.mass-battle').bounding_box();stage=page.locator('.map-stage').bounding_box()
 assert abs(panel['width']/stage['width']-.5)<.01 and abs(panel['height']/stage['height']-.5)<.01,(panel,stage)
 expect(page.locator('.map-zoom-status')).to_contain_text('%')
 canvas=page.locator('[data-mass-canvas]');assert canvas.evaluate('c=>c.width===Math.ceil(c.getBoundingClientRect().width*devicePixelRatio)')
 assert canvas.evaluate('c=>c.getContext("2d").getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)')
 def positions():return labels.evaluate_all('ns=>ns.map(n=>[n.dataset.massUnit,n.style.transform,n.dataset.troops,n.dataset.action])')
 frozen=positions();pixels=canvas.evaluate('c=>c.toDataURL()');page.clock.run_for(700);assert positions()==frozen;assert canvas.evaluate('c=>c.toDataURL()')==pixels
 page.screenshot(path=str(ROOT/'docs/v54-formation.png'))
 page.keyboard.press('a');page.clock.run_for(2400);page.keyboard.press('a');page.wait_for_timeout(600);page.clock.run_for(1)
 assert positions()!=frozen
 # All the real armies engage simultaneously, even when recorded accounting is sequential.
 page.keyboard.press('a');page.clock.run_for(1100);page.keyboard.press('a');page.clock.run_for(1)
 assert labels.evaluate_all("ns=>ns.filter(n=>['attack','guard'].includes(n.dataset.action)).length")>=4
 # Pan/zoom moves the territory anchor without resizing the quarter-screen panel.
 anchor=page.locator('.mass-battle').get_attribute('data-anchor-x');page.keyboard.press('ArrowRight');page.clock.run_for(1)
 assert page.locator('.mass-battle').get_attribute('data-anchor-x')==anchor
 page.locator('.atlas-scroll').dispatch_event('wheel',{'deltaY':-100,'clientX':200,'clientY':500,'bubbles':True});page.clock.run_for(50)
 expect(page.locator('.map-zoom-status')).not_to_contain_text('100%')
 assert abs(page.locator('.mass-battle').bounding_box()['width']-panel['width'])<1
 for n in labels.all():
  box=n.bounding_box();assert box and box['x']>=0 and box['x']+box['width']<=1601 and box['y']>=0 and box['y']+box['height']<=1001,box
 page.screenshot(path=str(ROOT/'docs/v54-combat.png'))
 frozen=positions();canvas.evaluate('n=>window.massCanvasIdentity=n');page.keyboard.press('Equal');page.keyboard.press('Equal');assert positions()==frozen;assert canvas.evaluate('n=>window.massCanvasIdentity===n')
 page.keyboard.press('a')
 for i in range(2000):
  if page.locator('.mass-battle[data-mass-phase=summary]').count():break
  page.clock.run_for(100)
 else:raise AssertionError('no summary '+str(errors))
 assert page.locator('.map-stage').get_attribute('data-effective-speed')=='1'
 page.keyboard.press('a');page.wait_for_timeout(500);page.clock.run_for(1);summary=positions();assert len(summary)==8
 page.screenshot(path=str(ROOT/'docs/v54-summary.png'))
 page.locator('[data-action=campaign-detail]').click();expect(page.locator('.mass-battle')).to_have_count(0);expect(page.locator('[data-action=campaign-return]')).to_be_visible()
 page.locator('[data-action=campaign-return]').click();expect(page.locator('.mass-battle[data-mass-phase=summary]')).to_be_visible();assert positions()==summary
 page.keyboard.press('a');page.locator('[data-action=mass-replay]').click();expect(page.locator('.mass-battle[data-mass-phase=combat]')).to_be_visible()
 page.locator('[data-action=mass-skip]').click();expect(page.locator('.mass-battle[data-mass-phase=summary]')).to_be_visible();page.keyboard.press('a')
 page.locator('[data-action=mass-map]').click();expect(page.locator('.mass-battle')).to_have_count(0);expect(page.locator('.map-stage-atlas')).to_be_visible()
 assert not page.locator('.map-judgment.is-duel').count()
 page.screenshot(path=str(ROOT/'docs/v54-map-return.png'))
 # Death/critical speed protection in a separately reconstructed real history.
 q=context.new_page();q.on('pageerror',lambda e:errors.append(str(e)));q.goto('http://127.0.0.1:3000/game.html',wait_until='networkidle',timeout=120000)
 expect(q.locator('.page-footer')).to_contain_text('v0.54.0',timeout=90000);q.locator('#world-file').set_input_files(str(ROOT/'.artifacts/v52-1.history.json'));expect(q.locator('[data-import-confirm]')).to_be_enabled(timeout=90000);q.locator('[data-import-confirm]').click();expect(q.locator('#file-import-dialog')).not_to_be_visible(timeout=90000)
 q.locator('#sim-speed').select_option('16');q.clock.install(time=0);q.clock.pause_at(1000);q.locator('.history-entry[data-id="1"]').click();q.locator('[data-action=map-fullscreen]').click();q.evaluate('document.activeElement?.blur()')
 for i in range(2000):
  if q.locator('[data-mass-critical=death]').count():break
  q.clock.run_for(100)
 else:raise AssertionError('no recorded death announcement '+str(errors))
 assert q.locator('.map-stage').get_attribute('data-effective-speed')=='1';q.keyboard.press('a');q.wait_for_timeout(600);q.clock.run_for(1);q.screenshot(path=str(ROOT/'docs/v54-death.png'))
 assert q.locator('[data-mass-unit][data-action="death"]').count()>0
 q.keyboard.press('a');q.clock.run_for(990);assert q.locator('[data-mass-critical=death]').count();q.keyboard.press('a');q.keyboard.press('Escape');expect(q.locator('.mass-inline')).to_be_visible();assert q.locator('[data-mass-unit]').count()==8
 q.screenshot(path=str(ROOT/'docs/v54-inline.png'))
 assert not errors,errors;assert not requests,requests
 b.close();print('PASS real offline army battle: full roster, DPR2, frozen pause, movement, readable labels, speed change, final report1x, details, replay, skip, exact map handoff; no app errors or external requests')
