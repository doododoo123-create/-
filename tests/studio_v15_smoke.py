"""Both offline editions: nation camera, compact combat, round overlays, history and new rules."""
from pathlib import Path
import json,subprocess
from urllib.parse import quote
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
subprocess.run(['node','tests/make-v15-fixture.mjs'],cwd=ROOT,check=True)
f=json.loads((ROOT/'.artifacts/v15-browser-fixture.json').read_text());errors=[];failed=[]
def seek(page,predicate,limit=5000):
 for _ in range(limit):
  if page.evaluate(predicate):return
  page.clock.run_for(60)
 page.screenshot(path=str(ROOT/'.artifacts/v15-failure.png'));raise AssertionError('Missing scene: '+str(page.locator('.map-stage').get_attribute('data-event'))+' / '+str(page.locator('#toast').text_content())+' / '+str(errors))
def pause(page):
 if page.locator('.map-stage').get_attribute('data-playing')=='true':page.keyboard.press('KeyA')
def layout(page):
 pane=page.locator('.is-compact-duel').bounding_box();v=page.viewport_size
 assert pane['width']<=210,pane
 assert 0<=pane['x'] and pane['x']+pane['width']<=v['width']+1,(pane,v)
 assert 0<=pane['y'] and pane['y']+pane['height']<=v['height']+1,(pane,v)
 assert pane['height']<140,pane
 icon=page.locator('.battle-emblem .target-ring').bounding_box()
 assert icon['y']+icon['height']<=pane['y'] or icon['y']>=pane['y']+pane['height'],(pane,icon)
 return pane
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'],headless=True)
 for mobile in [False,True]:
  label='mobile' if mobile else 'normal';name='사국쟁패 Studio 모바일 경량.html' if mobile else '사국쟁패 Studio.html'
  c=b.new_context(viewport={'width':900,'height':600} if mobile else {'width':1600,'height':1000},has_touch=mobile)
  page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda r:failed.append(r.url));page.on('dialog',lambda d:d.accept())
  page.add_init_script('if(!localStorage.getItem("saguk-studio.world.v1")){localStorage.setItem("saguk-studio.world.v1",'+json.dumps(json.dumps(f['world']))+');localStorage.setItem("saguk-studio.completed-run.v11",'+json.dumps(json.dumps(f['run']))+');}')
  page.goto('http://127.0.0.1:3000/dist/'+quote(name),wait_until='networkidle');expect(page.locator('.atlas-cell')).to_have_count(160);print(label+': loaded',flush=True)
  page.locator('nav [data-page="rules"]').click();expect(page.locator('[name="capitalReserveLimit"]')).to_have_value('10');expect(page.locator('[name="defenderCounterattack"]')).to_be_checked();expect(page.locator('[name="counter-capture-0"]')).to_have_value('20');expect(page.locator('[name="counter-capture-1"]')).to_have_value('40')
  page.locator('[name="counter-capture-0"]').fill('21');page.locator('#rules-form button[type="submit"]').click();assert page.evaluate('JSON.parse(localStorage.getItem("saguk-studio.world.v1")).world.rules.counterCaptureThresholds[0]')==21;page.locator('[name="counter-capture-0"]').fill('20');page.locator('#rules-form button[type="submit"]').click()
  page.locator('nav [data-page="simulation"]').click();saved=page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")');page.locator('#sim-speed').select_option('8');page.clock.install(time=0);page.clock.pause_at(1000)
  page.locator(f'.history-entry[data-id="{f["turn"]}"]').click();page.locator('[data-action="map-fullscreen"]').click()
  print(label+': replay started',flush=True);seek(page,"()=>document.querySelector('.map-stage')?.dataset.event==='attack_roll'");pause(page);page.clock.run_for(700);print(label+': attack roll reached',flush=True)
  expect(page.locator('.unit-combat-role,.battle-alert-label,.judgment-side-label')).to_have_count(0);expect(page.locator('.battle-side-token')).to_have_count(2);expect(page.locator('.observer-score')).to_have_count(2);expect(page.locator('.observer-score[data-score-visible="false"]').last.locator('strong')).to_have_text('—')
  assert page.locator('[data-round-capture]').count()>0,'Earlier nations must retain their captures'
  assert page.locator('[data-round-route]').count()>2,'Earlier arrows must remain'
  layout(page);page.screenshot(path=str(ROOT/f'docs/v15-{label}-battle.png'))
  if mobile:
   for width,height in [(390,844),(844,390)]:
    page.set_viewport_size({'width':width,'height':height});page.clock.run_for(700);layout(page);page.screenshot(path=str(ROOT/f'.artifacts/v15-mobile-{width}.png'))
   page.set_viewport_size({'width':900,'height':600});page.clock.run_for(700)
  print(label+': layouts passed',flush=True);view=page.locator('.atlas-map').get_attribute('viewBox');routes=page.locator('[data-round-route]').count()
  page.keyboard.press('KeyA');seek(page,"()=>document.querySelector('.map-stage')?.dataset.effectStage==='territory'");pause(page)
  assert page.locator('.atlas-map').get_attribute('viewBox')==view,'Camera must stay at nation center'
  assert page.locator('[data-round-route]').count()>=routes
  for id in f['battle']['takenTerritoryIds']:
   capture=page.locator(f'[data-round-capture="{id}"]');expect(capture).to_have_count(1);assert capture.get_attribute('fill').startswith('url(#round-hatch-')
  page.screenshot(path=str(ROOT/f'docs/v15-{label}-capture.png'))
  page.keyboard.press('KeyA');seek(page,"()=>document.querySelector('.map-stage')?.dataset.turn==='42'&&document.querySelector('.map-stage')?.dataset.finished==='true'")
  assert page.locator('[data-round-capture],[data-round-route],.round-stalemate').count()==0,'All round traces must clear at the round boundary'
  owners=page.locator('.atlas-cell').evaluate_all('els=>Object.fromEntries(els.map(e=>[e.dataset.territory,e.dataset.owner]))');assert owners==f['expected']
  assert page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')==saved,'Replay must not save or advance the live campaign'
  page.keyboard.press('Escape');page.locator('[data-action="return-live"]').click();page.locator('[data-action="new-run"]').click();page.locator('#dialog-form button[type="submit"]').click();page.locator('[data-action="step"]').click();page.locator('[data-action="scene-skip"]').click()
  fresh=page.evaluate('JSON.parse(localStorage.getItem("saguk-studio.completed-run.v11"))');assert fresh['engineVersion']=='studio-v11-20';assert all(n['reserve']<=10 for n in fresh['engineState']['countries'])
  c.route('**/dist/**',lambda r:r.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist'/name)));c.set_offline(True);page.reload(wait_until='networkidle');expect(page.locator('.atlas-cell')).to_have_count(160)
  c.close();print('PASS '+label+': compact layout, icon roles, nation camera, accumulated hatch/arrows, round commit, 8x replay, unchanged live save, new capital rules and offline HTML',flush=True)
 assert not errors,errors;assert not failed,failed;b.close();print('PASS JavaScript exceptions/request failures: 0',flush=True)
