"""Check actual compact800x500 UI through every real-record tactical change."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/v59-tactics';OUT.mkdir(exist_ok=True)
class QuietHandler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start();errors=[];rows=[]
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':1100,'height':650},device_scale_factor=1)
  for kind in ['normal','advance','counter','death']:
   p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.goto(f'http://127.0.0.1:{server.server_port}/tests/tactical-v59-demo.html?id={kind}&compact=1');p.wait_for_function('window.ready===true',timeout=90000)
   phases=p.evaluate('harness.plan.story.phases');transitions=[]
   for phase in phases:
    p.evaluate('(t)=>harness.seek(t)',phase['at']+1);p.wait_for_timeout(40)
    assert p.locator('[data-current-tactic]').inner_text()==phase['name']
    assert p.locator('[data-tactic-reason]').inner_text()==phase['reason']
    orders=p.locator('[data-mass-command] [data-command-text]').all_inner_texts()
    assert len(orders)==2 and orders[0] and orders[1] and orders[0]!=orders[1],orders
    if phase['changed']:assert '전술 변경' in p.locator('[data-tactic-change]').inner_text()
    assert p.locator('.mass-battle').evaluate('n=>n.getBoundingClientRect().width')==800
    assert p.locator('.mass-field').evaluate('n=>n.getBoundingClientRect().height')>=270
    transitions.append({'tactic':phase['name'],'reason':phase['reason'],'trigger':phase['trigger'],'attack':orders[0],'defense':orders[1]})
   changed=next((phase for phase in phases if phase['changed']),phases[0]);p.evaluate('(t)=>harness.seek(t)',changed['at']+300);p.wait_for_timeout(500);p.screenshot(path=str(OUT/f'{kind}-orders.jpg'),type='jpeg',quality=88)
   for r in p.evaluate('harness.plan.story.reveals.filter(r=>r.kind==="territory")'):
    for offset,expected in [(-1,r['from']),(1,r['to'])]:
     actual=p.evaluate('(v)=>harness.sample(v.at).owners.get(v.id)',{'at':r['at']+offset,'id':r['id']});assert actual==expected
   rows.append({'kind':kind,'transitions':transitions,'fixedPanel':[800,500]});p.close();print('PASS compact real record',kind,len(transitions),'command stages',flush=True)
  assert not errors,errors;c.close();b.close()
 (ROOT/'docs/v59-orders-browser.json').write_text(json.dumps({'cases':rows,'pageErrors':errors},ensure_ascii=False,indent=2))
finally:server.shutdown()
