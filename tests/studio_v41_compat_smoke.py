"""Single normal edition compatibility: licensed fonts, portable imports, shared routes and import rollback."""
from pathlib import Path
from urllib.parse import quote
import json,subprocess,os
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];subprocess.run(['node','tests/make-v29-fixtures.mjs'],cwd=ROOT,check=True);facts=json.loads((ROOT/'.artifacts/v29-file-fixture.json').read_text());errors=[];failed=[];SCREEN_LABEL='v41';APP_VERSION=json.loads((ROOT/'package.json').read_text())['version']
def import_file(page,name,confirm=True):
 page.locator('#world-file').set_input_files(str(ROOT/'.artifacts'/name));expect(page.locator('#file-import-dialog')).to_be_visible();expect(page.locator('[data-import-confirm]')).to_be_enabled(timeout=45000)
 if confirm:page.locator('[data-import-confirm]').click();expect(page.locator('#file-import-dialog')).not_to_be_visible(timeout=45000)
def seek(page,predicate,limit=2000):
 for _ in range(limit):
  if page.evaluate(predicate):return
  if page.locator('.map-stage').get_attribute('data-playing')!='true':page.keyboard.press('Space')
  page.clock.run_for(20)
 page.screenshot(path=str(ROOT/'.artifacts/v29-failure.png'));raise AssertionError(predicate+' errors '+str(errors))
def fonts_for(page,selector):
 cdp=page.context.new_cdp_session(page);cdp.send('DOM.enable');cdp.send('CSS.enable');root=cdp.send('DOM.getDocument')['root']['nodeId'];node=cdp.send('DOM.querySelector',{'nodeId':root,'selector':selector})['nodeId'];fonts=cdp.send('CSS.getPlatformFontsForNode',{'nodeId':node})['fonts'];cdp.detach();return fonts
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for mobile in [False]:
  name='사국쟁패 Studio 모바일 경량.html' if mobile else '사국쟁패 Studio.html';label='normal';ctx=b.new_context(viewport={'width':1600,'height':1000});page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda r:failed.append(r.url));page.on('dialog',lambda d:d.accept());ctx.route('**/dist/**',lambda route:route.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist'/name)));ctx.set_offline(True);page.goto('http://127.0.0.1:3000/dist/'+quote(name),wait_until='networkidle');expect(page.locator('.page-footer')).to_contain_text('v'+APP_VERSION);expect(page.locator('.atlas-cell')).to_have_count(160)
  faces=page.evaluate('Array.from(document.fonts).map(f=>({family:f.family,status:f.status}))');assert len(faces)==4 and all(f['status']=='loaded' for f in faces),faces
  for selector in ['.page-heading h1','.king-crown','.atlas-name']:
   used=fonts_for(page,selector);assert used and all(f['isCustomFont'] for f in used),(selector,used)
  page.locator('[data-action=font-licenses]').click();expect(page.locator('#font-license-dialog')).to_contain_text('SIL OPEN FONT LICENSE');assert page.locator('#font-license-dialog details').count()==4;page.locator('#font-license-dialog button').click()
  before=page.evaluate('localStorage.getItem("saguk-studio.world.v1")');import_file(page,'v29-large-world.json',False);assert page.evaluate('localStorage.getItem("saguk-studio.world.v1")')==before;page.locator('[data-import-cancel]').last.click();expect(page.locator('.atlas-cell')).to_have_count(160)
  import_file(page,'v29-large-world.json');expect(page.locator('.atlas-cell')).to_have_count(18);expect(page.locator('.page-heading')).not_to_contain_text('undefined')
  import_file(page,'v29-history.history.json');expect(page.locator('.history-panel .count-badge')).to_have_text('3턴');saved=page.evaluate('JSON.parse(localStorage.getItem("saguk-studio.completed-run.v11"))');assert saved['engineState']['rng']==facts['rng'] and saved['engineState']['turns']==3;same=page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')
  # Summary graph has one ribbon per shared directed segment; selection and all-mode expand it.
  page.locator('[data-action=map-fullscreen]').click();assert page.locator('.operation-arrow,.round-retreat,.operation-movement').count()==0;page.screenshot(path=str(ROOT/f'docs/{SCREEN_LABEL}-{label}-old-turn-clear.png'));assert page.locator('[data-action=toggle-route-mode]').count()==0;page.keyboard.press('Escape')
  # Exact old-world history remains intact during replay; the active moving route stays separate.
  page.locator('#sim-speed').select_option('8');page.clock.install(time=0);page.clock.pause_at(1000);page.locator('.history-entry[data-id="1"]').click();page.locator('[data-action=map-fullscreen]').click();page.evaluate('document.activeElement?.blur()');seek(page,"()=>document.querySelector('.map-stage')?.dataset.kind==='movement'&&document.querySelector('.map-stage')?.dataset.movementSide==='attack'");page.clock.run_for(70);assert page.locator('.operation-arrow[data-live-march=true]').count()>0
  seek(page,"()=>!!document.querySelector('[data-person=b0] .token-confusion')");mark=page.locator('[data-person=b0] .token-confusion');assert '0.5' in mark.evaluate('e=>getComputedStyle(e).transform');assert all(f['isCustomFont'] for f in fonts_for(page,'[data-person=b0] .token-confusion'));page.screenshot(path=str(ROOT/f'docs/{SCREEN_LABEL}-{label}-small-confusion.png'))
  page.keyboard.press('Escape');page.locator('[data-action=return-live]').click();assert page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')==same
  with page.expect_download() as dl:page.locator('[data-action=export-history]').click()
  target=ROOT/'.artifacts'/f'v29-{label}-export.history.json';dl.value.save_as(target);data=json.loads(target.read_text());assert data['version']==2 and data['engineState']['turns']==3 and data['integrity']['algorithm']=='SHA-256'
  page.clock.resume();import_file(page,'v29-legacy.history.json');saved=page.evaluate('JSON.parse(localStorage.getItem("saguk-studio.completed-run.v11"))');assert saved['engineState']['turns']==1 and saved['initialWorld']['rules']['resetConfusionOnRest']==False;assert any(g['confusion']>0 for g in saved['engineState']['countries'][1]['generals']);same=page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')
  page.locator('#world-file').set_input_files(str(ROOT/'.artifacts/v29-bad.history.json'));expect(page.locator('[data-import-status]')).to_contain_text('변경',timeout=30000);assert page.locator('[data-import-confirm]').is_disabled();assert page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')==same;page.locator('[data-import-cancel]').last.click();page.reload(wait_until='networkidle');page.locator('nav [data-page=simulation]').click();expect(page.locator('.history-panel .count-badge')).to_have_text('1턴');page.locator('[data-action=step]').click();page.locator('[data-action=scene-skip]').click();expect(page.locator('.history-panel .count-badge')).to_have_text('2턴');page.screenshot(path=str(ROOT/f'docs/{SCREEN_LABEL}-{label}-restored.png'));ctx.close();print('PASS '+label+': offline custom fonts/licenses, >5MiB world/cancel, portable history/replay/export, genuine27 continue, turn-clear/fixed summary,0.5 badge, damaged import preserves/reload',flush=True)
 assert not errors,errors;assert not failed,failed;b.close();print('PASS app exceptions/external request failures:0',flush=True)
