"""Offline standalone: resume two real failures and cross 255 in the automatic UI."""
from pathlib import Path
import json, subprocess
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
APP_VERSION = json.loads((ROOT / 'package.json').read_text())['version']
if any(not (ROOT / '.artifacts' / name).exists() for name in ['v0441-before-116.history.json', 'v0441-before-178.history.json', 'v0441-before-256.history.json']):
    subprocess.run(['node', 'tests/make-v0441-fixtures.mjs'], cwd=ROOT, check=True)
errors = []
failed = []
results = []
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    for before, name in [(115, 'v0441-before-116.history.json'), (177, 'v0441-before-178.history.json'), (255, 'v0441-before-256.history.json')]:
        context = browser.new_context(viewport={'width': 1440, 'height': 1000})
        context.route('**/game.html', lambda route: route.fulfill(status=200, content_type='text/html', path=str(ROOT / 'dist/사국쟁패 Studio.html')))
        context.set_offline(True)
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('requestfailed', lambda request: failed.append(request.url) if not request.url.startswith('blob:') else None)
        page.goto('http://127.0.0.1:3000/game.html', wait_until='networkidle', timeout=90000)
        expect(page.locator('.page-footer')).to_contain_text('v'+APP_VERSION, timeout=90000)
        page.locator('#world-file').set_input_files(str(ROOT / '.artifacts' / name))
        expect(page.locator('[data-import-confirm]')).to_be_enabled(timeout=60000)
        page.locator('[data-import-confirm]').click()
        expect(page.locator('#file-import-dialog')).not_to_be_visible(timeout=60000)
        expect(page.locator('.history-panel .count-badge')).to_have_text(f'{before}턴')
        page.locator('#sim-speed').select_option('16')
        page.clock.install(time=0)
        page.clock.pause_at(1000)
        page.locator('.simulation-controls [data-action=auto]').click()
        for _ in range(40):
            current = int(page.locator('.history-panel .count-badge').inner_text().removesuffix('턴'))
            if current >= before + 2:
                break
            page.clock.run_for(2000)
        assert current >= before + 2, (before, current, errors)
        page.locator('.simulation-controls [data-action=auto]').click()
        page.keyboard.press('Shift+S')
        page.wait_for_function("""target => {
          const saved = JSON.parse(localStorage.getItem('saguk-studio.completed-run.v11'));
          return (saved?.count ?? saved?.engineState?.turns ?? 0) >= target;
        }""", arg=before+2, timeout=30000)
        facts = page.evaluate("""async () => {
          let saved = JSON.parse(localStorage.getItem('saguk-studio.completed-run.v11'));
          if(saved.kind === 'saguk-studio-run-archive') saved = await new Promise((resolve,reject) => {
            const opened=indexedDB.open('saguk-studio-history',1);
            opened.onerror=()=>reject(opened.error);
            opened.onsuccess=()=>{
              const db=opened.result,tx=db.transaction('metadata','readonly'),request=tx.objectStore('metadata').get(saved.id);
              request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);tx.oncomplete=()=>db.close();
            };
          });
          const state=saved.engineState;
          return {turn:state.turns, kings:state.countries.filter(c=>c.royal?.active&&c.royal.alive).map(c=>({id:c.id,position:c.royal.position,capital:state.capitals[c.id]}))};
        }""")
        assert all(king['position'] == king['capital'] for king in facts['kings']), facts
        assert not errors, errors
        page.screenshot(path=str(ROOT / '.artifacts' / f'v0441-resumed-{before}.png'), full_page=False)
        page.clock.resume()
        page.reload(wait_until='networkidle', timeout=90000)
        expect(page.locator('.page-footer')).to_contain_text('v'+APP_VERSION, timeout=90000)
        page.locator('nav [data-page=simulation]').click()
        expect(page.locator('.history-panel .count-badge')).to_have_text(f"{facts['turn']}턴", timeout=30000)
        results.append({'resumedFrom': before, 'savedAndReloaded': facts['turn'], 'kings': facts['kings']})
        print('PASS', json.dumps(results[-1], ensure_ascii=False), flush=True)
        context.close()
    assert not errors, errors
    assert not failed, failed
    browser.close()
(ROOT / '.artifacts/v0441-browser-results.json').write_text(json.dumps({'results': results, 'errors': errors, 'externalRequestFailures': failed}, ensure_ascii=False, indent=2))
print('PASS offline standalone automatic continuation, save/reload and zero browser exceptions', flush=True)
