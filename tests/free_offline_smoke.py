"""New free-coast single HTML: no external assets/imports, offline turns and camp records."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 context=b.new_context(viewport={'width':1600,'height':1000});page=context.new_page();errors=[];failed=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda req:failed.append(req.url))
 page.goto('http://127.0.0.1:3000/dist/%EC%82%AC%EA%B5%AD%EC%9F%81%ED%8C%A8%20Studio.html',wait_until='networkidle');context.set_offline(True)
 expect(page.locator('.map-background-image')).to_have_count(1)
 assert page.locator('.map-background-image').evaluate('async el=>{const i=new Image();i.src=el.getAttribute("href");await i.decode();return i.naturalWidth===1200}')
 assert page.locator('img').evaluate_all('async imgs=>{await Promise.all(imgs.map(i=>i.decode()));return imgs.every(i=>i.src.startsWith("data:"))}')
 page.locator('nav [data-page="map"]').click();page.locator('#territory-form [name="name"]').fill('오프라인 해안');page.locator('#territory-form button[type="submit"]').click()
 assert page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.world.v1')).world.mapKind")=='free'
 page.locator('nav [data-page="simulation"]').click();page.locator('[data-action="map-fullscreen"]').click()
 for _ in range(12):page.keyboard.press('Enter');page.keyboard.press('s')
 data=page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.completed-run.v11'))")
 assert data['initialWorld']['mapKind']=='free' and len(data['engineState']['cells'])==80
 assert sum(len(r.get('movements',[])) for r in data['history'])>0
 for person,camp in data['history'][-1]['campsAfter'].items():expect(page.locator('[data-person="'+person+'"]').first).to_have_attribute('data-camp',camp['territoryId'])
 page.keyboard.press('Escape')
 # Fulfil only the distributable document for an offline reload, with no server dependencies.
 html=(ROOT/'dist/사국쟁패 Studio.html').read_text()
 context.route('**/dist/**',lambda route:route.fulfill(status=200,content_type='text/html',body=html))
 page.reload(wait_until='networkidle');page.locator('nav [data-page="simulation"]').click()
 assert page.locator('.history-entry').count()==12
 assert not errors,errors;assert not failed,failed
 print('PASS: 새 자유 대륙 단일 HTML · 내장 삽화/바다/사진 디코딩 · 오프라인 편집 · 12턴 실행/이동 기록 · 저장 재개 · 외부 요청/JavaScript 예외 0건')
 context.close();b.close()
