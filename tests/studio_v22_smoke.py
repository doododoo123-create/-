"""Both offline editions: a moving curved front, sequential provinces, texture/royal UI, new battle rules and old-save isolation."""
from pathlib import Path
from urllib.parse import quote
import json,subprocess
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
subprocess.run(['node','tests/make-v22-fixture.mjs'],cwd=ROOT,check=True)
flow=json.loads((ROOT/'.artifacts/v22-flow-fixture.json').read_text());combat=json.loads((ROOT/'.artifacts/v22-combat-fixture.json').read_text());errors=[];failed=[]
def seek(page,predicate,limit=2500):
 for _ in range(limit):
  if page.evaluate(predicate):return
  page.clock.run_for(20)
 page.screenshot(path=str(ROOT/'.artifacts/v22-failure.png'))
 raise AssertionError('Missing '+predicate+' state '+str(page.locator('.map-stage').evaluate('e=>({...e.dataset})'))+' errors '+str(errors))
def pause(page):
 if page.locator('.map-stage').get_attribute('data-playing')=='true':page.locator('.map-play-toggle').click()
def resume(page):
 if page.locator('.map-stage').get_attribute('data-playing')!='true':page.locator('.map-play-toggle').click()
def replay(page,turn):page.locator(f'.history-entry[data-id="{turn}"]').click();page.locator('[data-action=map-fullscreen]').click()
def leave(page):pause(page);page.keyboard.press('Escape');page.locator('[data-action=return-live]').click()
def waves(page):return page.locator('[data-front-wave]').evaluate_all('els=>els.map(e=>({index:Number(e.dataset.frontWave),order:Number(e.dataset.waveOrder),count:Number(e.dataset.waveCount),p:Number(e.dataset.waveProgress),d:e.getAttribute("d")}))')
def open_fixture(browser,mobile,fixture):
 ctx=browser.new_context(viewport={'width':900,'height':600} if mobile else {'width':1600,'height':1000});page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda r:failed.append(r.url));page.on('dialog',lambda d:d.accept())
 page.add_init_script('if(!localStorage.getItem("saguk-studio.world.v1")){localStorage.setItem("saguk-studio.world.v1",'+json.dumps(json.dumps(fixture['world']))+');localStorage.setItem("saguk-studio.completed-run.v11",'+json.dumps(json.dumps(fixture['run']))+');}')
 name='사국쟁패 Studio 모바일 경량.html' if mobile else '사국쟁패 Studio.html';page.goto('http://127.0.0.1:3000/dist/'+quote(name),wait_until='networkidle');expect(page.locator('.atlas-cell')).to_have_count(160);assert 'v0.22.0' in page.locator('.page-footer').inner_text();page.locator('nav [data-page=simulation]').click();page.locator('#sim-speed').select_option('8');saved=page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")');page.clock.install(time=0);page.clock.pause_at(1000);return ctx,page,name,saved
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for mobile in [False,True]:
  label='mobile' if mobile else 'normal';ctx,page,name,saved=open_fixture(browser,mobile,flow)
  replay(page,1);seek(page,f"()=>document.querySelector('.map-stage')?.dataset.kind==='capture'&&document.querySelector('.map-stage')?.dataset.battleIndex==='{flow['battle']['index']}'");pause(page)
  duration=900+(len(flow['battle']['takenTerritoryIds'])-1)*500
  for target,title in [(.18,'front-first'),(.5,'front-second'),(.84,'front-third')]:
   ws=sorted(waves(page),key=lambda w:w['order']);current=sum(w['p'] for w in ws)/3
   if target>current:resume(page);page.clock.run_for(round((target-current)*duration/8));pause(page)
   ws=sorted(waves(page),key=lambda w:w['order']);assert len(ws)==3,ws
   if target<1/3:assert 0<ws[0]['p']<1 and ws[1]['p']==0 and ws[2]['p']==0,ws
   elif target<2/3:assert ws[0]['p']==1 and 0<ws[1]['p']<1 and ws[2]['p']==0,ws
   else:assert ws[0]['p']==1 and ws[1]['p']==1 and 0<ws[2]['p']<1,ws
   assert page.locator('.moving-front-color').evaluate_all('els=>els.some(e=>(e.getAttribute("d")||"").includes("Q"))')
   assert page.locator('.round-captured-territory').evaluate_all('els=>els.every(e=>e.hasAttribute("clip-path"))')
   snapshot=waves(page);page.clock.run_for(300);assert waves(page)==snapshot
   page.screenshot(path=str(ROOT/f'docs/v22-{label}-{title}.png'))
  assert 'data:image/webp;base64,' in page.locator('html').get_attribute('style');assert page.locator('pattern[id^=text-box-]').count()==6
  # The enlarged king portrait and role-specific facts are opened from its actual map card.
  page.locator('.map-unit-position[data-unit-role=king] .map-unit-token').first.click();expect(page.locator('.commander-popover')).to_have_attribute('data-person-role','king');assert page.locator('.commander-popover header img').bounding_box()['width']>=88;assert page.locator('.commander-popover').get_by_text('주공 목표',exact=True).count()==1;page.screenshot(path=str(ROOT/f'docs/v22-{label}-king.png'));page.locator('[data-action=close-commander]').click();leave(page)
  replay(page,flow['ministerTurn']);seek(page,"()=>!!document.querySelector('.is-royal-choice[data-event=minister]')");pause(page);page.locator('.map-unit-position[data-unit-role=minister] .map-unit-token').click();expect(page.locator('.commander-popover')).to_have_attribute('data-person-role','minister');assert page.locator('.commander-popover').get_by_text('政策性向').count()==0;assert page.locator('.commander-popover').get_by_text('정책 성향',exact=True).count()==1;assert page.locator('.commander-popover header img').bounding_box()['width']>=88;page.screenshot(path=str(ROOT/f'docs/v22-{label}-minister.png'));page.locator('[data-action=close-commander]').click();leave(page)
  replay(page,flow['seasonTurn']);seek(page,"()=>document.querySelector('.map-stage')?.dataset.kind==='season'");pause(page);assert page.locator('[data-round-capture]').count()>=3;resume(page);seek(page,"()=>document.querySelector('.map-stage')?.dataset.kind==='round-settle'");pause(page)
  # The opening part highlights each province before the sequential color settlement.
  resume(page);page.clock.run_for(30);pause(page);assert page.locator('[data-wave-glow]').evaluate_all('els=>els.some(e=>Number(e.getAttribute("opacity"))>.2)');page.screenshot(path=str(ROOT/f'docs/v22-{label}-settle-highlight.png'));resume(page);page.clock.run_for(160);pause(page);page.screenshot(path=str(ROOT/f'docs/v22-{label}-settle-flow.png'));resume(page);seek(page,"()=>document.querySelector('.map-stage')?.dataset.kind==='reel'");pause(page);assert page.locator('[data-round-capture]').count()==0;leave(page)
  assert page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')==saved
  ctx.route('**/dist/**',lambda r:r.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist'/name)));ctx.set_offline(True);page.reload(wait_until='networkidle');expect(page.locator('.atlas-cell')).to_have_count(160);ctx.close();print('PASS '+label+': sequential curved fronts and simultaneous hatching, pause/8x, textured boxes, enlarged king/minister details, settlement emphasis, offline HTML and unchanged saved game',flush=True)
  cc,pg,_,live=open_fixture(browser,mobile,combat);counter=combat['counter'];replay(pg,counter['turn'])
  for b in counter['battles']:
   seek(pg,f"()=>document.querySelector('.map-stage')?.dataset.battleIndex==='{b['index']}'&&document.querySelector('.map-stage')?.dataset.event==='attack_roll'");pause(pg)
   expect(pg.locator('.map-unit-position[data-combat-side=attack]')).to_have_attribute('data-country',b['actorId']);expect(pg.locator('.map-unit-position[data-combat-side=defense]')).to_have_attribute('data-country',b['defenderId'])
   arrow=pg.locator('.operation-arrow').last;assert arrow.get_attribute('data-icon-clearance') is not None;assert float(arrow.get_attribute('data-icon-clearance'))>0
   pane=pg.locator('.is-compact-duel');assert pane.get_attribute('data-adjacent') in ['above','below'];resume(pg)
  pg.screenshot(path=str(ROOT/f'docs/v22-{label}-counter-chain.png'));leave(pg)
  replay(pg,combat['death']['turn']);seek(pg,f"()=>document.querySelector('.map-stage')?.dataset.battleIndex==='{combat['death']['battle']}'&&document.querySelector('.map-stage')?.dataset.event==='death_roll'");pause(pg);assert '대패' in pg.locator('.is-royal-die').inner_text();assert pg.locator('.is-royal-die .visual-die').get_attribute('data-die-sides')=='10';resume(pg);seek(pg,"()=>!!document.querySelector('.unit-death')");pause(pg);assert pg.locator('.unit-status-label.death').count()==1;pg.screenshot(path=str(ROOT/f'docs/v22-{label}-rout-death.png'));leave(pg)
  assert pg.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')==live;cc.close();print('PASS '+label+': actual attack/counter/counter-counter sequence, national roles, icon clearance, near-card dice, score-grade death roll and preserved survivors',flush=True)
  fresh=browser.new_context(viewport={'width':1200,'height':800});q=fresh.new_page();q.on('pageerror',lambda e:errors.append(str(e)));q.on('dialog',lambda d:d.accept());q.goto('http://127.0.0.1:3000/dist/'+quote(name),wait_until='networkidle');q.locator('nav [data-page=rules]').click();expect(q.locator('[name=continuousCampaign]')).to_be_checked();expect(q.locator('[name=routDeath]')).to_be_checked();expect(q.locator('[name=strategicTargets]')).to_be_checked();expect(q.locator('[name=strategyWeakLands]')).to_have_value('7');q.locator('nav [data-page=simulation]').click();q.locator('[data-action=step]').click();q.locator('[data-action=scene-skip]').click();stored=q.evaluate('JSON.parse(localStorage.getItem("saguk-studio.completed-run.v11"))');assert stored['engineVersion']=='studio-v11-25' and stored['initialWorld']['rules']['continuousCampaign'];fresh.close()
 assert not errors,errors;assert not failed,failed;browser.close();print('PASS JavaScript exceptions/request failures: 0; both fresh defaults: engine25, strategic finishing 1–7, continuous campaign and rout death')
