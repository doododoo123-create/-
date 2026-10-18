"""Single HTML image analysis, actual file import, correction, save/reload and simulation offline."""
from pathlib import Path
import io,json
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);context=b.new_context(viewport={'width':1600,'height':1100});page=context.new_page();errors=[];failed=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda req:failed.append(req.url))
 page.goto('http://127.0.0.1:3000/dist/%EC%82%AC%EA%B5%AD%EC%9F%81%ED%8C%A8%20Studio.html',wait_until='networkidle');context.set_offline(True);page.locator('[data-action="save"]').click();original=page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.world.v1')).world")
 page.locator('nav [data-page="map"]').click();assert page.locator('.atlas-scroll').evaluate('el=>getComputedStyle(el,"::after").content')=='none';page.locator('[data-action="map-generate"]').click();page.locator('[data-generate="current"]').click();expect(page.locator('[data-generate="generate"]')).to_be_enabled();page.locator('#generator-count').fill('32');page.locator('[data-generate="generate"]').click();expect(page.locator('[data-generate="apply"]')).to_be_enabled();expect(page.locator('.generator-boundaries path')).to_have_count(32);page.locator('[data-generate="close"]').click();assert page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.world.v1')).world")==original
 page.locator('[data-action="map-generate"]').click();im=Image.new('RGB',(1200,800),(16,62,72));draw=ImageDraw.Draw(im);draw.rectangle((150,100,1050,700),fill=(150,165,80));draw.rectangle((450,240,570,380),fill=(16,62,72));buffer=io.BytesIO();im.save(buffer,format='PNG');page.locator('#generator-file').set_input_files({'name':'offline-coast.png','mimeType':'image/png','buffer':buffer.getvalue()});expect(page.locator('[data-generate="generate"]')).to_be_enabled();page.locator('#generator-count').fill('18');page.locator('[data-generate="generate"]').click();expect(page.locator('[data-generate="apply"]')).to_be_enabled();expect(page.locator('.generator-boundaries path')).to_have_count(18);page.locator('[data-generate="apply"]').click()
 w=page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.world.v1')).world");assert len(w['territories'])==18 and w['people']==original['people'];assert len(w['cartography']['links'])>10
 page.locator('[data-action="map-edit-paint"]').click()
 for country,start,end in [('nation-0',0,9),('nation-1',9,18)]:
  page.locator('#paint-owner').select_option(country)
  for i in range(start,end):page.locator('[data-territory="generated-'+str(i)+'"]').dispatch_event('click')
 page.locator('[data-action="map-edit-select"]').click();page.locator('[data-action="map-zoom-in"]').click();assert float(page.locator('.atlas-map').get_attribute('viewBox').split()[2])<1200
 page.locator('nav [data-page="simulation"]').click();page.locator('#camera-follow').uncheck();page.locator('[data-action="map-fullscreen"]').click();page.mouse.move(800,650);page.mouse.wheel(0,-160);view=page.locator('.atlas-map').get_attribute('viewBox')
 for _ in range(2):page.keyboard.press('Enter');page.keyboard.press('s')
 assert page.locator('.atlas-map').get_attribute('viewBox')==view;page.keyboard.press('0');assert page.locator('.atlas-map').get_attribute('viewBox')=='0 0 1200 800';page.keyboard.press('Escape')
 saved=page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.completed-run.v11'))");assert len(saved['engineState']['cells'])==18 and len(saved['history'])==2
 html=(ROOT/'dist/사국쟁패 Studio.html').read_text();context.route('**/dist/**',lambda route:route.fulfill(status=200,content_type='text/html',body=html));page.reload(wait_until='networkidle');page.locator('nav [data-page="simulation"]').click();expect(page.locator('.history-entry')).to_have_count(2)
 assert not errors,errors;assert not failed,failed
 print(json.dumps({'passed':'내장 HTML 오프라인: 현재 그림 32영토 미리보기/취소, PNG 18영토 생성/적용, 소유국 칠하기, 실제 2턴, 줌 유지/원위치, 저장 재개','javascriptErrors':errors,'failedRequests':failed},ensure_ascii=False));context.close();b.close()
