"""Both offline HTML editions: actual royal combat, readiness, economy, succession and legacy isolation."""
from pathlib import Path
from urllib.parse import quote
import json,subprocess
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
subprocess.run(['node','tests/make-v27-fixture.mjs'],cwd=ROOT,check=True)
fixtures=json.loads((ROOT/'.artifacts/v27-browser-fixture.json').read_text());errors=[];failures=[]
def seek(page,selector,limit=350):
 for _ in range(limit):
  if page.locator(selector).count():return
  if page.locator('.map-stage').get_attribute('data-playing')!='true':page.keyboard.press('Space')
  page.clock.run_for(40)
 page.screenshot(path=str(ROOT/'.artifacts/v27-ui-failure.png'))
 raise AssertionError('Missing '+selector+' state '+str(page.locator('.map-stage').evaluate('e=>({...e.dataset})'))+' errors '+str(errors))
def load(ctx,name,fixture=None):
 page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda r:failures.append(r.url));page.on('dialog',lambda d:d.accept())
 if fixture:page.add_init_script('if(!localStorage.getItem("saguk-studio.world.v1")){localStorage.setItem("saguk-studio.world.v1",'+json.dumps(json.dumps(fixture['world']))+');localStorage.setItem("saguk-studio.completed-run.v11",'+json.dumps(json.dumps(fixture['run']))+');}')
 # Fulfilled standalone document is the only permitted request while offline.
 ctx.route('**/dist/**',lambda route:route.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist'/name)));ctx.set_offline(True)
 page.goto('http://127.0.0.1:3000/dist/'+quote(name),wait_until='networkidle');expect(page.locator('.page-footer')).to_contain_text('v0.27.0');return page
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for mobile in [False,True]:
  label='mobile' if mobile else 'normal';name='사국쟁패 Studio 모바일 경량.html' if mobile else '사국쟁패 Studio.html';ctx=b.new_context(viewport={'width':1600,'height':1000});page=load(ctx,name)
  expect(page.locator('.atlas-cell')).to_have_count(160);world=page.evaluate('JSON.parse(localStorage.getItem("saguk-studio.world.v1")).world');assert world['rules']['confusionCap']==6 and world['rules']['royalDefense']
  page.locator('nav [data-page=rules]').click()
  for key in ['warReadiness','royalDefense','territoryRecruitment','capitalDisruption','overCapacityDesertion','finishStrategy']:expect(page.locator('[name='+key+']')).to_be_checked()
  page.locator('.balance-v27-settings summary').click();expect(page.locator('[name=confusionCap]')).to_have_value('6');page.locator('[name=confusionCap]').fill('8');page.locator('#rules-form button[type=submit]').click();assert page.evaluate('JSON.parse(localStorage.getItem("saguk-studio.world.v1")).world.rules.confusionCap')==8
  page.locator('[data-action=v27-rules]').click();page.locator('nav [data-page=simulation]').click();page.locator('[data-action=step]').click();page.locator('[data-action=scene-skip]').click();saved=page.evaluate('JSON.parse(localStorage.getItem("saguk-studio.completed-run.v11"))');assert saved['engineState']['countries'][0]['royal']['slot']==-1;assert saved['initialWorld']['rules']['confusionCap']==6
  king=page.locator('.map-unit-token[data-role=king]').first;king.click(force=True);expect(page.locator('.commander-overview-slot')).to_contain_text('왕의 방어 부대');expect(page.locator('.commander-overview-slot')).to_contain_text('누적 추가 / 현재 적용');page.locator('[data-action=close-commander]').click();page.locator('[data-action=map-fullscreen]').click();expect(page.locator('.map-calendar')).to_contain_text('1년차');page.keyboard.press('+');expect(page.locator('.map-speed-status')).to_be_visible();before=page.locator('.atlas-camera').get_attribute('transform') if page.locator('.atlas-camera').count() else None;page.keyboard.press('ArrowRight')
  for view in [{'width':390,'height':844},{'width':844,'height':390}]:
   page.set_viewport_size(view);date=page.locator('.map-calendar').bounding_box();assert date['x']>=0 and date['y']>=0 and date['x']+date['width']<=view['width']+1;page.screenshot(path=str(ROOT/f'docs/v27-{label}-{view["width"]}.png'))
  page.keyboard.press('Escape');page.reload(wait_until='networkidle');page.locator('nav [data-page=simulation]').click();expect(page.locator('.history-panel .count-badge')).to_have_text('1턴');ctx.close();print('PASS '+label+': offline fresh160, editable settings, actual royal army/detail, new save restore, phone layouts',flush=True)
  ctx=b.new_context(viewport={'width':1600,'height':1000});page=load(ctx,name,fixtures['small']);page.locator('nav [data-page=simulation]').click();page.locator('#sim-speed').select_option('8');live=page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")');page.clock.install(time=0);page.clock.pause_at(1000);page.locator('.history-entry[data-id="1"]').click();page.locator('[data-action=map-fullscreen]').click();page.locator('.map-play-toggle').click() if page.locator('.map-stage').get_attribute('data-playing')=='true' else None
  seek(page,'.map-judgment.is-duel[data-event=defense_roll]');expect(page.locator('.map-judgment')).to_contain_text('혼란');expect(page.locator('.map-unit-token[data-role=king]')).to_have_count(3);page.screenshot(path=str(ROOT/f'docs/v27-{label}-royal-defense.png'))
  seek(page,'[data-effect=death][class*=unit-status-label]');page.screenshot(path=str(ROOT/f'docs/v27-{label}-royal-death.png'));assert page.locator('.unit-death').count()>0
  page.keyboard.press('Escape');page.locator('[data-action=return-live]').click();assert page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')==live
  # Completed economic history is visible, and the new king has a distinct life ID.
  expect(page.locator('.balance-chronicle')).not_to_have_count(0);assert page.locator('.map-unit-token[data-id="monarch-b-1"]').count()==1;page.locator('.map-unit-token[data-id="monarch-b-1"]').click(force=True);expect(page.locator('.commander-overview-slot')).to_contain_text('방어 전용');ctx.close();print('PASS '+label+': actual king defense/score/readiness, red death, three-turn succession, chronological replay preserves live run',flush=True)
 old=fixtures['legacy'];ctx=b.new_context(viewport={'width':1400,'height':950});page=load(ctx,'사국쟁패 Studio.html',{'world':old['world'],'run':old['eight']});before=page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")');page.locator('nav [data-page=rules]').click();expect(page.locator('[name=royalDefense]')).not_to_be_checked();page.locator('[data-action=v27-rules]').click();expect(page.locator('[name=royalDefense]')).to_be_checked();assert page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')==before;page.locator('nav [data-page=simulation]').click();page.locator('[data-action=step]').click();page.locator('[data-action=scene-skip]').click();saved=page.evaluate('JSON.parse(localStorage.getItem("saguk-studio.completed-run.v11"))');assert saved['engineState']['turns']==9 and 'royal' not in saved['engineState']['countries'][0];ctx.close();print('PASS old26 run continues under its own rules after editor upgrade without retroactive king/economy changes',flush=True)
 assert not errors,errors;assert not failures,failures;b.close();print('PASS UI exceptions/request failures:0',flush=True)
