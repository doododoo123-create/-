"""Release acceptance: formation reveal, contained dice, individual duels and one-pass empty captures."""
from pathlib import Path
from urllib.parse import quote
import subprocess
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];subprocess.run(['node','tests/make-v37-fixtures.mjs'],cwd=ROOT,check=True)
errors=[];failed=[]
def seek(page,predicate,limit=7000):
 for _ in range(limit):
  if page.evaluate(predicate):return
  if page.locator('.map-stage').get_attribute('data-playing')!='true':page.keyboard.press('a')
  page.clock.run_for(15)
 page.screenshot(path=str(ROOT/'.artifacts/v37-failure.png'));raise AssertionError(predicate+' errors '+str(errors))
def open_replay(page,kind,installed):
 if installed:
  page.clock.set_system_time(1000)
  page.clock.resume()
 page.locator('#world-file').set_input_files(str(ROOT/f'.artifacts/v37-{kind}.history.json'));expect(page.locator('[data-import-confirm]')).to_be_enabled(timeout=45000);page.locator('[data-import-confirm]').click();expect(page.locator('#file-import-dialog')).not_to_be_visible();page.locator('#sim-speed').select_option('2')
 if installed:page.clock.pause_at(page.evaluate('Date.now()')+100)
 else:page.clock.install(time=0);page.clock.pause_at(1000)
 page.locator('.history-entry[data-id="1"]').click();page.locator('[data-action=map-fullscreen]').click();page.evaluate('document.activeElement?.blur()');return page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')
def back(page,saved):
 page.keyboard.press('Escape');page.locator('[data-action=return-live]').click();assert page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')==saved

