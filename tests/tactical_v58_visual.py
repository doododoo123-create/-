"""Production canvas, real-clock browser acceptance for the three requested army sizes."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
import json, os

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/v58-tactics';OUT.mkdir(exist_ok=True)
class QuietHandler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH','/workspace/.cache/playwright')
errors=[];evidence=[]
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  c=b.new_context(viewport={'width':1280,'height':760},device_scale_factor=1,record_video_dir=str(ROOT/'.artifacts/v58/video'),record_video_size={'width':1280,'height':760})
  for row in json.loads((ROOT/'.artifacts/v58/index.json').read_text()):
   p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)))
   p.goto(f'http://127.0.0.1:{server.server_port}/tests/tactical-v58-demo.html?id='+row['id'])
   p.wait_for_function('window.ready===true',timeout=90000)
   facts=p.evaluate('''()=>{const p=harness.plan;let simultaneous=0,at=0,moving=0,overlaps=0;for(let t=0;t<p.baseDuration;t+=83){const s=harness.sample(t);if(s.contacts.length>simultaneous){simultaneous=s.contacts.length;at=t;}const gs=s.groups.filter(g=>g.visible&&g.figures>0);for(let i=0;i<gs.length;i++){const a=gs[i];for(let j=0;j<i;j++){const b=gs[j];if(Math.abs(a.x-b.x)<(a.footprint.width+b.footprint.width)/2-.1&&Math.abs(a.y-b.y)<(a.footprint.height+b.footprint.height)/2-.1)overlaps++;}if(a.contactId&&a.motion&&a.motion.cellFrom!==a.motion.cellTo)moving++;}}return {initialFigures:harness.sample(0).groups.reduce((n,g)=>n+g.figures,0),simultaneous,at,moving,overlaps,height:p.height,final:harness.sample(p.baseDuration).units.map(u=>({id:u.id,troops:u.troops,alive:u.alive,expected:p.after.people.find(a=>a.id===u.id).troops})),losses:p.losses};}''')
   assert facts['initialFigures']==row['initialFigures'],facts
   assert facts['overlaps']==0 and facts['moving']>0 and facts['height']==760,facts
   assert all(u['troops']==u['expected'] for u in facts['final']),facts
   if row['id']!='one':assert facts['simultaneous']>=2,facts
   p.evaluate('(t)=>harness.seek(t)',facts['at']+100);p.wait_for_timeout(600)
   p.screenshot(path=str(OUT/f'{row["id"]}-contact.jpg'),type='jpeg',quality=85)
   p.evaluate('harness.seek(0);harness.speed(2);harness.play(true)')
   p.wait_for_function('harness.time>=harness.plan.duration',timeout=120000)
   p.wait_for_timeout(300)
   p.screenshot(path=str(OUT/f'{row["id"]}-final.jpg'),type='jpeg',quality=85)
   video=p.video;p.close();video.save_as(str(ROOT/f'.artifacts/v58/{row["id"]}-continuous.webm'))
   evidence.append({**row,**facts,'realClockPlaybackSpeed':2,'completed':True})
   print('PASS real browser:',row['label'],'figures',facts['initialFigures'],'concurrent',facts['simultaneous'],'overlaps',facts['overlaps'],flush=True)
  assert not errors,errors
  c.close();b.close()
 (ROOT/'docs/v58-browser-results.json').write_text(json.dumps({'cases':evidence,'pageErrors':errors},ensure_ascii=False,indent=2))
finally:server.shutdown()
