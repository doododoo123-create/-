"""Offline v45: real group map-first/static report, skills, faces and critical 1x."""
from pathlib import Path
import subprocess,json
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
errors=[];failed=[]
def seek(page,predicate,limit=6000):
 for i in range(limit):
  if page.evaluate(predicate):return
  if i%500==499:print('seeking',predicate,page.locator('.map-stage').get_attribute('data-event'),page.locator('.map-stage').get_attribute('data-kind'),flush=True)
  if page.locator('.map-stage').get_attribute('data-playing')!='true':page.keyboard.press('a')
  page.clock.run_for(20)
 page.screenshot(path=str(ROOT/'.artifacts/v45-failure.png'));raise AssertionError(predicate+' '+str(errors))
def import_history(page,name):
 page.locator('#world-file').set_input_files(str(ROOT/'.artifacts'/name));expect(page.locator('[data-import-confirm]')).to_be_enabled(timeout=45000);page.locator('[data-import-confirm]').click();expect(page.locator('#file-import-dialog')).not_to_be_visible(timeout=45000)
def photo_keys(page):
 return page.locator('.map-unit-position:not(.is-army-group) > .unit-card-scaler .token-portraits img').evaluate_all('(xs)=>xs.map(e=>e.dataset.portraitKey)')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);ctx=browser.new_context(viewport={'width':1600,'height':1000});ctx.route('**/game.html',lambda r:r.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist/사국쟁패 Studio.html')));ctx.set_offline(True);page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda r:failed.append(r.url) if not r.url.startswith('blob:') else None);page.goto('http://127.0.0.1:3000/game.html',wait_until='networkidle',timeout=90000);expect(page.locator('.page-footer')).to_contain_text('v0.45.0',timeout=90000)
 page.locator('nav [data-page=people]').click();page.locator('.person-card:has(.role-badge:text-is("장군")) [data-action=edit-person]').first.click();expect(page.locator('[name=personalAbility]')).to_be_visible();page.locator('[name=personalAbility]').fill('3');page.locator('#dialog-form [type=submit]').click();page.locator('.person-card:has(.role-badge:text-is("장군")) [data-action=edit-person]').first.click();assert page.locator('[name=personalAbility]').input_value()=='3';page.locator('#editor-dialog [data-action=close-dialog]').first.click();print('PASS personal skill editing and persistence',flush=True)
 import_history(page,'v45-four.history.json');page.locator('#sim-speed').select_option('2');page.clock.install(time=0);page.clock.pause_at(1000);saved=page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")');page.locator('.history-entry[data-id="1"]').click();page.locator('[data-action=map-fullscreen]').click();page.evaluate('document.activeElement?.blur()')
 seek(page,"()=>document.querySelector('.map-stage')?.dataset.kind==='army-forming'");page.keyboard.press('a');assert page.locator('.campaign-popup').count()==0;page.screenshot(path=str(ROOT/'docs/v45-assembly.png'))
 seek(page,"()=>!!document.querySelector('[data-engagement][data-combat-side=attack]')&&document.querySelector('.map-stage')?.dataset.event==='resolve'");page.keyboard.press('a');assert page.locator('[data-engagement][data-combat-side=attack]').count()==4;assert page.locator('[data-engagement][data-combat-side=defense]').count()==4;assert page.locator('.campaign-popup').count()==0;page.screenshot(path=str(ROOT/'docs/v45-map-first.png'))
 seek(page,"()=>document.querySelector('.campaign-popup')?.dataset.campaignPhase==='report'");page.keyboard.press('a');expect(page.locator('.campaign-duel')).to_have_count(7);assert page.locator('[data-duel-complete=false]').count()==0;assert page.locator('[data-active-roll=true],.campaign-score.is-rolling,[data-score-phase=rolling]').count()==0;assert page.locator('[data-score-verdict]').count()==14;expect(page.locator('.campaign-popup')).to_contain_text('개인 무장');assert page.locator('[data-score-phase=locked]').count()==14
 before=page.locator('.campaign-popup').inner_html();page.clock.run_for(300);assert page.locator('.campaign-popup').inner_html()==before;page.screenshot(path=str(ROOT/'docs/v45-report.png'));print('PASS real4v4 movement/cohort first, one static seven-row result report, all14 verdicts and separate bonuses',flush=True)
 # Check visible portraits by person identity, ignoring repeated depictions of the same officer.
 faces=page.locator('.map-unit-position:not(.is-army-group)').evaluate_all('''xs=>xs.map(x=>({id:x.dataset.person,key:x.querySelector('.token-portraits img')?.dataset.portraitKey})).filter(x=>x.id&&x.key)''');assert faces;keys=[f['key'] for f in faces];assert len(keys)==len(set(keys)),faces
 page.keyboard.press('Escape');page.locator('[data-action=return-live]').click();assert page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')==saved
 page.clock.resume();import_history(page,'v45-death.history.json');page.locator('#sim-speed').select_option('16');page.clock.pause_at(100000);page.locator('.history-entry[data-id="1"]').click();page.locator('[data-action=map-fullscreen]').click();page.evaluate('document.activeElement?.blur()')
 seek(page,"()=>document.querySelector('.map-stage')?.dataset.event==='death'&&document.querySelector('.map-stage')?.dataset.kind==='apply'");assert page.locator('.map-stage').get_attribute('data-effective-speed')=='1';assert page.locator('.unit-death').count()>0;page.screenshot(path=str(ROOT/'docs/v45-death-1x.png'));page.clock.run_for(400);assert page.locator('.map-stage').get_attribute('data-effective-speed')=='1'
 seek(page,"()=>document.querySelector('.map-stage')?.dataset.effectiveSpeed==='16'&&document.querySelector('.map-stage')?.dataset.event!=='death'");print('PASS16x temporarily becomes actual1x for death, returns16x automatically',flush=True)
 seek(page,"()=>document.querySelector('.map-stage')?.dataset.event==='appointment'&&document.querySelector('.map-stage')?.dataset.kind==='apply'",limit=16000);assert page.locator('.map-stage').get_attribute('data-effective-speed')=='1';page.screenshot(path=str(ROOT/'docs/v45-appointment-1x.png'));print('PASS appointment normal-speed exception across continuous historical replay',flush=True)
 assert not errors,errors;assert not failed,failed;browser.close();print('PASS zero app exceptions/external request failures, offline HTML',flush=True)
