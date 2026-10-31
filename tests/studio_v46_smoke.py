"""Offline: report real-time1s at1/16x, same-person exile recruitment and regional desertion."""
from pathlib import Path
import json,subprocess
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
subprocess.run(['node','tests/make-v46-fixtures.mjs'],cwd=ROOT,check=True)
errors=[];failed=[]
def load(page,name):
 page.locator('#world-file').set_input_files(str(ROOT/'.artifacts'/name));expect(page.locator('[data-import-confirm]')).to_be_enabled(timeout=60000);page.locator('[data-import-confirm]').click();expect(page.locator('#file-import-dialog')).not_to_be_visible(timeout=60000)
def seek(page,predicate,step=40,limit=5000):
 for i in range(limit):
  if page.evaluate(predicate):return
  if page.locator('.map-stage').get_attribute('data-playing')!='true':page.keyboard.press('a')
  page.clock.run_for(step)
 page.screenshot(path=str(ROOT/'.artifacts/v46-failure.png'));raise AssertionError(predicate+' '+str(errors))
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);ctx=b.new_context(viewport={'width':1600,'height':1000});ctx.route('**/game.html',lambda r:r.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist/사국쟁패 Studio.html')));ctx.set_offline(True);page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda r:failed.append(r.url) if not r.url.startswith('blob:') else None);page.goto('http://127.0.0.1:3000/game.html',wait_until='networkidle',timeout=90000);expect(page.locator('.page-footer')).to_contain_text('v0.46.0',timeout=90000)
 # The same existing35 history is displayed using the revised presentation.
 load(page,'v45-four.history.json');page.clock.install(time=0);page.clock.pause_at(1000)
 for speed in ['1','16']:
  page.locator('#sim-speed').select_option(speed);page.locator('.history-entry[data-id="1"]').click();page.locator('[data-action=map-fullscreen]').click();page.evaluate('document.activeElement?.blur()');seek(page,"()=>document.querySelector('.campaign-popup')?.dataset.campaignPhase==='report'",step=40);assert page.locator('.map-stage').get_attribute('data-effective-speed')=='1';assert page.locator('[data-duel-complete=true]').count()==7;page.clock.run_for(800);assert page.locator('.campaign-popup[data-campaign-phase=report]').count()==1
  if speed=='16':page.screenshot(path=str(ROOT/'docs/v46-report-1s.png'))
  page.clock.run_for(260);assert page.locator('.campaign-popup[data-campaign-phase=report]').count()==0;page.keyboard.press('Escape');page.locator('[data-action=return-live]').click();print('PASS fixed1-second report at'+speed+'x',flush=True)
 page.clock.resume();load(page,'v46-exile.history.json');page.locator('[data-action=map-fullscreen]').click();hero=page.locator('.map-unit-position[data-person=b0]');expect(hero).to_have_attribute('data-country','a');expect(hero).to_have_count(1);hero.locator('.map-unit-token').click();panel=page.locator('[data-commander-overview=b0]');expect(panel).to_contain_text('망국 재등용');expect(panel).to_contain_text('b국 → a국');expect(panel).to_contain_text('3승');assert panel.locator('header img').get_attribute('data-portrait-key')=='general-037';page.screenshot(path=str(ROOT/'docs/v46-reemployed-veteran.png'));page.locator('[data-action=close-commander]').click();page.keyboard.press('Escape');print('PASS actual veteran b0 joined a with same face, prior victories and career overview',flush=True)
 load(page,'v46-regions.history.json');page.locator('#sim-speed').select_option('8');page.clock.pause_at(100000);page.locator('.history-entry[data-id="3"]').click();page.locator('[data-action=map-fullscreen]').click();page.evaluate('document.activeElement?.blur()');seek(page,"()=>document.querySelector('.map-stage')?.dataset.event==='desertion'&&[...document.querySelectorAll('[data-notice-kind=desertion]')].some(e=>e.textContent.includes('고립지 2칸'))");page.keyboard.press('a');notices=page.locator('[data-notice-kind=desertion]').all_text_contents();assert any('고립지 2칸 · 유지 10만' in n for n in notices),notices;page.screenshot(path=str(ROOT/'docs/v46-isolated-maintenance.png'));page.keyboard.press('Escape');page.locator('[data-action=return-live]').click();page.clock.resume();page.reload(wait_until='networkidle');page.locator('nav [data-page=simulation]').click();expect(page.locator('.history-panel .count-badge')).to_have_text('3턴');print('PASS real isolated maintenance losses and card labels, live save protected/reloaded',flush=True)
 assert not errors,errors;assert not failed,failed;b.close();print('PASS offline HTML, app exceptions/external request failures:0',flush=True)
