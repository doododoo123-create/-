"""Actual UI kit artwork, button interaction, readable frames and offline packaging."""
from pathlib import Path
import os,json
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];errors=[];failed=[];results=[]
def passed(label):
 results.append(label);print('PASS:',label,flush=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1600,'height':1100},accept_downloads=True)
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('requestfailed',lambda r:failed.append(r.url));page.on('dialog',lambda d:d.accept())
 url=os.environ.get('STUDIO_TEST_URL','http://127.0.0.1:3000')
 page.goto(url,wait_until='networkidle')
 offline=os.environ.get('STUDIO_OFFLINE')=='1'
 if offline:context.set_offline(True)
 assets=page.evaluate('''async()=>{
 const style=getComputedStyle(document.documentElement),names=[...document.styleSheets].flatMap(sheet=>{try{return [...sheet.cssRules].filter(rule=>rule.selectorText===':root').flatMap(rule=>[...rule.style].filter(name=>name.startsWith('--ui-')))}catch{return []}});
 const out=[];for(const name of new Set(names)){
  const text=style.getPropertyValue(name).trim(),path=text.match(/^url\\(["']?(.*?)["']?\\)$/)?.[1];
  if(!path)throw Error('Missing '+name);
  const image=new Image();image.src=path.startsWith('data:')?path:new URL(path,new URL('/src/ui/lacquer-bronze.css',location.origin)).href;
  await image.decode();if(!image.naturalWidth)throw Error(name);out.push({name,embedded:path.startsWith('data:')});
 }return out;
 }''')
 assert len(assets)==29,len(assets)
 if offline:assert all(a['embedded'] for a in assets)
 expect(page.locator('.kit-icon[data-ui-icon="world"]')).not_to_have_count(0)
 page.screenshot(path=str(ROOT/('.artifacts/bronze-offline-overview.png' if offline else 'docs/bronze-ui-preview.png')),full_page=True)
 passed('제공된 UI 장식·버튼·아이콘 29개 실제 디코딩'+(' · 모든 이미지 내장·오프라인' if offline else ''))
 save=page.locator('[data-action="save"]').first
 page.mouse.move(0,0);normal=save.evaluate('(el)=>getComputedStyle(el).borderImageSource')
 save.hover();hover=save.evaluate('(el)=>getComputedStyle(el).borderImageSource')
 assert normal!='none' and normal!=hover
 page.mouse.down();pressed=save.evaluate('(el)=>getComputedStyle(el).borderImageSource');assert pressed!=hover
 page.mouse.up();expect(page.locator('#toast')).to_contain_text('저장했습니다')
 page.keyboard.press('Tab');assert page.evaluate('document.activeElement.tagName') in ['BUTTON','A','INPUT','SELECT']
 assert page.evaluate('getComputedStyle(document.activeElement).outlineStyle')!='none'
 passed('버튼 기본·호버·눌림 이미지 전환·실제 저장 클릭·키보드 초점')
 page.locator('nav [data-page="people"]').click()
 expect(page.locator('.photo-avatar img')).to_have_count(49)
 assert page.locator('.photo-avatar').first.evaluate('(el)=>Math.abs(el.clientWidth/el.clientHeight-2/3)<.02')
 assert page.locator('.photo-avatar img').evaluate_all('(imgs)=>imgs.every(i=>i.complete&&i.naturalWidth>0)')
 for width in [1920,1366,1024,760,390]:
  page.set_viewport_size({'width':width,'height':1000})
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
 page.set_viewport_size({'width':1600,'height':1100})
 passed('청동 인물 프레임·실제 초상화·390~1920px에서 가로 넘침 없음')
 page.locator('nav [data-page="simulation"]').click()
 expect(page.locator('.framed-portrait img')).to_have_count(1)
 replay=page.locator('[data-action="replay-run"]');expect(replay).to_be_disabled()
 assert replay.evaluate('(el)=>getComputedStyle(el).borderImageSource')!='none'
 assert page.locator('.visual-die').get_attribute('data-die-value')==''
 assert page.locator('.visual-die').evaluate('(el)=>getComputedStyle(el).backgroundImage')!='none'
 assert page.locator('.history-empty h3').evaluate('(el)=>getComputedStyle(el).color')=='rgb(68, 55, 32)'
 if not offline:page.screenshot(path=str(ROOT/'docs/bronze-simulation-preview.png'),full_page=True)
 passed('동적 숫자를 가진 육각 주사위·비활성 버튼·종이 바탕 기록 가독성')
 page.locator('[data-action="map-fullscreen"]').click()
 expect(page.locator('.map-judgment')).to_have_count(0)
 expect(page.locator('.map-stage header,.map-stage footer,.map-stage-sidebar')).to_have_count(0)
 assert page.locator('.map-stage .atlas-scroll').evaluate('(el)=>["none","normal"].includes(getComputedStyle(el,"::after").content)')
 page.keyboard.press('Escape');expect(page.locator('h1')).to_have_text('시뮬레이션')
 passed('녹화용 전체화면에는 장식 프레임·고정 패널 없이 지도만 유지')
 assert not errors,errors;assert not failed,failed
 print(json.dumps({'passed':len(results),'javascriptErrors':errors,'failedRequests':len(failed)},ensure_ascii=False))
 context.close();browser.close()
