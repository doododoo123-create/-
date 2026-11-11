from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];errors=[]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':1600,'height':1000});p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.goto(f'http://127.0.0.1:{server.server_port}/dist/%EC%82%AC%EA%B5%AD%EC%9F%81%ED%8C%A8%20Studio.html',wait_until='domcontentloaded',timeout=120000);expect(p.locator('.page-footer')).to_contain_text('v0.56.1',timeout=90000);c.set_offline(True)
  p.locator('#world-file').set_input_files(str(ROOT/'.artifacts/v56-army.history.json'));expect(p.locator('[data-import-confirm]')).to_be_enabled(timeout=90000);p.locator('[data-import-confirm]').click();expect(p.locator('#file-import-dialog')).not_to_be_visible(timeout=90000);p.locator('#sim-speed').select_option('4');p.clock.install(time=0);p.clock.pause_at(1000);p.locator('.history-entry[data-id="1"]').click();p.locator('[data-action=map-fullscreen]').click();p.evaluate('document.activeElement?.blur()')
  for _ in range(1500):
   if p.locator('.entry-territory-name').count():break
   p.clock.run_for(20)
  else:raise AssertionError('no duel entry')
  assert p.locator('[data-army-group][data-combat-side]').count()==2
  rects=p.locator('[data-army-group][data-combat-side] .map-unit-token').evaluate_all('ns=>ns.map(n=>{const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})');icon=p.locator('.battle-emblem .target-ring').evaluate('n=>{const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}}');assert min(r['x']for r in rects)<icon['x']<max(r['x']for r in rects),(rects,icon)
  p.screenshot(path=str(ROOT/'docs/v561-duel.png'))
  for _ in range(100):
   if p.locator('.mass-battle').count():break
   p.clock.run_for(10)
  else:raise AssertionError('no tactical opening')
  p.clock.run_for(16);transform=p.locator('.mass-battle').evaluate('n=>n.style.transform');assert 'scale(' in transform,transform
  assert p.locator('[data-army-group][data-combat-side]').count()==2
  p.keyboard.press('a');frozen=p.locator('.mass-battle').evaluate('n=>n.style.transform');p.clock.run_for(150);assert p.locator('.mass-battle').evaluate('n=>n.style.transform')==frozen;p.keyboard.press('a');p.clock.run_for(250);assert p.locator('.mass-battle').evaluate('n=>n.style.transform')==''
  p.locator('[data-action=mass-skip]').click();p.locator('[data-action=mass-map]').click()
  for _ in range(700):
   if p.locator('.map-stage').get_attribute('data-finished')=='true':break
   p.clock.run_for(50)
  else:raise AssertionError('map recap did not finish')
  assert not errors,errors;print('PASS packed HTML offline: grouped duel either side of icon, anchored opening/pause/resume, map return; no page errors',flush=True);c.close();b.close()
finally:server.shutdown()
