"""Both offline editions: shared march clock, near-card dice, capture/season wipes and commander summaries."""
from pathlib import Path
from urllib.parse import quote
import json,subprocess,math
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
subprocess.run(['node','tests/make-v20-fixture.mjs'],cwd=ROOT,check=True)
f=json.loads((ROOT/'.artifacts/v20-browser-fixture.json').read_text());errors=[];failed=[]
def seek(page,pred,limit=2200):
 for _ in range(limit):
  if page.evaluate(pred):return
  page.clock.run_for(20)
 page.screenshot(path=str(ROOT/'.artifacts/v21-failure.png'))
 raise AssertionError('Missing '+pred+' current '+str(page.locator('.map-stage').evaluate('e=>({...e.dataset})')))
def pause(page):
 if page.locator('.map-stage').get_attribute('data-playing')=='true':page.locator('.map-play-toggle').click()
def resume(page):
 if page.locator('.map-stage').get_attribute('data-playing')!='true':page.locator('.map-play-toggle').click()
def replay(page,turn):
 page.locator(f'.history-entry[data-id="{turn}"]').click();page.locator('[data-action=map-fullscreen]').click()
def leave(page):
 pause(page);page.keyboard.press('Escape');page.locator('[data-action=return-live]').click()
def pair_layout(page):
 data=page.evaluate('''()=>{const pane=document.querySelector('.is-compact-duel'),p=pane.getBoundingClientRect(),items=[...document.querySelectorAll('.map-unit-position[data-combat-side] foreignObject,.map-unit-position[data-combat-side] .card-label-badge,.map-unit-position[data-combat-side] .unit-combat-role')].map(e=>e.getBoundingClientRect());return {p:{x:p.x,y:p.y,width:p.width,height:p.height},side:pane.dataset.adjacent,top:Math.min(...items.map(r=>r.top)),bottom:Math.max(...items.map(r=>r.bottom)),center:(Math.min(...items.map(r=>r.left))+Math.max(...items.map(r=>r.right)))/2}}''')
 p=data['p'];v=page.viewport_size
 assert p['x']>=7 and p['y']>=7 and p['x']+p['width']<=v['width']-7 and p['y']+p['height']<=v['height']-7,data
 gap=data['top']-p['y']-p['height'] if data['side']=='above' else p['y']-data['bottom'];assert 8<=gap<=14,data
 assert abs(p['x']+p['width']/2-data['center'])<100,data
 return data
