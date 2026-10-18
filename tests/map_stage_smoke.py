"""Clean fullscreen map, central judgments and exact transient map effects."""
from pathlib import Path
import os,json
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'.artifacts';OUT.mkdir(exist_ok=True)
results=[];errors=[]
def passed(label):
 results.append(label);print('PASS:',label,flush=True)

def seek(page,event,phase=None,limit=1200):
 for _ in range(limit):
  stage=page.locator('.map-stage')
  if stage.get_attribute('data-event')==event and (phase is None or stage.get_attribute('data-phase')==phase):return
  page.clock.run_for(40)
 raise AssertionError(f'No {event}/{phase}: '+page.locator('.map-stage').get_attribute('data-event'))

def pause(page):
 if page.locator('.map-stage').get_attribute('data-playing')=='true':page.keyboard.press('a')

FIXTURE='''async(kind)=>{
 const {createDemoWorld}=await import('/src/data/demo-world.js');
 const {createRun,nextTurn,projectWorld}=await import('/src/engine/simulation.js');
 const {saveRun}=await import('/src/storage/run-store.js');
 const w=createDemoWorld();let before,after;
 if(kind==='war'){before=nextTurn(createRun(w,123456));after=nextTurn(before);}
 else if(kind==='production'){
   before=createRun(w,15);for(let i=0;i<6;i++)before=nextTurn(before,{rolls:{king:1,minister:1,domestic:1}});after=nextTurn(before);
 }else{
   const action={recruit:'모병',recruitment:'충원력 강화',supply:'보급 강화',resupply:null}[kind];
   for(let i=1;i<300;i++){
     before=createRun(w,i*104729);
     if(kind==='resupply'){before.engineState.countries[0].reserve+=5;before.engineState.countries[0].army+=5;before.world=projectWorld(before.initialWorld,before.engineState);}
     after=nextTurn(before);const r=after.history.at(-1);
     if(kind==='resupply'||r.type==='domestic'&&r.action===action&&r.success)break;
     after=null;
   }
   if(!after)throw Error('Missing '+kind+' fixture');
 }
 localStorage.setItem('saguk-studio.world.v1',JSON.stringify({kind:'saguk-studio-world',version:2,world:w}));saveRun(localStorage,before);
 const r=after.history.at(-1),type=kind==='production'?'round_end':kind==='resupply'?'resupply':'resolve',index=r.events.findIndex(e=>e.type===type);
 return {expected:after.engineState,record:r,before:before.world,frame:{before:r.frames[index].before,after:r.frames[index].after},eventIndex:index};
}'''
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1920,'height':1080},accept_downloads=True)
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
 page.goto(os.environ.get('STUDIO_TEST_URL','http://127.0.0.1:3000'),wait_until='networkidle')
 fixture=page.evaluate(FIXTURE,'war');page.reload(wait_until='networkidle');page.clock.install()
 saved=page.evaluate("localStorage.getItem('saguk-studio.completed-run.v11')")
 page.locator('[data-action="map-fullscreen"]').click()
 assert page.evaluate('document.fullscreenElement?.id')=='app'
 expect(page.locator('.map-stage header,.map-stage footer,.map-stage-sidebar,.map-stage-nations,.map-stage-chronicle')).to_have_count(0)
 expect(page.locator('.map-judgment')).to_have_count(0)
 expect(page.locator('.map-unit-token')).to_have_count(29)
 assert page.evaluate("localStorage.getItem('saguk-studio.completed-run.v11')")==saved
 box=page.locator('.map-stage-atlas').bounding_box();assert box=={'x':0,'y':0,'width':1920,'height':1080}
 page.screenshot(path=str(OUT/'map-only-rest.png'))
 passed('전체화면은 지도만 표시 · 상시 패널/제목/차례/하단 국가 현황/조작부 제거 · 경기 상태 보존')
 page.keyboard.press('Space');seek(page,'king','rolling')
 expect(page.locator('.map-judgment .judgment-person strong')).to_have_text('강혁')
 expect(page.locator('.map-judgment .judgment-feature')).to_contain_text('호전형')
 expect(page.locator('.visual-die[data-die-locked="true"]')).to_have_count(0)
 assert fixture['record']['title'] not in page.locator('.map-stage').inner_text()
 page.clock.run_for(8000)
 expect(page.locator('.map-stage')).to_have_attribute('data-playing','false')
 expect(page.locator('.map-judgment')).to_have_count(0)
 page.keyboard.press('Space');page.clock.run_for(8000)
 page.keyboard.press('Space');seek(page,'territory')
 expect(page.locator('.map-judgment')).to_have_count(0)
 expect(page.locator('.campaign-route.attack')).to_have_count(1)
 expect(page.locator('.campaign-route.defense')).to_have_count(1)
 seek(page,'defense_roll','rolling')
 assert page.locator('.map-judgment').evaluate('(el)=>getComputedStyle(el).opacity')=='1'
 pause(page)
 battle=fixture['record']['battles'][0]
 expect(page.locator('.judgment-duel .judgment-person')).to_have_count(2)
 expect(page.locator('.judgment-vs')).to_have_text('VS')
 expect(page.locator('.judgment-side.attack .visual-die')).to_have_attribute('data-die-value',str(battle['attack']['score']))
 expect(page.locator('.judgment-side.defense .visual-die')).to_have_attribute('data-die-value','')
 assert page.evaluate('document.fullscreenElement?.id')=='app'
 assert page.locator('.map-judgment').evaluate('(el)=>getComputedStyle(el).opacity')=='1'
 page.screenshot(path=str(ROOT/'docs/central-battle-preview.png'))
 passed('중앙에만 인물·특성·주사위 표시 · 공격 확정 점수 유지하며 수비 주사위 진행 · 미래 결과 숨김')
 for width,height in [(1920,1080),(1366,768),(1280,720),(1024,768),(390,844),(844,390)]:
  page.set_viewport_size({'width':width,'height':height})
  assert not page.evaluate('document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight'),(width,height)
  popup=page.locator('.map-judgment').bounding_box()
  assert popup['x']>=0 and popup['y']>=0 and popup['x']+popup['width']<=width+1 and popup['y']+popup['height']<=height+1,(width,height,popup)
 page.set_viewport_size({'width':1920,'height':1080})
 passed('1920/1366/1280/1024px 및 390px 세로·가로 화면에서 지도와 중앙 창 표시')
 page.keyboard.press('Enter');seek(page,'resolve','holding');pause(page)
 expect(page.locator('.map-unit-feedback')).to_have_count(0)
 expect(page.locator('.map-judgment')).to_contain_text(f"공격 −{battle['losses']['attack']['amount']}만")
 for tile in battle['takenTerritoryIds']:
  expect(page.locator(f'[data-territory="{tile}"]')).to_have_attribute('title',fixture['before']['territories'][int(tile.split('-')[1])]['name']+' · 현해국')
 page.keyboard.press('Enter');seek(page,'resolve','departing')
 expect(page.locator('.map-judgment')).to_have_attribute('data-phase','departing')
 expect(page.locator('.map-unit-feedback')).to_have_count(0)
 seek(page,'resolve','holding')
 # We were departing; the next holding frame is map application of this same event.
 pause(page)
 expect(page.locator('.map-judgment')).to_have_count(0)
 army=page.locator('.map-unit-feedback[data-effect="army"]')
 expect(army).to_have_count(2)
 actual=army.evaluate_all('(els)=>els.map(e=>({country:e.dataset.country,slot:Number(e.dataset.slot),delta:Number(e.dataset.delta)}))')
 assert {'country':battle['actorId'],'slot':battle['slot'],'delta':-battle['losses']['attack']['amount']} in actual
 assert {'country':battle['defenderId'],'slot':battle['defenseSlot'],'delta':-battle['losses']['defense']['amount']} in actual
 expect(page.locator('.captured')).to_have_count(len(battle['takenCells']))
 expect(page.locator('.map-territory-feedback')).to_have_count(len(battle['takenCells']))
 page.screenshot(path=str(ROOT/'docs/map-changes-preview.png'))
 # Finish this manual effect group: labels and routes must also disappear while paused.
 page.keyboard.press('Space');page.clock.run_for(2100)
 expect(page.locator('.map-stage')).to_have_attribute('data-phase','settled')
 expect(page.locator('.map-unit-feedback,.map-territory-feedback,.map-event-announcement,.map-judgment,.map-campaign')).to_have_count(0)
 page.keyboard.press('s')
 assert page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.completed-run.v11')).engineState")==fixture['expected']
 expect(page.locator('.map-judgment')).to_have_count(0)
 page.keyboard.press('Escape');expect(page.locator('.sidebar')).to_be_visible()
 passed('결과 → 퇴장 → 실제 손실/점령 반영 순서 · 수동 정지에서도 문구 소멸 · 저장/RNG 동일')
 # Independent natural-seed fixtures exercise all three domestic effects and reserve transfers.
 for kind in ['recruit','recruitment','supply','resupply','production']:
  fixture=page.evaluate(FIXTURE,kind);page.reload(wait_until='networkidle')
  page.locator('[data-action="map-fullscreen"]').click();page.keyboard.press('Enter')
  target='round_end' if kind=='production' else 'resupply' if kind=='resupply' else 'resolve'
  seek(page,target,'holding');pause(page)
  expect(page.locator('.map-unit-feedback')).to_have_count(0)
  page.keyboard.press('Enter');seek(page,target,'departing');seek(page,target,'holding');pause(page)
  expect(page.locator('.map-judgment')).to_have_count(0)
  effects=page.locator('.map-unit-feedback').evaluate_all('(els)=>els.map(e=>({type:e.dataset.effect,country:e.dataset.country,role:e.dataset.role,delta:Number(e.dataset.delta),text:e.textContent}))')
  army=[e for e in effects if e['type']=='army']
  if kind=='recruit':assert sum(e['delta'] for e in army)==3 and all(e['delta']>0 for e in army)
  elif kind=='recruitment':assert not army and any(e['type']=='recruitment' and e['delta']==3 and '매 라운드 충원 +3만' in e['text'] for e in effects)
  elif kind=='supply':assert not army and any(e['type']=='supply' and e['delta']==5 for e in effects) and len([e for e in effects if e['type']=='capacity'])==5
  elif kind=='resupply':assert sum(e['delta'] for e in army)==0 and sum(e['delta'] for e in army if e['role']=='king')==-5 and sum(e['delta'] for e in army if e['role']=='general')==5
  else:
   net=sum(c['troops'] for c in fixture['frame']['after']['countries'])-sum(c['troops'] for c in fixture['frame']['before']['countries'])
   assert sum(e['delta'] for e in army)==net
  page.keyboard.press('s');assert page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.completed-run.v11')).engineState")==fixture['expected']
  page.keyboard.press('Escape')
 passed('실제 모병/라운드 생산 증가 · 수도 이동량 보존 · 충원력/지휘한도 구분 · 각 완료 상태 일치')
 colors_page=context.new_page();colors_page.on('pageerror',lambda e:errors.append(str(e)))
 colors_page.goto('http://127.0.0.1:3000',wait_until='networkidle')
 # Compare colours in real styled markup, including intermediate raw and corrected faces.
 colors=colors_page.evaluate('''async()=>{
 const {createDemoWorld}=await import('/src/data/demo-world.js');const {createRun,nextTurn}=await import('/src/engine/simulation.js');
 const {TurnPlayback}=await import('/src/ui/playback.js');const {renderArena}=await import('/src/ui/arena-view.js');
 const initial=createRun(createDemoWorld(),123456),run=nextTurn(initial,{rolls:{king:10,'attack:0':10,'attack:1':10,'attack:2':10,'attack:3':10,'attack:4':10},targetId:1}),snapshot=JSON.stringify(run.engineState),player=new TurnPlayback();player.load(run.history[0],initial.world,run.world,false);
 const host=document.createElement('div');host.style='position:fixed;inset:0;z-index:99999';document.body.append(host);const result=[];
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
 const frames=[];
 for(let i=0;i<7;i++){await new Promise(resolve=>setTimeout(resolve,90));const visible=[...host.querySelectorAll('.die-art-frame')].find(e=>Number(getComputedStyle(e).opacity)>.5);const text=visible.querySelector('text');frames.push({value:text.textContent,color:getComputedStyle(text).fill});}
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
 colors_page.close()
 # Native API failure still gives the same clean recording canvas.
 fallback=browser.new_context(viewport={'width':1366,'height':768})
 fallback.add_init_script("Element.prototype.requestFullscreen=function(){return Promise.reject(new Error('unsupported'));};")
 other=fallback.new_page();other.on('pageerror',lambda e:errors.append(str(e)));other.goto('http://127.0.0.1:3000',wait_until='networkidle')
 other.locator('[data-action="map-fullscreen"]').click();expect(other.locator('.map-judgment')).to_have_count(0)
 assert other.evaluate('document.fullscreenElement===null')
 other.keyboard.press('Enter');expect(other.locator('.map-judgment')).to_have_attribute('data-phase','locked',timeout=3000)
 other.keyboard.press('a');expect(other.locator('.map-stage')).to_have_attribute('data-playing','false')
 other.keyboard.press('s');other.keyboard.press('Escape');expect(other.locator('.sidebar')).to_be_visible()
 passed('전체화면 API 미지원 시 지도 화면 · Enter/A/S/Esc 조작 정상')
 assert not errors,errors
 print(f'{len(results)}개 중앙 판정/지도 변화 시나리오 통과 · JavaScript 예외 0건')
 fallback.close();context.close();browser.close()
