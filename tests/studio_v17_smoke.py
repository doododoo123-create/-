"""Both offline editions: nation camera, compact combat, round overlays, history and new rules."""
from pathlib import Path
import json,subprocess
from urllib.parse import quote
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
subprocess.run(['node','tests/make-v17-fixture.mjs'],cwd=ROOT,check=True)
f=json.loads((ROOT/'.artifacts/v17-browser-fixture.json').read_text());errors=[];failed=[]
def seek(page,predicate,limit=5000):
 for _ in range(limit):
  if page.evaluate(predicate):return
  page.clock.run_for(60)
 page.screenshot(path=str(ROOT/'.artifacts/v17-failure.png'));raise AssertionError('Missing scene: '+str(page.locator('.map-stage').get_attribute('data-event'))+' / '+str(page.locator('#toast').text_content())+' / '+str(errors))
def pause(page):
 if page.locator('.map-stage').get_attribute('data-playing')=='true':page.keyboard.press('KeyA')
def layout(page):
 pane=page.locator('.is-compact-duel').bounding_box();v=page.viewport_size
 assert 334<=pane['width']<=338,pane
 assert 0<=pane['x'] and pane['x']+pane['width']<=v['width']+1,(pane,v)
 assert 0<=pane['y'] and pane['y']+pane['height']<=v['height']+1,(pane,v)
 assert pane['height']<230,pane
 for card in page.locator('.map-unit-position[data-combat-side] foreignObject').all():
  box=card.bounding_box();assert abs(box['width']-48)<1,box
  assert box['x']+box['width']<=pane['x'] or box['x']>=pane['x']+pane['width'] or box['y']+box['height']<=pane['y']+1 or box['y']>=pane['y']+pane['height']-1,(pane,box)
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
  for _ in range(8):page.locator('[data-action="map-zoom-out"]').click()
  expect(page.locator('.atlas-scroll')).to_have_attribute('data-zoom','0.5')
  for z in ['0.5','5']:
   if z=='5':
    for _ in range(15):page.locator('[data-action="map-zoom-in"]').click()
   expect(page.locator('.atlas-scroll')).to_have_attribute('data-zoom',z)
   cards=page.locator('.map-unit-position').evaluate_all('els=>els.map(e=>({visible:getComputedStyle(e).visibility,width:e.querySelector("foreignObject").getBoundingClientRect().width}))')
   assert len(cards)>7;assert all(e['visible']=='visible' and 23.8<=e['width']<=36.2 for e in cards),cards
   assert page.locator('.country-tokens>.map-unit-position').count()==len(cards)
   assert page.locator('.unit-pin-tip').evaluate_all('els=>els.every(e=>{const p=e.closest(".map-unit-position"),s=e.closest("svg"),a=new DOMPoint(0,35).matrixTransform(e.getScreenCTM()),b=new DOMPoint(Number(p.dataset.mapX),Number(p.dataset.mapY)+35).matrixTransform(s.getScreenCTM());return Math.hypot(a.x-b.x,a.y-b.y)<.2})')
  page.locator('[data-action="map-zoom-reset"]').click()

  page.locator('nav [data-page="rules"]').click();expect(page.locator('[name="capitalReserveLimit"]')).to_have_value('10');expect(page.locator('[name="defenderCounterattack"]')).to_be_checked();expect(page.locator('[name="battlefieldRecovery"]')).to_be_checked();expect(page.locator('[name="counter-capture-0"]')).to_have_value('20');expect(page.locator('[name="counter-capture-1"]')).to_have_value('40')
  page.locator('[name="counter-capture-0"]').fill('21');page.locator('#rules-form button[type="submit"]').click();assert page.evaluate('JSON.parse(localStorage.getItem("saguk-studio.world.v1")).world.rules.counterCaptureThresholds[0]')==21;page.locator('[name="counter-capture-0"]').fill('20');page.locator('#rules-form button[type="submit"]').click()
  page.locator('nav [data-page="simulation"]').click();saved=page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")');page.locator('#sim-speed').select_option('8');page.clock.install(time=0);page.clock.pause_at(1000)
  page.locator(f'.history-entry[data-id="{f["turn"]}"]').click();page.locator('[data-action="map-fullscreen"]').click()
  print(label+': replay started',flush=True);seek(page,"()=>document.querySelector('.map-stage')?.dataset.event==='attack_roll'");pause(page);page.clock.run_for(700);print(label+': attack roll reached',flush=True);assert page.locator('.is-v16-duel .observer-bonuses>span').count()==10;assert page.locator('.mini-combat-details').count()==0
  expect(page.locator('.unit-combat-role,.battle-alert-label,.judgment-side-label')).to_have_count(0);expect(page.locator('.battle-side-token')).to_have_count(0);expect(page.locator('.map-unit-position[data-combat-side]')).to_have_count(2);expect(page.locator('.observer-score')).to_have_count(2);expect(page.locator('.observer-score[data-score-visible="false"]').last.locator('strong')).to_have_text('—')
  assert page.locator('[data-round-capture]').count()>0,'Earlier nations must retain their captures';assert page.locator('.round-retreat .retreat-arrow[marker-end],.round-relocation').count()>0
  assert page.locator('[data-round-route]').count()>1,'Earlier arrows must remain'
  assert page.locator('.campaign-route.defense,.march-routes,.round-relocation path').count()==0
  assert page.locator('.operational-front').count()==1
  assert page.locator('.operation-arrow[data-operation-count]').count()==page.locator('[data-round-route]').count()
  links={frozenset(pair) for pair in f['run']['initialWorld']['cartography']['links']}
  for route in page.locator('.operation-arrow').evaluate_all('els=>els.map(e=>[e.dataset.operationFrom,e.dataset.operationTo])'):
   assert frozenset(route) in links,route
  assert abs(page.locator('.mini-score-roll .visual-die.attached-die').first.evaluate('e=>parseFloat(getComputedStyle(e).width)')-43.2)<.5
  assert page.locator('.operation-movement').count()==0
  selectable=page.locator('.map-unit-position button[data-action="focus-unit"]').evaluate_all('els=>els.map(e=>e.dataset.id)')
  chosen=next((id for id in f['routePeople'] if id in selectable),None);assert chosen,'A visible commander with a revealed route is required'
  button=page.locator(f'.map-unit-position button[data-action="focus-unit"][data-id="{chosen}"]');view=page.locator('.atlas-map').get_attribute('viewBox')
  button.dispatch_event('click');assert page.locator('.operation-movement.is-selected').count()>0
  assert page.locator(f'.map-unit-position[data-person="{chosen}"]').get_attribute('data-selected')=='true'
  button.dispatch_event('click');assert page.locator('.operation-movement.is-selected').count()==0
  assert page.locator('.atlas-map').get_attribute('viewBox')==view
  layout(page);page.screenshot(path=str(ROOT/f'docs/v17-{label}-battle.png'))
  if mobile:
   for width,height in [(390,844),(844,390)]:
    page.set_viewport_size({'width':width,'height':height});page.clock.run_for(700);layout(page);page.screenshot(path=str(ROOT/f'.artifacts/v17-mobile-{width}.png'))
   page.set_viewport_size({'width':900,'height':600});page.clock.run_for(700)
  print(label+': layouts passed',flush=True);view=page.locator('.atlas-map').get_attribute('viewBox');routes=page.locator('[data-round-route]').count()
  page.keyboard.press('KeyA');seek(page,"()=>document.querySelector('.map-stage')?.dataset.effectStage==='territory'");pause(page)
  assert page.locator('.atlas-map').get_attribute('viewBox')==view,'Camera must stay at nation center'
  assert page.locator('[data-round-route]').count()>=routes
  for id in f['battle']['takenTerritoryIds']:
   capture=page.locator(f'[data-round-capture="{id}"]');expect(capture).to_have_count(1);assert capture.get_attribute('fill').startswith('url(#round-hatch-')
  page.screenshot(path=str(ROOT/f'docs/v17-{label}-capture.png'))
  page.keyboard.press('KeyA');seek(page,"()=>document.querySelector('.map-stage')?.dataset.event==='occupation'&&!!document.querySelector('.unit-marching')");pause(page)
  assert page.locator('.march-progress-dot').count()>0
  assert page.locator('.march-progress-dot').evaluate_all('els=>els.every(e=>{const d=e.getBoundingClientRect(),p=e.parentElement.querySelector("path").getBoundingClientRect(),x=d.x+d.width/2,y=d.y+d.height/2;return getComputedStyle(e).animationPlayState==="paused"&&x>=p.x-6&&x<=p.right+6&&y>=p.y-6&&y<=p.bottom+6})')
  page.keyboard.press('KeyA');seek(page,"()=>document.querySelector('.map-stage')?.dataset.event==='occupation'&&!document.querySelector('.unit-marching')");pause(page)
  winner=f['battle']['attackerPersonId'] if f['battle']['winner']==f['battle']['actor'] else f['battle']['defenderPersonId']
  expect(page.locator(f'.map-unit-position[data-person="{winner}"]')).to_have_attribute('data-camp',f['battle']['takenTerritoryIds'][0]);assert page.locator('[data-combat-side]').count()==0
  page.screenshot(path=str(ROOT/f'docs/v17-{label}-occupation.png'))
  page.keyboard.press('KeyA');seek(page,"()=>document.querySelector('.map-stage')?.dataset.turn==='42'&&document.querySelector('.map-stage')?.dataset.finished==='true'")
  assert page.locator('[data-round-capture],[data-round-route],.round-stalemate,.round-retreat,.round-relocation').count()==0,'All round traces must clear at the round boundary'
  owners=page.locator('.atlas-cell').evaluate_all('els=>Object.fromEntries(els.map(e=>[e.dataset.territory,e.dataset.owner]))');assert owners==f['expected']
  assert page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')==saved,'Replay must not save or advance the live campaign'
  page.keyboard.press('Escape');page.locator('[data-action="return-live"]').click();page.locator('[data-action="new-run"]').click();page.locator('#dialog-form button[type="submit"]').click();page.locator('[data-action="step"]').click();page.locator('[data-action="scene-skip"]').click()
  fresh=page.evaluate('JSON.parse(localStorage.getItem("saguk-studio.completed-run.v11"))');assert fresh['engineVersion']=='studio-v11-22';assert all(n['reserve']<=10 for n in fresh['engineState']['countries'])
  c.route('**/dist/**',lambda r:r.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist'/name)));c.set_offline(True);page.reload(wait_until='networkidle');expect(page.locator('.atlas-cell')).to_have_count(160)
  c.close();print('PASS '+label+': small pins at 50/500%, 1.2x duel, all modifiers, adjacent grouped arrows, selected marches, moving/paused route dots, occupation/retreat, nation camera, dense hatching, round commit, 8x replay, unchanged live save, new capital rules and offline HTML',flush=True)
 assert not errors,errors;assert not failed,failed;b.close();print('PASS JavaScript exceptions/request failures: 0',flush=True)
