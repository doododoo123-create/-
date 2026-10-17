"""Fullscreen map, compact event panel and progressive die colours in Chromium."""
from pathlib import Path
import os,json
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'.artifacts';OUT.mkdir(exist_ok=True)
results=[];errors=[]
def passed(label):
 results.append(label);print('PASS:',label,flush=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1920,'height':1080},accept_downloads=True)
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
 page.goto(os.environ.get('STUDIO_TEST_URL','http://127.0.0.1:3000'),wait_until='networkidle')
 fixture=page.evaluate('''async()=>{
 const {createDemoWorld}=await import('/src/data/demo-world.js');const {createRun,nextTurn}=await import('/src/engine/simulation.js');const {saveRun}=await import('/src/storage/run-store.js');
 const w=createDemoWorld(),before=nextTurn(createRun(w,123456)),after=nextTurn(before);
 localStorage.setItem('saguk-studio.world.v1',JSON.stringify({kind:'saguk-studio-world',version:2,world:w}));saveRun(localStorage,before);
 return {before:before.engineState,after:after.engineState,record:after.history.at(-1)};
 }''')
 page.reload(wait_until='networkidle')
 saved=page.evaluate("localStorage.getItem('saguk-studio.completed-run.v11')")
 page.locator('[data-action="map-fullscreen"]').click()
 expect(page.locator('.map-stage')).to_have_count(1)
 assert page.evaluate('document.fullscreenElement?.id')=='app'
 expect(page.locator('.sidebar')).to_have_count(0)
 expect(page.locator('.map-stage-sidebar .scene-portrait strong')).to_have_text('강혁')
 expect(page.locator('.map-unit-token')).to_have_count(29)
 assert page.evaluate("localStorage.getItem('saguk-studio.completed-run.v11')")==saved
 passed('개요 지도에서 실제 브라우저 전체화면 진입 · 현 차례 인물 · 29개 부대 카드 · 경기 상태 보존')
 page.locator('#sim-speed').select_option('4')
 page.locator('[data-action="scene-step"]').click()
 expect(page.locator('.arena-panel')).to_have_attribute('data-event','king')
 expect(page.locator('.arena-panel')).to_have_attribute('data-playing','false',timeout=3500)
 assert fixture['record']['title'] not in page.locator('.map-stage-sidebar').inner_text()
 expect(page.locator('.map-stage-chronicle p')).to_have_count(1)
 # The stable fullscreen root survives each full UI render.
 assert page.evaluate('document.fullscreenElement?.id')=='app'
 page.locator('[data-action="scene-step"]').click()
 expect(page.locator('.arena-panel')).to_have_attribute('data-playing','false',timeout=3500)
 page.locator('[data-action="scene-step"]').click()
 expect(page.locator('.campaign-route.attack')).to_have_count(1)
 expect(page.locator('.campaign-route.defense')).to_have_count(1)
 expect(page.locator('.arena-panel')).to_have_attribute('data-playing','false',timeout=6500)
 expect(page.locator('.battle-losses')).to_be_visible()
 expect(page.locator('.map-stage-sidebar .scene-portrait')).to_have_count(2)
 assert page.locator('.captured').count()==len(fixture['record']['battles'][0]['takenCells'])
 passed('우측 인물·공격/방어 주사위·손실·2영토 점령 갱신 · 미공개 미래 기록 숨김 · 전체화면 유지')
 for width,height in [(1920,1080),(1366,768),(1280,720),(1024,768),(390,844)]:
  page.set_viewport_size({'width':width,'height':height})
  assert not page.evaluate('document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight'),(width,height)
  for selector in ['.map-stage-atlas','.map-stage-sidebar','.map-stage-controls']:
   box=page.locator(selector).bounding_box();assert box['width']>0 and box['height']>0
   assert box['x']>=0 and box['y']>=0 and box['x']+box['width']<=width+1 and box['y']+box['height']<=height+1,(selector,width,box)
  if width>=1024:
   assert page.locator('.map-stage-sidebar').evaluate('(el)=>el.scrollHeight<=el.clientHeight'),width
  if width==1920:page.screenshot(path=str(ROOT/'docs/map-fullscreen-preview.png'))
 passed('1920×1080·1366×768·1280×720·1024×768·390px 전체화면 지도/요약/조작 영역 배치')
 page.set_viewport_size({'width':1366,'height':768})
 page.locator('[data-action="scene-skip"]').click()
 assert page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.completed-run.v11')).engineState")==fixture['after']
 expect(page.locator('.map-stage-chronicle p')).to_have_count(2)
 page.locator('[data-action="map-fullscreen-close"]').click()
 expect(page.locator('.map-stage')).to_have_count(0)
 expect(page.locator('.sidebar')).to_be_visible()
 expect(page.locator('.history-entry')).to_have_count(2)
 assert page.evaluate('document.fullscreenElement===null')
 page.locator('[data-action="map-fullscreen"]').click()
 page.evaluate('document.exitFullscreen()')
 expect(page.locator('.map-stage')).to_have_count(0)
 page.locator('[data-action="map-fullscreen"]').click();page.keyboard.press('Escape')
 expect(page.locator('.map-stage')).to_have_count(0)
 passed('턴 결과·자동 저장 동일 · 닫기 버튼/브라우저 전체화면 종료/Esc 복귀')
 # Compare colours in real styled markup, including intermediate raw and corrected faces.
 colors=page.evaluate('''async()=>{
 const {createDemoWorld}=await import('/src/data/demo-world.js');const {createRun,nextTurn}=await import('/src/engine/simulation.js');
 const {TurnPlayback}=await import('/src/ui/playback.js');const {renderArena}=await import('/src/ui/arena-view.js');
 const initial=createRun(createDemoWorld(),123456),run=nextTurn(initial,{rolls:{king:10,'attack:0':10,'attack:1':10,'attack:2':10,'attack:3':10,'attack:4':10},targetId:1}),snapshot=JSON.stringify(run.engineState),player=new TurnPlayback();player.load(run.history[0],initial.world,run.world,false);
 const host=document.createElement('div');document.body.append(host);const result=[];
 for(let value=1;value<=10;value++){
   player.scene.value=value;player.state.phase='locked';host.innerHTML=renderArena({world:initial.world,run,playback:player});
   result.push(getComputedStyle(host.querySelector('.die-number')).color);
 }
 while(player.scene.event?.type!=='attack_roll'||player.scene.bonus<=0)player.step();
 player.scene.value=10;player.state.phase='raw';host.innerHTML=renderArena({world:player.displayWorld,run,playback:player});
 const raw={value:host.querySelector('.visual-die').dataset.dieValue,color:getComputedStyle(host.querySelector('.die-number')).color};
 player.state.phase='locked';host.innerHTML=renderArena({world:player.displayWorld,run,playback:player});
 const total={value:host.querySelector('.visual-die').dataset.dieValue,color:getComputedStyle(host.querySelector('.die-number')).color,scoreColor:getComputedStyle(host.querySelector('.die-equation>strong')).color};
 player.state.phase='rolling';host.innerHTML=renderArena({world:player.displayWorld,run,playback:player});
 const reel=host.querySelector('.rolling-number');const frames=[];
 for(let i=0;i<7;i++){await new Promise(resolve=>setTimeout(resolve,90));const style=getComputedStyle(reel,'::after');frames.push({value:style.content,color:style.color});}
 host.remove();return {result,raw,total,frames,unchanged:snapshot===JSON.stringify(run.engineState)};
 }''')
 channels=lambda c:[int(v.strip()) for v in c.removeprefix('rgb(').removesuffix(')').split(',')]
 redness=[channels(c)[0]-channels(c)[1] for c in colors['result']]
 assert all(a<b for a,b in zip(redness,redness[1:])),colors
 assert int(colors['total']['value'])>int(colors['raw']['value'])
 assert colors['total']['color']==colors['result'][-1]==colors['total']['scoreColor'],colors
 assert len(set(f['value'] for f in colors['frames']))>=3,colors['frames']
 for frame in colors['frames']:
  value=int(frame['value'].strip('"'));assert frame['color']==colors['result'][value-1],frame
 assert colors['unchanged']
 passed('1~10 눈금마다 붉은 강도 증가 · 보정 후 10 초과값 보존 · 굴림 숫자와 색 동기화')
 # Unsupported/denied browser fullscreen still provides an in-window recording canvas.
 fallback=browser.new_context(viewport={'width':1366,'height':768})
 fallback.add_init_script("Element.prototype.requestFullscreen=function(){return Promise.reject(new Error('unsupported'));};")
 other=fallback.new_page();other.on('pageerror',lambda e:errors.append(str(e)));other.goto('http://127.0.0.1:3000',wait_until='networkidle')
 other.locator('[data-action="map-fullscreen"]').click();expect(other.locator('.map-stage')).to_have_count(1)
 assert other.evaluate('document.fullscreenElement===null')
 other.locator('[data-action="step"]').click();expect(other.locator('.arena-panel')).to_have_attribute('data-phase','locked',timeout=3000)
 other.locator('[data-action="scene-skip"]').click();other.keyboard.press('Escape');expect(other.locator('.sidebar')).to_be_visible()
 passed('브라우저 전체화면 API 미지원 환경의 창 내부 녹화 화면과 진행·Esc 동작')
 assert not errors,errors
 print(f'{len(results)}개 전체화면/주사위 시나리오 통과 · JavaScript 예외 0건')
 fallback.close();context.close();browser.close()
