"""Actual32officer/42engagement history, offline standalone rendering check."""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];errors=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1600,'height':1000},device_scale_factor=2);context.route('**/game.html',lambda r:r.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist/사국쟁패 Studio.html')));context.set_offline(True)
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:3000/game.html',wait_until='networkidle',timeout=120000);expect(page.locator('.page-footer')).to_contain_text('v0.53.0',timeout=90000)
 page.locator('#world-file').set_input_files(str(ROOT/'.artifacts/v52-large.history.json'));expect(page.locator('[data-import-confirm]')).to_be_enabled(timeout=90000);page.locator('[data-import-confirm]').click();expect(page.locator('#file-import-dialog')).not_to_be_visible(timeout=90000)
 page.locator('#sim-speed').select_option('16');page.clock.install(time=0);page.clock.pause_at(1000);page.locator('.history-entry[data-id="1"]').click();page.locator('[data-action=map-fullscreen]').click();page.evaluate('document.activeElement?.blur()')
 for i in range(4000):
  if page.locator('.mass-battle').count():break
  page.clock.run_for(100)
 else:raise AssertionError('no mass stage '+str(errors))
 page.keyboard.press('a');page.wait_for_timeout(1500);page.clock.run_for(1)
 labels=page.locator('[data-mass-unit]');assert labels.count()==32
 assert labels.evaluate_all('ns=>new Set(ns.map(n=>n.dataset.massUnit)).size')==32
 assert labels.evaluate_all('ns=>ns.reduce((n,e)=>n+Number(e.dataset.figures),0)')==512
 assert page.locator('.map-stage-atlas').is_visible()
 assert page.locator('.map-stage-atlas').get_attribute('inert') is None
 assert page.locator('.map-stage-atlas').evaluate('n=>getComputedStyle(n).opacity')=='1'
 colors=page.locator('[data-mass-canvas]').evaluate('''c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let red=0,blue=0;for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2];if(r>50&&r<200&&r>g*1.5&&r>b*1.5)red++;if(b>50&&b<220&&b>r*1.8&&b>g*1.6)blue++;}return {red,blue}}''')
 assert colors['red']>400 and colors['blue']>400,colors
 depths=page.locator('[data-mass-canvas]').get_attribute('data-depth-order').split(',');assert all(float(a)<=float(b) for a,b in zip(depths,depths[1:]))
 before=labels.evaluate_all('ns=>ns.map(n=>[n.style.transform,n.dataset.troops])');page.clock.run_for(500);assert labels.evaluate_all('ns=>ns.map(n=>[n.style.transform,n.dataset.troops])')==before
 page.screenshot(path=str(ROOT/'docs/v53-large32.png'))
 assert not errors,errors
 browser.close();print('PASS all32 commanders and512 figures; actual red/blue sprite pixels:',colors,'offline DPR2, paused state stable, no app errors. No FPS measurement.')