def track(page):
 return page.locator('.operation-arrow[data-live-march=true]').evaluate('''arrow=>{const svg=arrow.closest('svg'),card=[...svg.querySelectorAll('.map-unit-position')].find(c=>c.dataset.person===arrow.dataset.routePerson),tip=arrow.dataset.motionTip.split(',').map(Number),pin=new DOMPoint(0,35).matrixTransform(card.querySelector('.unit-stack-card').getScreenCTM()),screen=new DOMPoint(...tip).matrixTransform(svg.getScreenCTM());return {tip,pin:[pin.x,pin.y],screen:[screen.x,screen.y],d:arrow.querySelector('.campaign-route').getAttribute('d'),shadow:arrow.querySelector('.campaign-route-shadow').getAttribute('d')}}''')
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for mobile in [False,True]:
  edition='mobile' if mobile else 'normal';name='사국쟁패 Studio 모바일 경량.html' if mobile else '사국쟁패 Studio.html'
  ctx=browser.new_context(viewport={'width':900,'height':600} if mobile else {'width':1600,'height':1000});page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda r:failed.append(r.url));page.on('dialog',lambda d:d.accept())
  page.add_init_script('if(!localStorage.getItem("saguk-studio.world.v1")){localStorage.setItem("saguk-studio.world.v1",'+json.dumps(json.dumps(f['world']))+');localStorage.setItem("saguk-studio.completed-run.v11",'+json.dumps(json.dumps(f['run']))+');}')
  page.goto('http://127.0.0.1:3000/dist/'+quote(name),wait_until='networkidle');expect(page.locator('.atlas-cell')).to_have_count(160);assert 'v0.21.0' in page.locator('.page-footer').inner_text();page.locator('nav [data-page=simulation]').click();page.locator('#sim-speed').select_option('8');saved=page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")');page.clock.install(time=0);page.clock.pause_at(1000)
  replay(page,f['movementTurn']);pred=f"document.querySelector('.map-stage')?.dataset.battleIndex==='{f['movementBattle']['index']}'"
  seek(page,"()=>"+pred+"&&document.querySelector('.map-stage')?.dataset.movementSide==='attack'");pause(page);expect(page.locator('.clock-marching')).to_have_count(1)
  a=track(page);assert math.dist(a['pin'],a['screen'])<1,a;assert a['d']==a['shadow'];page.clock.run_for(500);assert track(page)==a
  view=page.locator('.atlas-map').get_attribute('viewBox');page.keyboard.press('-');expect(page.locator('.map-speed-status')).to_have_text('4×');assert page.locator('.atlas-map').get_attribute('viewBox')==view;assert track(page)==a
  page.keyboard.press('+');expect(page.locator('.map-speed-status')).to_have_text('8×');page.screenshot(path=str(ROOT/f'docs/v21-{edition}-march.png'));resume(page)
  seek(page,"()=>"+pred+"&&document.querySelector('.map-stage')?.dataset.kind==='route'&&document.querySelector('.map-stage')?.dataset.routeSides==='attack'");pause(page);expect(page.locator('[data-forming=true]')).to_have_count(1);assert page.locator('.clock-formation').evaluate('e=>getComputedStyle(e).transform')!='none';page.screenshot(path=str(ROOT/f'docs/v21-{edition}-formation.png'));resume(page)
  seek(page,"()=>"+pred+"&&document.querySelector('.map-stage')?.dataset.movementSide==='defense'");pause(page);a=track(page);assert math.dist(a['pin'],a['screen'])<1,a;expect(page.locator('.map-unit-position[data-combat-side=attack]')).to_have_count(1);resume(page)
  seek(page,"()=>"+pred+"&&document.querySelector('.map-stage')?.dataset.event==='attack_roll'");pause(page);pair_layout(page)
  order=page.locator('.country-tokens>.map-unit-position').evaluate_all('els=>els.map(e=>!!e.dataset.combatSide)');assert order[-2:]==[True,True] and not any(order[:-2]);expect(page.locator('.observer-bonuses>span')).to_have_count(10)
  # The supplied roll animation is deliberately unchanged by request 14.
  assert page.locator('.visual-die.rolling').evaluate('e=>getComputedStyle(e).animationName')=='studio-die-roll'
  for width,height in [(390,844),(844,390),({'width':900,'height':600} if mobile else {'width':1600,'height':1000}).values()]:
   page.set_viewport_size({'width':width,'height':height});page.clock.run_for(50);pair_layout(page)
  page.screenshot(path=str(ROOT/f'docs/v21-{edition}-battle.png'))
  page.locator('.map-play-toggle').focus();before=page.locator('.atlas-map').get_attribute('viewBox');page.keyboard.press('ArrowRight');assert page.locator('.atlas-map').get_attribute('viewBox')!=before;pair_layout(page);page.keyboard.press('ArrowLeft');page.mouse.move(page.viewport_size['width']/2,page.viewport_size['height']/2);page.mouse.wheel(0,-500);page.clock.run_for(50);pair_layout(page);page.keyboard.press('ArrowDown');pair_layout(page);page.keyboard.press('Digit0');page.clock.run_for(50)
  widths=page.locator('.campaign-route').evaluate_all('els=>els.map(e=>({army:Number(e.closest(".campaign-route-pair").dataset.arrowArmy),w:parseFloat(getComputedStyle(e).strokeWidth)}))');assert all(x['w']>=3.8 for x in widths),widths
  resume(page);seek(page,"()=>"+pred+"&&document.querySelector('.map-stage')?.dataset.kind==='apply'&&document.querySelector('.map-stage')?.dataset.event==='resolve'");pause(page)
  assert page.locator('.unit-result-label').count()==2;assert page.locator('.unit-result-label').evaluate_all('els=>els.every(e=>!!e.parentNode.querySelector(".card-label-background"))');page.screenshot(path=str(ROOT/f'docs/v21-{edition}-result.png'));resume(page)
  target=f['movementBattle']['takenTerritoryIds'][0]
  seek(page,"()=>"+pred+"&&document.querySelector('.map-stage')?.dataset.kind==='capture'");pause(page)
  wipe=page.locator('[data-wipe-span]').first;w=float(wipe.get_attribute('width'));span=float(wipe.get_attribute('data-wipe-span'));assert 0<=w<span,(w,span);assert page.locator('.capture-border-advance').count()==1;assert page.locator(f'[data-round-capture="{target}"]').get_attribute('clip-path');page.clock.run_for(500);assert float(wipe.get_attribute('width'))==w
  # Let the sweep visibly advance halfway, then freeze it for review.
  resume(page);page.clock.run_for(35);pause(page);w2=float(page.locator('[data-wipe-span]').first.get_attribute('width'));assert w2>w,(w,w2);page.screenshot(path=str(ROOT/f'docs/v21-{edition}-capture.png'));page.keyboard.press('KeyS');leave(page)
  replay(page,f['nextSeasonTurn']);seek(page,"()=>document.querySelector('.map-stage')?.dataset.kind==='season'");pause(page);assert page.locator('[data-round-capture]').count()>0;expect(page.locator('.season-announcement')).to_have_count(1);page.screenshot(path=str(ROOT/f'docs/v21-{edition}-season.png'));resume(page)
  seek(page,"()=>document.querySelector('.map-stage')?.dataset.kind==='round-settle'");pause(page);assert page.locator('.season-announcement').count()==0;expect(page.locator('.capture-settle-fill').first).to_be_attached();assert page.locator('[data-round-capture]').first.get_attribute('mask');page.screenshot(path=str(ROOT/f'docs/v21-{edition}-settle.png'));page.keyboard.press('Space');seek(page,"()=>document.querySelector('.map-stage')?.dataset.kind==='round-settle'&&document.querySelector('.map-stage')?.dataset.playing==='false'");assert page.locator('[data-wipe-span]').evaluate_all('els=>els.every(e=>Math.abs(Number(e.getAttribute("width"))-Number(e.dataset.wipeSpan))<.01)');resume(page)
  seek(page,"()=>document.querySelector('.map-stage')?.dataset.kind==='reel'");pause(page);assert page.locator('[data-round-capture]').count()==0;leave(page)
  replay(page,42);seek(page,"()=>document.querySelector('.map-stage')?.dataset.kind==='capture'&&document.querySelector('.map-stage')?.dataset.battleIndex==='0'");pause(page);assert page.locator('.round-prior-capture').count()>=2;assert page.locator('.round-prior-capture').evaluate_all('els=>els.every(e=>e.hasAttribute("mask"))');page.screenshot(path=str(ROOT/f'docs/v21-{edition}-recapture.png'));leave(page)
  replay(page,f['turn']);seek(page,"()=>document.querySelector('.map-stage')?.dataset.event==='attack_roll'");pause(page)
  unit=page.locator('.map-unit-position[data-combat-side=attack] .map-unit-token');pid=unit.get_attribute('data-id');unit.click();expect(page.locator('.commander-popover')).to_have_attribute('data-commander-overview',pid);assert page.locator('.commander-popover').get_by_text('주요 전투 · 최근 5회').count()==1
  # No future or unresolved turn-41 duel leaks into the selected lifetime's overview.
  turns=page.locator('.commander-popover .commander-battle-link').evaluate_all('els=>els.map(e=>Number(e.dataset.id))');assert all(t<int(f['turn']) for t in turns),turns
  page.screenshot(path=str(ROOT/f'docs/v21-{edition}-overview.png'))
  if turns:
   page.locator('.commander-popover .commander-battle-link').first.click();seek(page,f"()=>document.querySelector('.map-stage')?.dataset.turn==='{turns[0]}'");pause(page);assert page.locator('.commander-popover').count()==0
  else:page.locator('[data-action=close-commander]').click()
  leave(page)
  page.locator('.map-unit-token[data-role=general]').first.click();expect(page.locator('.commander-overview:not(.commander-popover)')).to_have_count(1);page.locator('nav [data-page=overview]').click();expect(page.locator('.commander-overview-slot')).to_have_count(1);page.locator('[data-action=close-commander]').click();page.locator('nav [data-page=simulation]').click()
  replay(page,f['ministerTurn']);seek(page,"()=>document.querySelector('.map-stage')?.dataset.event==='domestic_roll'&&document.querySelector('.map-stage')?.dataset.phase==='locked'");pause(page)
  positions=page.locator('.is-royal-die .visual-die').evaluate('e=>{const r=e.getBoundingClientRect(),n=e.querySelector(".die-number").getBoundingClientRect();return {ratio:(n.top-r.top)/r.height,font:getComputedStyle(e.querySelector(".die-number")).fontSize}}');assert positions['ratio']<.12,positions;page.screenshot(path=str(ROOT/f'docs/v21-{edition}-minister.png'));leave(page)
  assert page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')==saved
  ctx.route('**/dist/**',lambda r:r.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist'/name)));ctx.set_offline(True);page.reload(wait_until='networkidle');expect(page.locator('.atlas-cell')).to_have_count(160);ctx.close()
  print('PASS '+edition+': serial approach/formation, arrowhead-pin sync and pause/speed, top combat layers, adjacent dice on three viewports, unchanged roll, result/local badges, directional capture/season settlement, exact-lifetime overview without future leakage, fullscreen keys, offline HTML and unchanged live save',flush=True)
 assert not errors,errors;assert not failed,failed;browser.close();print('PASS JavaScript exceptions/request failures: 0')
