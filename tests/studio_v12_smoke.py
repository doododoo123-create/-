"""160-province vector map integration, editing/undo, scale settings, playback and offline HTML."""
from pathlib import Path
import json,os,subprocess
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
subprocess.run(['node','tests/make-v12-fixture.mjs'],cwd=ROOT,check=True)
f=json.loads((ROOT/'.artifacts/v12-browser-fixture.json').read_text());errors=[];failed=[]
def setup(browser,data=None):
 context=browser.new_context(viewport={'width':1600,'height':1000});page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda r:failed.append(r.url));page.on('dialog',lambda d:d.accept())
 if data:page.add_init_script('if(!localStorage.getItem("saguk-studio.world.v1")){localStorage.setItem("saguk-studio.world.v1",'+json.dumps(json.dumps(data['world'],ensure_ascii=False))+');localStorage.setItem("saguk-studio.completed-run.v11",'+json.dumps(json.dumps(data['run'],ensure_ascii=False))+');}')
 page.goto(os.environ.get('STUDIO_TEST_URL','http://127.0.0.1:3000'),wait_until='networkidle')
 if os.environ.get('STUDIO_OFFLINE'):
  context.route('**/dist/**',lambda r:r.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist/사국쟁패 Studio.html')));context.set_offline(True)
 return context,page

def seek(page,predicate,limit=2200):
 for _ in range(limit):
  if page.evaluate(predicate):return
  page.clock.run_for(100)
 raise AssertionError('Missing playback event at '+page.locator('.arena-panel,.map-stage').first.get_attribute('data-event'))
def pause(page):
 if page.locator('[data-action="auto"]').inner_text().strip()=='일시정지':page.locator('[data-action="auto"]').click()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'],headless=True)
 context,page=setup(b);expect(page.locator('.atlas-cell')).to_have_count(160);assert page.locator('.map-background-image').get_attribute('href').startswith('data:image/svg+xml;base64,');assert page.locator('.ocean-texture').count()==0;assert page.evaluate('typeof window.ContinentMap')=='undefined'
 page.locator('nav [data-page="rules"]').click()
 for name,value in {'territoriesPerCommander':'8','productionDivisor':'2','distanceScale':'1.5','territoryArmyLimit':'5','capture-0':'10','capture-1':'20','baseCapacity':'7','capacityCap':'25','combat-loss-major-1':'40'}.items():expect(page.locator('[name="'+name+'"]').first).to_have_value(value)
 expect(page.locator('[name="adaptiveReserve"]')).to_be_checked();page.locator('[name="productionDivisor"]').fill('3');page.locator('#rules-form button[type="submit"]').click();assert page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.world.v1')).world.rules.productionDivisor")==3
 page.locator('[data-action="scale160-rules"]').click();expect(page.locator('[name="productionDivisor"]')).to_have_value('2');page.locator('nav [data-page="map"]').click();expect(page.locator('.atlas-cell')).to_have_count(160)
 page.locator('.atlas-cell[data-territory="territory-001"]').evaluate('e=>e.dispatchEvent(new MouseEvent("click",{bubbles:true}))');page.locator('#territory-form [name="name"]').fill('수정한 첫 영지');page.locator('#territory-form button[type="submit"]').click();page.reload(wait_until='networkidle');page.locator('nav [data-page="map"]').click();expect(page.locator('#territory-form [name="name"]')).to_have_value('수정한 첫 영지')
 page.locator('[data-action="map-generate"]').click();page.locator('[data-generate="current"]').click();expect(page.locator('[data-generate="generate"]')).to_be_enabled(timeout=20000);expect(page.locator('#generator-count')).to_have_value('160');page.locator('[data-generate="close"]').click();page.locator('nav [data-page="simulation"]').click();page.locator('[data-action="map-fullscreen"]').click();expect(page.locator('.atlas-cell')).to_have_count(160)
 assert page.locator('.map-unit-token[data-role="general"]').count()==22;assert page.locator('.mountain-markers text').count()==21;assert page.locator('.map-stage .map-camera-controls,.map-stage .visual-nations,.map-stage .arena-panel').count()==0
 if not os.environ.get('STUDIO_OFFLINE'):page.screenshot(path=str(ROOT/'docs/v12-map-preview.png'))
 view=page.locator('.atlas-map').get_attribute('viewBox');page.keyboard.press('ArrowRight');assert page.locator('.atlas-map').get_attribute('viewBox')!=view;page.mouse.move(800,500);page.mouse.wheel(0,-1200);assert page.locator('.map-background-image').get_attribute('data-vector-plate')=='continent160';page.keyboard.press('Escape');context.close();print('PASS: 기본160영토/357연결 벡터·산악21개·장군22명·규모 규칙 편집/복원·이름 저장·줌/이동/전체화면',flush=True)
 # Existing 80-province saves must remain unchanged until an explicit map replacement and new run.
 context,page=setup(b,f['legacy']);page.locator('nav [data-page="map"]').click();expect(page.locator('.atlas-cell')).to_have_count(80);saved=page.evaluate("localStorage.getItem('saguk-studio.completed-run.v11')");page.locator('[data-action="map-edit-continent160"]').click();expect(page.locator('.atlas-cell')).to_have_count(160);page.locator('[data-action="map-edit-undo"]').click();expect(page.locator('.atlas-cell')).to_have_count(80);page.locator('[data-action="map-edit-continent160"]').click();page.locator('nav [data-page="simulation"]').click();expect(page.locator('.atlas-cell')).to_have_count(80);assert page.evaluate("localStorage.getItem('saguk-studio.completed-run.v11')")==saved
 page.locator('[data-action="new-run"]').click();page.locator('#dialog-form button[type="submit"]').click();expect(page.locator('.atlas-cell')).to_have_count(160);assert page.locator('.map-unit-token[data-role="general"]').count()==22;context.close();print('PASS: 이전80영토 경기 보존·160지도 적용/되돌리기·명시적 새 실행에서만160전환',flush=True)
 context,page=setup(b,f['history']);page.locator('nav [data-page="simulation"]').click();saved=page.evaluate("localStorage.getItem('saguk-studio.completed-run.v11')");page.locator('#sim-speed').select_option('8');page.clock.install(time=0);page.clock.pause_at(1000);page.locator(f'.history-entry[data-id="{f["turn"]}"]').click();seek(page,"()=>['attack_roll','defense_roll'].includes(document.querySelector('.arena-panel')?.dataset.event)");pause(page);page.locator('[data-action="map-fullscreen"]').click();page.clock.run_for(650);expect(page.locator('.map-judgment .judgment-person')).to_have_count(2);assert all('병력' in t for t in page.locator('.judgment-person figcaption').all_inner_texts())
 if not os.environ.get('STUDIO_OFFLINE'):page.screenshot(path=str(ROOT/'docs/v12-battle-preview.png'))
 page.keyboard.press('Escape');page.locator('[data-action="auto"]').click();seek(page,"()=>document.querySelector('.replay-banner')?.textContent.includes('50 / 50턴')&&document.querySelector('.arena-panel')?.dataset.scene==='result'&&document.querySelector('.arena-panel')?.dataset.playing==='false'")
 owners=page.locator('.atlas-cell').evaluate_all('els=>Object.fromEntries(els.map(e=>[e.dataset.territory,e.dataset.owner]))');assert owners==f['expected'];assert page.evaluate("localStorage.getItem('saguk-studio.completed-run.v11')")==saved;page.locator('[data-action="return-live"]').click();context.close();print('PASS: 실제160영토 전투·판정창/국가색·8배속 연속 역사재생·최종 영토/현재 저장 일치',flush=True)
 assert not errors,errors;assert not failed,failed;b.close();print('PASS: JavaScript 예외/실패 요청0건',flush=True)
