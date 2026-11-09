"""Offline standalone at recording speeds2x and4x, using an actual engine history."""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
errors=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':1600,'height':1000},device_scale_factor=1)
 c.route('**/game.html',lambda r:r.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist/사국쟁패 Studio.html')))
 c.set_offline(True)
 for speed in [2,4]:
  p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)))
  p.goto('http://127.0.0.1:3000/game.html',wait_until='networkidle',timeout=120000)
  expect(p.locator('.page-footer')).to_contain_text('v0.55.0',timeout=90000)
  p.locator('#world-file').set_input_files(str(ROOT/'.artifacts/v52-10.history.json'));expect(p.locator('[data-import-confirm]')).to_be_enabled(timeout=90000);p.locator('[data-import-confirm]').click();expect(p.locator('#file-import-dialog')).not_to_be_visible(timeout=90000)
  p.locator('#sim-speed').select_option(str(speed));p.clock.install(time=0);p.clock.pause_at(1000)
  p.locator('.history-entry[data-id="1"]').click();p.locator('[data-action=map-fullscreen]').click();p.evaluate('document.activeElement?.blur()');p.keyboard.press('s')
  seen_entry=False
  for _ in range(800):
   if p.locator('.entry-territory-name').count():seen_entry=True
   if p.locator('.mass-battle').count():break
   p.clock.run_for(100)
  else:raise AssertionError('missing arena '+str(errors))
  assert seen_entry,'battle location must appear on the map before the arena'
  start=p.evaluate('Date.now()');p.keyboard.press('a');p.wait_for_timeout(700);p.clock.run_for(1)
  pane=p.locator('.mass-battle');assert '⚔ 공격' in pane.inner_text() and '🛡 방어' in pane.inner_text()
  box=pane.bounding_box();p.keyboard.press('ArrowRight');p.clock.run_for(1);assert pane.bounding_box()==box
  p.keyboard.press('a');commands=False;attacks=False;guards=False
  for _ in range(100):
   if p.locator('.mass-command.is-active[data-mass-command=attack]').count() and p.locator('.mass-command.is-active[data-mass-command=defense]').count():commands=True
   attacks|=bool(p.locator('[data-mass-unit][data-action=attack]').count());guards|=bool(p.locator('[data-mass-unit][data-action=guard]').count())
   if p.locator('.mass-battle[data-mass-phase=summary]').count():break
   p.clock.run_for(100)
  assert commands and attacks and guards,(commands,attacks,guards,errors)
  assert p.evaluate('Date.now()')-start>=(7000 if speed==2 else 3400)
  p.keyboard.press('a');p.locator('[data-action=mass-replay]').click();p.clock.run_for(1500);p.keyboard.press('a');p.screenshot(path=str(ROOT/f'docs/v55-orders-{speed}x.png'),animations='disabled',timeout=120000)
  p.locator('[data-action=mass-skip]').click();p.locator('[data-action=mass-map]').click()
  expect(p.locator('.map-stage')).to_have_attribute('data-batch-retreat','true');p.wait_for_timeout(400);p.clock.run_for(1)
  moving=p.locator('.map-unit-position[data-motion-pin]');assert moving.count()>=2
  arrows=p.locator('.round-retreat[data-live-march=true]');assert arrows.count()>=2
  for arrow in arrows.all():
   person=arrow.get_attribute('data-route-person');tip=arrow.get_attribute('data-motion-tip');pin=p.locator('.map-unit-position').evaluate_all('(ns,id)=>ns.find(n=>n.dataset.person===id)?.dataset.motionPin',person)
   assert tip and pin and all(abs(float(a)-float(b))<.01 for a,b in zip(tip.split(','),pin.split(','))),(person,tip,pin)
  p.screenshot(path=str(ROOT/f'docs/v55-retreat-{speed}x.png'),animations='disabled',timeout=120000)
  if not p.locator('.map-stage').get_attribute('data-playing')=='true':p.keyboard.press('a')
  for _ in range(150):
   if p.locator('.map-stage').get_attribute('data-finished')=='true':break
   p.clock.run_for(100)
  assert not errors,errors
  p.close()
 b.close()
 print('PASS offline2x/4x: map entry, fixed quarter arena, both commands, attack/guard cycles, protected summary, replay/skip, concurrent retreat and matching arrow tips, no app errors')
