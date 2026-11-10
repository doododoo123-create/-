"""v59 packed HTML offline: retained v571 toggle, persistence and unchanged map recap."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];errors=[]
class QuietHandler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
URL=f'http://127.0.0.1:{server.server_port}/dist/%EC%82%AC%EA%B5%AD%EC%9F%81%ED%8C%A8%20Studio.html'
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':1600,'height':1000});p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.goto(URL,wait_until='domcontentloaded',timeout=120000);expect(p.locator('.page-footer')).to_contain_text('v0.59.0',timeout=90000);c.set_offline(True)
 p.locator('#world-file').set_input_files(str(ROOT/'.artifacts/v56-army.history.json'));expect(p.locator('[data-import-confirm]')).to_be_enabled(timeout=90000);p.locator('[data-import-confirm]').click();expect(p.locator('#file-import-dialog')).not_to_be_visible(timeout=90000)
 print('PASS packed HTML loaded and history imported',flush=True);expect(p.locator('[data-selected-battle-mode]')).to_be_checked();p.locator('[data-selected-battle-mode]').uncheck();assert p.evaluate('JSON.parse(localStorage.getItem("saguk-studio.filming.v1")).massBattlePresentation===false');p.close();c.set_offline(False);p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.goto(URL,wait_until='domcontentloaded',timeout=120000);p.locator('.nav-item[data-page=simulation]').click();c.set_offline(True);expect(p.locator('.page-footer')).to_contain_text('v0.59.0',timeout=90000);expect(p.locator('[data-selected-battle-mode]')).not_to_be_checked(timeout=90000)
 print('PASS checkbox preference persisted in a newly opened page',flush=True)
 p.locator('[data-film-select]').first.click();expect(p.locator('[data-film-count]')).to_contain_text('1개 선택');p.screenshot(path=str(ROOT/'docs/v59-recording-choice.png'))
 p.locator('#sim-speed').select_option('4');p.clock.install(time=0);p.clock.pause_at(1000);p.locator('[data-action=film-selected]').click();expect(p.locator('.selected-film-controls')).to_be_visible(timeout=90000);expect(p.locator('.selected-film-controls')).not_to_contain_text('복원 중',timeout=90000)
 seen=set();capture=False;retreat=False
 for _ in range(700):
  assert not p.locator('.mass-battle').count(),'tactics must be skipped'
  stage=p.locator('.map-stage');kind=stage.get_attribute('data-kind');event=stage.get_attribute('data-event');seen.add((kind,event));assert event not in ['attack_roll','defense_roll']
  if kind=='capture':capture=True
  if stage.get_attribute('data-batch-retreat')=='true':retreat=True
  if stage.get_attribute('data-finished')=='true':break
  p.clock.run_for(50)
 else:raise AssertionError('map-only playback did not finish')
 assert capture and retreat,seen;assert not errors,errors
 p.locator('[data-action=return-live]').click();expect(p.locator('[data-selected-battle-mode]')).not_to_be_checked();p.locator('[data-selected-battle-mode]').check();p.locator('[data-action=film-selected]').click();expect(p.locator('.selected-film-controls')).not_to_contain_text('복원 중',timeout=90000)
 for _ in range(700):
  if p.locator('.mass-battle').count():break
  p.clock.run_for(50)
 else:raise AssertionError('enabled tactics did not open')
 p.clock.run_for(1000);p.wait_for_timeout(600);p.clock.run_for(1)
 expect(p.locator('[data-mass-canvas]')).to_be_visible()
 assert p.locator('[data-mass-unit]').count()==8
 expect(p.locator('[data-current-tactic]')).not_to_be_empty()
 expect(p.locator('[data-tactic-reason]')).not_to_be_empty()
 a=p.locator('[data-mass-command=attack] [data-command-text]').inner_text();d=p.locator('[data-mass-command=defense] [data-command-text]').inner_text();assert a and d and a!=d
 depths=p.locator('[data-mass-canvas]').get_attribute('data-depth-order');assert depths
 values=list(map(float,depths.split(',')));assert values==sorted(values)
 assert not errors,errors;p.screenshot(path=str(ROOT/'docs/v59-recording-on.png'))
 p.locator('[data-action=mass-skip]').click();expect(p.locator('[data-action=mass-map]')).to_be_visible();p.locator('[data-action=mass-map]').click()
 for _ in range(700):
  if p.locator('.map-stage').get_attribute('data-finished')=='true':break
  p.clock.run_for(50)
 else:raise AssertionError('enabled tactical map return did not finish')
 assert not p.locator('.mass-battle').count();assert not errors,errors
 print('PASS: offline selected-turn checkbox persists; off preserves retreat/capture; on draws all8commanders, orders soldier depth and returns to finished map without errors',flush=True);b.close()

server.shutdown()
