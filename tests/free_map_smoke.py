"""Free province editor, persistence and friendly forward-camp/return presentation."""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
errors=[]
def world(page):return page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.world.v1')).world")
def click_at(page,x,y):
 q=page.locator('#geographic-editor .atlas-map').evaluate('(el,p)=>{const q=new DOMPoint(...p).matrixTransform(el.getScreenCTM());return {x:q.x,y:q.y}}',[x,y]);page.mouse.click(q['x'],q['y'])
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 context=b.new_context(viewport={'width':1600,'height':1100},accept_downloads=True);page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
 page.goto(os.environ.get('STUDIO_TEST_URL','http://127.0.0.1:3000'),wait_until='networkidle')
 expect(page.locator('.map-background-image')).to_have_count(1)
 assert page.locator('.map-background-image').evaluate('async el=>{const i=new Image();i.src=el.getAttribute("href");await i.decode();return i.naturalWidth===1200}')
 page.locator('[data-action="map-fullscreen"]').click();expect(page.locator('.map-stage header,.map-stage footer,.visual-nations')).to_have_count(0)
 page.screenshot(path=str(ROOT/'docs/free-coast-preview.png'));Image.open(ROOT/'docs/free-coast-preview.png').resize((1200,825)).save('/tmp/free-coast-review.jpg')
 page.keyboard.press('Escape');page.locator('nav [data-page="map"]').click()
 expect(page.locator('.atlas-cell')).to_have_count(80)
 page.locator('[data-action="map-edit-create"]').click()
 for point in [(35,45),(100,45),(65,85)]:click_at(page,*point)
 page.locator('[data-action="map-edit-apply"]').click();expect(page.locator('.atlas-cell')).to_have_count(81)
 w=world(page);new=w['territories'][-1];assert w['mapKind']=='free' and 'row' not in new
 page.locator('#territory-form [name="name"]').fill('남해의 섬');page.locator('#territory-form [name="ownerId"]').select_option('nation-0');page.locator('#territory-form button[type="submit"]').click()
 page.locator('[data-action="map-edit-move"]').click();click_at(page,140,50)
 moved=world(page);assert abs(moved['cartography']['polygons'][new['id']]['center'][0]-140)<2
 page.locator('[data-action="map-edit-links"]').click();page.locator('[data-territory="tile-0"]').click();assert any(set(pair)=={new['id'],'tile-0'} for pair in world(page)['cartography']['links'])
 page.locator('[data-action="map-edit-select"]').click()
 with page.expect_download() as d:page.locator('[data-action="export"]').click()
 out=ROOT/'.artifacts/free-map.world.json';out.parent.mkdir(exist_ok=True);d.value.save_as(str(out));saved=world(page);assert json.loads(out.read_text())['world']==saved
 page.reload(wait_until='networkidle');page.locator('nav [data-page="map"]').click();assert world(page)==saved
 page.locator('[data-territory="'+new['id']+'"]').click();page.locator('[data-action="map-edit-delete"]').click();expect(page.locator('.atlas-cell')).to_have_count(80)
 assert all(new['id'] not in pair for pair in world(page)['cartography']['links'])
 page.locator('[data-action="map-edit-undo"]').click();expect(page.locator('.atlas-cell')).to_have_count(81)
 page.locator('#world-file').set_input_files(str(out));assert world(page)==saved
 print('PASS: 자유 영토 추가·이름/소유권·통째로 이동·인접 연결·삭제/되돌리기·내보내기/불러오기',flush=True)
 # Install a completed run immediately before a turn that recalls a forward camp.
 fixture=page.evaluate('''async()=>{
 const {createReferenceWorld}=await import('/src/data/reference-world.js');const {createRun,nextTurn}=await import('/src/engine/simulation.js');const {saveRun}=await import('/src/storage/run-store.js');
 const w=createReferenceWorld();let r=createRun(w,123456);
 for(let i=0;i<100&&!r.result;i++){const after=nextTurn(r),record=after.history.at(-1);if(record.movements.some(b=>b.moves.some(m=>m.kind==='return'))){localStorage.setItem('saguk-studio.world.v1',JSON.stringify({kind:'saguk-studio-world',version:2,world:w}));saveRun(localStorage,r);return {expected:after.engineState,camps:after.world.visualCamps,moves:record.movements};}r=after;}throw Error('No return fixture');}''')
 page.reload(wait_until='networkidle');page.clock.install(time=0);page.clock.pause_at(1000);page.locator('[data-action="map-fullscreen"]').click();page.keyboard.press('Enter')
 saw_return=False;saw_outbound=False
 for _ in range(2400):
  labels=page.locator('.unit-marching .march-label').all_text_contents()
  if labels:
   assert page.locator('.map-judgment').count()==0
   saw_return|=any('복귀' in text for text in labels);saw_outbound|=any('출정' in text for text in labels)
   assert page.locator('.march-routes path').count()>0
   motion_css=page.locator('.unit-marching').first.evaluate('el=>({path:getComputedStyle(el).offsetPath,style:el.getAttribute("style"),person:el.parentElement.getAttribute("data-person")})');assert motion_css['path'].startswith('path('),motion_css
   travel=page.locator('.unit-marching').first.evaluate('''el=>{getComputedStyle(el).animationName;const a=el.getAnimations()[0];if(!a)throw Error('Missing movement animation: '+el.getAttribute('style')+' / '+getComputedStyle(el).animationName);a.pause();a.currentTime=0;const first=el.querySelector('foreignObject').getBoundingClientRect();a.currentTime=a.effect.getTiming().duration;const last=el.querySelector('foreignObject').getBoundingClientRect(),q=new DOMPoint(0,0).matrixTransform(el.parentElement.getScreenCTM());return {distance:Math.hypot(first.x-last.x,first.y-last.y),dx:last.x+last.width/2-q.x,dy:last.y+last.height/2-q.y};}''')
   assert travel['distance']>8,travel
   assert abs(travel['dx'])<3 and abs(travel['dy'])<8,travel
   if saw_return:
    page.screenshot(path=str(ROOT/'docs/commander-return-preview.png'))
    break
  page.clock.run_for(40)
 assert saw_return,'return scene never appeared'
 page.keyboard.press('s');page.keyboard.press('Escape')
 state=page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.completed-run.v11'))")
 assert state['engineState']==fixture['expected'];assert state['history'][-1]['campsAfter']==fixture['camps']
 page.reload(wait_until='networkidle');page.locator('[data-action="map-fullscreen"]').click()
 for person,camp in fixture['camps'].items():expect(page.locator('[data-person="'+person+'"]').first).to_have_attribute('data-camp',camp['territoryId'])
 page.keyboard.press('Escape')
 for width,height in [(390,844),(1366,768)]:
  page.set_viewport_size({'width':width,'height':height});page.locator('nav [data-page="map"]').click();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 print('PASS: 출정·담당 영역 방어 복귀 장면·친선 경로·중앙 판정 숨김·결과/RNG 동일·저장 후 주둔 위치 복원·모바일',flush=True)
 page.locator('nav [data-page="overview"]').click();page.locator('[data-action="new-world"]').click();page.locator('#editor-dialog [name="mapTemplate"]').select_option('free')
 expect(page.locator('#grid-dimensions')).to_be_hidden();page.locator('#editor-dialog [name="name"]').fill('빈 자유 세계');page.locator('#editor-dialog button[type="submit"]').click()
 assert world(page)['mapKind']=='free' and len(world(page)['territories'])==1
 page.locator('nav [data-page="map"]').click();page.locator('[data-action="map-edit-delete"]').click();expect(page.locator('#toast')).to_contain_text('최소 1개')
 page.locator('nav [data-page="overview"]').click();page.locator('[data-action="new-world"]').click();page.locator('#editor-dialog [name="mapTemplate"]').select_option('original');page.locator('#editor-dialog [name="name"]').fill('원본 복원');page.locator('#editor-dialog button[type="submit"]').click()
 assert world(page)['mapKind']=='v11';people=world(page)['people']
 page.locator('nav [data-page="map"]').click();page.locator('[data-action="map-edit-reference"]').click();assert world(page)['mapKind']=='free' and world(page)['people']==people
 page.locator('[data-action="map-edit-undo"]').click();assert world(page)['mapKind']=='v11'
 print('PASS: 빈 자유 지도·원본 예제 선택·격자 입력 구분·마지막 영토 보호·기존 세계 참고 대륙 적용/되돌리기',flush=True)
 assert not errors,errors
 print(json.dumps({'passed':3,'javascriptErrors':errors},ensure_ascii=False));context.close();b.close()
