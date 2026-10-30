"""Real requestAnimationFrame intervals during zoom/pan, not just JS duration.
Same offline Chromium/viewport/source game, no virtual clock in this benchmark.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import json,subprocess
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'.artifacts/v42-performance-baseline.html';BASE.parent.mkdir(exist_ok=True)
if not BASE.exists():
 with BASE.open('wb') as out:subprocess.run(['git','show','v0.42.0:사국쟁패 Studio.html'],cwd=ROOT,stdout=out,check=True)
results={}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for label,path in [('v42',BASE),('v43',ROOT/'dist/사국쟁패 Studio.html')]:
  ctx=b.new_context(viewport={'width':1600,'height':1000},device_scale_factor=1);page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));ctx.route('**/paint43',lambda r:r.fulfill(status=200,content_type='text/html',path=str(path)));ctx.set_offline(True);page.goto('http://localhost:3000/paint43',wait_until='networkidle',timeout=90000);expect(page.locator('.atlas-cell')).to_have_count(160,timeout=90000);page.locator('[data-action=map-fullscreen]').first.click();expect(page.locator('.han-map-host')).to_have_attribute('data-han-art','Han-natural-cultivation-margins-500-v1',timeout=60000);page.evaluate('document.activeElement?.blur()')
  if label=='v43':expect(page.locator('.han-map-host')).to_have_attribute('data-han-ready','true',timeout=30000)
  page.wait_for_timeout(250);page.screenshot(path=str(ROOT/f'.artifacts/{label}-paint100.png'))
  page.evaluate('''()=>{window.paintCycle=kind=>new Promise(resolve=>{const map=document.querySelector('.atlas-scroll'),intervals=[],inputs=[];let i=0,last=performance.now();const tick=()=>{const now=performance.now();if(i>3)intervals.push(now-last);last=now;const t=performance.now();if(kind==='zoom')map.dispatchEvent(new WheelEvent('wheel',{clientX:800,clientY:500,deltaY:i<9?-45:45,bubbles:true,cancelable:true}));else document.body.dispatchEvent(new KeyboardEvent('keydown',{key:i<9?'ArrowLeft':'ArrowRight',bubbles:true}));inputs.push(performance.now()-t);if(++i<18)requestAnimationFrame(tick);else requestAnimationFrame(()=>{intervals.sort((a,b)=>a-b);inputs.sort((a,b)=>a-b);resolve({frameMedianMs:intervals[7],frameP95Ms:intervals.at(-1),inputMedianMs:inputs[9],frames:intervals.length});});};requestAnimationFrame(tick);});}''')
  results[label]={}
  for kind in ['zoom','pan']:
   page.evaluate('(kind)=>window.paintCycle(kind)',kind);results[label][kind]=page.evaluate('(kind)=>window.paintCycle(kind)',kind);print(label,kind,json.dumps(results[label][kind]),flush=True)
  if label=='v43':
   page.evaluate('''async()=>{for(let i=0;i<12;i++)document.querySelector('.atlas-scroll').dispatchEvent(new WheelEvent('wheel',{clientX:800,clientY:500,deltaY:-160,bubbles:true,cancelable:true}));await new Promise(requestAnimationFrame);}''');expect(page.locator('.atlas-scroll')).to_have_attribute('data-zoom','5');expect(page.locator('.han-map-host')).to_have_attribute('data-han-pending','0',timeout=30000);page.wait_for_timeout(150);page.screenshot(path=str(ROOT/'.artifacts/v43-paint500.png'))
   results[label]['background']=page.evaluate('''()=>{const host=document.querySelector('.han-map-host'),shadow=document.querySelector('.han-map-surface').shadowRoot;return {nodes:shadow.querySelectorAll('*').length,masks:shadow.querySelectorAll('mask').length,quality:host.dataset.hanQuality,bytes:Number(host.dataset.hanBytes),cached:Number(host.dataset.hanCached),ready:host.dataset.hanReady,aligned:document.querySelector('.atlas-map').getAttribute('viewBox')===document.querySelector('.atlas-art-surface').getAttribute('viewBox')};}''');assert results[label]['background']['aligned'];assert results[label]['background']['masks']==0
  assert not errors,errors;ctx.close()
 b.close()
(ROOT/'.artifacts/v43-paint-performance.json').write_text(json.dumps(results,indent=2));print(json.dumps(results),flush=True)
