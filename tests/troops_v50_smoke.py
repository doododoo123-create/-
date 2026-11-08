"""Offline real recorded battle: sprites, pause, battlefield-anchored cutout and camera."""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
errors=[];failed=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':1600,'height':1000});c.route('**/game.html',lambda r:r.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist/사국쟁패 Studio.html')));c.set_offline(True)
 page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda r:failed.append(r.url) if not r.url.startswith('blob:') else None)
 page.goto('http://127.0.0.1:3000/game.html',wait_until='networkidle',timeout=120000);expect(page.locator('.page-footer')).to_contain_text('v0.50.0',timeout=90000)
 page.locator('#world-file').set_input_files(str(ROOT/'.artifacts/v47-honor.history.json'));expect(page.locator('[data-import-confirm]')).to_be_enabled(timeout=90000);page.locator('[data-import-confirm]').click();expect(page.locator('#file-import-dialog')).not_to_be_visible(timeout=90000)
 page.locator('#sim-speed').select_option('16');page.clock.install(time=0);page.clock.pause_at(1000);page.locator('.history-entry[data-id="1"]').click();page.locator('[data-action=map-fullscreen]').click();page.evaluate('document.activeElement?.blur()');page.keyboard.press('s')
 for i in range(4000):
  if page.locator('.battlefield-honor').count():break
  page.clock.run_for(10)
 else:raise AssertionError('No honor shown '+str(errors))
 page.clock.run_for(200);page.keyboard.press('a');page.wait_for_timeout(600);page.clock.run_for(1)
 assert page.locator('canvas[data-troop-action]').count()>0
 painted=page.locator('canvas[data-troop-action]').evaluate_all('nodes=>nodes.filter(n=>{const a=n.getContext("2d").getImageData(0,0,n.width,n.height).data;return a.some((v,i)=>i%4===3&&v>0)}).length')
 assert painted>0, 'sprites are transparent'
 badge=page.locator('.battlefield-honor');assert badge.locator('.honor-hero').count()==1;assert '3배 병력 격파' in badge.inner_text();assert page.locator('.map-stage').get_attribute('data-effective-speed')=='1'
 def alignment():
  return page.evaluate('''()=>{const a=document.querySelector('.battlefield-honor'),svg=document.querySelector('.atlas-map'),stage=document.querySelector('.map-stage'),[x,y]=a.dataset.victoryAnchor.split(',').map(Number),p=new DOMPoint(x,y).matrixTransform(svg.getScreenCTM()),r=stage.getBoundingClientRect();return Math.abs(parseFloat(a.style.left)-(p.x-r.left))}''')
 assert alignment()<1
 before=badge.get_attribute('style');page.keyboard.press('ArrowRight');assert alignment()<1;assert badge.get_attribute('style')!=before
 snapshot=page.locator('canvas[data-troop-action]').first.evaluate('c=>c.toDataURL()');page.clock.run_for(700);assert page.locator('canvas[data-troop-action]').first.evaluate('c=>c.toDataURL()')==snapshot
 page.screenshot(path=str(ROOT/'docs/v50-battlefield-honor.png'))
 page.keyboard.press('a');page.clock.run_for(990);assert page.locator('.battlefield-honor').count()==1;page.clock.run_for(20);assert page.locator('.battlefield-honor').count()==0
 page.keyboard.press('Escape');page.locator('[data-action=return-live]').click()
 assert not errors,errors;assert not failed,failed;b.close();print('PASS offline sprites painted, pause, real upset cutout, geographic camera anchoring and fixed 1.2s honor at16x; no page errors')
