"""Both standalone editions: seasons, local retreats, spatial cards and a fully manual camera."""
from pathlib import Path
from urllib.parse import quote
import json,subprocess
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
subprocess.run(['node','tests/make-v18-fixture.mjs'],cwd=ROOT,check=True)
f=json.loads((ROOT/'.artifacts/v18-browser-fixture.json').read_text());errors=[];failed=[]
def seek(page,predicate,limit=5000):
 for _ in range(limit):
  if page.evaluate(predicate):return
  page.clock.run_for(60)
 page.screenshot(path=str(ROOT/'.artifacts/v18-failure.png'))
 raise AssertionError('Missing scene: '+str(page.locator('.map-stage').get_attribute('data-event'))+' '+str(page.locator('.map-stage').get_attribute('data-phase'))+' '+str(errors))
def pause(page):
 if page.locator('.map-stage').get_attribute('data-playing')=='true':page.keyboard.press('KeyA')
def inside(box,v):
 return box['x']>=-1 and box['y']>=-1 and box['x']+box['width']<=v['width']+1 and box['y']+box['height']<=v['height']+1
def overlap(a,b):
 return max(0,min(a['x']+a['width'],b['x']+b['width'])-max(a['x'],b['x']))*max(0,min(a['y']+a['height'],b['y']+b['height'])-max(a['y'],b['y']))
def layout(page):
 pane=page.locator('.is-compact-duel').bounding_box();assert inside(pane,page.viewport_size),pane
 assert 334<=pane['width']<=338,pane
 for card in page.locator('.map-unit-position[data-combat-side]').all():
  for box in card.locator('foreignObject,.unit-combat-role,.unit-loss-label,.unit-status-label').all():
   b=box.bounding_box();assert overlap(pane,b)<2,(pane,b,page.viewport_size)
  width=card.locator('foreignObject').bounding_box()['width'];assert 39<=width<=81,width
 assert overlap(pane,page.locator('.battle-emblem .target-ring').bounding_box())<2
 return pane
def open_replay(page,turn):
 page.locator(f'.history-entry[data-id="{turn}"]').click();page.locator('[data-action="map-fullscreen"]').click()
