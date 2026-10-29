"""Repeatable synchronous UI cost comparison; this does not measure device FPS."""
from pathlib import Path
import json,subprocess
from playwright.sync_api import sync_playwright,expect

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'.artifacts/v39-performance-baseline.html'
BASE.parent.mkdir(exist_ok=True)
with BASE.open('wb') as out:
 subprocess.run(['git','show','f3e6c1b:사국쟁패 Studio.html'],cwd=ROOT,stdout=out,check=True)
results={}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for label,path in [('v39',BASE),('v40',ROOT/'dist/사국쟁패 Studio.html')]:
  context=browser.new_context(viewport={'width':1600,'height':1000},device_scale_factor=1)
  page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  context.route('**/render-benchmark',lambda route:route.fulfill(status=200,content_type='text/html',path=str(path)))
  context.set_offline(True);page.goto('http://127.0.0.1:3000/render-benchmark',wait_until='networkidle',timeout=90000)
  expect(page.locator('.atlas-cell')).to_have_count(160,timeout=90000)
  page.locator('[data-action=map-fullscreen]').first.click()
  expect(page.locator('.han-map-host')).to_have_attribute('data-han-art','Han-natural-cultivation-margins-500-v1',timeout=60000)
  results[label]=page.evaluate('''()=>{
   const sample=fn=>{const values=[];for(let i=0;i<24;i++){const start=performance.now();fn(i);if(i>=4)values.push(performance.now()-start);}values.sort((a,b)=>a-b);return {medianMs:values[10],p95Ms:values[18]};};
   const redraw=sample(()=>document.querySelector('[data-action=toggle-camera-follow]').click());
   document.activeElement?.blur();
   const pan=sample(i=>document.body.dispatchEvent(new KeyboardEvent('keydown',{key:i%2?'ArrowLeft':'ArrowRight',code:i%2?'ArrowLeft':'ArrowRight',bubbles:true})));
   return {redraw,pan,cards:document.querySelectorAll('.map-unit-position').length};
  }''')
  assert not errors,errors
  print(label,json.dumps(results[label]),flush=True);context.close()
 browser.close()
for kind in ['redraw','pan']:
 results[kind+'ReductionPercent']=round((1-results['v40'][kind]['medianMs']/results['v39'][kind]['medianMs'])*100,1)
(ROOT/'.artifacts/v40-performance.json').write_text(json.dumps(results,indent=2))
print(json.dumps(results),flush=True)
