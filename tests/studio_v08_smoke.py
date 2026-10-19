"""Real dispatch/combat/death, fixed pins, gold kings, shared sea camera and saved replay."""
from pathlib import Path
import os,json,subprocess
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
subprocess.run(['node',str(ROOT/'tests/make-v08-fixture.mjs')],cwd=ROOT,check=True)
f=json.loads((ROOT/'.artifacts/v08-browser-fixture.json').read_text());errors=[];failed=[]
def seek(page,selector,limit=1600):
 for _ in range(limit):
  if page.locator(selector).count():return
  page.clock.run_for(40)
 raise AssertionError('Missing '+selector+' at '+page.locator('.map-stage').get_attribute('data-event'))
def pause(page):
 if page.locator('.map-stage').get_attribute('data-playing')=='true':page.keyboard.press('a')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);context=b.new_context(viewport={'width':1600,'height':1100});page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda r:failed.append(r.url));page.on('dialog',lambda d:d.accept())
 page.add_init_script('if(!localStorage.getItem("saguk-studio.world.v1")){localStorage.setItem("saguk-studio.world.v1",'+json.dumps(json.dumps(f['world'],ensure_ascii=False))+');localStorage.setItem("saguk-studio.completed-run.v11",'+json.dumps(json.dumps(f['before'],ensure_ascii=False))+');}')
 page.goto(os.environ.get('STUDIO_TEST_URL','http://127.0.0.1:3000'),wait_until='networkidle')
 if os.environ.get('STUDIO_OFFLINE'):
  context.route('**/dist/**',lambda route:route.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist/사국쟁패 Studio.html')));context.set_offline(True)
 page.locator('nav [data-page="simulation"]').click();expect(page.locator('.king-crown')).to_have_count(2)
 assert page.locator('.ocean-texture').evaluate('e=>e.tagName.toLowerCase()')=='image';assert page.locator('.atlas-scroll>img.ocean-texture').count()==0
 assert page.locator('.atlas-map').evaluate('svg=>{const sea=svg.querySelector(".ocean-texture");return sea.ownerSVGElement===svg&&sea.parentElement.classList.contains("unified-map-background")}')
 original=page.locator('.ocean-texture').evaluate('e=>e.getScreenCTM().a');page.locator('[data-action="map-zoom-in"]').click();assert page.locator('.ocean-texture').evaluate('e=>e.getScreenCTM().a')!=original
 assert page.locator('.atlas-map').evaluate('s=>s.querySelector(".ocean-texture").getScreenCTM().a===s.querySelector(".atlas-cells").getScreenCTM().a')
 labels=page.locator('.atlas-labels text').evaluate_all('els=>els.map(e=>[Number(e.getAttribute("x")),Number(e.getAttribute("y"))])');positions=page.locator('.map-unit-position').evaluate_all('els=>els.map(e=>({camp:e.dataset.camp,xy:e.getAttribute("transform").match(/[-0-9.]+/g).map(Number)}))')
 for m in positions:
  i=next(i for i,t in enumerate(f['world']['world']['territories']) if t['id']==m['camp']);x,y=labels[i];assert abs(m['xy'][0]-x)<.001 and abs(m['xy'][1]+55-y+17)<.001
 print('PASS: 왕 금색 이름/왕관·카드 끝/영토 이름 고정·바다/육지 SVG 및 줌 변환 일치',flush=True)
 page.locator('[data-action="map-fullscreen"]').click();page.clock.install(time=0);page.clock.pause_at(1000);page.keyboard.press('Enter')
 seek(page,'.map-stage[data-event="expedition_roll"][data-phase="locked"]');pause(page);expect(page.locator('.map-judgment')).to_contain_text('출전');expect(page.locator('.map-judgment .visual-die')).to_have_attribute('data-die-sides','100');page.keyboard.press('Enter')
 seek(page,'.map-unit-position[data-outcome="victory"]');pause(page);assert page.locator('.unit-defeat').count()==1
 # Inspect actual animation styles at an exact presentation time, independent of wall-clock timing.
 for selector,name in [('.unit-victory','commander-victory'),('.unit-defeat','commander-defeat')]:
  style=page.locator(selector).evaluate('(e,name)=>{const a=e.getAnimations().find(a=>a.animationName===name);if(!a)throw Error("missing animation");a.pause();a.currentTime=0;return getComputedStyle(e).filter}',name);assert ('drop-shadow' in style if 'victory' in selector else 'grayscale' in style),style
 troops=page.locator('.token-copy strong').all_text_contents();assert all('.' not in t for t in troops)
 print('PASS: 실제 D100 출전 판정·승자 밝은 점멸/패자 회색 점멸·만 단위 정수 표시',flush=True)
 page.keyboard.press('Enter');seek(page,'.map-unit-position[data-ghost="true"] .unit-death');pause(page)
 ghost=page.locator('.map-unit-position[data-ghost="true"]');expect(ghost).to_have_attribute('data-person',f['deadId']);effect=ghost.locator('.unit-death')
 first=effect.evaluate('e=>{const a=e.getAnimations().find(a=>a.animationName==="commander-death");a.pause();a.currentTime=0;return {filter:getComputedStyle(e).filter,opacity:getComputedStyle(e).opacity}}');assert 'drop-shadow' in first['filter'];assert ghost.locator('.unit-status-wash.death').count()==1;expect(ghost.locator('.unit-status-label')).to_have_text('사망');assert float(first['opacity'])>.9
 last=effect.evaluate('e=>{const a=e.getAnimations().find(a=>a.animationName==="commander-death");a.currentTime=1800;return getComputedStyle(e).opacity}');assert float(last)==0
 page.keyboard.press('s');assert page.locator(f'.map-unit-position[data-person="{f["deadId"]}"]').count()==0;page.keyboard.press('Escape')
 saved=page.evaluate("localStorage.getItem('saguk-studio.completed-run.v11')");assert json.loads(saved)['engineState']==f['after']
 page.reload(wait_until='networkidle');page.locator('nav [data-page="simulation"]').click();page.locator('.history-entry[data-id="1"]').click();expect(page.locator('.replay-banner')).to_contain_text('역사 재생 중');page.locator('[data-action="map-fullscreen"]').click();seek(page,'.map-unit-position[data-ghost="true"] .unit-death');pause(page);expect(page.locator('.map-unit-position[data-ghost="true"]')).to_have_attribute('data-person',f['deadId']);page.keyboard.press('s');page.keyboard.press('Escape');page.locator('[data-action="return-live"]').click();assert page.evaluate("localStorage.getItem('saguk-studio.completed-run.v11')")==saved
 print('PASS: 전사 카드 빨간 점멸→소멸·실제 최종 상태 일치·저장 후 동일 사망 재생·현재 경기 불변',flush=True)
 page.locator('nav [data-page="rules"]').click();expect(page.locator('[name="fieldCommand"]')).to_be_checked();expect(page.locator('[name="troopRounding"]')).to_have_value('ten-thousand');page.locator('[name="reliefRadius"]').fill('4');page.locator('[name="expedition-5"]').fill('90');page.locator('#rules-form button[type="submit"]').click();assert page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.world.v1')).world.rules.reliefRadius")==4
 assert not errors,errors;assert not failed,failed
 print('PASS: 구원 거리/출전 확률/병력 단위 설정·JavaScript 예외/외부 요청 실패 0건',flush=True);b.close()
