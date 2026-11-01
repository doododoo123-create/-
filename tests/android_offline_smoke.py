from pathlib import Path
import json
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1280,'height':720},has_touch=True)
 context.add_init_script("window.androidExports=[];window.SagukAndroid={saveText:(name,text,mime)=>androidExports.push({name,text,mime})};")
 context.route('https://app.saguk.local/**',lambda r:r.fulfill(status=200,content_type='text/html',path=str(ROOT/'.artifacts/android/assets/www/index.html')))
 context.set_offline(True)
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('https://app.saguk.local/index.html',wait_until='networkidle',timeout=90000)
 expect(page.locator('.page-footer')).to_contain_text('v0.46.1',timeout=90000)
 assert page.locator('.atlas-cell').count()==160
 assert page.evaluate('window.isSecureContext&&!!crypto.subtle&&!!indexedDB')
 page.locator('[data-action=export]').click()
 page.wait_for_function('androidExports.length===1')
 data=page.evaluate('JSON.parse(androidExports[0].text)');assert data['kind']=='saguk-studio-world'
 page.locator('nav [data-page=simulation]').click();page.locator('[data-action=step]').click()
 page.keyboard.press('Shift+S')
 page.wait_for_function("(()=>{const d=JSON.parse(localStorage.getItem('saguk-studio.completed-run.v11'));return (d?.engineState?.turns??d?.count??0)>=1})()")
 page.locator('[data-action=export-history]').click();page.wait_for_function('androidExports.length===2')
 data=page.evaluate('JSON.parse(androidExports[1].text)');assert len(data['history'])==1
 page.evaluate("window.dispatchEvent(new Event('saguk-app-pause'))")
 page.reload(wait_until='networkidle');expect(page.locator('.page-footer')).to_contain_text('v0.46.1',timeout=90000)
 page.locator('nav [data-page=simulation]').click();expect(page.locator('.history-panel .count-badge')).to_have_text('1턴')
 page.screenshot(path=str(ROOT/'.artifacts/android-preview.png'))
 assert not errors,errors
 print('PASS offline160 territory game, secure storage, native export adapter, one turn, history export, pause and reload; browser errors0')
 browser.close()
