"""Actual offline editions: ordered marches, capture arrival, local notices, capital ring, dice sums and 90 portraits."""
from pathlib import Path
from urllib.parse import quote
import json,subprocess
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
subprocess.run(['node','tests/make-v20-fixture.mjs'],cwd=ROOT,check=True)
f=json.loads((ROOT/'.artifacts/v20-browser-fixture.json').read_text());cap=json.loads((ROOT/'.artifacts/v20-capital-fixture.json').read_text());ref=json.loads((ROOT/'.artifacts/v20-refusal-fixture.json').read_text())
errors=[];failed=[]
def seek(page,predicate,limit=1800):
 for i in range(limit):
  if page.evaluate(predicate):return
  page.clock.run_for(60)
 page.screenshot(path=str(ROOT/'.artifacts/v20-failure.png'))
 raise AssertionError('Missing scene '+predicate+'; current '+str(page.locator('.map-stage').evaluate('e=>({...e.dataset})'))+' errors '+str(errors))
def pause(page):
 if page.locator('.map-stage').get_attribute('data-playing')=='true':page.locator('.map-play-toggle').click()
def resume(page):
 if page.locator('.map-stage').get_attribute('data-playing')!='true':page.locator('.map-play-toggle').click()
def open_replay(page,turn):
 page.locator(f'.history-entry[data-id="{turn}"]').click();page.locator('[data-action="map-fullscreen"]').click()
def leave(page):
 pause(page);page.keyboard.press('Escape');page.locator('[data-action="return-live"]').click()
