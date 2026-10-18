"""Actual pixels on both sides of borders, 4K bitmap persistence, and sea-rule UI."""
import io,os
from pathlib import Path
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1600,'height':1100},accept_downloads=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(os.environ.get('STUDIO_TEST_URL','http://127.0.0.1:3000'),wait_until='networkidle')
 assert page.locator('.map-background-image').evaluate('async el=>{const i=new Image();i.src=el.getAttribute("href");await i.decode();return i.naturalWidth===1536&&i.naturalHeight===1024}')
 page.locator('nav [data-page="rules"]').click();expect(page.locator('[name="seaSupply"]')).to_be_checked();page.locator('[name="seaSupply"]').uncheck();page.locator('#rules-form button[type="submit"]').click();assert not page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.world.v1')).world.rules.seaSupply")
 page.reload(wait_until='networkidle');page.locator('nav [data-page="rules"]').click();expect(page.locator('[name="seaSupply"]')).not_to_be_checked();page.locator('[name="seaSupply"]').check();page.locator('#rules-form button[type="submit"]').click()
 print('PASS: 기본 지도 원본 1536×1024·해상 보급 설정 저장/재실행',flush=True)
 page.locator('nav [data-page="map"]').click();im=Image.new('RGB',(3840,2560),(16,62,72));d=ImageDraw.Draw(im);d.rectangle((480,320,3360,2240),fill=(150,165,80));d.rectangle((1440,800,1800,1200),fill=(16,62,72));d.line((600,600,3000,1600),fill=(230,220,180),width=2);buf=io.BytesIO();im.save(buf,format='PNG')
 page.locator('#map-background-file').set_input_files({'name':'4k-map.png','mimeType':'image/png','buffer':buf.getvalue()});page.wait_for_function("JSON.parse(localStorage.getItem('saguk-studio.world.v1')).world.cartography.background!==null")
 source=page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.world.v1')).world.cartography.background")
 assert page.locator('.map-background-image').evaluate('async el=>{const i=new Image();i.src=el.getAttribute("href");await i.decode();return i.naturalWidth===3840&&i.naturalHeight===2560}')
 page.reload(wait_until='networkidle');page.locator('nav [data-page="map"]').click();assert page.locator('.map-background-image').get_attribute('href')==source
 page.locator('[data-action="map-generate"]').click();page.locator('[data-generate="current"]').click();expect(page.locator('[data-generate="generate"]')).to_be_enabled();page.locator('#generator-count').fill('12');page.locator('[data-generate="generate"]').click();expect(page.locator('[data-generate="apply"]')).to_be_enabled();page.locator('[data-generate="apply"]').click();assert page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.world.v1')).world.cartography.background")==source
 with page.expect_download() as down:page.locator('[data-action="export"]').click()
 saved=ROOT/'.artifacts/4k-map.world.json';down.value.save_as(str(saved));page.locator('#world-file').set_input_files(str(saved));assert page.locator('.map-background-image').get_attribute('href')==source
 print('PASS: 4K 지도 불러오기·새로고침·자동 영토 제작·세계 파일 저장/불러오기에서 해상도 보존',flush=True)
 # Render the production SVG in isolation, then sample actual colored border pixels.
 page.evaluate('''async()=>{const {renderAtlas}=await import('/src/ui/atlas-view.js');const {generatedWorld}=await import('/src/model/free-map.js');const {createDemoWorld}=await import('/src/data/demo-world.js');const shape=(x)=>({points:[[x,100],[x+500,100],[x+500,700],[x,700]],center:[x+250,400]});const w=generatedWorld(createDemoWorld(),[shape(100),shape(600)],[[0,1]],null);w.countries[0].color='#ff0000';w.countries[1].color='#0000ff';w.territories[0].ownerId='nation-0';w.territories[1].ownerId='nation-1';w.cartography.style='classic';const host=document.createElement('div');host.id='border-check';host.style='position:fixed;inset:0;z-index:99999;background:white';document.body.append(host);window.borderTestWorld=w;window.drawBorderTest=(reverse,zoom)=>{const n=structuredClone(w);if(reverse)n.territories.reverse();host.innerHTML=renderAtlas(n,{showNames:false,showUnits:false});const svg=host.querySelector('svg');svg.style='width:1200px;height:800px;max-width:none;display:block';svg.setAttribute('viewBox',zoom?'450 300 300 200':'0 0 1200 800');};window.drawBorderTest(false,false);}''')
 for reverse in [False,True]:
  for zoom in [False,True]:
   page.evaluate('([r,z])=>window.drawBorderTest(r,z)',[reverse,zoom]);page.wait_for_timeout(100)
   coords=page.locator('#border-check svg').evaluate('(svg)=>[598,601].map(x=>{const p=new DOMPoint(x,400).matrixTransform(svg.getScreenCTM());return [Math.round(p.x),Math.round(p.y)]})')
   shot=Image.open(io.BytesIO(page.screenshot()));left,right=[shot.getpixel(tuple(c))[:3] for c in coords];assert left[0]>240 and left[1]<20 and left[2]<20,(reverse,zoom,left);assert right[2]>240 and right[0]<20 and right[1]<20,(reverse,zoom,right)
 page.screenshot(path=str(ROOT/'.artifacts/double-border-pixels.png'));assert not errors,errors
 print('PASS: 양국 경계 안쪽 빨강/파랑 실제 픽셀 확인·그리는 순서 역전·4배 확대에서도 양쪽 표시',flush=True);b.close()
