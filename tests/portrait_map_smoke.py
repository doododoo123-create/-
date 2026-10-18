"""New portraits, compact face cards, succession names, battle routes and higher dice."""
from pathlib import Path
import os,json
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];errors=[];results=[]
def passed(label):
 results.append(label);print('PASS:',label,flush=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1920,'height':1080},accept_downloads=True)
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
 page.goto(os.environ.get('STUDIO_TEST_URL','http://127.0.0.1:3000'),wait_until='networkidle')
 page.locator('nav [data-page="people"]').click()
 generals=page.locator('.person-card img[data-portrait-kind="general"]')
 expect(generals).to_have_count(35)
 assert len(set(generals.evaluate_all('(imgs)=>imgs.map(i=>i.src)')))==35
 page.locator('[data-action="edit-person"][data-id="general-0-0"]').first.click()
 choices=page.locator('.portrait-options input[value^="general-"]');expect(choices).to_have_count(50)
 assert page.locator('.portrait-options img').evaluate_all('async imgs=>{await Promise.all(imgs.map(i=>i.decode()));return imgs.every(i=>i.naturalWidth>0)}')
 page.locator('[name="portraitKey"][value="general-050"]').check()
 page.locator('#editor-dialog button[type="submit"]').click()
 assert page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.world.v1')).world.people.find(p=>p.id==='general-0-0').portraitKey")=='general-050'
 page.reload(wait_until='networkidle');page.locator('nav [data-page="people"]').click()
 expect(page.locator('.person-card').filter(has_text='진우').locator('img')).to_have_attribute('data-portrait-key','general-050')
 passed('50개 장수 사진 디코딩·35명 서로 다른 자동 얼굴·직접 선택·저장 복구')
 page.locator('nav [data-page="overview"]').click();page.locator('[data-action="map-fullscreen"]').click()
 tokens=page.locator('.map-unit-token');expect(tokens).to_have_count(29)
 for token in tokens.all():
  box=token.bounding_box();assert box['height']>box['width']*1.5
  assert len(token.inner_text().splitlines())<=3
  expect(token.locator('em')).to_have_count(0)
  assert token.locator('img').evaluate('(img)=>img.getBoundingClientRect().width>img.parentElement.getBoundingClientRect().width*1.5')
 expect(page.locator('.ocean-texture')).to_have_count(1)
 assert page.locator('.ocean-texture').get_attribute('src').startswith('data:image/jpeg;base64,')
 assert page.locator('.ocean-texture').evaluate('(img)=>img.complete&&img.naturalWidth>=1000')
 assert page.locator('.ocean-texture').bounding_box()==page.locator('.atlas-scroll').bounding_box()
 assert page.locator('.atlas-map').evaluate('(el)=>getComputedStyle(el).backgroundColor')=='rgba(0, 0, 0, 0)'
 page.screenshot(path=str(ROOT/'docs/compact-map-preview.png'))
 page.keyboard.press('Escape')
 passed('얼굴 확대·얼굴/이름/병력 세로 카드·실제 병력·현실적인 바다·전체화면 여백까지 표시')
 await_data=page.evaluate('''async()=>{
 const {createDemoWorld}=await import('/src/data/demo-world.js');const {createRun,nextTurn,projectWorld}=await import('/src/engine/simulation.js');const {saveRun}=await import('/src/storage/run-store.js');
 const w=createDemoWorld(),before=nextTurn(createRun(w,123456));
 before.engineState.countries[1].generals[0].name='강찬·3대1';before.engineState.countries[1].generals[0].generation=1;
 before.world=projectWorld(before.initialWorld,before.engineState);
 const after=nextTurn(before);localStorage.setItem('saguk-studio.world.v1',JSON.stringify({kind:'saguk-studio-world',version:2,world:w}));saveRun(localStorage,before);
 return {before:before.engineState,after:after.engineState};}''')
 page.reload(wait_until='networkidle');page.clock.install();page.locator('[data-action="map-fullscreen"]').click()
 assert '강찬' in page.locator('.map-stage').inner_text() and '3대1' not in page.locator('.map-stage').inner_text()
 page.keyboard.press('Enter')
 for _ in range(1500):
  if page.locator('.map-stage').get_attribute('data-event')=='defense_roll' and page.locator('.map-stage').get_attribute('data-phase')=='rolling':break
  page.clock.run_for(40)
 else:raise AssertionError('No defense roll')
 page.keyboard.press('a')
 expect(page.locator('.campaign-route.attack')).to_have_count(1)
 expect(page.locator('.campaign-route.defense')).to_have_count(1)
 expect(page.locator('.battle-swords')).to_have_count(1)
 expect(page.locator('.clash-mark')).to_have_count(0)
 assert page.locator('#attack-head').get_attribute('markerUnits')=='userSpaceOnUse'
 assert '3대1' not in page.locator('.map-stage').inner_text()
 for side in ['attack','defense']:
  portrait=page.locator(f'.judgment-side.{side} .framed-portrait').bounding_box()
  die=page.locator(f'.judgment-side.{side} .visual-die').bounding_box()
  assert abs((die['y']+die['height']/2)-(portrait['y']+portrait['height']/2))<10,(portrait,die)
 page.screenshot(path=str(ROOT/'docs/compact-battle-preview.png'))
 for width,height in [(1366,768),(390,844),(844,390)]:
  page.set_viewport_size({'width':width,'height':height});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  for el in page.locator('.judgment-person,.map-judgment .visual-die').all():
   box=el.bounding_box();assert box['x']>=0 and box['y']>=0 and box['x']+box['width']<=width+1 and box['y']+box['height']<=height+1,box
 page.set_viewport_size({'width':1920,'height':1080});page.keyboard.press('s');page.keyboard.press('Escape')
 saved=page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.completed-run.v11')).engineState")
 for key in ['countries','cells','rng','turns']:assert saved[key]==await_data['after'][key],key
 assert '3대1' not in page.locator('#main-content').inner_text()
 passed('후임 번호 숨김·양측 화살표와 벡터 표식·주사위 높이·좁은 화면·실제 결과/RNG 유지')
 assert not errors,errors
 print(json.dumps({'passed':len(results),'javascriptErrors':errors},ensure_ascii=False))
 context.close();browser.close()
