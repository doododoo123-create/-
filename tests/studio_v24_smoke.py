"""Actual offline editions, native Chromium MP3 decode/output, settings and recorded scene audio."""
from pathlib import Path
from urllib.parse import quote
import json,subprocess
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
subprocess.run(['node','tests/make-v22-fixture.mjs'],cwd=ROOT,check=True)
fixture=json.loads((ROOT/'.artifacts/v22-combat-fixture.json').read_text())
manifest=json.loads((ROOT/'assets/sounds/classic-v2/manifest.json').read_text())
hashes={}
for p in (ROOT/'assets/sounds/classic-v2').glob('*.mp3'):
 h=2166136261
 for b in p.read_bytes():h=((h^b)*16777619)&0xffffffff
 hashes[str(h)]=p.stem
probe='''(()=>{const ids=HASHES,buffers=new WeakMap();window.audioProbe={plays:[],decoded:[],contexts:0,peak:0};const Native=window.AudioContext;window.AudioContext=class extends Native{constructor(...args){super(...args);audioProbe.contexts++;const a=this.createAnalyser();a.fftSize=256;audioProbe.context=this;audioProbe.analyser=a;const master=this.createGain.bind(this);this.createGain=()=>{const n=master(),connect=n.connect.bind(n);n.connect=(dest,...rest)=>{if(dest===this.destination)connect(a);return connect(dest,...rest);};return n;};const decode=this.decodeAudioData.bind(this);this.decodeAudioData=(data)=>{let h=2166136261;for(const b of new Uint8Array(data))h=Math.imul(h^b,16777619);const id=ids[String(h>>>0)]||'unknown';return decode(data).then(buffer=>{buffers.set(buffer,id);audioProbe.decoded.push(id);return buffer;});};const source=this.createBufferSource.bind(this);this.createBufferSource=()=>{const node=source(),start=node.start.bind(node);node.start=(...args)=>{audioProbe.plays.push({id:buffers.get(node.buffer),args,scene:{...document.querySelector('.map-stage')?.dataset}});return start(...args);};return node;};}};setInterval(()=>{const a=audioProbe.analyser;if(a){const v=new Float32Array(a.fftSize);a.getFloatTimeDomainData(v);audioProbe.peak=Math.max(audioProbe.peak,...v.map(Math.abs));}},10);})()'''.replace('HASHES',json.dumps(hashes))
errors=[];failed=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--autoplay-policy=user-gesture-required'])
 for mobile in [False,True]:
  name='사국쟁패 Studio 모바일 경량.html' if mobile else '사국쟁패 Studio.html';label='mobile' if mobile else 'normal'
  context=browser.new_context(viewport={'width':844,'height':600} if mobile else {'width':1500,'height':950})
  page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda r:failed.append(r.url));page.on('dialog',lambda d:d.accept());page.add_init_script(probe)
  page.add_init_script('if(!localStorage.getItem("saguk-studio.world.v1")){localStorage.setItem("saguk-studio.world.v1",'+json.dumps(json.dumps(fixture['world']))+');localStorage.setItem("saguk-studio.completed-run.v11",'+json.dumps(json.dumps(fixture['run']))+');}')
  url='http://127.0.0.1:3000/dist/'+quote(name);page.goto(url,wait_until='networkidle');expect(page.locator('.page-footer')).to_contain_text('v0.24.0');assert page.evaluate('audioProbe.contexts')==0
  page.locator('[data-action=sound-settings]').click();expect(page.locator('#sound-dialog')).to_be_visible();page.locator('.sound-library summary').click();assert page.locator('[data-sound-preview]').count()==42
  ids=page.locator('[data-sound-preview]').evaluate_all('els=>els.map(e=>e.dataset.soundPreview)')
  for i,id in enumerate(ids):
   page.locator('[data-sound-preview="'+id+'"]').click();page.wait_for_function('id=>audioProbe.plays.some(p=>p.id===id)',arg=id);page.wait_for_timeout(30)
  assert page.evaluate('new Set(audioProbe.decoded).size')==42
  page.wait_for_function('audioProbe.peak>0.001');assert page.evaluate('audioProbe.contexts')==1
  print(label+': all 42 MP3 native decodes/previews; measured nonzero audio signal',flush=True)
  page.locator('[name=sound-preset]').select_option('recording');page.locator('[name=sound-volume]').fill('42');page.locator('[name=sound-volume]').dispatch_event('input');page.locator('.sound-library summary').click();page.screenshot(path=str(ROOT/f'docs/v24-{label}-sound-settings.png'))
  page.locator('[data-sound-close]').last.click();page.keyboard.press('m');assert page.evaluate('JSON.parse(localStorage.getItem("saguk-studio.sound.v1")).enabled')==False;assert page.locator('[data-action=sound-settings] svg').count()==1;page.keyboard.press('m')
  page.reload(wait_until='networkidle');page.locator('[data-action=sound-settings]').click();expect(page.locator('[name=sound-preset]')).to_have_value('recording');expect(page.locator('[name=sound-volume]')).to_have_value('42');page.locator('[name=sound-preset]').select_option('standard');page.locator('[data-sound-close]').last.click()
  page.locator('nav [data-page=simulation]').click();saved=page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")');page.locator(f'.history-entry[data-id="{fixture["counter"]["turn"]}"]').click();page.locator('[data-action=map-fullscreen]').click();page.locator('.map-sound-toggle').click();expect(page.locator('#sound-dialog')).to_be_visible();assert page.locator('.map-stage').get_attribute('data-playing')=='false';page.locator('[data-sound-close]').last.click()
  # Native audio runs in real time; no mocked playback or AudioContext.
  page.locator('.map-play-toggle').click();page.wait_for_function("audioProbe.plays.some(p=>p.id==='dice_drop_single'&&p.scene.event==='attack_roll')",timeout=90000)
  page.locator('.map-play-toggle').click();count=page.evaluate('audioProbe.plays.length');page.wait_for_timeout(350);assert page.evaluate('audioProbe.plays.length')==count
  page.locator('.map-play-toggle').click();page.wait_for_function("audioProbe.plays.some(p=>p.id==='score_lock')",timeout=30000);page.locator('.map-play-toggle').click();count=page.evaluate('audioProbe.plays.filter(p=>p.id==="score_lock").length');page.locator('.map-play-toggle').click();page.wait_for_timeout(80);page.locator('.map-play-toggle').click();assert page.evaluate('audioProbe.plays.filter(p=>p.id==="score_lock").length')==count
  page.screenshot(path=str(ROOT/f'docs/v24-{label}-battle-audio.png'));assert page.evaluate('localStorage.getItem("saguk-studio.completed-run.v11")')==saved
  page.locator('.map-sound-toggle').click();page.set_viewport_size({'width':390,'height':844});box=page.locator('#sound-dialog').bounding_box();assert box['x']>=0 and box['width']<=390;page.set_viewport_size({'width':844,'height':390});box=page.locator('#sound-dialog').bounding_box();assert box['height']<=390 and box['y']>=0
  page.locator('[data-sound-close]').last.click();page.keyboard.press('Escape');page.locator('[data-action=return-live]').click();page.locator('nav [data-page=overview]').click()
  context.route('**/dist/**',lambda route:route.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist'/name)));context.set_offline(True);page.reload(wait_until='networkidle');page.locator('[data-action=sound-settings]').click();page.locator('.sound-library summary').click();page.locator('[data-sound-preview=dice_land]').click();page.wait_for_function('audioProbe.plays.some(p=>p.id==="dice_land")');context.close()
  print(label+': settings reload, M, fullscreen modal/pause, native recorded battle dice/score, no score replay, live-save isolation, narrow layouts, offline playback passed',flush=True)
 assert not errors,errors;assert not failed,failed;browser.close();print('PASS JavaScript errors and failed asset requests: 0',flush=True)
