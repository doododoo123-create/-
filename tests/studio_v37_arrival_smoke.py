"""Screen-gap stability and a shorter path arriving before the last rally member."""
from pathlib import Path
from urllib.parse import quote
import json,subprocess,math
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
subprocess.run(['node','tests/make-v37-fixtures.mjs'],cwd=ROOT,check=True)
errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);ctx=b.new_context(viewport={'width':1600,'height':1000});page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));ctx.route('**/dist/**',lambda r:r.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist/사국쟁패 Studio.html')));ctx.set_offline(True);page.goto('http://127.0.0.1:3000/dist/'+quote('사국쟁패 Studio.html'),wait_until='networkidle');expect(page.locator('.atlas-cell')).to_have_count(160,timeout=45000)
 page.locator('[data-map-detail]').first.select_option('all');name=page.locator('[data-territory-label]').first;anchor=(name.get_attribute('x'),name.get_attribute('y'))
 for i in range(5):
  gaps=page.evaluate("()=>[...document.querySelectorAll('[data-mountain-id]')].map(e=>{const n=[...document.querySelectorAll('[data-territory-label]')].find(n=>n.dataset.territoryLabel===e.dataset.mountainId),a=n.getBoundingClientRect(),b=e.getBoundingClientRect();return b.left-a.right})");assert all(1<x<9 for x in gaps),(i,gaps);assert anchor==(name.get_attribute('x'),name.get_attribute('y'));page.locator('[data-action=map-zoom-in]').first.click()
 print('PASS measured mountain gap and unchanged name anchors through five zoom levels',flush=True)
 page.locator('#world-file').set_input_files(str(ROOT/'.artifacts/v37-unequal.history.json'));expect(page.locator('[data-import-confirm]')).to_be_enabled(timeout=45000);page.locator('[data-import-confirm]').click();page.locator('#sim-speed').select_option('1');page.clock.install(time=0);page.clock.pause_at(1000);page.locator('.history-entry[data-id="1"]').click();page.locator('[data-action=map-fullscreen]').click();page.evaluate('document.activeElement?.blur()')
 for _ in range(5000):
  if page.evaluate("()=>document.querySelector('.map-stage')?.dataset.kind==='movement'&&document.querySelector('.map-stage')?.dataset.event==='army_assembly'"):break
  if page.locator('.map-stage').get_attribute('data-playing')!='true':page.keyboard.press('a')
  page.clock.run_for(10)
 else:raise AssertionError('no rally')
 page.clock.run_for(640);assert page.locator('.map-stage').get_attribute('data-kind')=='movement';assert page.locator('[data-army-forming]').count()==0
 distances={}
 for who in ['a0','a2']:
  a=page.locator('.operation-arrow[data-live-march=true][data-route-person='+who+']');points=json.loads(a.get_attribute('data-route-points'));pin=list(map(float,page.locator('[data-person='+who+']').get_attribute('data-motion-pin').split(',')));distances[who]=math.dist(pin,points[-1])
 assert distances['a2']<.01 and distances['a0']>1,distances;page.screenshot(path=str(ROOT/'docs/v37-rally-arrival.png'))
 for _ in range(100):
  if page.locator('.map-stage').get_attribute('data-kind')=='army-forming':break
  page.clock.run_for(10)
 assert page.locator('.map-stage').get_attribute('data-kind')=='army-forming';assert not errors,errors;print('PASS shorter route arrives/waits, last member completes travel before forming; app exceptions0',flush=True);b.close()
