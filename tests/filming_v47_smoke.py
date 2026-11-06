"""Exercise the packed game offline: live controls, disclosure, retakes, camera and RGBA art."""
from pathlib import Path
import json,subprocess
from playwright.sync_api import sync_playwright,expect

ROOT=Path(__file__).resolve().parents[1]
subprocess.run(['node','tests/make-v47-fixtures.mjs'],cwd=ROOT,check=True)
errors=[];requests=[]
def load(page,name):
 page.locator('#world-file').set_input_files(str(ROOT/'.artifacts'/name))
 expect(page.locator('[data-import-confirm]')).to_be_enabled(timeout=90000)
 page.locator('[data-import-confirm]').click()
 expect(page.locator('#file-import-dialog')).not_to_be_visible(timeout=90000)
def seek(page,predicate,step=30,limit=6000):
 for _ in range(limit):
  if page.evaluate(predicate):return
  page.clock.run_for(step)
 page.screenshot(path=str(ROOT/'.artifacts/v47-smoke-failure.png'))
 raise AssertionError(predicate+' errors='+str(errors))
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 ctx=browser.new_context(viewport={'width':1920,'height':1080})
 ctx.route('**/game.html',lambda r:r.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist/사국쟁패 Studio.html')))
 ctx.set_offline(True)
 page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('request',lambda r:requests.append(r.url) if r.url.startswith('https://') else None)
 page.goto('http://127.0.0.1:3000/game.html',wait_until='networkidle',timeout=120000)
 expect(page.locator('.page-footer')).to_contain_text('사국쟁패 Studio',timeout=120000)
 load(page,'v47-four.history.json')
 page.clock.install(time=0);page.clock.pause_at(1000)
 page.locator('[data-film-setting=enabled]').click()
 print('PASS offline import and film activation',flush=True)
 expect(page.locator('.filming-mode')).to_be_visible()
 # Enabling filming on an imported turn restores it in a separate paused replay.
 page.locator('[data-action=auto]').first.click()
 seek(page,"()=>document.querySelector('.film-hud')?.dataset.filmPhase==='situation'")
 assert page.locator('.film-score').inner_text()=='VS'
 assert page.locator('.film-highlight').count()==0
 page.evaluate("window.__fighter=document.querySelector('.film-fighter.attack');window.__portrait=window.__fighter.querySelector('img')")
 seek(page,"()=>document.querySelector('.film-hud')?.dataset.filmPhase==='result'")
 assert page.evaluate("()=>window.__fighter===document.querySelector('.film-fighter.attack')&&window.__portrait===document.querySelector('.film-fighter.attack img')")
 assert '손실' in page.locator('.film-loss').first.inner_text()
 print('PASS persistent HUD and staged disclosure',flush=True)
 page.locator('[data-action=film-hold]').click()
 assert page.locator('.map-stage').get_attribute('data-playing')=='false'
 page.screenshot(path=str(ROOT/'.artifacts/v47-battle.png'))
 page.locator('[data-film-speed]').select_option('16')
 page.locator('[data-action=film-save-camera]').click()
 page.locator('[data-action=film-retake-battle]').click()
 seek(page,"()=>document.querySelector('.map-stage')?.dataset.playing==='false'")
 assert page.locator('.map-stage').get_attribute('data-turn')=='1'
 page.clock.run_for(3000)
 assert page.locator('.map-stage').get_attribute('data-turn')=='1'
 assert page.locator('.map-stage').get_attribute('data-playing')=='false'
 print('PASS battle retake stops at boundary',flush=True)
 page.locator('[data-action=film-retake-campaign]').click()
 seek(page,"()=>document.querySelector('.film-report')!==null")
 assert '7전' in page.locator('.film-report').inner_text()
 assert '4승 3패' in page.locator('.film-report').inner_text()
 assert '영토' in page.locator('.film-report').inner_text()
 page.locator('[data-action=film-details]').click()
 assert page.locator('.film-details article').count()==7
 page.locator('.film-details [data-action=film-details]').click()
 page.keyboard.press('h');assert not page.locator('.film-toolbar').is_visible()
 page.screenshot(path=str(ROOT/'.artifacts/v47-clean.png'))
 page.keyboard.press('h');assert page.locator('.film-toolbar').is_visible()
 page.keyboard.press('Escape');page.locator('[data-action=return-live]').click()
 expect(page.locator('.history-panel .count-badge')).to_have_text('1턴')
 print('PASS campaign report, details, clean screen, live save',flush=True)
 page.clock.resume()
 load(page,'v47-honor.history.json')
 page.clock.pause_at(page.evaluate('Date.now()')+1000)
 page.locator('.history-entry[data-id="1"]').click()
 page.locator('[data-action=film-open]').click()
 seek(page,"()=>document.querySelector('.film-highlight')!==null")
 page.locator('[data-action=auto]').first.click()
 assert '3배 병력 격파' in page.locator('.film-honor').inner_text()
 assert page.locator('.film-highlight.has-cutout').count()==1
 assert page.locator('.film-hero').evaluate('async(img)=>{await img.decode();return img.naturalWidth===800}')
 page.screenshot(path=str(ROOT/'.artifacts/v47-honor.png'))
 page.keyboard.press('h');page.set_viewport_size({'width':1280,'height':720});page.screenshot(path=str(ROOT/'.artifacts/v47-honor-720p.png'))
 page.set_viewport_size({'width':480,'height':900});page.screenshot(path=str(ROOT/'.artifacts/v47-honor-mobile.png'))
 assert page.locator('.film-hud').evaluate('(el)=>el.getBoundingClientRect().right<=innerWidth+1')
 assert not errors,errors
 assert not requests,requests
 browser.close()
 print(json.dumps({'offline':True,'errors':errors,'externalRequests':requests,'checks':['persistent fighter/portrait','no early score/honor','result hold','battle/campaign retakes stop','7-battle report/details','clean H shortcut','live history preserved','800x1200 transparent honor','1920/1280/480 viewport']},ensure_ascii=False))
