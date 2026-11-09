"""Measure both actual RAF and actual Canvas redraws, with no virtual clock."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,statistics
ROOT=Path(__file__).resolve().parents[1];results=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':1280,'height':760},device_scale_factor=1);p=c.new_page();p.goto('http://127.0.0.1:8765/tests/tactical-v57-demo.html?id=pressure');p.wait_for_function('window.ready===true');p.wait_for_timeout(1000)
 for speed in [1,4,8]:
  p.evaluate('(speed)=>{harness.play(false);harness.speed(speed);harness.seek(3000);harness.play(true)}',speed);p.wait_for_timeout(1500);p.evaluate('rafFrames.length=0;window.drawBaseline=harness.renderer.drawCount;window.perfStart=performance.now()');p.wait_for_timeout(3000 if speed==8 else 8000)
  data=p.evaluate('({frames:rafFrames.slice(),draws:harness.renderer.drawCount-drawBaseline,elapsed:performance.now()-perfStart})');frames=data.pop('frames');results.append({'speed':speed,**data,'meanRafFps':1000/statistics.mean(frames),'canvasDrawFps':data['draws']*1000/data['elapsed'],'medianFrameMs':statistics.median(frames),'p95FrameMs':sorted(frames)[int(len(frames)*.95)]});print(results[-1],flush=True)
 c.close();b.close()
 path=ROOT/'docs/v57-visual-results.json';data=json.loads(path.read_text());data['postOptimizationPerformance']={'environment':'Linux container / headless Chromium /1280x760 /DPR1 /960 initial figures / no recording / real wall time', 'runs':results};path.write_text(json.dumps(data,ensure_ascii=False,indent=2))
