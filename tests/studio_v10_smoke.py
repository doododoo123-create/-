"""Current UI, route-free survivor placement, softened bands and recorded life-cycle effects."""
from pathlib import Path
import json,os,subprocess
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
subprocess.run(['node',str(ROOT/'tests/make-v10-fixture.mjs')],cwd=ROOT,check=True)
f=json.loads((ROOT/'.artifacts/v10-browser-fixture.json').read_text());errors=[];failed=[]
def setup(browser,data=None):
 context=browser.new_context(viewport={'width':1600,'height':1000});page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda r:failed.append(r.url));page.on('dialog',lambda d:d.accept())
 if data:page.add_init_script('if(!localStorage.getItem("saguk-studio.world.v1")){localStorage.setItem("saguk-studio.world.v1",'+json.dumps(json.dumps(data['world'],ensure_ascii=False))+');localStorage.setItem("saguk-studio.completed-run.v11",'+json.dumps(json.dumps(data['run'],ensure_ascii=False))+');}')
 page.goto(os.environ.get('STUDIO_TEST_URL','http://127.0.0.1:3000'),wait_until='networkidle')
 if os.environ.get('STUDIO_OFFLINE'):
  context.route('**/dist/**',lambda r:r.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist/사국쟁패 Studio.html')));context.set_offline(True)
 page.locator('nav [data-page="simulation"]').click();return context,page

def seek(page,selector,limit=1600):
 for _ in range(limit):
  if page.locator(selector).count():return
  page.clock.run_for(100)
 raise AssertionError('Missing '+selector+' at '+page.locator('.arena-panel').get_attribute('data-event'))
def pause(page):
 if page.locator('[data-action="auto"]').inner_text().strip()=='일시정지':page.locator('[data-action="auto"]').click()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 context,page=setup(browser)
 expect(page.locator('.map-background-image')).to_have_attribute('clip-path','url(#continent-clip)');assert page.locator('.king-gold-outline').count()==0;expect(page.locator('.king-crown')).to_have_count(7)
 assert page.locator('.map-unit-token[data-role="king"] .token-copy b').first.evaluate('e=>getComputedStyle(e).color')=='rgb(255, 214, 90)'
 assert page.locator('.atlas-map').evaluate('s=>s.querySelector(".ocean-texture").ownerSVGElement===s.querySelector(".map-background-image").ownerSVGElement')
 page.locator('[data-action="map-fullscreen"]').click();page.locator('.atlas-map').evaluate('s=>s.setAttribute("viewBox","-100 -80 1400 960")')
 if not os.environ.get('STUDIO_OFFLINE'):page.screenshot(path=str(ROOT/'docs/v10-map-preview.png'))
 page.keyboard.press('ArrowRight');assert page.locator('.map-background-image').get_attribute('clip-path')=='url(#continent-clip)';page.keyboard.press('Escape')
 page.locator('nav [data-page="rules"]').click();expect(page.locator('[name="retreatMode"]')).to_have_value('home');assert page.locator('#army-bands tr').count()==10
 assert page.locator('[name="army-score-2"]').input_value()=='3';assert page.locator('[name="army-score-9"]').input_value()=='20';page.locator('#rules-form button[type="submit"]').click();assert page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.world.v1')).world.rules.retreatMode")=='home'
 print('PASS: 지도 물 영역/외부 바다 단일화·확대/이동·왕 금색 이름/왕관·새 병력 보정과 복귀 설정',flush=True);context.close()
 context,page=setup(browser,f['tiny']);front=page.locator('.map-unit-position[data-camp="tile-11"][data-stack-front="true"]');assert front.count()==1
 old=front.get_attribute('data-person');back=page.locator('.map-unit-position[data-camp="tile-11"][data-stack-front="false"] .unit-stack-card');assert back.get_attribute('transform')=='translate(24,0)';front.locator('button').evaluate('e=>e.click()');assert page.locator('.map-unit-position[data-camp="tile-11"][data-stack-front="true"]').get_attribute('data-person')!=old;assert page.locator('.map-unit-position[data-camp="tile-11"] .unit-pin-tip').count()==1
 print('PASS: 포갠 카드24px 간격·뒷카드 노출·클릭 넘기기·묶음 핀 고정',flush=True);context.close()
 context,page=setup(browser,f['history']);saved=page.evaluate("localStorage.getItem('saguk-studio.completed-run.v11')");page.locator('#sim-speed').select_option('8');page.clock.install(time=0);page.clock.pause_at(1000);page.locator('.history-entry[data-id="1"]').click();seek(page,'.unit-death');pause(page)
 death=page.locator('.unit-death');expect(death.locator('.unit-status-label')).to_have_text('사망');assert death.locator('.unit-status-label').evaluate('e=>getComputedStyle(e).fill')=='rgb(255, 48, 56)'
 wash=death.locator('.unit-status-wash');assert wash.evaluate('e=>getComputedStyle(e).fill')=='rgb(255, 16, 27)';assert wash.evaluate('e=>{const a=e.getAnimations()[0];a.effect.updateTiming({delay:0});a.pause();a.currentTime=0;return +getComputedStyle(e).opacity}')>.4
 assert death.evaluate('e=>{const a=e.getAnimations().find(a=>a.animationName==="commander-death");a.pause();a.currentTime=1800;return +getComputedStyle(e).opacity}')==0
 page.locator('[data-action="auto"]').click();seek(page,'.unit-appointment');pause(page);expect(page.locator('.arena-panel')).to_have_attribute('data-event','roster');expect(page.locator('.unit-appointment .unit-status-label').first).to_have_text('임관')
 page.locator('.history-entry[data-id="8"]').click();seek(page,'.unit-appointment');pause(page);appointment=page.locator('.unit-appointment').first;expect(appointment.locator('.unit-status-label')).to_have_text('임관');assert appointment.locator('.unit-status-label').evaluate('e=>getComputedStyle(e).fill')=='rgb(57, 255, 115)';assert appointment.locator('.unit-status-wash').evaluate('e=>getComputedStyle(e).fill')=='rgb(255, 210, 62)'
 assert appointment.evaluate('e=>e.getAnimations().some(a=>a.animationName==="commander-appointment")');page.locator('[data-action="scene-skip"]').click();assert page.locator('.unit-status-label').count()==0;page.locator('[data-action="return-live"]').click();assert page.evaluate("localStorage.getItem('saguk-studio.completed-run.v11')")==saved
 page.reload(wait_until='networkidle');page.locator('nav [data-page="simulation"]').click();page.locator('.history-entry[data-id="8"]').click();seek(page,'.unit-appointment');pause(page);assert page.evaluate("localStorage.getItem('saguk-studio.completed-run.v11')")==saved
 print('PASS: 실제 사망 빨간 점멸/사망 표기/소멸·후임 금색 점멸/초록 임관·8배속/정지/저장 후 동일 재생',flush=True);context.close()
 context,page=setup(browser,f['capital']);survivor=f['capitalPerson'];card=page.locator('.map-unit-position[data-person="'+survivor['id']+'"]');expect(card).to_have_attribute('data-camp',survivor['positionId']);assert str(survivor['troops']) in card.locator('.token-copy strong').inner_text();assert '퇴각 불가' not in card.locator('button').get_attribute('title')
 saved=page.evaluate("localStorage.getItem('saguk-studio.completed-run.v11')");page.clock.install(time=0);page.clock.pause_at(1000);page.locator('.history-entry[data-id="1"]').click();seek(page,'.arena-panel[data-event="retreat"]:not([data-scene^="move-"])');pause(page);expect(page.locator('.arena-heading')).to_contain_text('수도 인근');page.locator('[data-action="scene-skip"]').click();expect(page.locator('.map-unit-position[data-person="'+survivor['id']+'"]')).to_have_attribute('data-camp',survivor['positionId']);assert page.evaluate("localStorage.getItem('saguk-studio.completed-run.v11')")==saved
 print('PASS: 담당 영지 없는 생존 지휘관 수도 인근 배치·카드/잔여 병력 보존·같은 퇴각 재생',flush=True);context.close()
 assert not errors,errors;assert not failed,failed;browser.close();print('PASS: JavaScript 예외/실패 요청0건',flush=True)
