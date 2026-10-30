"""Retained-layer invalidation, source-art lifecycle, camera alignment, and editor save/reload."""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);ctx=b.new_context(viewport={'width':1600,'height':1000});page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));ctx.route('**/editor42',lambda r:r.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist/사국쟁패 Studio.html')));ctx.set_offline(True);page.goto('http://localhost:3000/editor42',wait_until='networkidle',timeout=90000);expect(page.locator('.page-footer')).to_contain_text('v0.43.0',timeout=60000)
 page.locator('nav [data-page=map]').click();expect(page.locator('.atlas-cell')).to_have_count(160)
 tile=page.locator('.atlas-cell').first.get_attribute('data-territory');owner=page.locator('#territory-form [name=ownerId]').input_value();other=page.locator('#territory-form [name=ownerId] option').evaluate_all('(es,current)=>es.find(e=>e.value&&e.value!==current).value',owner)
 page.evaluate('window.originalCells=document.querySelector(".atlas-cells")');page.locator('#territory-form [name=name]').fill('갱신검증');page.locator('#territory-form [name=ownerId]').select_option(other);page.locator('#territory-form [name=terrain]').select_option('mountain');page.locator('#territory-form [type=submit]').click()
 expect(page.locator(f'.atlas-cell[data-territory="{tile}"]')).to_have_attribute('data-owner',other);expect(page.locator(f'[data-territory-label="{tile}"]')).to_have_text('갱신검증');assert page.evaluate('window.originalCells!==document.querySelector(".atlas-cells")')
 page.locator('#map-art-style').select_option('classic');expect(page.locator('.han-map-host')).to_have_count(0);expect(page.locator('.atlas-art-surface')).to_have_count(0)
 page.locator('#map-art-style').select_option('illustrated');expect(page.locator('.han-map-host')).to_have_attribute('data-han-art','Han-natural-cultivation-margins-500-v1',timeout=60000)
 for z in ['1','5','1']:
  page.locator('#map-editor-zoom').select_option(z)
  assert page.evaluate('''()=>{const map=document.querySelector('.atlas-map'),art=document.querySelector('.atlas-art-surface');return map.getAttribute('viewBox')===art.getAttribute('viewBox')&&!document.querySelector('[data-atlas-fragment]:not([data-atlas-mounted=true])')}''')
  gap=page.evaluate('''id=>{const a=document.querySelector('[data-territory-label="'+id+'"]').getBoundingClientRect(),b=document.querySelector('[data-mountain-id="'+id+'"]').getBoundingClientRect();return b.left-a.right}''',tile);assert abs(gap-4)<1,(z,gap)
 page.locator('#map-background-file').set_input_files(str(ROOT/'assets/ui-kit/01-art/panel_parchment.webp'));expect(page.locator('[data-action=map-edit-remove-background]')).to_be_visible(timeout=30000);expect(page.locator('.han-map-host')).to_have_count(0);expect(page.locator('.atlas-art-surface')).to_have_count(0)
 page.locator('[data-action=map-edit-remove-background]').click();expect(page.locator('.han-map-host')).to_have_attribute('data-han-art','Han-natural-cultivation-margins-500-v1',timeout=60000)
 page.reload(wait_until='networkidle');page.locator('nav [data-page=map]').click();expect(page.locator(f'[data-territory-label="{tile}"]')).to_have_text('갱신검증');expect(page.locator(f'.atlas-cell[data-territory="{tile}"]')).to_have_attribute('data-owner',other)
 assert not errors,errors;b.close();print('PASS territory name/owner/mountain invalidation, original/custom/classic art lifecycle,1/5 zoom and mountain alignment, save/reload without stale layers',flush=True)
