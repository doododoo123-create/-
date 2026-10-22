"""Observer flow in both offline editions: detail levels, safe camera, score secrecy and staged outcomes."""
from pathlib import Path
import json,subprocess
from urllib.parse import quote
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
subprocess.run(['node','tests/make-v14-fixture.mjs'],cwd=ROOT,check=True)
f=json.loads((ROOT/'.artifacts/v14-browser-fixture.json').read_text());errors=[];failed=[]
def setup(browser,mobile,data=None):
 c=browser.new_context(viewport={'width':900,'height':600} if mobile else {'width':1600,'height':1000},has_touch=mobile,device_scale_factor=1)
 page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda r:failed.append(r.url));page.on('dialog',lambda d:d.accept())
 if data:page.add_init_script('if(!localStorage.getItem("saguk-studio.world.v1")){localStorage.setItem("saguk-studio.world.v1",'+json.dumps(json.dumps(data['world']))+');localStorage.setItem("saguk-studio.completed-run.v11",'+json.dumps(json.dumps(data['run']))+');}')
 name='사국쟁패 Studio 모바일 경량.html' if mobile else '사국쟁패 Studio.html';page.goto('http://127.0.0.1:3000/dist/'+quote(name),wait_until='networkidle');return c,page,name

def seek(page,predicate,limit=3500):
 for _ in range(limit):
  if page.evaluate(predicate):return
  page.clock.run_for(60)
 raise AssertionError('Missing scene: '+page.locator('.map-stage,.arena-panel').first.get_attribute('data-event'))
def pause(page):
 if page.locator('.map-stage').count():
  if page.locator('.map-stage').get_attribute('data-playing')=='true':page.keyboard.press('KeyA')
 elif page.locator('[data-action="auto"]').inner_text().strip()=='일시정지':page.locator('[data-action="auto"]').click()
def owners(page):return page.locator('.atlas-cell').evaluate_all('els=>Object.fromEntries(els.map(e=>[e.dataset.territory,e.dataset.owner]))')
def layout(page):
 pane=page.locator('.map-judgment').bounding_box();viewport=page.viewport_size
 assert pane['y']>=0,(pane,viewport)
 assert pane['x']>=0 and pane['x']+pane['width']<=viewport['width']+1,(pane,viewport)
 assert pane['y']+pane['height']<viewport['height']-15,(pane,viewport)
 icon=page.locator('.battle-emblem .target-ring').bounding_box();assert icon['y']>pane['y']+pane['height']+5,(pane,icon,viewport)
 for box in page.locator('.unit-engaged foreignObject').evaluate_all('els=>els.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})'):
  assert box['x']>=-1 and box['x']+box['w']<=viewport['width']+1,(box,viewport)
  assert box['y']>=pane['y']+pane['height']-2,(box,pane,viewport)