def contained(page):
 for die in page.locator('.campaign-score .visual-die').all():
  box=die.locator('xpath=ancestor::*[contains(@class,"campaign-score")][1]').bounding_box();d=die.bounding_box();assert d['x']>=box['x']-1 and d['x']+d['width']<=box['x']+box['width']+1;assert d['y']>=box['y']-1 and d['y']+d['height']<=box['y']+box['height']+1
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for mobile,width,height in [(False,1600,1000),(True,844,650),(True,390,844)]:
  label='portrait' if width==390 else 'mobile' if mobile else 'normal';name='사국쟁패 Studio 모바일 경량.html' if mobile else '사국쟁패 Studio.html';ctx=b.new_context(viewport={'width':width,'height':height});page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda r:failed.append(r.url));ctx.route('**/dist/**',lambda route:route.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist'/name)));ctx.set_offline(True);page.goto('http://127.0.0.1:3000/dist/'+quote(name),wait_until='networkidle');expect(page.locator('.page-footer')).to_contain_text('v0.37.0',timeout=45000);expect(page.locator('.atlas-cell')).to_have_count(160);assert page.locator('[data-army-forming]').count()==0
  page.evaluate("document.querySelector('[data-map-detail]').value='all'");page.locator('[data-map-detail]').first.dispatch_event('change')
  mountains=page.evaluate("()=>[...document.querySelectorAll('[data-mountain-id]')].map(e=>{const n=[...document.querySelectorAll('[data-territory-label]')].find(n=>n.dataset.territoryLabel===e.dataset.mountainId),a=n?.getBoundingClientRect(),b=e.getBoundingClientRect();return a&&a.width?b.left-a.right:null}).filter(x=>x!==null)");assert mountains and all(1<x<9 for x in mountains),mountains
  saved=open_replay(page,'army',False)
  seek(page,"()=>document.querySelector('.map-stage')?.dataset.event==='army_assembly'&&document.querySelector('.map-stage')?.dataset.kind==='movement'");assert page.locator('[data-rally-spot]').count()==1
  seek(page,"()=>document.querySelector('.map-stage')?.dataset.kind==='army-forming'");assert page.locator('[data-army-forming=true]').count()==1;assert page.locator('.army-formation-ring').count()==1;page.clock.run_for(40);page.keyboard.press('a');leader=page.locator('[data-army-forming=true] .army-leader-scale');shape=leader.get_attribute('transform');mini=page.locator('[data-army-forming=true] .army-mini-unit').first.get_attribute('style');page.clock.run_for(220);assert leader.get_attribute('transform')==shape;assert page.locator('[data-army-forming=true] .army-mini-unit').first.get_attribute('style')==mini;page.screenshot(path=str(ROOT/f'docs/v37-{label}-formation.png'));page.keyboard.press('a')
  seek(page,"()=>document.querySelector('.map-stage')?.dataset.event==='attack_roll'&&document.querySelector('.map-stage')?.dataset.phase==='rolling'");expect(page.locator('.campaign-v36')).to_be_visible();assert page.locator('[data-army-forming]').count()==0;assert page.locator('.campaign-v36 .die-equation').count()==0;assert '눈금 → 보정 합산' not in page.locator('.campaign-v36').inner_text();contained(page)
  if width>760:
   centre=page.locator('.campaign-balance').bounding_box();left=page.locator('.is-attack .campaign-side-results').bounding_box();right=page.locator('.is-defense .campaign-side-results').bounding_box();assert left['x']+left['width']<=centre['x']+1;assert right['x']>=centre['x']+centre['width']-1;assert abs(left['y']-page.locator('.is-attack .campaign-portrait').first.bounding_box()['y'])<12
  seek(page,"()=>document.querySelector('.map-stage')?.dataset.phase==='merging'&&!!document.querySelector('.campaign-v36 .bonus-flight')");contained(page);flight=page.locator('.bonus-flight').first;f=flight.bounding_box();box=flight.locator('xpath=ancestor::*[contains(@class,"campaign-score")][1]').bounding_box();assert f['x']>=box['x']-1 and f['x']+f['width']<=box['x']+box['width']+1 and f['y']>=box['y']-1 and f['y']+f['height']<=box['y']+box['height']+1;page.screenshot(path=str(ROOT/f'docs/v37-{label}-bonuses.png'))
  seek(page,"()=>document.querySelectorAll('.campaign-duel').length===3&&document.querySelector('.map-stage')?.dataset.event==='defense_roll'&&document.querySelector('.map-stage')?.dataset.phase==='locked'");contained(page);assert page.locator('[data-round-capture]').count()==0;expect(page.locator('[data-campaign-advantage]')).to_contain_text('a국 우세');page.screenshot(path=str(ROOT/f'docs/v37-{label}-dice.png'));back(page,saved)
  # Separate sectors against the same country must keep different headers/rosters.
  saved=open_replay(page,'fronts',True);seek(page,"()=>!!document.querySelector('.campaign-title h2')");first_title=page.locator('.campaign-title h2').inner_text();assert '전선' in first_title
  seek(page,"()=>{const e=document.querySelector('.campaign-title h2');return !!e&&e.textContent!=="+repr(first_title)+"}");second_title=page.locator('.campaign-title h2').inner_text();assert '전선' in second_title and first_title!=second_title;contained(page);page.screenshot(path=str(ROOT/f'docs/v37-{label}-fronts.png'));back(page,saved)
  # Real confusion from an earlier mild defeat in this recorded war, not an injected officer state.
  saved=open_replay(page,'confusion',True);seek(page,"()=>document.querySelector('.campaign-portrait .portrait-confusion')?.dataset.confusion==='2'");badge=page.locator('.campaign-portrait .portrait-confusion').first;face=badge.locator('xpath=..');bb=badge.bounding_box();fb=face.bounding_box();assert bb['width']<fb['width'] and bb['x']+bb['width']>=fb['x']+fb['width']-12;assert badge.evaluate('(e)=>getComputedStyle(e.parentElement).overflow')=='visible';page.screenshot(path=str(ROOT/f'docs/v37-{label}-confusion.png'));back(page,saved)
  # The same viewer must render a true1vs1 as the normal individual duel.
  saved=open_replay(page,'duel',True);seek(page,"()=>document.querySelector('.map-stage')?.dataset.event==='attack_roll'&&document.querySelector('.map-stage')?.dataset.phase==='rolling'");assert page.locator('.campaign-table').count()==0;assert page.locator('[data-army-group]').count()==0;expect(page.locator('.map-judgment')).to_be_visible();assert page.locator('.map-judgment [data-die-sides="30"]').count()>=1;page.screenshot(path=str(ROOT/f'docs/v37-{label}-duel.png'));back(page,saved)
  # Empty provinces: the entry card stays at that province through capture.
  saved=open_replay(page,'empty',True);seek(page,"()=>document.querySelector('.map-stage')?.dataset.event==='territory'&&document.querySelector('.map-stage')?.dataset.kind==='movement'");assert page.locator('.campaign-table,.battle-emblem').count()==0;assert page.locator('[data-person=a0]').get_attribute('data-camp')=='tile-6';page.screenshot(path=str(ROOT/f'docs/v37-{label}-empty-entry.png'))
  seek(page,"()=>document.querySelector('.map-stage')?.dataset.kind==='capture'&&document.querySelector('.map-stage')?.dataset.battleIndex==='0'");assert page.locator('[data-person=a0]').get_attribute('data-camp')=='tile-6';assert page.locator('[data-round-capture="tile-6"]').count()==1;page.screenshot(path=str(ROOT/f'docs/v37-{label}-empty-capture.png'))
  for _ in range(150):
   if page.locator('.map-stage').get_attribute('data-battle-index')!='0':break
   assert page.locator('[data-person=a0]').get_attribute('data-camp')=='tile-6';assert page.locator('.battle-emblem').count()==0;page.clock.run_for(15)
  assert page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')==saved;ctx.close();print('PASS '+label+': clocked formation/pause, contained dice and bonuses, supplied header layout, no redundant text, individual1vs1 and direct unopposed capture, saved state unchanged',flush=True)
 assert not errors,errors;assert not failed,failed;b.close();print('PASS app exceptions/external request failures0',flush=True)
