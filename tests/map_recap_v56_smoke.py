"""Actual army campaign at212%: map transitions remain ordered and bystanders stay put."""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import json,subprocess
ROOT=Path(__file__).resolve().parents[1]
if not (ROOT/'.artifacts/v56-campaign.history.json').exists():subprocess.run(['node','tests/make-v56-fixture.mjs'],cwd=ROOT,check=True)
f=json.loads((ROOT/'.artifacts/v56-campaign.history.json').read_text());record=f['history'][-1];errors=[]
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':1600,'height':1000},device_scale_factor=2);c.route('**/recap56',lambda r:r.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist/사국쟁패 Studio.html')));c.set_offline(True);p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)))
 p.goto('http://localhost:3000/recap56',wait_until='networkidle',timeout=120000);expect(p.locator('.page-footer')).to_contain_text('v0.56.0',timeout=90000);p.locator('#world-file').set_input_files(str(ROOT/'.artifacts/v56-campaign.history.json'));expect(p.locator('[data-import-confirm]')).to_be_enabled(timeout=90000);p.locator('[data-import-confirm]').click();expect(p.locator('#file-import-dialog')).not_to_be_visible(timeout=90000);p.locator('#sim-speed').select_option('4');p.clock.install(time=0);p.clock.pause_at(1000);p.locator(f'.history-entry[data-id="{record["turn"]}"]').click();p.locator('[data-action=map-fullscreen]').click();p.evaluate('document.activeElement?.blur()')
 if p.locator('.map-follow-toggle').get_attribute('aria-pressed')!='true':p.keyboard.press('s')
 for _ in range(2):p.locator('.atlas-scroll').dispatch_event('wheel',{'deltaY':-150.5666,'clientX':800,'clientY':500,'bubbles':True});p.clock.run_for(20)
 for _ in range(1600):
  if p.locator('.mass-battle').count():break
  p.clock.run_for(50)
 else:raise AssertionError('no actual army campaign')
 p.locator('[data-action=mass-skip]').click();p.locator('[data-action=mass-map]').click()
 expect(p.locator('.map-zoom-status')).to_contain_text('212%');expect(p.locator('.map-stage')).to_have_attribute('data-batch-retreat','true')
 p.wait_for_timeout(500);p.clock.run_for(1);previous=None;seen=set();captured=set();waves_seen=[];shot=False
 for _ in range(650):
  facts=p.evaluate('''()=>{const root=document.querySelector('.map-stage'),svg=root.querySelector('.atlas-map'),inverse=svg.getScreenCTM().inverse();return {event:root.dataset.event,kind:root.dataset.kind,battle:root.dataset.battleIndex,finished:root.dataset.finished,captured:[...root.querySelectorAll('[data-round-capture]')].map(n=>n.dataset.roundCapture),waves:[...root.querySelectorAll('[data-front-wave]')].map(n=>({order:Number(n.dataset.waveOrder),progress:Number(n.dataset.waveProgress)})),units:[...root.querySelectorAll('.map-unit-position')].flatMap(n=>{const token=n.querySelector('.troop-token');if(!token)return [];const rect=token.getBoundingClientRect(),p=new DOMPoint(rect.x+rect.width/2,rect.y+rect.height/2).matrixTransform(inverse),motion=n.querySelector('.clock-marching');return [{id:n.dataset.person,camp:n.dataset.camp,x:p.x,y:p.y,moving:!!motion,opacity:motion?Number(motion.style.opacity||1):1}];})}}''')
  signature=(facts['kind'],facts['battle'],facts['event']);seen.add(signature)
  assert captured.issubset(set(facts['captured'])),('lost hatch before season',captured,facts['captured']);captured.update(facts['captured'])
  if facts['waves']:
   waves_seen.append(facts['waves'])
   for wave in facts['waves']:
    if wave['order']>0 and wave['progress']>0:assert all(v['progress']==1 for v in facts['waves'] if v['order']<wave['order']),facts['waves']
  if previous:
   old={u['id']:u for u in previous['units']}
   for u in facts['units']:
    v=old.get(u['id'])
    if v and v['camp']==u['camp'] and not v['moving'] and not u['moving']:
     assert ((u['x']-v['x'])**2+(u['y']-v['y'])**2)**.5<.3,('bystander displaced',u,v)
  if not shot and facts['kind']=='capture' and len(captured)>=3:p.keyboard.press('a');p.screenshot(path=str(ROOT/'docs/v56-campaign-212.png'),animations='disabled',timeout=120000);p.keyboard.press('a');shot=True
  if facts['finished']=='true':break
  previous=facts;p.clock.run_for(20)
 assert facts['finished']=='true';assert captured=={x['territoryId'] for x in record['changes']},(captured,record['changes']);assert len([s for s in seen if s[0]=='capture'])>=3;assert waves_seen and shot;assert not errors,errors
 b.close();print('PASS actual212% army campaign,DPR2,4x: simultaneous retreat, sequential occupation including unopposed advance, five retained hatches, no bystander jumps, final map and multi-territory wave order')
