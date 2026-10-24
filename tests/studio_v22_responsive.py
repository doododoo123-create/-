"""Royal inspector on phone sizes; explicitly migrate an old edited world without changing its live run."""
from pathlib import Path
from urllib.parse import quote
import json
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
fixture=json.loads((ROOT/'.artifacts/v20-browser-fixture.json').read_text())
errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for mobile in [False,True]:
  label='mobile' if mobile else 'normal';name='사국쟁패 Studio 모바일 경량.html' if mobile else '사국쟁패 Studio.html'
  context=browser.new_context(viewport={'width':390,'height':844});page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
  page.add_init_script('if(!localStorage.getItem("saguk-studio.world.v1")){localStorage.setItem("saguk-studio.world.v1",'+json.dumps(json.dumps(fixture['world']))+');localStorage.setItem("saguk-studio.completed-run.v11",'+json.dumps(json.dumps(fixture['run']))+');}')
  page.goto('http://127.0.0.1:3000/dist/'+quote(name),wait_until='networkidle');page.locator('nav [data-page=simulation]').click();page.locator('[data-action=map-fullscreen]').click();kings=page.locator('.map-unit-position[data-unit-role=king] .map-unit-token')
  for index in range(kings.count()):
   card=kings.nth(index);box=card.bounding_box()
   if box and page.evaluate('p=>document.elementFromPoint(p.x,p.y)?.closest("[data-unit-role]")?.dataset.unitRole==="king"',{'x':box['x']+box['width']/2,'y':box['y']+box['height']/2}):
    card.click();break
  expect(page.locator('.commander-popover')).to_have_attribute('data-person-role','king')
  assert page.locator('.operation-arrow').count()>0
  arrows=page.locator('.operation-arrow').evaluate_all('els=>els.map(e=>({clearance:Number(e.dataset.iconClearance),d:e.querySelector(".campaign-route").getAttribute("d")}))')
  assert all(a['clearance']>=22 or not a['d'] for a in arrows),arrows
  for width,height in [(390,844),(844,390)]:
   page.set_viewport_size({'width':width,'height':height});box=page.locator('.commander-popover').bounding_box();assert 0<=box['x'] and box['x']+box['width']<=width+1,box;assert 0<=box['y'] and box['y']+box['height']<=height+1,box;assert page.locator('.commander-popover header img').bounding_box()['width']>=(88 if width<480 else 96);page.screenshot(path=str(ROOT/f'docs/v22-{label}-phone-{width}.png'))
  page.locator('[data-action=close-commander]').click();page.keyboard.press('Escape');page.set_viewport_size({'width':1200,'height':800});before=page.evaluate('JSON.parse(localStorage.getItem("saguk-studio.world.v1")).world');saved=page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')
  page.locator('nav [data-page=rules]').click();expect(page.locator('[name=continuousCampaign]')).not_to_be_checked();page.locator('[data-action=v22-rules]').click();expect(page.locator('[name=continuousCampaign]')).to_be_checked();expect(page.locator('[name=routDeath]')).to_be_checked();expect(page.locator('[name=strategicTargets]')).to_be_checked();expect(page.locator('[name=strategyWeakLands]')).to_have_value('7')
  after=page.evaluate('JSON.parse(localStorage.getItem("saguk-studio.world.v1")).world')
  for key in ['countries','people','territories','cartography']:assert before[key]==after[key],key
  for key in ['combatSides','captureThresholds','armyBands','regions','territoriesPerCommander','capacityCap']:
   if key in before['rules']:assert before['rules'][key]==after['rules'][key],key
  assert page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')==saved
  page.reload(wait_until='networkidle');page.locator('nav [data-page=rules]').click();expect(page.locator('[name=continuousCampaign]')).to_be_checked();assert page.evaluate('JSON.parse(localStorage.getItem("saguk-studio.completed-run.v11")).engineState.turns')==43
  context.close();print('PASS '+label+': portrait/landscape phone inspector fits, larger face, completed-route icon clearance, existing world migration preserves countries/people/map/other rules and ongoing 43-turn save',flush=True)
 browser.close();assert not errors,errors;print('PASS JavaScript exceptions: 0')
