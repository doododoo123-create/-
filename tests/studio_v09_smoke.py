"""V0.9 stacking, country outlines, fatigue/waves, continuous recorded playback and limits."""
from pathlib import Path
import os,json,subprocess
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
subprocess.run(['node',str(ROOT/'tests/make-v09-fixture.mjs')],cwd=ROOT,check=True)
f=json.loads((ROOT/'.artifacts/v09-browser-fixture.json').read_text());errors=[];failed=[]
def seek(page,predicate,limit=2200):
 for _ in range(limit):
  if page.evaluate(predicate):return
  page.clock.run_for(100)
 raise AssertionError('Timed out at '+page.locator('.replay-banner').inner_text())
def pause(page):
 if page.locator('[data-action="auto"]').inner_text().strip()=='일시정지':page.locator('[data-action="auto"]').click()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);context=b.new_context(viewport={'width':1600,'height':1100});page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda r:failed.append(r.url));page.on('dialog',lambda d:d.accept())
 page.add_init_script('if(!localStorage.getItem("saguk-studio.world.v1")){localStorage.setItem("saguk-studio.world.v1",'+json.dumps(json.dumps(f['world'],ensure_ascii=False))+');localStorage.setItem("saguk-studio.completed-run.v11",'+json.dumps(json.dumps(f['run'],ensure_ascii=False))+');}')
 page.goto(os.environ.get('STUDIO_TEST_URL','http://127.0.0.1:3000'),wait_until='networkidle')
 if os.environ.get('STUDIO_OFFLINE'):
  context.route('**/dist/**',lambda route:route.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist/사국쟁패 Studio.html')));context.set_offline(True)
 page.locator('nav [data-page="simulation"]').click();saved=page.evaluate("localStorage.getItem('saguk-studio.completed-run.v11')")
 expect(page.locator('#sim-speed option[value="8"]')).to_have_count(1);assert '충원 상한' in page.locator('.visual-nations').inner_text()
 front=page.locator('.map-unit-position[data-stack-front="true"]:not([data-stack-count="1"])').first
 camp=front.get_attribute('data-camp');person=front.get_attribute('data-person');front.locator('button').evaluate('e=>e.click()')
 next_front=page.locator(f'.map-unit-position[data-camp="{camp}"][data-stack-front="true"]');assert next_front.get_attribute('data-person')!=person
 assert next_front.locator('.unit-stack-card').get_attribute('transform')=='translate(0,0)'
 assert page.locator(f'.map-unit-position[data-camp="{camp}"][data-stack-front="false"] .unit-pin-tip').count()==0
 print('PASS: 한 영토 카드 포개기·클릭 넘기기·핀 위치 유지·국가별 충원 상한 표시',flush=True)
 page.locator('#sim-speed').select_option('8');page.clock.install(time=0);page.clock.pause_at(1000)
 page.locator('.history-entry[data-id="3"]').click();expect(page.locator('.replay-banner')).to_contain_text('3 / 16턴')
 seek(page,"() => document.querySelector('.arena-panel')?.dataset.event==='attack_roll' || document.querySelector('.arena-panel')?.dataset.event==='defense_roll'")
 pause(page);assert page.locator('.fatigue-bonus').count()>0;assert '이동' in page.locator('.fatigue-bonus').first.inner_text()
 page.locator('[data-action="map-fullscreen"]').click();assert page.locator('.map-stage .map-judgment').count()==1
 outlines=page.locator('.judgment-person .framed-portrait').evaluate_all('els=>els.map(e=>({width:getComputedStyle(e).outlineWidth,color:getComputedStyle(e).outlineColor,nation:getComputedStyle(e).getPropertyValue("--nation")}))')
 assert len(outlines)==2;assert all(x['width']=='4px' for x in outlines);assert outlines[0]['color']!=outlines[1]['color']
 assert page.locator('.map-stage .visual-nations,.map-stage .arena-panel,.map-stage .map-camera-controls').count()==0
 if not os.environ.get('STUDIO_OFFLINE'):page.screenshot(path=str(ROOT/'docs/v09-map-preview.png'))
 page.keyboard.press('Escape');assert page.evaluate("localStorage.getItem('saguk-studio.completed-run.v11')")==saved
 print('PASS: 기록된 이동 피로·공격/수비 국가색 테두리·지도 전체화면 녹화 구성 유지',flush=True)
 # Pick another recorded turn, then verify a multi-commander defense wave.
 page.locator('.history-entry[data-id="8"]').click();seek(page,"() => document.querySelector('.battle-sequence')?.textContent.includes('순차 방어')")
 pause(page);expect(page.locator('.battle-sequence')).to_contain_text('순차 방어');assert page.locator('[data-action="auto"]').is_enabled()
 stopped=page.locator('.arena-panel').get_attribute('data-scene');page.clock.run_for(5000);assert page.locator('.arena-panel').get_attribute('data-scene')==stopped
 # Skip one recorded turn while running: it must continue at 9 and stop at recorded end 16.
 page.locator('[data-action="auto"]').click();page.locator('[data-action="scene-skip"]').click();page.clock.run_for(100);expect(page.locator('.replay-banner')).to_contain_text('9 / 16턴')
 page.locator('[data-action="auto"]').click();page.locator('#sim-speed').select_option('4');page.locator('#sim-speed').select_option('8');page.locator('[data-action="auto"]').click()
 seek(page,"() => document.querySelector('.replay-banner')?.textContent.includes('16 / 16턴') && document.querySelector('.arena-panel')?.dataset.scene==='result' && document.querySelector('.arena-panel')?.dataset.playing==='false'")
 page.clock.run_for(3000);expect(page.locator('.replay-banner')).to_contain_text('16 / 16턴');assert page.locator('.history-entry[data-id="17"]').count()==0
 assert page.locator('.atlas-cell').evaluate_all('els=>els.map(e=>[e.dataset.territory,e.dataset.owner])')==f['expected']['16']['owners']
 assert page.evaluate("localStorage.getItem('saguk-studio.completed-run.v11')")==saved
 page.locator('[data-action="return-live"]').click();assert page.locator('.replay-banner').count()==0;assert page.evaluate("localStorage.getItem('saguk-studio.completed-run.v11')")==saved
 print('PASS: 선택 턴→마지막 기록까지 연속 재생·정지/재개·4/8배속·마지막 정지·미래 턴 생성/저장 변경 없음',flush=True)
 page.locator('nav [data-page="rules"]').click();expect(page.locator('[name="advancedCampaign"]')).to_be_checked();expect(page.locator('[name="territoryArmyLimit"]')).to_have_value('10');expect(page.locator('[name="fatigueStep"]')).to_have_value('4');expect(page.locator('[name="fatiguePenalty"]')).to_have_value('2');expect(page.locator('[name="supply-min"]')).to_have_value('1');expect(page.locator('[name="supply-max"]')).to_have_value('3')
 page.locator('[name="territoryArmyLimit"]').fill('12');page.locator('#rules-form button[type="submit"]').click();stored=page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.world.v1')).world");assert stored['rules']['territoryArmyLimit']==12;assert stored['rules']['supplyGainRange']==[1,3]
 page.locator('nav [data-page="simulation"]').click();page.locator('[data-action="step"]').click();pending_scene=page.locator('.arena-panel').get_attribute('data-scene');pending_phase=page.locator('.arena-panel').get_attribute('data-phase')
 page.locator('.history-entry[data-id="16"]').click();expect(page.locator('.replay-banner')).to_contain_text('16 / 16턴');assert page.locator('.history-entry[data-id="17"]').count()==0;page.locator('[data-action="return-live"]').click();assert page.locator('.arena-panel').get_attribute('data-scene')==pending_scene;assert page.locator('.arena-panel').get_attribute('data-phase')==pending_phase;assert page.locator('.arena-panel').get_attribute('data-playing')=='false';assert page.evaluate("localStorage.getItem('saguk-studio.completed-run.v11')")==saved
 print('PASS: 진행 중 미완료 턴은 재생 범위에서 제외·현재로 복귀 시 원래 판정에서 정지',flush=True)
 assert not errors,errors;assert not failed,failed;print('PASS: 새 규칙 화면 편집·저장·JavaScript 예외/실패 요청 0건',flush=True);b.close()
