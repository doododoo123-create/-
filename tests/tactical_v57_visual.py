"""Real-clock screenshots/video/RAF evidence; no fake-clock FPS claims."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,statistics
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/v57-tactics';OUT.mkdir(exist_ok=True);errors=[];evidence=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':1280,'height':760},device_scale_factor=1)
 for row in json.loads((ROOT/'.artifacts/v57/demos/index.json').read_text()):
  p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.goto('http://127.0.0.1:8765/tests/tactical-v57-demo.html?id='+row['id']);p.wait_for_function('window.ready===true',timeout=90000)
  positions=[]
  for i,at in enumerate([row['start']+300,(row['start']+row['contact'])/2,row['contact']+400,row['resolve']+800]):
   p.evaluate('(t)=>harness.seek(t)',at);p.wait_for_timeout(500);positions.append(p.evaluate('(t)=>harness.sample(t).groups.map(g=>[g.id,Math.round(g.x),Math.round(g.y),g.action])',at));p.screenshot(path=str(OUT/f'{row["id"]}-{i+1}.jpg'),type='jpeg',quality=80)
  assert len({json.dumps(x)for x in positions})>=3,row['id'];evidence.append({**row,'distinctStates':len({json.dumps(x)for x in positions})});p.close();print('PASS',row['id'],flush=True)
 p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.goto('http://127.0.0.1:8765/tests/tactical-v57-demo.html?id=roundtrip');p.wait_for_function('window.ready===true');transitions=p.evaluate('harness.plan.story.reveals.filter(r=>r.kind==="territory")');assert len(transitions)>=2
 for i,r in enumerate(transitions):
  for side,offset in [('before',-1),('after',1)]:
   p.evaluate('(t)=>harness.seek(t)',r['at']+offset);p.wait_for_timeout(150);state=p.evaluate('(t)=>Object.fromEntries(harness.sample(t).owners)',r['at']+offset);assert state[r['id']]==(r['from']if side=='before'else r['to']);p.screenshot(path=str(OUT/f'roundtrip-{i}-{side}.jpg'),type='jpeg',quality=80)
 assert p.evaluate('harness.plan.gained===0&&harness.plan.lost===0');p.close();c.close()
 # A genuine continuous recording, measured with real RAF timestamps.
 c=b.new_context(viewport={'width':1280,'height':760},device_scale_factor=1,record_video_dir=str(ROOT/'.artifacts/v57/video'),record_video_size={'width':1280,'height':760});p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.goto('http://127.0.0.1:8765/tests/tactical-v57-demo.html?id=pressure');p.wait_for_function('window.ready===true');p.wait_for_timeout(2000);p.evaluate('harness.seek(0);harness.play(true);rafFrames.length=0;window.drawBaseline=harness.renderer.drawCount');p.wait_for_timeout(45000)
 frames=p.evaluate('rafFrames.slice(90)');stats={'environment':'headless Chromium / Linux container /1280x760 /DPR1 / real RAF /960 initial figures','samples':len(frames),'medianFrameMs':statistics.median(frames),'p95FrameMs':sorted(frames)[int(len(frames)*.95)],'meanRafFps':1000/statistics.mean(frames),'canvasDrawFps':p.evaluate('(harness.renderer.drawCount-drawBaseline)/45'),'errors':errors};video=p.video;video_path=video.path();c.close();video.save_as(str(ROOT/'docs/v57-continuous.webm'));b.close()
 assert not errors,errors
 (ROOT/'docs/v57-visual-results.json').write_text(json.dumps({'policies':evidence,'performance':stats,'ownershipTransitions':transitions},ensure_ascii=False,indent=2));print(json.dumps(stats),flush=True)
