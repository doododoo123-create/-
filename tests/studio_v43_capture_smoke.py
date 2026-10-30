"""Actual160-map history: occupied mask only grows, pause/resume does not reset
it, season effects persist across countries, and settlement removes them once.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import subprocess,json
from io import BytesIO
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
if not (ROOT/'.artifacts/v43-captures.history.json').exists():subprocess.run(['node','tests/make-v43-fixture.mjs'],cwd=ROOT,check=True)
fixture=json.loads((ROOT/'.artifacts/v43-captures.history.json').read_text());season_turn=next(r['turn'] for r in fixture['history'] if r['round']>1 and r.get('seasonStart'))
def seek(page,predicate,limit=8000):
 for i in range(limit):
  if page.evaluate(predicate):return
  if page.locator('.map-stage').get_attribute('data-playing')!='true':page.keyboard.press('a')
  page.clock.run_for(40)
 raise AssertionError(predicate)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);ctx=b.new_context(viewport={'width':1600,'height':1000});page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));ctx.route('**/capture43',lambda r:r.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist/사국쟁패 Studio.html')));ctx.set_offline(True);page.goto('http://localhost:3000/capture43',wait_until='networkidle',timeout=90000);expect(page.locator('.page-footer')).to_contain_text('v0.43.0',timeout=60000)
 page.locator('#world-file').set_input_files(str(ROOT/'.artifacts/v43-captures.history.json'));expect(page.locator('[data-import-confirm]')).to_be_enabled(timeout=60000);page.locator('[data-import-confirm]').click();expect(page.locator('#file-import-dialog')).not_to_be_visible();saved=page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")');page.locator('#sim-speed').select_option('1');page.clock.install(time=0);page.clock.pause_at(1000);page.locator('.history-entry[data-id="1"]').click();page.locator('[data-action=map-fullscreen]').click();page.evaluate('document.activeElement?.blur()');page.locator('[data-action=toggle-camera-follow]').click()
 seek(page,"()=>document.querySelector('.map-stage').dataset.kind==='capture'&&!!document.querySelector('[data-front-wave]')")
 page.evaluate('''()=>{const wave=document.querySelector('[data-front-wave]'),i=wave.dataset.frontWave,capture=[...document.querySelectorAll('[data-round-capture]')].find(p=>p.getAttribute('clip-path')==='url(#capture-flow-'+i+')'),id=capture.dataset.roundCapture,area=document.querySelector('.atlas-cell[data-territory="'+id+'"] .atlas-territory'),box=area.getBBox(),points=[];for(let y=1;y<20;y++)for(let x=1;x<20;x++){const p=new DOMPoint(box.x+box.width*x/20,box.y+box.height*y/20);if(area.isPointInFill(p))points.push(p);}window.probe={wave,id,points,seen:points.map(()=>false),counts:[],steps:0};}''')
 shot=False;pixel_before=None;pixel_points=[];pixel_checked=False;pixel_style=None
 for i in range(180):
  if page.locator('.map-stage').get_attribute('data-kind')!='capture':break
  facts=page.evaluate('''()=>{const p=window.probe,inside=p.points.map(v=>p.wave.isPointInFill(v)),lost=inside.some((v,i)=>p.seen[i]&&!v);p.seen=inside;p.counts.push(inside.filter(Boolean).length);p.steps++;return {lost,count:p.counts.at(-1),total:p.points.length,progress:Number(p.wave.dataset.waveProgress),pieces:(p.wave.getAttribute('d').match(/Z/g)||[]).length};}''');assert not facts['lost'],facts
  if not shot and facts['count']>facts['total']*.35:
   page.keyboard.press('a');before=page.evaluate('window.probe.wave.getAttribute("d")');page.clock.run_for(100);assert page.evaluate('window.probe.wave.getAttribute("d")')==before;page.screenshot(path=str(ROOT/'docs/v43-capture.png'));page.keyboard.press('a');shot=True
  if pixel_before is None and facts['progress']>.65:
   pixel_points=page.evaluate("""()=>{const p=probe,m=p.wave.getScreenCTM();return p.points.filter(v=>[[0,0],[6,0],[-6,0],[0,6],[0,-6]].every(([x,y])=>p.wave.isPointInFill(new DOMPoint(v.x+x,v.y+y)))).map(v=>v.matrixTransform(m)).filter(v=>v.x>=0&&v.x<1600&&v.y>=0&&v.y<1000).map(v=>[Math.floor(v.x),Math.floor(v.y)]);} """)
   if pixel_points:
    pixel_style=page.add_style_tag(content='.country-tokens,.map-campaign{visibility:hidden!important}')
    pixel_before=Image.open(BytesIO(page.screenshot())).convert('RGB')
  elif pixel_before is not None and not pixel_checked and facts['progress']>.9:
   after=Image.open(BytesIO(page.screenshot())).convert('RGB');changes=[max(abs(a-b) for a,b in zip(pixel_before.getpixel(tuple(point)),after.getpixel(tuple(point)))) for point in pixel_points];assert max(changes)<=8,{'pixelChanges':changes,'points':pixel_points};pixel_checked=True;pixel_style.evaluate('e=>e.remove()')
  page.clock.run_for(8)
 facts=page.evaluate('({steps:probe.steps,counts:[...new Set(probe.counts)],id:probe.id})');assert len(facts['counts'])>=3 and facts['steps']>=5,facts;assert shot,facts;assert pixel_checked,'captured interior pixels must stay stable';print('PASS actual160-map occupied mask grows monotonically and survives pause/resume',facts,flush=True)
 for _ in range(2):page.keyboard.press('=')
 seek(page,"()=>Number(document.querySelector('.map-stage').dataset.turn)>=2")
 assert page.locator('[data-round-capture]').count()>0
 page.keyboard.press('a');page.keyboard.press('Escape');page.locator(f'.history-entry[data-id="{season_turn}"]').click();page.locator('[data-action=map-fullscreen]').click();page.evaluate('document.activeElement?.blur()')
 seek(page,"()=>document.querySelector('.map-stage').dataset.kind==='round-settle'")
 assert page.locator('[data-front-wave]').count()>0
 seek(page,f"()=>Number(document.querySelector('.map-stage').dataset.turn)==={season_turn}&&document.querySelector('.map-stage').dataset.kind!=='round-settle'&&document.querySelector('.map-stage').dataset.kind!=='season'")
 assert page.locator('[data-round-capture]').count()==0,page.evaluate('''()=>({stage:{...document.querySelector('.map-stage').dataset},captures:[...document.querySelectorAll('[data-round-capture]')].map(e=>({id:e.dataset.roundCapture,clip:e.getAttribute('clip-path'),mask:e.getAttribute('mask')}))})''');page.keyboard.press('a');page.keyboard.press('Escape');page.locator('[data-action=return-live]').click();assert page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')==saved;assert not errors,errors;b.close();print('PASS country-turn hatch persistence, seasonal settlement, actual history replay and unchanged live save',flush=True)
