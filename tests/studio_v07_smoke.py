"""V0.7 source or standalone: old-record replay, editor anchors, terrain, keys and artwork."""
from pathlib import Path
import json,os,subprocess
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];subprocess.run(['node',str(ROOT/'tests/make-v07-fixture.mjs')],cwd=ROOT,check=True);fixture=json.loads((ROOT/'.artifacts/v07-browser-fixture.json').read_text());errors=[]
def stored(page):return page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.world.v1')).world")
def at(page,point):return page.locator('#geographic-editor .atlas-map').evaluate('(s,p)=>{const q=new DOMPoint(...p).matrixTransform(s.getScreenCTM());return [q.x,q.y]}',point)
def box(page):return page.locator('.atlas-map').get_attribute('viewBox')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);context=b.new_context(viewport={'width':1600,'height':1100},accept_downloads=True);page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
 page.add_init_script('if(!localStorage.getItem("saguk-studio.world.v1")){localStorage.setItem("saguk-studio.world.v1",'+json.dumps(json.dumps(fixture['world'],ensure_ascii=False))+');localStorage.setItem("saguk-studio.completed-run.v11",'+json.dumps(json.dumps(fixture['run'],ensure_ascii=False))+');}')
 page.goto(os.environ.get('STUDIO_TEST_URL','http://127.0.0.1:3000'),wait_until='networkidle')
 if os.environ.get('STUDIO_OFFLINE'):
  context.route('**/dist/**',lambda route:route.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist/사국쟁패 Studio.html')))
  context.set_offline(True)
 page.locator('nav [data-page="simulation"]').click();saved=page.evaluate("localStorage.getItem('saguk-studio.completed-run.v11')");expect(page.locator('.veteran-stars').first).to_be_visible();assert all(len(s)<=3 for s in page.locator('.veteran-stars').all_text_contents())
 assert page.locator('.unit-pin-tip').count()>0;assert page.locator('img[data-portrait-key^="king-"]').count()>0
 page.locator('[data-action="history-older"]').click();page.locator('.history-entry[data-id="1"]').click();expect(page.locator('.replay-banner')).to_contain_text('1 / 110턴');page.locator('[data-action="auto"]').click();page.locator('[data-action="scene-skip"]').click()
 for unit in fixture['expected']['1']['units']:
  marker=page.locator(f'.map-unit-position[data-person="{unit["id"]}"]');expect(marker).to_have_attribute('data-camp',unit['camp']);text=marker.locator('.token-copy strong').inner_text().replace(',','');assert str(unit['troops']) in text,(unit,text)
 owners=page.locator('.atlas-cell').evaluate_all('els=>els.map(e=>[e.dataset.territory,e.dataset.owner])');assert owners==fixture['expected']['1']['owners'];assert page.evaluate("localStorage.getItem('saguk-studio.completed-run.v11')")==saved
 page.locator('[data-action="return-live"]').click();assert page.locator('.replay-banner').count()==0;assert page.evaluate("localStorage.getItem('saguk-studio.completed-run.v11')")==saved
 # Watch a recorded real D30 battle, with the attack result held while defense rolls.
 page.locator('#sim-speed').select_option('4');page.locator('[data-action="map-zoom-in"]').click();page.locator('.history-entry[data-id="2"]').click();page.locator('[data-action="map-fullscreen"]').click()
 page.wait_for_function("""()=>{const s=document.querySelector('.map-stage');if(s?.dataset.event==='defense_roll'&&s.dataset.phase==='rolling'){document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'a',code:'KeyA',bubbles:true}));return true;}return false;}""",timeout=30000)
 page.wait_for_timeout(650);defender=page.locator('.judgment-person strong').last.inner_text();battle=next(b for b in fixture['run']['history'][1]['battles'] if b['defense']['name']==defender);dice=page.locator('.map-judgment .visual-die');assert dice.count()==2;expect(dice.nth(0)).to_have_attribute('data-die-value',str(battle['attack']['score']));expect(dice.nth(0)).to_have_attribute('data-die-sides','30');expect(dice.nth(1)).to_have_attribute('data-die-value','');assert dice.nth(1).locator('.die-art-frame').count()==7;assert page.locator('.map-judgment .combat-breakdown').count()==2
 point=fixture['run']['initialWorld']['cartography']['polygons'][battle['territoryId']]['center'];view=[float(n) for n in box(page).split()];assert abs(view[0]+view[2]/2-point[0])<.1 and abs(view[1]+view[3]/2-point[1])<.1,(view,point)
 old=box(page);page.keyboard.press('ArrowRight');moved=box(page);assert moved!=old;page.wait_for_timeout(650);assert box(page)==moved
 assert page.locator('.map-judgment .judgment-side-label').first.evaluate("e=>getComputedStyle(e).color")=='rgb(255, 255, 255)'
 if not os.environ.get('STUDIO_OFFLINE'):page.screenshot(path=str(ROOT/'docs/v07-map-preview.png'))
 page.keyboard.press('s');page.keyboard.press('Escape');page.locator('[data-action="return-live"]').click();assert page.evaluate("localStorage.getItem('saguk-studio.completed-run.v11')")==saved
 print('PASS: 실제 D30 공격/수비 첨부 주사위·선행 점수 보존·미래 눈금 숨김·사건 중앙 추적·수동 이동 유지·흰색 녹화 글자',flush=True)
 page.reload(wait_until='networkidle');page.locator('nav [data-page="simulation"]').click();page.locator('.history-entry[data-id="15"]').click();expect(page.locator('.replay-banner')).to_contain_text('15 / 110턴');page.locator('[data-action="auto"]').click();page.locator('[data-action="scene-skip"]').click();assert page.locator('.atlas-cell').evaluate_all('els=>els.map(e=>[e.dataset.territory,e.dataset.owner])')==fixture['expected']['15']['owners'];page.locator('[data-action="return-live"]').click()
 print('PASS: 별/새 초상화/마커·110턴의 오래된 기록 클릭·저장 후 재생·당시 영토/부대/임시주둔 일치·현재 경기 불변',flush=True)
 page.locator('#camera-follow').uncheck();page.locator('[data-action="map-zoom-in"]').click();page.locator('h1').click();old=box(page);page.keyboard.press('ArrowRight');assert box(page)!=old;old=box(page);page.keyboard.press('Shift+ArrowDown');assert box(page)!=old
 page.locator('[data-action="map-fullscreen"]').click();expect(page.locator('.map-stage')).to_be_visible();old=box(page);page.keyboard.press('ArrowLeft');assert box(page)!=old;assert page.locator('.map-stage .map-camera-controls').count()==0;page.keyboard.press('Escape')
 print('PASS: 방향키/Shift 이동·줌 보존·전체화면에서 이동·상시 조작판 없음',flush=True)
 page.locator('[data-action="history-older"]').click();page.locator('[data-action="replay-run"]').click();page.locator('[data-action="step"]').click();page.locator('[data-action="scene-skip"]').click();expect(page.locator('.history-entry[data-id="1"]')).to_be_visible()
 page.locator('nav [data-page="map"]').click();w=stored(page);id=w['territories'][0]['id'];shape=w['cartography']['polygons'][id];center=shape['center'];target=[round(center[0]+1,3),round(center[1]+1,3)]
 page.locator('[data-action="map-edit-battle"]').click();page.mouse.click(*at(page,target));w2=stored(page);actual=w2['cartography']['polygons'][id]['anchors']['battle'];assert max(abs(a-b) for a,b in zip(actual,target))<1.5;target=actual;assert w2['cartography']['polygons'][id]['center']==center
 page.locator('[data-action="map-edit-label"]').click();target2=[round(center[0]-.5,3),round(center[1]+.5,3)];page.mouse.click(*at(page,target2));assert max(abs(a-b) for a,b in zip(stored(page)['cartography']['polygons'][id]['anchors']['label'],target2))<1.5;assert stored(page)['cartography']['polygons'][id]['anchors']['battle']==target
 # Drag the explicitly chosen battlefield handle.
 page.locator('[data-action="map-edit-battle"]').click();start=at(page,target);end=at(page,[target[0]+1,target[1]+1]);page.mouse.move(*start);page.mouse.down();page.mouse.move(*end,steps=5);page.mouse.up();after=stored(page)['cartography']['polygons'][id]['anchors']['battle'];assert abs(after[0]-target[0]-1)<1.5 and abs(after[1]-target[1]-1)<1.5 and after!=target,after
 page.locator('[data-action="map-edit-undo"]').click();assert stored(page)['cartography']['polygons'][id]['anchors']['battle']==target
 page.locator('#territory-form [name="terrain"]').select_option('mountain');page.locator('#territory-form button[type="submit"]').click();assert stored(page)['territories'][0]['terrain']=='mountain';assert page.locator('.mountain-markers text').count()>0
 with page.expect_download() as download:page.locator('[data-action="export"]').click()
 path=ROOT/'.artifacts/v07-edited.world.json';download.value.save_as(str(path));before=stored(page);page.locator('#world-file').set_input_files(str(path));assert stored(page)==before
 print('PASS: 독립 전투/이름 위치 클릭·전투점 드래그·기하 중심 보존·되돌리기·산악 편집·파일 왕복',flush=True)
 page.locator('nav [data-page="people"]').click();page.locator('#person-role-filter').select_option('king');page.locator('[data-action="edit-person"]').first.click();assert page.locator('input[name="portraitKey"][value="king-010"]').count()==1;assert page.locator('input[name="portraitKey"][value="minister-010"]').count()==1;page.locator('input[name="portraitKey"][value="king-010"]').check();page.locator('#editor-dialog button[type="submit"]').click();assert any(person.get('portraitKey')=='king-010' for person in stored(page)['people'])
 page.locator('nav [data-page="rules"]').click();expect(page.locator('[name="battleMode"]')).to_have_value('additive30');page.locator('[name="mountainBonus"]').fill('9');page.locator('[data-action="add-army-band"]').click();assert page.locator('#army-bands tr').count()==8;page.locator('[data-action="remove-army-band"]').last.click();page.locator('#rules-form button[type="submit"]').click();assert stored(page)['rules']['mountainBonus']==9;assert stored(page)['rules']['armyBands'][-1]==[20,28]
 page.locator('[name="army-ratio-1"]').fill('1.1');page.locator('#rules-form button[type="submit"]').click();assert stored(page)['rules']['armyBands'][1][0]==1.5
 print('PASS: 왕/승상 20종 선택·규칙 보정/구간 추가삭제·잘못된 구간 저장 차단',flush=True)
 assert not errors,errors;b.close()