def leave_replay(page):
 pause(page);page.keyboard.press('Escape');page.locator('[data-action="return-live"]').click()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'],headless=True)
 for mobile in [False,True]:
  label='mobile' if mobile else 'normal';name='사국쟁패 Studio 모바일 경량.html' if mobile else '사국쟁패 Studio.html'
  c=b.new_context(viewport={'width':900,'height':600} if mobile else {'width':1600,'height':1000},has_touch=mobile)
  page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda r:failed.append(r.url));page.on('dialog',lambda d:d.accept())
  page.add_init_script('if(!localStorage.getItem("saguk-studio.world.v1")){localStorage.setItem("saguk-studio.world.v1",'+json.dumps(json.dumps(f['world']))+');localStorage.setItem("saguk-studio.completed-run.v11",'+json.dumps(json.dumps(f['run']))+');}')
  page.goto('http://127.0.0.1:3000/dist/'+quote(name),wait_until='networkidle');expect(page.locator('.atlas-cell')).to_have_count(160)
  small=None
  for _ in range(8):page.locator('[data-action="map-zoom-out"]').click()
  widths=page.locator('.map-unit-position foreignObject').evaluate_all('els=>els.map(e=>e.getBoundingClientRect().width)');assert all(23.8<=w<=24.2 for w in widths);small=widths
  for _ in range(15):page.locator('[data-action="map-zoom-in"]').click()
  widths=page.locator('.map-unit-position foreignObject').evaluate_all('els=>els.map(e=>e.getBoundingClientRect().width)');assert all(79.8<=w<=80.2 for w in widths);assert all(a<b for a,b in zip(small,widths))
  assert page.locator('.unit-pin-tip').evaluate_all('els=>els.every(e=>{const p=e.closest(".map-unit-position"),s=e.closest("svg"),a=new DOMPoint(0,35).matrixTransform(e.getScreenCTM()),b=new DOMPoint(Number(p.dataset.mapX),Number(p.dataset.mapY)+35).matrixTransform(s.getScreenCTM());return Math.hypot(a.x-b.x,a.y-b.y)<.2})')
  page.locator('[data-action="map-zoom-reset"]').click();page.locator('nav [data-page="rules"]').click();expect(page.locator('[name="nearbyRetreat"]')).to_be_checked()
  page.locator('nav [data-page="simulation"]').click();assert page.locator('#camera-follow').count()==0
  saved=page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")');page.locator('#sim-speed').select_option('8');page.clock.install(time=0);page.clock.pause_at(1000)

  open_replay(page,f['seasonTurn']);seek(page,"()=>document.querySelector('.map-stage')?.dataset.event==='season'");pause(page);expect(page.locator('.season-announcement')).to_have_count(1)
  round=next(r['round'] for r in f['run']['history'] if r['turn']==f['seasonTurn']);labeltext=str((round-1)//4+1)+'년차 '+['봄','여름','가을','겨울'][(round-1)%4]
  expect(page.locator('.season-announcement strong')).to_have_text(labeltext);view=page.locator('.atlas-map').get_attribute('viewBox');page.clock.run_for(2000);expect(page.locator('.season-announcement')).to_have_count(1)
  page.screenshot(path=str(ROOT/f'docs/v18-{label}-season.png'));page.keyboard.press('KeyA');seek(page,"()=>!!document.querySelector('.is-royal-choice[data-event=king]')");pause(page)
  royal=page.locator('.is-royal-choice');assert inside(royal.bounding_box(),page.viewport_size);assert royal.bounding_box()['width']<=205;assert royal.locator('img').count()==0
  nation=royal.get_attribute('data-nation');king=page.locator(f'.map-unit-position[data-unit-role="king"][data-country="{nation}"] foreignObject').bounding_box();box=royal.bounding_box();assert box['y']+box['height']<=king['y']+1 or king['y']+king['height']<=box['y']+1
  assert page.locator('.atlas-map').get_attribute('viewBox')==view;page.screenshot(path=str(ROOT/f'docs/v18-{label}-royal.png'));leave_replay(page)

  open_replay(page,f['ministerTurn']);seek(page,"()=>!!document.querySelector('.is-royal-choice[data-event=minister]')");pause(page);assert inside(page.locator('.is-royal-choice').bounding_box(),page.viewport_size);assert page.locator('.is-royal-choice .choice-item').count()>0;leave_replay(page)

  open_replay(page,f['turn']);seek(page,"()=>document.querySelector('.map-stage')?.dataset.event==='attack_roll'");pause(page)
  view=page.locator('.atlas-map').get_attribute('viewBox');expect(page.locator('.map-unit-position[data-combat-side]')).to_have_count(2);expect(page.locator('.unit-combat-role')).to_have_count(2)
  expect(page.locator('.unit-combat-role').filter(has_text='공격')).to_have_count(1);expect(page.locator('.unit-combat-role').filter(has_text='수비')).to_have_count(1)
  assert page.locator('.is-compact-duel .observer-bonuses>span').count()==10;assert page.locator('.unit-loss-label').count()==0;assert page.locator('.retreat-symbol').count()==0
  assert page.locator('[data-battle-site]').count()>0;assert page.locator('.past-route').first.evaluate('e=>parseFloat(getComputedStyle(e).opacity)')>=.8
  assert page.locator('.battle-swords').evaluate('e=>getComputedStyle(e).stroke')=='rgb(255, 38, 61)'
  assert page.locator('.map-campaign').evaluate('e=>{const svg=e.closest("svg"),o=e.dataset.attackOrigin.split(",").map(Number),p=new DOMPoint(...o).matrixTransform(svg.getScreenCTM()),r=e.querySelector(".target-ring").getBoundingClientRect(),cx=r.x+r.width/2,cy=r.y+r.height/2,a=svg.querySelector("[data-combat-side=attack]"),d=svg.querySelector("[data-combat-side=defense]"),ax=Number(a.dataset.combatScreenX),ay=Number(a.dataset.combatScreenY),dx=Number(d.dataset.combatScreenX),dy=Number(d.dataset.combatScreenY);return svg.dataset.duelAxis==="horizontal"?(p.x-cx)*(ax-dx)>0:(p.y-cy)*(ay-dy)>0}')
  layout(page);page.screenshot(path=str(ROOT/f'docs/v18-{label}-battle.png'));print(label+': season, royal/minister reels, zoom, spatial battle layout passed',flush=True)
  if mobile:
   for width,height in [(390,844),(844,390)]:
    page.set_viewport_size({'width':width,'height':height});page.clock.run_for(200);layout(page);page.screenshot(path=str(ROOT/f'.artifacts/v18-mobile-{width}.png'))
   page.set_viewport_size({'width':900,'height':600});page.clock.run_for(200)
  page.keyboard.press('KeyA');seek(page,"()=>document.querySelector('.map-stage')?.dataset.effectStage==='outcome'");pause(page)
  assert page.locator('.atlas-map').get_attribute('viewBox')==view;expect(page.locator('.unit-loss-label')).to_have_count(2);expect(page.locator('.unit-status-label.victory')).to_have_text('승리');expect(page.locator('.unit-status-label.defeat')).to_have_text('패배');assert page.locator('.map-unit-feedback[data-effect="army"]').count()==0
  assert page.locator('.unit-status-label.victory').evaluate('e=>getComputedStyle(e).fill')=='rgb(255, 38, 61)';assert page.locator('.unit-defeat').evaluate('e=>getComputedStyle(e).filter')=='none';page.screenshot(path=str(ROOT/f'docs/v18-{label}-result.png'))
  page.keyboard.press('KeyA');seek(page,"()=>document.querySelector('.map-stage')?.dataset.event==='retreat'&&!!document.querySelector('.unit-marching')");pause(page)
  assert page.locator('.round-retreat .campaign-route.attack').count()>0;assert page.locator('.round-retreat .campaign-route').evaluate_all('els=>els.every(e=>getComputedStyle(e).strokeDasharray==="none")');assert page.locator('.retreat-symbol').count()==0
  assert page.locator('.round-retreat marker path').evaluate_all('els=>els.every(e=>getComputedStyle(e).fill!=="none")')
  page.screenshot(path=str(ROOT/f'docs/v18-{label}-retreat.png'));page.keyboard.press('KeyA')
  seek(page,"()=>document.querySelector('.map-stage')?.dataset.turn==='42'&&document.querySelector('.map-stage')?.dataset.finished==='true'")
  assert page.locator('[data-battle-site],[data-round-capture],[data-round-route],.round-stalemate,.round-retreat,.round-relocation').count()==0
  owners=page.locator('.atlas-cell').evaluate_all('els=>Object.fromEntries(els.map(e=>[e.dataset.territory,e.dataset.owner]))');assert owners==f['expected']
  assert page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')==saved
  page.keyboard.press('Escape');page.locator('[data-action="return-live"]').click();page.locator('[data-action="new-run"]').click();page.locator('#dialog-form button[type="submit"]').click();page.locator('[data-action="step"]').click();page.locator('[data-action="scene-skip"]').click()
  fresh=page.evaluate('JSON.parse(localStorage.getItem("saguk-studio.completed-run.v11"))');assert fresh['engineVersion']=='studio-v11-23';assert fresh['initialWorld']['rules']['nearbyRetreat'];assert all(n['reserve']<=10 for n in fresh['engineState']['countries'])
  c.route('**/dist/**',lambda r:r.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist'/name)));c.set_offline(True);page.reload(wait_until='networkidle');expect(page.locator('.atlas-cell')).to_have_count(160)
  c.close();print('PASS '+label+': calendar, royal anchoring, manual camera, 24→80px pins, spatial card roles, red combat/result, unified losses, solid retreat, seasonal sites, 8x replay, unchanged live save and offline HTML',flush=True)
 assert not errors,errors;assert not failed,failed;b.close();print('PASS JavaScript exceptions/request failures: 0',flush=True)
