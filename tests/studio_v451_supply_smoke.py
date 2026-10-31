"""Offline normal HTML: new world land-only, old history continued with a recorded supply boundary."""
from pathlib import Path
import json,subprocess
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
if not (ROOT/'.artifacts/v43-captures.history.json').exists():subprocess.run(['node','tests/make-v43-fixture.mjs'],cwd=ROOT,check=True)
errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);ctx=b.new_context(viewport={'width':1440,'height':1000});ctx.route('**/game.html',lambda r:r.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist/사국쟁패 Studio.html')));ctx.set_offline(True);page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:3000/game.html',wait_until='networkidle',timeout=90000);expect(page.locator('.page-footer')).to_contain_text('v0.45.1',timeout=90000)
 with page.expect_download() as d:page.locator('[data-action=export]').first.click()
 out=ROOT/'.artifacts/v451-world.json';d.value.save_as(out);world=json.loads(out.read_text())['world'];assert world['rules']['seaSupply']==False;assert world['rules']['territoryArmyLimit']==5 and world['rules']['desertionRate']==.25
 source=ROOT/'.artifacts/v43-captures.history.json';original=json.loads(source.read_text());assert original['world']['rules']['seaSupply']==True;count=len(original['history'])
 page.locator('#world-file').set_input_files(str(source));expect(page.locator('[data-import-confirm]')).to_be_enabled(timeout=45000);page.locator('[data-import-confirm]').click();expect(page.locator('#file-import-dialog')).not_to_be_visible();expect(page.locator('.history-panel .count-badge')).to_have_text(f'{count}턴');page.locator('[data-action=step]').click();page.locator('[data-action=scene-skip]').click();page.wait_for_function('''()=>JSON.parse(localStorage.getItem('saguk-studio.completed-run.v11'))&& ((JSON.parse(localStorage.getItem('saguk-studio.completed-run.v11')).count??JSON.parse(localStorage.getItem('saguk-studio.completed-run.v11')).engineState?.turns)===9)''')
 with page.expect_download() as d:page.locator('[data-action=export-history]').click()
 exported=ROOT/'.artifacts/v451-after.history.json';d.value.save_as(exported);saved=json.loads(exported.read_text());assert saved['engineState']['landSupplyOnly']==True;assert saved['world']['rules']['seaSupply']==True;assert saved['history'][:count]==original['history'];assert saved['history'][count]['controls']['landSupplyOnly']==True
 page.reload(wait_until='networkidle');page.locator('nav [data-page=simulation]').click();expect(page.locator('.history-panel .count-badge')).to_have_text(f'{count+1}턴')
 with page.expect_download() as d:page.locator('[data-action=export-history]').click()
 d.value.save_as(exported);assert json.loads(exported.read_text())['engineState']['landSupplyOnly']==True

 assert not errors,errors;b.close();print('PASS offline default160 land-only, unchanged5万/cell and25% desertion, original34 history retained, new turn flag, save/reload, zero browser errors',flush=True)
