"""One normal standalone: exact Han art/tiles,500% cap, editor and outward combat stacks."""
from pathlib import Path
from urllib.parse import quote
import subprocess,json
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];subprocess.run(['node','tests/make-v39-fixtures.mjs'],cwd=ROOT,check=True);errors=[];failed=[]
def seek(page,predicate,limit=6000):
 for _ in range(limit):
  if page.evaluate(predicate):return
  if page.locator('.map-stage').get_attribute('data-playing')!='true':page.keyboard.press('a')
  page.clock.run_for(15)
 page.screenshot(path=str(ROOT/'.artifacts/v39-failure.png'));raise AssertionError(predicate+' errors '+str(errors))
def load_history(page,name,installed):
 if installed:page.clock.set_system_time(1000);page.clock.resume()
 page.locator('#world-file').set_input_files(str(ROOT/f'.artifacts/v39-{name}.history.json'));expect(page.locator('[data-import-confirm]')).to_be_enabled(timeout=45000);page.locator('[data-import-confirm]').click();expect(page.locator('#file-import-dialog')).not_to_be_visible();page.locator('#sim-speed').select_option('2')
 if installed:page.clock.pause_at(page.evaluate('Date.now()')+100)
 else:page.clock.install(time=0);page.clock.pause_at(1000)
 page.locator('.history-entry[data-id="1"]').click();page.locator('[data-action=map-fullscreen]').click();page.evaluate('document.activeElement?.blur()');return page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')
def back(page,saved):
 page.keyboard.press('Escape');page.locator('[data-action=return-live]').click();assert page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')==saved

def verify_stacks(page):
 icon=page.locator('.battle-emblem .target-ring').bounding_box();centre=icon['x']+icon['width']/2
 counts={}
 for card in page.locator('[data-engagement][data-combat-side]').all():
  face=card.locator('.map-unit-token').first.bounding_box();direction=int(card.get_attribute('data-stack-direction'));side=card.get_attribute('data-combat-side');counts[side]=counts.get(side,0)+1
  if direction<0:assert face['x']+face['width']<=icon['x']-4,(side,face,icon)
  else:assert face['x']>=icon['x']+icon['width']+4,(side,face,icon)
 return counts
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);ctx=b.new_context(viewport={'width':1600,'height':1000});page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda r:failed.append(r.url) if not r.url.startswith('blob:') else None);ctx.route('**/dist/**',lambda r:r.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist/사국쟁패 Studio.html')));ctx.set_offline(True);page.goto('http://127.0.0.1:3000/dist/'+quote('사국쟁패 Studio.html'),wait_until='networkidle',timeout=90000);expect(page.locator('.page-footer')).to_contain_text('v0.39.0',timeout=90000);expect(page.locator('.han-map-host')).to_have_attribute('data-han-art','Han-natural-cultivation-margins-500-v1',timeout=60000)
 assert page.evaluate('window.ContinentMap===undefined');assert page.evaluate('document.fonts.size')==4
 page.locator('[data-action=map-fullscreen]').first.click();expect(page.locator('.han-map-host')).to_have_attribute('data-han-art','Han-natural-cultivation-margins-500-v1');page.screenshot(path=str(ROOT/'docs/v39-map100.png'))
 # Tile culling and all original territory hit regions remain in one coordinate system.
 page.locator('.atlas-scroll').hover()
 for _ in range(20):page.mouse.wheel(0,-160)
 page.wait_for_function('document.querySelector(".atlas-scroll").dataset.zoom==="5"');page.wait_for_function('document.querySelector(".han-map-host").dataset.hanPending==="0"');assert int(page.locator('.han-map-host').get_attribute('data-han-loaded'))>0;assert page.locator('.han-map-host').get_attribute('data-han-error') is None
 difference=page.evaluate('''()=>{const s=document.querySelector('.han-map-surface').shadowRoot,a=s.querySelector('#territory-005').getBoundingClientRect(),b=document.querySelector('[data-territory="territory-005"] path').getBoundingClientRect();return Math.max(...['x','y','width','height'].map(k=>Math.abs(a[k]-b[k])))}''');assert difference<.03,difference
 page.evaluate('window.savedHanNode=document.querySelector(".han-map-host")');page.locator('[data-action=toggle-route-mode]').click();assert page.evaluate('window.savedHanNode===document.querySelector(".han-map-host")');page.screenshot(path=str(ROOT/'docs/v39-map500.png'));page.keyboard.press('Escape')
 page.locator('nav [data-page=map]').click();expect(page.locator('.han-map-host')).to_have_attribute('data-han-art','Han-natural-cultivation-margins-500-v1');page.locator('#map-editor-zoom').select_option('5');assert page.locator('[data-map-camera=editor]').get_attribute('data-zoom')=='5';assert page.locator('#map-editor-zoom option[value="8"]').count()==0;page.locator('#map-editor-zoom').select_option('1');page.locator('[data-map-camera=editor]').scroll_into_view_if_needed();point=page.evaluate('''()=>{const svg=document.querySelector('.han-map-surface').shadowRoot.querySelector('svg'),p=new DOMPoint(1171.4,110.89).matrixTransform(svg.getScreenCTM());return [p.x,p.y]}''');page.mouse.click(*point);assert page.locator('[data-territory="territory-005"] .selected').count()==1;page.screenshot(path=str(ROOT/'docs/v39-editor.png'))
 print('PASS exact source art/476-cell bank, visible500% tiles, geometry alignment, preserved art DOM, click/editor and500% cap; normal HTML only',flush=True)
 installed=False
 for name,counts in [('cohort',{'attack':1,'defense':3}),('mirror',{'attack':1,'defense':3}),('multi',{'attack':3,'defense':1})]:
  saved=load_history(page,name,installed);installed=True;seek(page,"()=>document.querySelector('.map-stage')?.dataset.kind==='apply'&&document.querySelector('.map-stage')?.dataset.event==='resolve'&&!!document.querySelector('[data-engagement]')");actual=verify_stacks(page);assert actual==counts,(name,actual);page.screenshot(path=str(ROOT/f'docs/v39-{name}.png'));page.keyboard.press('s');page.locator('.atlas-scroll').hover()
  for _ in range(15):page.mouse.wheel(0,-160)
  assert float(page.locator('.atlas-scroll').get_attribute('data-zoom'))<=5;verify_stacks(page);page.screenshot(path=str(ROOT/f'docs/v39-{name}-zoom.png'));back(page,saved)
 saved=load_history(page,'fall',True);seek(page,"()=>!!document.querySelector('[data-nation-fall=b]')");assert page.locator('[data-round-capture]').count()>0;assert page.locator('.campaign-map-strip,.global-history-notice[data-notice=elimination]').count()==0;expect(page.locator('[data-nation-fall]')).to_contain_text('b국 멸망');page.keyboard.press('a');notice=page.locator('[data-nation-fall]').inner_text();page.clock.run_for(250);assert page.locator('[data-nation-fall]').inner_text()==notice;page.screenshot(path=str(ROOT/'docs/v39-elimination.png'));assert page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')==saved
 assert not errors,errors;assert not failed,failed;b.close();print('PASS outward stacks both directions and high zoom, army against individual, season-style elimination/pause, unchanged live save; app errors/external requests0',flush=True)
