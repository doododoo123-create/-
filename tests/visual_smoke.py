"""v11 original map, independent units, sequential battles, playback and resume."""
from pathlib import Path
import os,json,re
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'.artifacts';OUT.mkdir(exist_ok=True)
results=[];errors=[]
def passed(label):
 results.append(label);print('PASS:',label,flush=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1600,'height':1000},accept_downloads=True)
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
 page.goto(os.environ.get('STUDIO_TEST_URL','http://127.0.0.1:3000'),wait_until='networkidle')
 page.locator('nav [data-page="simulation"]').click()
 expect(page.locator('.map-unit-token[data-role="king"]')).to_have_count(7)
 expect(page.locator('.map-unit-token[data-role="general"]')).to_have_count(22)
 assert page.locator('img').evaluate_all('(imgs)=>imgs.every(i=>i.complete&&i.naturalWidth>0)')
 passed('원본 지도·초상화·수도 7개·장군별 주둔군 22개 표시')
 page.locator('[data-action="step"]').click()
 expect(page.locator('.arena-panel')).to_have_attribute('data-phase','rolling')
 expect(page.locator('.pending-entry')).to_have_count(1)
 expect(page.locator('.visual-die[data-die-locked="true"]')).to_have_count(0)
 page.locator('[data-action="auto"]').click()
 phase=page.locator('.arena-panel').get_attribute('data-phase');page.wait_for_timeout(1200)
 assert page.locator('.arena-panel').get_attribute('data-phase')==phase
 page.locator('[data-action="step"]').click()
 expect(page.locator('.arena-panel')).to_have_attribute('data-phase','locked',timeout=2500)
 page.locator('[data-action="scene-skip"]').click()
 expect(page.locator('.pending-entry')).to_have_count(0)
 page.reload(wait_until='networkidle');page.locator('nav [data-page="simulation"]').click()
 expect(page.locator('.history-entry')).to_have_count(1)
 assert page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.completed-run.v11')).engineState.turns")==1
 passed('실제 타이머 · 미공개 결과 숨김 · 정지/재개 · 완료 턴 자동 저장 및 새로고침 복구')
 # Deterministic reference fixture: seed 123456, first turn domestic, next turn four separate battles.
 fixture=page.evaluate('''async()=>{
 const {createDemoWorld}=await import('/src/data/demo-world.js');const {createRun,nextTurn}=await import('/src/engine/simulation.js');const {saveRun}=await import('/src/storage/run-store.js');
 const w=createDemoWorld(),before=nextTurn(createRun(w,123456)),after=nextTurn(before);
 localStorage.setItem('saguk-studio.world.v1',JSON.stringify({kind:'saguk-studio-world',version:2,world:w}));saveRun(localStorage,before);
 return {before:before.engineState,after:after.engineState,record:after.history.at(-1)};
 }''')
 page.reload(wait_until='networkidle');page.locator('nav [data-page="simulation"]').click()
 page.locator('#sim-speed').select_option('4')
 page.locator('[data-action="scene-step"]').click()
 expect(page.locator('.arena-panel')).to_have_attribute('data-event','king')
 expect(page.locator('.map-campaign')).to_have_count(0)
 # One press completes a judgment group, then waits at its final frame.
 expect(page.locator('.arena-panel')).to_have_attribute('data-playing','false',timeout=3500)
 page.locator('[data-action="scene-step"]').click()
 expect(page.locator('.arena-panel')).to_have_attribute('data-event','war_target')
 expect(page.locator('.arena-panel')).to_have_attribute('data-playing','false',timeout=3500)
 page.locator('#sim-speed').select_option('1')
 page.locator('[data-action="scene-step"]').click()
 expect(page.locator('.campaign-route.attack')).to_have_count(1)
 expect(page.locator('.campaign-route.defense')).to_have_count(1)
 expect(page.locator('.battle-target')).to_have_count(1)
 # Attack and defense run continuously into this battle's map application.
 expect(page.locator('.arena-panel')).to_have_attribute('data-event','resolve',timeout=6500)
 expect(page.locator('.arena-panel')).to_have_attribute('data-scene',re.compile('^apply-'),timeout=6500)
 page.locator('[data-action="auto"]').click()
 expect(page.locator('.battle-losses')).to_be_visible()
 assert 'apply-' in page.locator('.arena-panel').get_attribute('data-scene')
 assert page.locator('.captured').count()==len(fixture['record']['battles'][0]['takenCells'])
 expect(page.locator('.map-unit-feedback[data-effect="army"]')).to_have_count(2)
 page.screenshot(path=str(OUT/'v11-first-battle.png'),full_page=True)
 passed('장군별 실제 경로 · 양측 주사위 연속 진행 · 2영토 점령 · 양측 부대 손실 표시')
 page.locator('[data-action="scene-skip"]').click()
 saved=page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.completed-run.v11'))")
 assert saved['engineState']==fixture['after']
 assert len(saved['history'][-1]['battles'])==4
 # Same stored state after reload must generate the exact next RNG and events.
 expected=page.evaluate('''async()=>{const {loadRun}=await import('/src/storage/run-store.js');const {nextTurn}=await import('/src/engine/simulation.js');return nextTurn(loadRun(localStorage)).engineState;}''')
 page.reload(wait_until='networkidle');page.locator('nav [data-page="simulation"]').click()
 page.locator('[data-action="step"]').click();page.locator('[data-action="scene-skip"]').click()
 assert page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.completed-run.v11')).engineState")==expected
 passed('한 원정의 4회 전투 원본 결과 · 저장/재개 후 다음 턴 난수와 상태 동일')
 # Show another battle in recording view, then verify desktop and small viewport boundaries.
 page.locator('[data-action="new-run"]').click();page.locator('#editor-dialog [name="seed"]').fill('123456');page.locator('#editor-dialog button[type="submit"]').click()
 expect(page.locator('.history-entry')).to_have_count(0)
 page.locator('#sim-speed').select_option('4')
 page.locator('[data-action="step"]').click();page.locator('[data-action="scene-skip"]').click()
 page.locator('[data-action="scene-step"]').click();expect(page.locator('.arena-panel')).to_have_attribute('data-playing','false',timeout=3500)
 page.locator('[data-action="scene-step"]').click();expect(page.locator('.arena-panel')).to_have_attribute('data-playing','false',timeout=3500)
 page.locator('[data-action="scene-step"]').click();expect(page.locator('.arena-panel')).to_have_attribute('data-playing','false',timeout=6500)
 page.locator('[data-action="recording"]').click();expect(page.locator('.sidebar')).to_be_hidden()
 for width,height in [(1920,1080),(1366,768)]:
  page.set_viewport_size({'width':width,'height':height})
  assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),f'overflow {width}'
  arena=page.locator('.arena-panel').bounding_box();assert arena['y']+arena['height']<=height+2,(width,arena)
  if width==1920:page.screenshot(path=str(ROOT/'docs/visual-preview.png'))
 page.keyboard.press('Escape');expect(page.locator('.sidebar')).to_be_visible()
 page.locator('[data-action="replay-run"]').click();expect(page.locator('.history-entry')).to_have_count(0)
 passed('동일 초기 세계·시드 재현 · 새 실행 · 1920×1080/1366×768 관찰 화면')
 for width in [1920,1280,1024,768,390]:
  page.set_viewport_size({'width':width,'height':900})
  for screen in ['overview','countries','people','map','rules','simulation']:
   page.locator(f'nav [data-page="{screen}"]').click()
   assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),f'overflow {screen} at {width}'
 passed('390~1920px 6개 화면 가로 넘침 없음')
 assert not errors,errors
 print(f'{len(results)}개 시각화 시나리오 통과 · JavaScript 예외 0건')
 context.close();browser.close()
