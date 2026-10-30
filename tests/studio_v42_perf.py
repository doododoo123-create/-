"""Same offline Chromium and fixture, v41/v42 synchronous costs + source-map pixels.
These timings are not end-user FPS. Output screenshots stay in .artifacts.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from PIL import Image,ImageChops,ImageStat
import json,subprocess
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'.artifacts/v41-performance-baseline.html';BASE.parent.mkdir(exist_ok=True)
if not BASE.exists():
 with BASE.open('wb') as out:subprocess.run(['git','show','v0.41.0:사국쟁패 Studio.html'],cwd=ROOT,stdout=out,check=True)
subprocess.run(['node','tests/make-v42-fixture.mjs'],cwd=ROOT,check=True)
results={}
def seek(page,predicate):
 for i in range(2000):
  if page.evaluate(predicate):return
  if page.locator('.map-stage').get_attribute('data-playing')!='true':page.keyboard.press('a')
  page.clock.run_for(25)
 raise AssertionError(predicate)
def sample(page,kind):
 return page.evaluate('''kind=>{const now=window.cpuNow||performance.now.bind(performance),values=[];for(let i=0;i<34;i++){
 const t=now();if(kind==='redraw')document.querySelector('[data-action=toggle-camera-follow]').click();
 else document.body.dispatchEvent(new KeyboardEvent('keydown',{key:i%2?'ArrowLeft':'ArrowRight',bubbles:true}));
 if(i>=4)values.push(now()-t);}values.sort((a,b)=>a-b);return {medianMs:values[15],p95Ms:values[28]};}''',kind)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for label,path in [('v41',BASE),('v42',ROOT/'dist/사국쟁패 Studio.html')]:
  ctx=browser.new_context(viewport={'width':1600,'height':1000},device_scale_factor=1);page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  ctx.route('**/perf42',lambda r:r.fulfill(status=200,content_type='text/html',path=str(path)));ctx.set_offline(True);page.goto('http://127.0.0.1:3000/perf42',wait_until='networkidle',timeout=90000)
  expect(page.locator('.atlas-cell')).to_have_count(160,timeout=90000);page.locator('[data-action=map-fullscreen]').first.click();expect(page.locator('.han-map-host')).to_have_attribute('data-han-art','Han-natural-cultivation-margins-500-v1',timeout=60000);page.evaluate('document.activeElement?.blur()')
  page.wait_for_timeout(200);page.screenshot(path=str(ROOT/f'.artifacts/{label}-map100.png'))
  results[label]={'redraw':sample(page,'redraw'),'pan':sample(page,'pan')}
  page.evaluate('''()=>{for(let i=0;i<12;i++)document.querySelector('.atlas-scroll').dispatchEvent(new WheelEvent('wheel',{clientX:800,clientY:500,deltaY:-160,bubbles:true,cancelable:true}));}''')
  expect(page.locator('.atlas-scroll')).to_have_attribute('data-zoom','5');expect(page.locator('.han-map-host')).to_have_attribute('data-han-pending','0',timeout=60000);page.wait_for_timeout(150);page.screenshot(path=str(ROOT/f'.artifacts/{label}-map500.png'))
  results[label]['redraw500']=sample(page,'redraw');results[label]['pan500']=sample(page,'pan')
  if label=='v42':
   assert page.evaluate('''()=>{const a=document.querySelector('.atlas-map'),b=document.querySelector('.atlas-art-surface');return a.getAttribute('viewBox')===b.getAttribute('viewBox')&&!!b.querySelector('.han-map-host')&&document.querySelector('.han-map-surface').shadowRoot.querySelectorAll('[data-texture-id]').length===476}''')
  page.keyboard.press('Escape');page.locator('#world-file').set_input_files(str(ROOT/'.artifacts/v42-four.history.json'));expect(page.locator('[data-import-confirm]')).to_be_enabled(timeout=45000);page.locator('[data-import-confirm]').click();expect(page.locator('#file-import-dialog')).not_to_be_visible();page.evaluate('window.cpuNow=performance.now.bind(performance)');page.clock.install(time=0);page.clock.pause_at(1000);page.locator('.history-entry[data-id="1"]').click();page.locator('[data-action=map-fullscreen]').click();page.evaluate('document.activeElement?.blur()')
  seek(page,"()=>[...document.querySelectorAll('.campaign-duel')].some(e=>e.dataset.duelIndex==='2'&&e.dataset.currentDuel==='true')&&document.querySelector('.map-stage').dataset.phase==='rolling'");page.keyboard.press('a')
  results[label]['fourVsFourDice']=sample(page,'redraw')
  page.evaluate("window.keptMap=document.querySelector('.atlas-cells');window.keptRow=document.querySelector('.campaign-duel');")
  seek(page,"()=>document.querySelector('.map-stage').dataset.phase==='merging'");page.keyboard.press('a');assert page.evaluate("window.keptMap===document.querySelector('.atlas-cells')&&window.keptRow===document.querySelector('.campaign-duel')")
  results[label]['fourVsFourBonus']=sample(page,'redraw')
  seek(page,"()=>!!document.querySelector('[data-engagement][data-combat-side=attack]')&&document.querySelector('.map-stage').dataset.event==='resolve'");page.keyboard.press('a');results[label]['stackedBattle']=sample(page,'redraw')
  assert not errors,errors;print(label,json.dumps(results[label]),flush=True);ctx.close()
 browser.close()
for zoom in [100,500]:
 a=Image.open(ROOT/f'.artifacts/v41-map{zoom}.png').convert('RGB');b=Image.open(ROOT/f'.artifacts/v42-map{zoom}.png').convert('RGB');diff=ImageChops.difference(a,b)
 results[f'pixels{zoom}']={'meanAbsoluteChannelError':sum(ImageStat.Stat(diff).mean)/3,'changedPixels':sum(1 for rgb in diff.get_flattened_data() if max(rgb)>8)}
 assert results[f'pixels{zoom}']['meanAbsoluteChannelError']<.15,results[f'pixels{zoom}']
(ROOT/'.artifacts/v42-performance.json').write_text(json.dumps(results,indent=2));print(json.dumps(results),flush=True)
