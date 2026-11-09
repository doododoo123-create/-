"""Real automatic battle->map->next-country handoff with camera following."""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];errors=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':1600,'height':1000});c.route('**/game.html',lambda r:r.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist/사국쟁패 Studio.html')));c.set_offline(True)
 p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.goto('http://127.0.0.1:3000/game.html',wait_until='networkidle',timeout=120000);expect(p.locator('.page-footer')).to_contain_text('v0.54.0',timeout=90000)
 p.locator('#world-file').set_input_files(str(ROOT/'.artifacts/v521-transition.history.json'));expect(p.locator('[data-import-confirm]')).to_be_enabled(timeout=90000);p.locator('[data-import-confirm]').click();expect(p.locator('#file-import-dialog')).not_to_be_visible(timeout=90000)
 p.locator('#sim-speed').select_option('16');p.clock.install(time=0);p.clock.pause_at(1000);p.locator('.history-entry[data-id="1"]').click();p.locator('[data-action=map-fullscreen]').click();p.evaluate('document.activeElement?.blur()');p.keyboard.press('s');expect(p.locator('.map-follow-toggle')).to_have_attribute('aria-pressed','true')
 seen=set();mass=False;returned=False
 for _ in range(2500):
  stage=p.locator('.map-stage');turn=stage.get_attribute('data-turn');kind=stage.get_attribute('data-kind');seen.add(turn)
  if p.locator('.mass-battle').count():mass=True
  elif mass and turn=='1':returned=True
  if turn=='3' and stage.get_attribute('data-finished')=='true':break
  if errors:raise AssertionError(errors)
  p.clock.run_for(100)
 else:raise AssertionError('did not finish third turn '+str(seen)+' '+str(errors))
 assert mass and returned and {'1','2','3'}<=seen,(mass,returned,seen)
 assert not errors,errors
 p.keyboard.press('ArrowRight');assert not errors,errors
 p.screenshot(path=str(ROOT/'docs/v54-auto-map-return.png'));b.close();print('PASS camera follow ON: automatic army ending, map handoff, turns1/2/3, completion and pan; no page errors')
