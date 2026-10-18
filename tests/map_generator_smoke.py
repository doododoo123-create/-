"""Image-to-province wizard, mask brushes, transactional apply and camera interactions."""
from pathlib import Path
import os,io,json
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
errors=[]
def world(page):return page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.world.v1')).world")
def canvas_at(page,x,y):
 box=page.locator('#generator-canvas').bounding_box();return [box['x']+x/1200*box['width'],box['y']+y/800*box['height']]
def map_at(page,x,y):return page.locator('.atlas-map').evaluate('(el,p)=>{const q=new DOMPoint(...p).matrixTransform(el.getScreenCTM());return [q.x,q.y]}',[x,y])
def box(page):return [float(n) for n in page.locator('.atlas-map').get_attribute('viewBox').split()]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);context=b.new_context(viewport={'width':1600,'height':1100},accept_downloads=True);page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
 page.goto(os.environ.get('STUDIO_TEST_URL','http://127.0.0.1:3000'),wait_until='networkidle');page.locator('[data-action="save"]').click();original=world(page)
 assert page.locator('.atlas-scroll').evaluate('el=>["none","normal"].includes(getComputedStyle(el,"::after").content)')
 page.locator('nav [data-page="map"]').click();page.locator('[data-action="map-generate"]').click();page.locator('[data-generate="current"]').click();expect(page.locator('[data-generate="generate"]')).to_be_enabled();page.locator('[data-generate="generate"]').click();expect(page.locator('[data-generate="apply"]')).to_be_enabled(timeout=20000);expect(page.locator('.generator-boundaries path')).to_have_count(80)
 assert world(page)==original
 page.screenshot(path=str(ROOT/'docs/automatic-map-preview.png'));page.locator('[data-generate="close"]').click();assert world(page)==original
 print('PASS: 프레임 덮개 제거·현재 지도 80영토 자동 제작·미리보기 취소 시 기존 세계 보존',flush=True)
 page.locator('[data-action="map-generate"]').click()
 image=Image.new('RGB',(1200,800),(16,62,72));draw=ImageDraw.Draw(image);draw.rectangle((180,100,1000,560),fill=(140,160,75));draw.rectangle((420,200,570,340),fill=(16,62,72));draw.rectangle((100,650,240,740),fill=(140,160,75));buffer=io.BytesIO();image.save(buffer,format='PNG')
 page.locator('#generator-file').set_input_files({'name':'coast-and-lake.png','mimeType':'image/png','buffer':buffer.getvalue()});expect(page.locator('[data-generate="generate"]')).to_be_enabled()
 page.locator('#generator-islands').select_option('0');status=page.locator('#generator-status').inner_text();assert '2개 덩어리' in status,status
 page.locator('#generator-count').fill('1');page.locator('[data-generate="generate"]').click();expect(page.locator('#generator-status')).to_contain_text('떨어져');expect(page.locator('[data-generate="apply"]')).to_be_disabled();assert world(page)==original
 page.locator('#generator-islands').select_option('-1');page.locator('[data-generate="generate"]').click();expect(page.locator('[data-generate="apply"]')).to_be_enabled();expect(page.locator('.generator-boundaries path')).to_have_count(1);assert page.locator('.generator-boundaries path').get_attribute('d').count('M')>=2
 page.locator('#generator-islands').select_option('0');page.locator('[data-generate="land"]').click();page.mouse.click(*canvas_at(page,920,700));expect(page.locator('#generator-status')).to_contain_text('3개 덩어리');page.locator('[data-generate="undo"]').click();expect(page.locator('#generator-status')).to_contain_text('2개 덩어리')
 page.locator('[data-generate="pick"]').click();page.mouse.click(*canvas_at(page,30,30));expect(page.locator('#generator-status')).to_contain_text('2개 덩어리')
 page.locator('#generator-count').fill('14');page.locator('[data-generate="generate"]').click();expect(page.locator('[data-generate="apply"]')).to_be_enabled();expect(page.locator('.generator-boundaries path')).to_have_count(14)
 page.locator('[data-generate="sea"]').click();page.mouse.click(*canvas_at(page,300,300));expect(page.locator('[data-generate="apply"]')).to_be_disabled();page.locator('[data-generate="undo"]').click();page.locator('[data-generate="generate"]').click();expect(page.locator('[data-generate="apply"]')).to_be_enabled()
 page.locator('[data-generate="apply"]').click();generated=world(page);assert len(generated['territories'])==14 and generated['mapKind']=='free';assert generated['people']==original['people'] and generated['rules']==original['rules'];assert all(t['ownerId'] is None for t in generated['territories']);assert generated['cartography']['background'].startswith('data:image/webp;base64,');assert page.evaluate('async w=>{const {pointInShape}=await import("/src/model/cartography.js");return !Object.values(w.cartography.polygons).some(s=>pointInShape([480,270],s));}',generated)
 with page.expect_download() as d:page.locator('[data-action="export"]').click()
 out=ROOT/'.artifacts/generated-map.world.json';d.value.save_as(str(out));assert json.loads(out.read_text())['world']==generated
 page.locator('[data-action="map-edit-undo"]').click();assert world(page)==original
 page.locator('#world-file').set_input_files(str(out));expect(page.locator('h1')).to_have_text('세계 개요');assert world(page)==generated;page.reload(wait_until='networkidle');page.locator('nav [data-page="map"]').click();assert world(page)==generated
 print('PASS: 사용자 PNG·육지/바다/색 보정·붓 되돌리기·섬 옵션·정확한 14영토·호수 제외·적용/되돌리기·파일/저장 복원',flush=True)
 before=world(page);page.locator('[data-action="map-zoom-in"]').click();assert box(page)[2]<1200
 page.locator('[data-action="map-zoom-out"]').click();assert abs(box(page)[2]-1200)<1
 page.locator('#map-editor-zoom').select_option('2');assert abs(box(page)[2]-600)<1
 old_box=box(page);svg=page.locator('.atlas-map').bounding_box();x=svg['x']+svg['width']*.5;y=min(980,svg['y']+svg['height']*.4);page.mouse.move(x,y);page.mouse.down(button='right');page.mouse.move(x+60,y+30,steps=5);page.mouse.up(button='right');assert box(page)!=old_box;assert world(page)==before
 page.locator('[data-action="map-pan-toggle"]').click();old_box=box(page);page.mouse.move(x,y);page.mouse.down();page.mouse.move(x-70,y-20,steps=5);page.mouse.up();assert box(page)!=old_box;assert world(page)==before;page.locator('[data-action="map-pan-toggle"]').click();page.locator('[data-action="map-zoom-reset"]').click();assert box(page)==[0,0,1200,800]
 page.mouse.move(x,y);page.mouse.wheel(0,-200);assert box(page)[2]<1200;assert world(page)==before
 page.locator('[data-action="map-zoom-reset"]').click();page.screenshot(path=str(ROOT/'docs/unframed-map-preview.png'))
 # Restore a playable world for observing zoom across simulation rerenders.
 page.evaluate('(w)=>{localStorage.setItem("saguk-studio.world.v1",JSON.stringify({kind:"saguk-studio-world",version:2,world:w}));localStorage.removeItem("saguk-studio.completed-run.v11");}',original);page.reload(wait_until='networkidle');page.locator('nav [data-page="simulation"]').click();page.locator('#camera-follow').uncheck();page.clock.install(time=0);page.clock.pause_at(1000)
 page.locator('[data-action="map-fullscreen"]').click();page.keyboard.press('Enter');page.mouse.move(800,650);page.mouse.wheel(0,-160);zoomed=box(page);assert zoomed[2]<1200;page.clock.run_for(2500);assert box(page)==zoomed
 expect(page.locator('.map-stage .map-camera-controls,.map-stage header,.map-stage footer')).to_have_count(0);page.keyboard.press('0');assert box(page)==[0,0,1200,800];page.keyboard.press('+');assert box(page)[2]<1200;page.keyboard.press('s');page.keyboard.press('Escape')
 print('PASS: 버튼/휠 확대·축소·원위치·우클릭/이동모드 드래그·세계 데이터 보존·전체화면 연출 중 배율 유지·고정 패널 없음',flush=True)
 page.locator('nav [data-page="map"]').click();page.locator('[data-action="map-generate"]').click();page.set_viewport_size({'width':390,'height':844});assert page.locator('#map-generator').evaluate('el=>el.scrollWidth<=el.clientWidth+1');page.locator('[data-generate="current"]').click();expect(page.locator('[data-generate="generate"]')).to_be_enabled();page.locator('#generator-count').fill('40');page.locator('[data-generate="generate"]').click();page.clock.run_for(100);expect(page.locator('[data-generate="apply"]')).to_be_enabled();expect(page.locator('.generator-boundaries path')).to_have_count(40);page.locator('[data-generate="close"]').click()
 assert not errors,errors
 print(json.dumps({'passed':4,'javascriptErrors':errors},ensure_ascii=False));context.close();b.close()
