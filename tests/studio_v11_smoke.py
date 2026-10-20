"""Recording UI: deterministic choice reels, refusals, compact combat and offline replay."""
from pathlib import Path
import json,os,subprocess
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
subprocess.run(['node','tests/make-v11-fixture.mjs'],cwd=ROOT,check=True)
f=json.loads((ROOT/'.artifacts/v11-browser-fixture.json').read_text());errors=[];failed=[]
def setup(browser,data=None,viewport=None):
 context=browser.new_context(viewport=viewport or {'width':1600,'height':1000});page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda r:failed.append(r.url));page.on('dialog',lambda d:d.accept())
 if data:page.add_init_script('if(!localStorage.getItem("saguk-studio.world.v1")){localStorage.setItem("saguk-studio.world.v1",'+json.dumps(json.dumps(data['world'],ensure_ascii=False))+');localStorage.setItem("saguk-studio.completed-run.v11",'+json.dumps(json.dumps(data['run'],ensure_ascii=False))+');}')
 page.goto(os.environ.get('STUDIO_TEST_URL','http://127.0.0.1:3000'),wait_until='networkidle')
 if os.environ.get('STUDIO_OFFLINE'):
  context.route('**/dist/**',lambda route:route.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist/사국쟁패 Studio.html')));context.set_offline(True)
 return context,page

def seek(page,selector,limit=1800):
 for _ in range(limit):
  if page.locator(selector).count():return
  page.clock.run_for(100)
 raise AssertionError('Missing '+selector+' at '+page.locator('.arena-panel,.map-stage').first.get_attribute('data-event'))
def pause(page):
 if page.locator('.map-stage').count():
  if page.locator('.map-stage').get_attribute('data-playing')=='true':page.keyboard.press('a')
 elif page.locator('[data-action="auto"]').inner_text().strip()=='일시정지':page.locator('[data-action="auto"]').click()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 context,page=setup(browser);page.locator('nav [data-page="rules"]').click()
 for name,value in {'baseCapacity':'7','capacityCap':'25','capacityWinStep':'3','capacityWinCap':'9','capture-0':'20','capture-1':'40','combat-loss-narrow-0':'15','combat-loss-clear-0':'10','combat-loss-major-0':'8','combat-loss-rout-0':'5','combat-loss-narrow-1':'20','combat-loss-clear-1':'30','combat-loss-major-1':'40','combat-loss-rout-1':'50'}.items():expect(page.locator('[name="'+name+'"]').first).to_have_value(value)
 page.locator('[name="combat-loss-major-1"]').fill('41');page.locator('#rules-form button[type="submit"]').click();stored=page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.world.v1')).world.rules");assert stored['combatLosses']['major'][1]==.41;assert stored['baseCapacity']==7;assert stored['capacityCap']==25
 page.locator('nav [data-page="simulation"]').click();expect(page.locator('.king-crown')).to_have_count(7)
 ocean=page.locator('.ocean-texture').first.evaluate('async e=>{const i=new Image();i.src=e.getAttribute("href");await i.decode();return [i.naturalWidth,i.naturalHeight,e.getAttribute("width"),e.getAttribute("height")]}');assert ocean==[1536,1024,'1200','800'],ocean
 page.locator('[data-action="map-fullscreen"]').click();assert page.locator('.map-stage .map-camera-controls,.map-stage .visual-nations,.map-stage .arena-panel').count()==0
 if not os.environ.get('STUDIO_OFFLINE'):page.screenshot(path=str(ROOT/'docs/v11-map-preview.png'))
 page.keyboard.press('ArrowRight');before=page.locator('.atlas-map').get_attribute('viewBox');page.mouse.move(850,500);page.mouse.wheel(0,-400);assert page.locator('.atlas-map').get_attribute('viewBox')!=before
 print('PASS: 합의한 규칙 기본값/손실률 편집·저장·고해상도 바다·지도 전체화면·줌/이동',flush=True);context.close()
 context,page=setup(browser,f['refusal']);page.locator('nav [data-page="simulation"]').click();saved=page.evaluate("localStorage.getItem('saguk-studio.completed-run.v11')");page.clock.install(time=0);page.clock.pause_at(1000);page.locator('.history-entry[data-id="1"]').click();seek(page,'.arena-panel[data-event="king"] .choice-reel');assert page.locator('.arena-panel[data-event="king"] .visual-die').count()==0
 seek(page,'.arena-panel[data-event="war_target"] .choice-reel');assert page.locator('.arena-panel[data-event="war_target"] .visual-die').count()==0
 seek(page,'.arena-panel[data-event="hold"]');pause(page);page.locator('[data-action="map-fullscreen"]').click();expect(page.locator('.map-judgment .dispatch-refusal')).to_have_text('출정 거부');expect(page.locator('.map-judgment img')).to_have_count(1);assert '병력' in page.locator('.map-judgment figcaption').inner_text();assert page.locator('.map-judgment .visual-die,.map-unit-token .dispatch-refusal').count()==0
 if not os.environ.get('STUDIO_OFFLINE'):page.screenshot(path=str(ROOT/'docs/v11-refusal-preview.png'))
 page.keyboard.press('Escape');assert page.evaluate("localStorage.getItem('saguk-studio.completed-run.v11')")==saved;context.close();print('PASS: 내부 출정 D100 비노출·출정 거부 별도 인물창·왕 행동/국가 선택 파칭코·현재 저장 보존',flush=True)
 context,page=setup(browser,f['policies']);page.locator('nav [data-page="simulation"]').click();page.clock.install(time=0);page.clock.pause_at(1000);page.locator('.history-entry[data-id="1"]').click();seek(page,'.arena-panel[data-event="minister"] .choice-reel');assert page.locator('.arena-panel[data-event="minister"] .visual-die').count()==0;seek(page,'.arena-panel[data-event="domestic_roll"] .visual-die');pause(page);page.locator('[data-action="map-fullscreen"]').click();assert page.locator('.map-judgment .visual-die').count()==1
 # Attached face text is above the D-type label, for D10 as well as D30.
 text=page.locator('.map-judgment .dice-art text').first;assert text.get_attribute('y')=='91';label=page.locator('.map-judgment .attached-die>small');assert label.bounding_box()['y']>text.bounding_box()['y']+text.bounding_box()['height']
 context.close();print('PASS: 승상 정책 파칭코·실행 판정 주사위 유지·숫자와 D표기 간격',flush=True)
 context,page=setup(browser,f['battle'],{'width':1920,'height':1080});page.locator('nav [data-page="simulation"]').click();saved=page.evaluate("localStorage.getItem('saguk-studio.completed-run.v11')");turn=next(r['turn'] for r in f['battle']['run']['history'] if any(not b['automatic'] for b in r['battles']));page.clock.install(time=0);page.clock.pause_at(1000);page.locator(f'.history-entry[data-id="{turn}"]').click();seek(page,'.arena-panel[data-event="attack_roll"]');pause(page);page.locator('[data-action="map-fullscreen"]').click();page.clock.run_for(650)
 expect(page.locator('.map-judgment .judgment-person')).to_have_count(2);assert all('병력' in t for t in page.locator('.judgment-person figcaption').all_inner_texts());assert all('장군' not in t for t in page.locator('.judgment-person small').all_inner_texts());assert page.locator('.judgment-person .framed-portrait').first.bounding_box()['width']>=100
 routes=page.locator('.campaign-route').evaluate_all('els=>els.map(e=>({side:e.classList.contains("attack")?"attack":"defense",color:getComputedStyle(e).stroke,head:e.ownerSVGElement.querySelector(e.getAttribute("marker-end").slice(4,-1)+" path").getAttribute("fill")}))');assert routes;assert routes[0]['color']!=routes[-1]['color'];assert page.locator('.battle-swords-outline').count()==1
 # Camera intentionally puts the battlefield below the compact judgment, after following completes.
 emblem=page.locator('.battle-emblem').bounding_box();dialog=page.locator('.map-judgment').bounding_box();assert emblem['y']>dialog['y']+dialog['height'],(emblem,dialog)
 if not os.environ.get('STUDIO_OFFLINE'):page.screenshot(path=str(ROOT/'docs/v11-battle-preview.png'))
 page.set_viewport_size({'width':480,'height':800});page.clock.run_for(700);assert page.locator('.map-judgment').bounding_box()['width']<=480;assert page.locator('.map-judgment').bounding_box()['x']>=0
 page.keyboard.press('Escape');page.locator('#sim-speed').select_option('8');page.locator('[data-action="scene-skip"]').click();page.locator('[data-action="auto"]').click();seek(page,'.replay-banner');
 # Replaying has not changed the actual saved campaign.
 assert page.evaluate("localStorage.getItem('saguk-studio.completed-run.v11')")==saved;page.locator('[data-action="return-live"]').click();assert page.evaluate("localStorage.getItem('saguk-studio.completed-run.v11')")==saved
 print('PASS: 전투 얼굴 확대·이름 밑 병력·국가색 화살표/윤곽선·전장 하단 구도·작은 화면·8배속 역사 재생',flush=True);context.close()
 assert not errors,errors;assert not failed,failed;browser.close();print('PASS: JavaScript 예외/실패 요청 0건',flush=True)
