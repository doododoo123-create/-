"""Offline acceptance for direct release, overlaid sequential defenders, returns and fresh-turn routes."""
from pathlib import Path
from urllib.parse import quote
import subprocess
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];subprocess.run(['node','tests/make-v38-fixtures.mjs'],cwd=ROOT,check=True)
errors=[];failed=[]
def seek(page,predicate,limit=6000):
 for _ in range(limit):
  if page.evaluate(predicate):return
  if page.locator('.map-stage').get_attribute('data-playing')!='true':page.keyboard.press('a')
  page.clock.run_for(15)
 page.screenshot(path=str(ROOT/'.artifacts/v38-failure.png'));raise AssertionError(predicate+' errors '+str(errors))
def open_replay(page,kind,installed):
 if installed:page.clock.set_system_time(1000);page.clock.resume()
 page.locator('#world-file').set_input_files(str(ROOT/f'.artifacts/v38-{kind}.history.json'));expect(page.locator('[data-import-confirm]')).to_be_enabled(timeout=45000);page.locator('[data-import-confirm]').click();expect(page.locator('#file-import-dialog')).not_to_be_visible();page.locator('#sim-speed').select_option('2')
 if installed:page.clock.pause_at(page.evaluate('Date.now()')+100)
 else:page.clock.install(time=0);page.clock.pause_at(1000)
 page.locator('.history-entry[data-id="1"]').click();page.locator('[data-action=map-fullscreen]').click();page.evaluate('document.activeElement?.blur()');return page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')
def back(page,saved):
 page.keyboard.press('Escape');page.locator('[data-action=return-live]').click();assert page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')==saved
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for mobile,width,height in [(False,1600,1000),(True,844,650),(True,390,844)]:
  label='portrait' if width==390 else 'mobile' if mobile else 'normal';name='사국쟁패 Studio 모바일 경량.html' if mobile else '사국쟁패 Studio.html';ctx=b.new_context(viewport={'width':width,'height':height});page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda r:failed.append(r.url));ctx.route('**/dist/**',lambda r:r.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist'/name)));ctx.set_offline(True);page.goto('http://127.0.0.1:3000/dist/'+quote(name),wait_until='networkidle');expect(page.locator('.page-footer')).to_contain_text('v0.38.0',timeout=45000)
  saved=open_replay(page,'cohort',False)
  seek(page,"()=>document.querySelector('.map-stage')?.dataset.event==='attack_roll'");assert page.locator('[data-engagement]').count()==0
  # Army text must occupy its own copy row underneath the full face.
  cards=page.locator('[data-army-group] .map-unit-token:has(.token-army-caption)');assert cards.count()>0
  for card in cards.all():
   face=card.locator('.token-portraits').bounding_box();caption=card.locator('.token-army-caption').bounding_box();box=card.bounding_box();assert face['y']+face['height']<=caption['y']+1;assert caption['y']+caption['height']<=box['y']+box['height']+1
  page.screenshot(path=str(ROOT/f'docs/v38-{label}-portrait.png'))
  seek(page,"()=>document.querySelectorAll('[data-engagement][data-combat-side=defense]').length===3&&document.querySelector('.map-stage')?.dataset.event==='resolve'&&document.querySelector('.map-stage')?.dataset.kind==='apply'");assert page.locator('[data-engagement][data-combat-side=attack]').count()==1
  for slot in ['b0','b1','b2']:assert page.locator('[data-engagement][data-person='+slot+']').get_attribute('data-stack-count')=='3'
  assert page.locator('[data-engagement][data-stack-front=true][data-combat-side=defense]').get_attribute('data-person')=='b0';page.screenshot(path=str(ROOT/f'docs/v38-{label}-cohort.png'))
  seek(page,"()=>document.querySelector('.map-stage')?.dataset.battleIndex==='1'&&document.querySelector('.map-stage')?.dataset.event==='resolve'&&document.querySelector('.map-stage')?.dataset.kind==='apply'");assert page.locator('[data-engagement][data-stack-front=true][data-combat-side=defense]').get_attribute('data-person')=='b1';assert page.locator('[data-person=b0] .unit-result-label').count()==1;assert page.locator('[data-engagement][data-combat-side=defense]').count()==3;page.screenshot(path=str(ROOT/f'docs/v38-{label}-cohort-next.png'))
  seek(page,"()=>document.querySelector('.map-stage')?.dataset.event==='cohort_retreat'");assert page.locator('[data-engagement]').count()==0;back(page,saved)
  saved=open_replay(page,'reinforce',True);seek(page,"()=>!!document.querySelector('[data-reinforcement]')");expect(page.locator('[data-reinforcement]')).to_contain_text('방어군 증원!');expect(page.locator('[data-reinforcement]')).to_contain_text('b1');notice=page.locator('[data-reinforcement]').bounding_box();panel=page.locator('.campaign-popup').bounding_box();assert notice['x']>=panel['x'] and notice['x']+notice['width']<=panel['x']+panel['width']+1;page.screenshot(path=str(ROOT/f'docs/v38-{label}-reinforcement.png'));back(page,saved)
  saved=open_replay(page,'domestic',True);seek(page,"()=>document.querySelector('.map-stage')?.dataset.event==='home_return'&&document.querySelector('.map-stage')?.dataset.kind==='movement'");assert page.locator('.operation-arrow[data-live-march=true]').count()>=2;page.clock.run_for(50);before=page.locator('[data-person=a0]').get_attribute('data-motion-pin');before2=page.locator('[data-person=a1]').get_attribute('data-motion-pin');assert before and before2;page.clock.run_for(60);assert page.locator('[data-person=a0]').get_attribute('data-motion-pin')!=before and page.locator('[data-person=a1]').get_attribute('data-motion-pin')!=before2;page.keyboard.press('a');pins=[page.locator('[data-person='+id+']').get_attribute('data-motion-pin') for id in ['a0','a1']];page.clock.run_for(180);assert pins==[page.locator('[data-person='+id+']').get_attribute('data-motion-pin') for id in ['a0','a1']];page.screenshot(path=str(ROOT/f'docs/v38-{label}-home.png'));back(page,saved)
  saved=open_replay(page,'army',True);seek(page,"()=>document.querySelector('.map-stage')?.dataset.turn==='2'&&document.querySelector('.map-stage')?.dataset.event==='king'");assert page.locator('.operation-arrow,.round-retreat,.round-relocation,.operation-movement').count()==0;assert page.locator('[data-round-capture]').count()>0;assert page.locator('.battle-site-icon').count()>0;page.screenshot(path=str(ROOT/f'docs/v38-{label}-turn-clear.png'));back(page,saved)
  saved=open_replay(page,'duel',True);seek(page,"()=>document.querySelector('.map-stage')?.dataset.event==='attack_roll'");assert page.locator('.campaign-table,[data-engagement]').count()==0;back(page,saved)
  saved=open_replay(page,'empty',True);seek(page,"()=>document.querySelector('.map-stage')?.dataset.kind==='capture'");assert page.locator('[data-round-capture]').count()>0;assert page.locator('.campaign-table,[data-engagement]').count()==0;assert page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')==saved;ctx.close();print('PASS '+label+': full portrait, stacked/active defenders and prior verdict, reinforcement notice, simultaneous return/pause, per-country route clear/season marks, individual duel/empty capture, current save unchanged',flush=True)
 assert not errors,errors;assert not failed,failed;b.close();print('PASS app exceptions/external request failures0',flush=True)
