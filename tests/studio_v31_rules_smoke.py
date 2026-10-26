"""Native playback of the new seasonal penalty and the king's return to capital."""
from pathlib import Path
from urllib.parse import quote
import subprocess,json
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];subprocess.run(['node','tests/make-v31-fixtures.mjs'],cwd=ROOT,check=True);errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for mobile in [False,True]:
  label='mobile' if mobile else 'normal';name='사국쟁패 Studio 모바일 경량.html' if mobile else '사국쟁패 Studio.html';ctx=b.new_context(viewport={'width':844 if mobile else 1600,'height':650 if mobile else 1000});page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));ctx.route('**/dist/**',lambda route:route.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist'/name)));ctx.set_offline(True);page.goto('http://127.0.0.1:3000/dist/'+quote(name),wait_until='networkidle');expect(page.locator('.page-footer')).to_contain_text('v0.31.0')
  def load(name):
   page.locator('#world-file').set_input_files(str(ROOT/'.artifacts'/name));expect(page.locator('[data-import-confirm]')).to_be_enabled(timeout=45000);page.locator('[data-import-confirm]').click();expect(page.locator('#file-import-dialog')).not_to_be_visible(timeout=45000)
  load('v31-rest.history.json');page.locator('[data-action=map-fullscreen]').click();mark=page.locator('[data-person=b0] .token-confusion');expect(mark).to_have_text('↓↓↓');expect(mark).to_have_attribute('data-confusion','6');assert page.locator('[data-person=b0] .unit-readiness').count()==0;page.locator('[data-person=b0] .map-unit-token').click();expect(page.locator('.commander-overview')).to_contain_text('이번 계절 혼란 −6 고정');page.screenshot(path=str(ROOT/f'docs/v31-{label}-season-confusion.png'));page.locator('[data-action=close-commander]').click();page.keyboard.press('Escape');before=page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")');page.reload(wait_until='networkidle');page.locator('nav [data-page=simulation]').click();page.locator('[data-action=map-fullscreen]').click();expect(page.locator('[data-person=b0] .token-confusion')).to_have_text('↓↓↓');page.keyboard.press('Escape');assert page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')==before
  load('v31-guard.history.json');page.locator('#sim-speed').select_option('2');page.clock.install(time=0);page.clock.pause_at(1000);page.locator('.history-entry[data-id="1"]').click();page.locator('[data-action=map-fullscreen]').click();page.evaluate('document.activeElement?.blur()')
  for _ in range(3000):
   if page.locator('.map-stage').get_attribute('data-event')=='royal_return' and page.locator('.map-stage').get_attribute('data-kind')=='movement':break
   if page.locator('.map-stage').get_attribute('data-playing')!='true':page.keyboard.press('a')
   page.clock.run_for(20)
  else:raise AssertionError('royal return movement not reached')
  page.keyboard.press('a');page.clock.run_for(20)
  king=page.locator('.map-unit-position[data-unit-role=king][data-country=b]');assert king.count()==1;assert king.locator('.march-label').text_content() in ['수도 복귀','재배치'];page.screenshot(path=str(ROOT/f'docs/v31-{label}-royal-return.png'));page.keyboard.press('Escape');page.locator('[data-action=return-live]').click();page.locator('[data-action=map-fullscreen]').click();expect(page.locator('.map-unit-position[data-unit-role=king][data-country=b]')).to_have_attribute('data-camp','tile-7');ctx.close();print('PASS '+label+': seasonal-6 badge/details survive reload, actual royal return motion and final capital camp',flush=True)
 assert not errors,errors;b.close();print('PASS app exceptions0',flush=True)