def inside(box,v):return box['x']>=-1 and box['y']>=-1 and box['x']+box['width']<=v['width']+1 and box['y']+box['height']<=v['height']+1
def overlap(a,b):return max(0,min(a['x']+a['width'],b['x']+b['width'])-max(a['x'],b['x']))*max(0,min(a['y']+a['height'],b['y']+b['height'])-max(a['y'],b['y']))
def layout(page):
 pane=page.locator('.is-compact-duel').bounding_box();assert inside(pane,page.viewport_size),pane
 assert 334<=pane['width']<=338
 for c in page.locator('.map-unit-position[data-combat-side]').all():
  for node in c.locator('foreignObject,.unit-combat-role,.unit-loss-label,.unit-feedback-text').all():assert overlap(pane,node.bounding_box())<2,(pane,node.bounding_box())
 assert overlap(pane,page.locator('.map-play-toggle').bounding_box())<2
 cards=page.locator('.map-unit-position[data-combat-side]').evaluate_all('els=>els.map(e=>[Number(e.dataset.combatScreenX),Number(e.dataset.combatScreenY)])');assert abs(cards[0][1]-cards[1][1])<.1
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'],headless=True)
 def opened(mobile,fixture):
  c=browser.new_context(viewport={'width':900,'height':600} if mobile else {'width':1600,'height':1000},has_touch=mobile)
  page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda r:failed.append(r.url));page.on('dialog',lambda d:d.accept())
  page.add_init_script('if(!localStorage.getItem("saguk-studio.world.v1")){localStorage.setItem("saguk-studio.world.v1",'+json.dumps(json.dumps(fixture['world']))+');localStorage.setItem("saguk-studio.completed-run.v11",'+json.dumps(json.dumps(fixture['run']))+');}')
  name='사국쟁패 Studio 모바일 경량.html' if mobile else '사국쟁패 Studio.html';page.goto('http://127.0.0.1:3000/dist/'+quote(name),wait_until='networkidle');expect(page.locator('.atlas-cell')).to_have_count(160)
  assert 'v0.20.0' in page.locator('.page-footer').inner_text();assert page.locator('.map-unit-token img').evaluate_all('els=>els.every(e=>e.src.startsWith("data:image/jpeg;base64,"))')
  page.locator('nav [data-page="simulation"]').click();page.locator('#sim-speed').select_option('8');page.clock.install(time=0);page.clock.pause_at(1000)
  return c,page,name
 for mobile in [False,True]:
  label='mobile' if mobile else 'normal';c,page,name=opened(mobile,f);saved=page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')
  open_replay(page,f['ministerTurn']);seek(page,"()=>!!document.querySelector('.is-royal-choice[data-event=minister]')");pause(page)
  expect(page.locator('[data-unit-role=minister]')).to_have_count(1);assert page.locator('.is-royal-choice').get_attribute('data-anchor-role')=='minister'
  resume(page);seek(page,"()=>!!document.querySelector('.is-royal-die[data-event=domestic_roll]')");pause(page);assert inside(page.locator('.is-royal-die').bounding_box(),page.viewport_size);page.screenshot(path=str(ROOT/f'docs/v20-{label}-minister.png'))
  resume(page);seek(page,"()=>document.querySelector('.map-stage')?.dataset.kind==='result'&&document.querySelector('.map-stage')?.dataset.event==='resolve'");pause(page)
  assert page.locator('.map-event-announcement,.global-history-notice,.map-judgment').count()==0
  notice=page.locator('[data-unit-role=minister] .unit-local-notice');expect(notice).to_have_count(1);assert any(w in notice.text_content() for w in ['성공','실패']);page.screenshot(path=str(ROOT/f'docs/v20-{label}-domestic-result.png'));leave(page)
  print(label+': local minister result and portraits passed',flush=True)

  open_replay(page,f['movementTurn']);bi=f['movementBattle']['index'];b=f['movementBattle'];target=b['territoryId'];captor=b['actorId'];pred=f"document.querySelector('.map-stage')?.dataset.battleIndex==='{bi}'"
  seek(page,"()=>"+pred+"&&document.querySelector('.map-stage')?.dataset.kind==='movement'&&document.querySelector('.map-stage')?.dataset.movementSide==='attack'");pause(page)
  expect(page.locator('.unit-marching')).to_have_count(1);assert page.locator('.operation-arrow').count()==0;assert page.locator('.is-compact-duel').count()==0
  view=page.locator('.atlas-map').get_attribute('viewBox');snapshot=page.locator('.unit-marching').get_attribute('style');page.clock.run_for(1000);assert page.locator('.unit-marching').get_attribute('style')==snapshot;expect(page.locator('.map-play-toggle')).to_have_attribute('aria-label','재생')
  page.screenshot(path=str(ROOT/f'docs/v20-{label}-attack-march.png'));resume(page)
  seek(page,"()=>"+pred+"&&document.querySelector('.map-stage')?.dataset.kind==='route'&&document.querySelector('.map-stage')?.dataset.routeSides==='attack'");pause(page)
  expect(page.locator('.operation-arrow')).to_have_count(1);assert page.locator('.campaign-route.defense').count()==0;resume(page)
  seek(page,"()=>"+pred+"&&document.querySelector('.map-stage')?.dataset.kind==='movement'&&document.querySelector('.map-stage')?.dataset.movementSide==='defense'");pause(page)
  expect(page.locator('.unit-marching')).to_have_count(1);expect(page.locator('.operation-arrow')).to_have_count(1);assert page.locator('.campaign-route.defense').count()==0;resume(page)
  seek(page,"()=>"+pred+"&&document.querySelector('.map-stage')?.dataset.kind==='route'&&document.querySelector('.map-stage')?.dataset.routeSides==='attack,defense'");pause(page)
  expect(page.locator('.operation-arrow')).to_have_count(2);assert page.locator('.campaign-route').evaluate_all('els=>els.every(e=>getComputedStyle(e).strokeDasharray==="none")');assert page.locator('.round-march.outbound,.round-march.return,.round-march.relief').count()==0;page.screenshot(path=str(ROOT/f'docs/v20-{label}-ordered-routes.png'));resume(page)
  seek(page,"()=>"+pred+"&&document.querySelector('.map-stage')?.dataset.event==='attack_roll'");pause(page)
  expect(page.locator('.unit-role-background')).to_have_count(2);assert page.locator('.observer-score').count()==0;assert page.locator('.observer-bonuses>span').count()==10
  assert page.locator('.map-unit-position:not([data-combat-side])').evaluate_all('els=>els.every(e=>getComputedStyle(e).opacity==="1"&&getComputedStyle(e.querySelector(".map-unit-token")).opacity==="1")')
  layout(page);page.screenshot(path=str(ROOT/f'docs/v20-{label}-battle.png'));resume(page)
  seek(page,"()=>"+pred+"&&document.querySelector('.map-stage')?.dataset.kind==='movement'&&document.querySelector('.map-stage')?.dataset.event==='occupation'");pause(page)
  assert page.locator(f'[data-round-capture="{target}"][data-capture-owner="{captor}"]').count()==0
  assert page.locator('.map-event-announcement,.global-history-notice').count()==0;resume(page)
  seek(page,"()=>"+pred+"&&document.querySelector('.map-stage')?.dataset.kind==='arrival'");pause(page)
  expect(page.locator(f'[data-round-capture="{target}"][data-capture-owner="{captor}"]')).to_have_count(1)
  expect(page.locator(f'[data-person="{b["attackerPersonId"]}"]')).to_have_attribute('data-camp',target);assert page.locator('.atlas-map').get_attribute('viewBox')==view
  page.screenshot(path=str(ROOT/f'docs/v20-{label}-arrival.png'));page.keyboard.press('KeyS');expect(page.locator('.map-stage')).to_have_attribute('data-finished','true');assert page.locator('[data-round-capture]').count()>0;leave(page)
  print(label+': sequential moves/arrows and occupation-after-arrival passed',flush=True)

  open_replay(page,f['turn']);seek(page,"()=>document.querySelector('.map-stage')?.dataset.event==='attack_roll'&&document.querySelector('.map-stage')?.dataset.phase==='merging'");pause(page)
  flight=page.locator('.bonus-flight');expect(flight).to_have_count(1);assert flight.inner_text().strip();assert flight.evaluate('e=>getComputedStyle(e).animationPlayState')=='paused'
  before=page.locator('.accumulating-die').evaluate_all('els=>els.map(e=>e.outerHTML)');page.clock.run_for(1500);assert page.locator('.accumulating-die').evaluate_all('els=>els.map(e=>e.outerHTML)')==before
  page.screenshot(path=str(ROOT/f'docs/v20-{label}-bonus-flight.png'));resume(page)
  seek(page,"()=>document.querySelector('.map-stage')?.dataset.event==='attack_roll'&&document.querySelector('.map-stage')?.dataset.phase==='locked'");pause(page)
  die=page.locator('.judgment-side.attack .visual-die');assert int(die.get_attribute('data-die-value'))==f['battle']['attack']['score'];assert page.locator('.judgment-side.defense .accumulating-die').get_attribute('data-score-visible')=='false'
  if mobile:
   for width,height in [(390,844),(844,390)]:
    page.set_viewport_size({'width':width,'height':height});page.clock.run_for(150);layout(page);page.screenshot(path=str(ROOT/f'.artifacts/v20-mobile-{width}.png'))
   page.set_viewport_size({'width':900,'height':600});page.clock.run_for(150)
  resume(page);seek(page,"()=>document.querySelector('.map-stage')?.dataset.event==='retreat'&&document.querySelector('.map-stage')?.dataset.kind==='focus'");pause(page)
  assert page.locator('.map-event-announcement,.global-history-notice,.map-judgment').count()==0;expect(page.locator('.unit-local-notice[data-notice-kind=retreat]')).to_have_count(1);page.screenshot(path=str(ROOT/f'docs/v20-{label}-local-retreat.png'));leave(page)
  assert page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')==saved;c.close()

  cc,pg,_=opened(mobile,cap);open_replay(pg,cap['turn']);seek(pg,"()=>!!document.querySelector('[data-notice=capital_fall]')");pause(pg)
  assert pg.locator('.global-history-notice').count()==1;assert '수도 함락' in pg.locator('.global-history-notice').inner_text()
  owner=cap['battle']['actorId'] if cap['battle']['captureOwner']==cap['battle']['actor'] else cap['battle']['defenderId']
  for tid in cap['battle']['takenTerritoryIds']:expect(pg.locator(f'[data-round-capture="{tid}"]')).to_have_attribute('data-capture-owner',owner)
  pg.screenshot(path=str(ROOT/f'docs/v20-{label}-capital.png'));leave(pg)
  pg.locator('nav [data-page="rules"]').click();expect(pg.locator('[name=capitalFallAnnexation]')).to_be_checked();pg.locator('nav [data-page="simulation"]').click();pg.locator('[data-action=new-run]').click();pg.locator('#dialog-form button[type=submit]').click();pg.locator('[data-action=step]').click();pg.locator('[data-action=scene-skip]').click()
  fresh=pg.evaluate('JSON.parse(localStorage.getItem("saguk-studio.completed-run.v11"))');assert fresh['engineVersion']=='studio-v11-24' and fresh['initialWorld']['rules']['capitalFallAnnexation'];assert all(n['reserve']<=10 for n in fresh['engineState']['countries'])
  cc.route('**/dist/**',lambda r:r.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist'/name)));cc.set_offline(True);pg.reload(wait_until='networkidle');expect(pg.locator('.atlas-cell')).to_have_count(160);cc.close()
  rc,rp,_=opened(mobile,ref);open_replay(rp,1);seek(rp,"()=>document.querySelector('.map-stage')?.dataset.event==='hold'");pause(rp)
  text=rp.locator('.unit-local-notice.is-refusal');expect(text).to_have_count(1);expect(text).to_have_text('출정 거부');assert text.evaluate('e=>getComputedStyle(e).fill')=='rgb(255, 48, 63)';assert rp.locator('.map-judgment,.map-event-announcement,.global-history-notice').count()==0
  rp.screenshot(path=str(ROOT/f'docs/v20-{label}-refusal.png'));rc.close()
  print('PASS '+label+': 90 JPEG portraits, serial combat marches/arrows, arrival-before-hatch, local notices/refusal/domestic, nation role badges, signed in-die bonus animation and paused 8x clock, capital fall ring, play button, saved-history isolation, offline HTML',flush=True)
 assert not errors,errors;assert not failed,failed;browser.close();print('PASS JavaScript exceptions/request failures: 0',flush=True)
