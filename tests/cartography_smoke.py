"""Map artwork, image import, boundary/anchor/link editing, undo and standalone persistence."""
from pathlib import Path
import json, os, io
from PIL import Image
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.artifacts'; OUT.mkdir(exist_ok=True)
errors=[]; results=[]
def passed(label):
 results.append(label); print('PASS:',label,flush=True)
def world(page):
 return page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.world.v1')).world")
def at(page,x,y):
 return page.locator('#geographic-editor .atlas-map').evaluate('(svg,p)=>{const q=new DOMPoint(...p).matrixTransform(svg.getScreenCTM());return {x:q.x,y:q.y}}',[x,y])
def click_at(page,x,y):
 point=at(page,x,y); page.mouse.click(point['x'],point['y'])
def trace(page,points):
 page.locator('[data-action="map-edit-trace"]').click()
 for x,y in points: click_at(page,x,y)
 page.locator('[data-action="map-edit-apply"]').click()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1600,'height':1100},accept_downloads=True)
 page=context.new_page(); page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
 page.goto(os.environ.get('STUDIO_TEST_URL','http://127.0.0.1:3000'),wait_until='networkidle')
 expect(page.locator('.illustrated-atlas')).to_have_count(1)
 assert page.locator('.terrain-art').get_attribute('href').startswith('data:image/jpeg;base64,')
 assert page.evaluate("async()=>{const i=new Image();i.src=document.querySelector('.terrain-art').getAttribute('href');await i.decode();return i.naturalWidth>1000}")
 page.locator('nav [data-page="map"]').click()
 expect(page.locator('#geographic-editor .atlas-cell')).to_have_count(80)
 expect(page.locator('#geographic-editor .map-unit-token')).to_have_count(0)
 passed('산맥·숲 삽화·국경 렌더링과 대륙 편집 화면 진입')
 page.locator('#territory-form [name="name"]').fill('새 지도 서원')
 page.locator('#territory-form button[type="submit"]').click()
 assert world(page)['territories'][0]['name']=='새 지도 서원'
 page.locator('[data-action="map-edit-paint"]').click()
 page.locator('#paint-owner').select_option('nation-1')
 page.locator('[data-territory="tile-1"]').click()
 assert world(page)['territories'][1]['ownerId']=='nation-1'
 page.locator('[data-action="map-edit-select"]').click()
 page.locator('[data-territory="tile-0"]').click()
 page.locator('[data-action="map-edit-reshape"]').click()
 vertex=page.locator('[data-vertex="5"]');x=float(vertex.get_attribute('cx'));y=float(vertex.get_attribute('cy'))
 start=at(page,x,y);end=at(page,x+2,y+1)
 page.mouse.move(start['x'],start['y']);page.mouse.down();page.mouse.move(end['x'],end['y'],steps=5);page.mouse.up()
 page.locator('[data-action="map-edit-apply"]').click()
 polygons=world(page)['cartography']['polygons']
 assert 'tile-0' in polygons and len(polygons)>1,polygons.keys()
 for shape in polygons.values(): assert any(abs(pt[0]-(x+2))<.01 and abs(pt[1]-(y+1))<.01 for pt in shape['points'])
 passed('이름·소유권 편집 및 공유 꼭짓점 이동으로 맞닿은 영토 경계 동시 수정')
 page.locator('[data-action="map-edit-undo"]').click()
 assert world(page).get('cartography',{}).get('polygons',{})=={}
 square=[[100,100],[220,100],[220,200],[100,200]]
 trace(page,square)
 actual=world(page)['cartography']['polygons']['tile-0']['points']; assert len(actual)==4 and all(abs(a-b)<1.5 for p,q in zip(actual,square) for a,b in zip(p,q)),actual
 assert page.locator('[data-territory="tile-0"] path').get_attribute('d').endswith(' Z')
 before=world(page)
 trace(page,[[100,100],[220,200],[100,200],[220,100]])
 expect(page.locator('#toast')).to_contain_text('교차')
 assert world(page)==before
 expect(page.locator('.map-vertex')).to_have_count(4)
 page.locator('[data-action="map-edit-cancel"]').click()
 page.locator('[data-action="map-edit-center"]').click();click_at(page,150,150)
 assert all(abs(n-150)<1.5 for n in world(page)['cartography']['polygons']['tile-0']['center'])
 passed('자유형 경계 그리기·잘못된 경계 보호·이름/부대 기준 위치 이동·되돌리기')
 page.locator('[data-action="map-edit-links"]').click()
 page.locator('[data-territory="tile-79"]').click()
 assert ['tile-0','tile-79'] in world(page)['cartography']['links']
 expect(page.locator('[data-territory="tile-79"]')).to_have_class('atlas-cell linked-territory')
 page.locator('[data-territory="tile-79"]').click()
 assert ['tile-0','tile-79'] not in world(page)['cartography']['links']
 page.locator('[data-action="map-edit-reset-links"]').click()
 assert world(page)['cartography']['links'] is None
 passed('양방향 인접 관계 추가·해제·원본 연결 복원')
 page.locator('[data-action="map-edit-select"]').click()
 page.locator('#map-art-style').select_option('classic');expect(page.locator('.classic-atlas')).to_have_count(1)
 page.locator('#map-art-style').select_option('illustrated')
 page.locator('#map-color-opacity').fill('43');page.locator('#map-color-opacity').dispatch_event('change')
 assert world(page)['cartography']['opacity']==.43
 image=Image.new('RGB',(1600,900),(61,112,97));buffer=io.BytesIO();image.save(buffer,format='PNG')
 page.locator('#map-background-file').set_input_files({'name':'my-map.png','mimeType':'image/png','buffer':buffer.getvalue()})
 expect(page.locator('.map-background-image')).to_have_count(1)
 assert world(page)['cartography']['background'].startswith('data:image/jpeg;base64,')
 page.locator('#map-background-file').set_input_files({'name':'unsafe.svg','mimeType':'image/svg+xml','buffer':b'<svg onload="alert(1)"></svg>'})
 expect(page.locator('#toast')).to_contain_text('PNG')
 expect(page.locator('.map-background-image')).to_have_count(1)
 saved=world(page)
 with page.expect_download() as download:page.locator('[data-action="export"]').click()
 exported=OUT/'cartography.world.json';download.value.save_as(str(exported))
 assert json.loads(exported.read_text())['world']==saved
 page.reload(wait_until='networkidle');page.locator('nav [data-page="map"]').click()
 expect(page.locator('.map-background-image')).to_have_count(1)
 assert world(page)==saved
 page.locator('#world-file').set_input_files(str(exported))
 expect(page.locator('h1')).to_have_text('세계 개요')
 expect(page.locator('.map-background-image')).to_have_count(1)
 page.locator('nav [data-page="map"]').click()
 assert world(page)==saved
 page.locator('[data-action="map-edit-remove-background"]').click()
 expect(page.locator('.terrain-art')).to_have_count(1)
 passed('내 지도 이미지 압축·저장·안전한 형식 제한·색 진하기·파일 내보내기·새로고침 복구')
 page.locator('#map-editor-zoom').select_option('2')
 assert page.locator('.atlas-map').bounding_box()['width']>page.locator('.cartography-viewport').bounding_box()['width']*1.9
 page.locator('#map-editor-zoom').select_option('1')
 page.screenshot(path=str(OUT/'cartography-editor.png'),full_page=True)
 for width in [1024,390]:
  page.set_viewport_size({'width':width,'height':900})
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  assert page.locator('.cartography-viewport').evaluate('el=>el.scrollWidth>el.clientWidth') or width>900
 page.set_viewport_size({'width':1600,'height':1100})
 page.locator('#map-editor-view').select_option('grid');expect(page.locator('.territory-grid')).to_have_count(1)
 page.locator('#map-editor-view').select_option('atlas')
 passed('확대·스크롤·모바일 화면·기존 격자 편집 보존')
 page.locator('[data-action="map-edit-reset-shape"]').click()
 page.locator('nav [data-page="countries"]').click()
 page.locator('[data-action="add-country"]').first.click()
 page.locator('#editor-dialog [name="name"]').fill('지도 편집 후 추가한 나라')
 page.locator('#editor-dialog button[type="submit"]').click()
 page.locator('nav [data-page="map"]').click()
 expect(page.locator('[data-action="map-edit-undo"]')).to_be_disabled()
 assert world(page)['countries'][-1]['name']=='지도 편집 후 추가한 나라'
 passed('다른 국가·인물 편집 후 지도 되돌리기가 새 정보를 삭제하지 않도록 기록 분리')
 page.locator('nav [data-page="simulation"]').click()
 page.locator('[data-action="step"]').click();page.locator('[data-action="scene-skip"]').click()
 page.locator('[data-action="map-fullscreen"]').click()
 expect(page.locator('.map-stage .illustrated-atlas')).to_have_count(1)
 expect(page.locator('.map-stage header,.map-stage footer,.cartography-controls')).to_have_count(0)
 page.screenshot(path=str(OUT/'cartography-fullscreen.png'))
 page.keyboard.press('Escape')
 passed('새 지도 시뮬레이션·판정·지도 단독 전체화면 정상 실행')
 assert not errors,errors
 print(json.dumps({'passed':len(results),'javascriptErrors':errors},ensure_ascii=False))
 context.close();browser.close()
