"""Offline v0.57: 212% map stability, continuous recap, theme and real audio loops."""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import subprocess,json
ROOT=Path(__file__).resolve().parents[1]
if not (ROOT/'.artifacts/v56-capture.history.json').exists():subprocess.run(['node','tests/make-v56-fixture.mjs'],cwd=ROOT,check=True)
turn=json.loads((ROOT/'.artifacts/v56-capture.history.json').read_text())['history'][-1]['turn']
def seek(p,predicate,limit=1800):
 for _ in range(limit):
  if p.evaluate(predicate):return
  p.clock.run_for(25)
 raise AssertionError(predicate)
def open_game(c,path):
 p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.goto('http://localhost:3000/game57',wait_until='networkidle',timeout=120000)
 expect(p.locator('.page-footer')).to_contain_text('v0.57.0',timeout=90000);p.locator('#world-file').set_input_files(str(path));expect(p.locator('[data-import-confirm]')).to_be_enabled(timeout=90000);p.locator('[data-import-confirm]').click();expect(p.locator('#file-import-dialog')).not_to_be_visible(timeout=90000);p.locator('#sim-speed').select_option('2');p.clock.install(time=0);p.clock.pause_at(1000);return p
errors=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':1600,'height':1000},device_scale_factor=1)
 c.route('**/game57',lambda r:r.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist/사국쟁패 Studio.html')));c.set_offline(True)
 c.add_init_script('''(()=>{window.audioProbe=[];const C=window.AudioContext||window.webkitAudioContext,create=C.prototype.createBufferSource;C.prototype.createBufferSource=function(){const n=create.call(this),start=n.start;n.start=function(...args){window.audioProbe.push({loop:n.loop,duration:n.buffer?.duration,rate:n.playbackRate.value});return start.apply(n,args);};return n;};})()''')
 # Exact zoom212%, actual 160-region map, real turn with a defended capture.
 p=open_game(c,ROOT/'.artifacts/v56-capture.history.json');p.locator(f'.history-entry[data-id="{turn}"]').click();p.locator('[data-action=map-fullscreen]').click();p.evaluate('document.activeElement?.blur()')
 if p.locator('.map-follow-toggle').get_attribute('aria-pressed')!='true':p.keyboard.press('s')
 for _ in range(2):p.locator('.atlas-scroll').dispatch_event('wheel',{'deltaY':-150.5666,'clientX':800,'clientY':500,'bubbles':True});p.clock.run_for(20)
 expect(p.locator('.map-zoom-status')).to_contain_text('212%')
 seek(p,"()=>document.querySelectorAll('.map-unit-position[data-combat-side]').length>=2&&document.querySelector('.map-stage').dataset.kind==='roll'")
 p.keyboard.press('a');p.wait_for_timeout(600);p.clock.run_for(1)
 centers=p.evaluate('''()=>{const ring=document.querySelector('.battle-emblem .target-ring').getBoundingClientRect();return {target:ring.y+ring.height/2,units:[...document.querySelectorAll('.map-unit-position[data-combat-side] .troop-token')].map(n=>{const b=n.getBoundingClientRect();return b.y+b.height/2;})}}''');assert centers['units'] and all(abs(y-centers['target'])<2 for y in centers['units']),centers
 p.screenshot(path=str(ROOT/'docs/v57-vs-212.png'),animations='disabled',timeout=120000);p.keyboard.press('a')
 seek(p,"()=>document.querySelector('.map-stage').dataset.kind==='capture'&&document.querySelector('[data-front-wave]')")
 p.keyboard.press('a');p.wait_for_timeout(400);p.clock.run_for(1)
 p.evaluate('''()=>{const n=document.querySelector('[data-front-wave]'),i=n.dataset.frontWave,cell=document.querySelectorAll('.atlas-cell')[Number(i)].querySelector('.atlas-territory'),b=cell.getBBox(),points=[];for(let y=1;y<15;y++)for(let x=1;x<15;x++){const p=new DOMPoint(b.x+b.width*x/15,b.y+b.height*y/15);if(cell.isPointInFill(p))points.push(p);}window.waveProbe={node:n,points,previous:points.map(()=>false)};}''')
 stable=p.locator('.atlas-map').get_attribute('viewBox');p.keyboard.press('a');frames=0;shot=False
 for _ in range(150):
  if p.locator('.map-stage').get_attribute('data-kind')!='capture':break
  assert p.locator('.atlas-map').get_attribute('viewBox')==stable
  assert p.locator('.atlas-art-surface').get_attribute('viewBox')==stable
  facts=p.evaluate('''()=>{const p=waveProbe,now=p.points.map(v=>p.node.isPointInFill(v)),lost=now.some((v,i)=>p.previous[i]&&!v);p.previous=now;return {lost,progress:Number(p.node.dataset.waveProgress)}}''');assert not facts['lost'],facts
  if not shot and facts['progress']>.3:p.keyboard.press('a');p.screenshot(path=str(ROOT/'docs/v57-capture-212.png'),animations='disabled',timeout=120000);p.keyboard.press('a');shot=True
  p.clock.run_for(8);frames+=1
 assert frames>=5 and shot,frames
 for _ in range(100):
  kind=p.locator('.map-stage').get_attribute('data-kind');event=p.locator('.map-stage').get_attribute('data-event')
  if event=='roster' and kind=='apply' and p.locator('.map-unit-position[data-outcome=appointment]').count():stable=p.locator('.atlas-map').get_attribute('viewBox')
  elif event in ['hold','roster','war_recovery','season_recovery','production_settlement','desertion']:assert p.locator('.atlas-map').get_attribute('viewBox')==stable,(kind,event)
  if p.locator('.map-stage').get_attribute('data-finished')=='true':break
  p.clock.run_for(16)
 print('PASS actual160 map at212%: VS centered, capture monotonic, aligned map surfaces, no post-capture administrative camera hops',flush=True);p.close()
 for speed in [2,4,8]:
  p=open_game(c,ROOT/'.artifacts/v56-army.history.json');p.locator('#sim-speed').select_option(str(speed));p.locator('.history-entry[data-id="1"]').click();p.locator('[data-action=map-fullscreen]').click();p.evaluate('document.activeElement?.blur()')
  if p.locator('.map-follow-toggle').get_attribute('aria-pressed')!='true':p.keyboard.press('s')
  seek(p,"()=>!!document.querySelector('.entry-territory-name')");p.clock.run_for(20)
  assert p.locator('.map-unit-position[data-army-group][data-combat-side]').count()==2
  if speed==2:
   p.clock.run_for(350);p.screenshot(path=str(ROOT/'docs/v57-entry.png'),animations='disabled',timeout=120000)
  seek(p,"()=>!!document.querySelector('.mass-battle')");p.keyboard.press('a');p.wait_for_timeout(900);p.clock.run_for(1)
  assert p.locator('.mass-surface').evaluate('n=>getComputedStyle(n).backgroundImage.includes("data:image/webp;base64,")')
  assert p.locator('.mass-battle').evaluate('n=>getComputedStyle(n).borderImageSource.includes("data:image/png;base64,")')
  assert p.locator('[data-mass-canvas]').evaluate('n=>n.getContext("2d").getImageData(0,0,1,1).data[3]===0'),'opaque old ground hides new meadow'
  p.keyboard.press('a');p.wait_for_timeout(400);p.clock.run_for(1);p.keyboard.press('a');p.wait_for_timeout(500)
  assert p.evaluate('audioProbe.some(a=>a.loop&&a.rate===1)'),p.evaluate('audioProbe')
  p.keyboard.press('a');p.clock.run_for(round(3000/speed));p.keyboard.press('a');p.wait_for_timeout(500);p.clock.run_for(1)
  p.screenshot(path=str(ROOT/f'docs/v57-battle-{speed}x.png'),animations='disabled',timeout=120000)
  assert p.locator('.mass-command.is-active').count()>=1
  p.locator('[data-action=mass-skip]').click();p.locator('[data-action=mass-map]').click();expect(p.locator('.map-stage')).to_have_attribute('data-batch-retreat','true')
  p.clock.run_for(1);count=p.locator('.map-unit-position[data-motion-pin]').count();assert count>=2
  previous=None
  if p.locator('.map-stage').get_attribute('data-playing')!='true':p.keyboard.press('a')
  capture_seen=False
  for _ in range(200):
   kind=p.locator('.map-stage').get_attribute('data-kind')
   if p.locator('.map-stage').get_attribute('data-batch-retreat')=='true':
    pins=p.locator('[data-motion-pin]').evaluate_all('ns=>Object.fromEntries(ns.map(n=>[n.dataset.person,{point:n.dataset.motionPin.split(",").map(Number),opacity:Number(n.querySelector(".clock-marching")?.style.opacity||1)}]))')
    if previous:
     for key,point in pins.items():
      if key in previous and point['opacity']>.15 and previous[key]['opacity']>.15:assert sum((a-b)**2 for a,b in zip(point['point'],previous[key]['point']))**.5<25,(key,point,previous[key])
    previous=pins
   if kind=='capture':capture_seen=True
   if p.locator('.map-stage').get_attribute('data-finished')=='true':break
   p.clock.run_for(16)
  assert capture_seen
  assert all(a['rate']==1 for a in p.evaluate('audioProbe'))
  assert not errors,errors;p.close();print(f'PASS{speed}x: embedded theme, transparent canvas, actual pitch1 loops, concurrent retreat, no reactive displacement and sequential capture',flush=True)
 b.close()