with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'],headless=True)
 for mobile in [False,True]:
  label='mobile' if mobile else 'normal';c,page,name=setup(b,mobile)
  expect(page.locator('.atlas-cell')).to_have_count(160);expect(page.locator('.atlas-scroll')).to_have_attribute('data-detail','wide');assert page.locator('.observer-country-labels text').count()==7
  visible=page.locator('.atlas-name').evaluate_all('els=>els.filter(e=>getComputedStyle(e).visibility!=="hidden").length');assert 7<=visible<160
  page.locator('[data-map-detail]').select_option('all');expect(page.locator('.atlas-scroll')).to_have_attribute('data-detail','all');assert page.locator('.atlas-name').evaluate_all('els=>els.every(e=>getComputedStyle(e).visibility!=="hidden")')
  page.reload(wait_until='networkidle');expect(page.locator('[data-map-detail]')).to_have_value('all');page.locator('[data-map-detail]').select_option('auto');page.locator('[data-action="map-zoom-in"]').click();page.locator('[data-action="map-zoom-in"]').click();assert float(page.locator('.atlas-scroll').get_attribute('data-zoom'))>1.5
  page.locator('[data-action="map-zoom-reset"]').click();page.locator('nav [data-page="map"]').click();expect(page.locator('.atlas-scroll')).to_have_attribute('data-detail','editor');assert page.locator('.atlas-name').evaluate_all('els=>els.every(e=>getComputedStyle(e).visibility!=="hidden")')
  page.locator('.atlas-cell[data-territory="territory-001"]').evaluate('e=>e.dispatchEvent(new MouseEvent("click",{bubbles:true}))');page.locator('#territory-form [name="name"]').fill('관전 시험 영토');page.locator('#territory-form button[type="submit"]').click();page.reload(wait_until='networkidle');page.locator('nav [data-page="map"]').click();expect(page.locator('#territory-form [name="name"]')).to_have_value('관전 시험 영토')
  page.locator('nav [data-page="simulation"]').click();page.locator('[data-action="map-fullscreen"]').click();assert page.locator('.map-stage-sidebar,.map-stage .visual-nations,.map-stage .map-camera-controls,.map-stage .map-judgment').count()==0
  if not mobile:page.screenshot(path=str(ROOT/'docs/v14-map.png'))
  page.keyboard.press('Escape');c.route('**/dist/**',lambda r:r.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist'/name)));c.set_offline(True);page.reload(wait_until='networkidle');expect(page.locator('.atlas-cell')).to_have_count(160);c.close();print(f'PASS {label}: adaptive/all details and persistence, capitals/country names, zoom, full editor/rename/save, clean fullscreen and offline HTML',flush=True)

  c,page,name=setup(b,mobile,f['history']);page.locator('nav [data-page="simulation"]').click();saved=page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")');page.locator('#sim-speed').select_option('8');page.clock.install(time=0);page.clock.pause_at(1000);page.locator(f'.history-entry[data-id="{f["turn"]}"]').click()
  seek(page,"()=>document.querySelector('.arena-panel')?.dataset.event==='attack_roll'");pause(page);page.locator('[data-action="map-fullscreen"]').click();page.clock.run_for(700);expect(page.locator('.unit-engaged')).to_have_count(2);expect(page.locator('.unit-combat-role')).to_have_count(2);expect(page.locator('.unit-battle-glow')).to_have_count(2);expect(page.locator('.observer-score')).to_have_count(2);expect(page.locator('.observer-score[data-score-visible="false"]').last.locator('strong')).to_have_text('—');assert ' +0' not in ' '.join(page.locator('.observer-bonuses').all_text_contents());layout(page)
  page.screenshot(path=str(ROOT/f'docs/v14-{label}-battle.png'))
  if mobile:
   for width,height in [(390,844),(844,390)]:
    page.set_viewport_size({'width':width,'height':height});page.clock.run_for(800);layout(page);page.screenshot(path=str(ROOT/f'.artifacts/v14-mobile-{width}.png'))
   page.set_viewport_size({'width':900,'height':600});page.clock.run_for(800)
  view=page.locator('.atlas-map').get_attribute('viewBox');page.keyboard.press('KeyA');seek(page,"()=>document.querySelector('.map-stage')?.dataset.effectStage==='outcome'");pause(page);assert page.locator('.atlas-map').get_attribute('viewBox')==view
  assert owners(page)==f['before'];assert page.locator('.map-unit-feedback[data-effect="army"],.map-territory-feedback').count()==0;expect(page.locator('.unit-status-label.victory')).to_have_count(1);expect(page.locator('.unit-status-label.defeat')).to_have_count(1)
  if not mobile:page.screenshot(path=str(ROOT/'docs/v14-outcome.png'))
  page.keyboard.press('KeyA');seek(page,"()=>document.querySelector('.map-stage')?.dataset.effectStage==='troops'");pause(page);assert owners(page)==f['before'];assert page.locator('.unit-status-label.victory,.map-territory-feedback').count()==0
  losses=page.locator('.map-unit-feedback[data-effect="army"]');assert losses.count()>0;assert losses.first.locator('text').evaluate('e=>getComputedStyle(e).fill')=='rgb(255, 70, 84)'
  if not mobile:page.screenshot(path=str(ROOT/'docs/v14-troops.png'))
  page.keyboard.press('KeyA');seek(page,"()=>document.querySelector('.map-stage')?.dataset.effectStage==='territory'");pause(page);assert owners(page)==f['after'];assert page.locator('.map-unit-feedback[data-effect="army"]').count()==0;assert page.locator('.map-event-announcement').inner_text()
  if not mobile:page.screenshot(path=str(ROOT/'docs/v14-territory.png'))
  if 'growth' in f['steps']:
   page.keyboard.press('KeyA');seek(page,"()=>document.querySelector('.map-stage')?.dataset.effectStage==='growth'");pause(page);assert page.locator('.map-unit-feedback[data-effect="army"],.map-territory-feedback').count()==0;assert page.locator('.map-unit-feedback[data-effect="capacity"],.map-unit-feedback[data-effect="experience"]').count()>0
  page.keyboard.press('Escape');page.locator('[data-action="auto"]').click();seek(page,"()=>document.querySelector('.replay-banner')?.textContent.includes('50 / 50턴')&&document.querySelector('.arena-panel')?.dataset.scene==='result'&&document.querySelector('.arena-panel')?.dataset.playing==='false'")
  assert owners(page)==f['expected'];assert page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')==saved
  page.locator('[data-action="return-live"]').click();page.locator('[data-action="new-run"]').click();page.locator('#dialog-form button[type="submit"]').click();page.locator('[data-action="step"]').click();page.locator('[data-action="scene-skip"]').click();assert page.evaluate('JSON.parse(localStorage.getItem("saguk-studio.completed-run.v11")).engineVersion')=='studio-v11-19'
  c.close();print(f'PASS {label}: safe battle camera, stable duel, role/score visibility, separate outcome/troops/territory/growth, 8x replay and unchanged engine/save',flush=True)
 assert not errors,errors;assert not failed,failed;b.close();print('PASS JavaScript exceptions/request failures: 0',flush=True)
