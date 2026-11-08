"""Offline real recorded battle: sprites, pause, battlefield-anchored cutout and camera."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
errors=[];failed=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':1600,'height':1000},device_scale_factor=float(os.getenv('STUDIO_DPR','1')));c.route('**/game.html',lambda r:r.fulfill(status=200,content_type='text/html',path=str(ROOT/'dist/사국쟁패 Studio.html')));c.set_offline(True)
 page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda r:failed.append(r.url) if not r.url.startswith('blob:') else None)
 page.goto('http://127.0.0.1:3000/game.html',wait_until='networkidle',timeout=120000);expect(page.locator('.page-footer')).to_contain_text('v0.51.1',timeout=90000)
 page.locator('#world-file').set_input_files(str(ROOT/'.artifacts/v47-honor.history.json'));expect(page.locator('[data-import-confirm]')).to_be_enabled(timeout=90000);page.locator('[data-import-confirm]').click();expect(page.locator('#file-import-dialog')).not_to_be_visible(timeout=90000)
 page.locator('#sim-speed').select_option('16');page.clock.install(time=0);page.clock.pause_at(1000);page.locator('.history-entry[data-id="1"]').click();page.locator('[data-action=map-fullscreen]').click();page.evaluate('document.activeElement?.blur()');page.keyboard.press('s')
 for i in range(4000):
  if page.locator('.battlefield-honor').count():break
  page.clock.run_for(10)
 else:raise AssertionError('No honor shown '+str(errors))
 page.clock.run_for(200);page.keyboard.press('a');page.wait_for_timeout(600);page.clock.run_for(1)
 assert page.locator('canvas[data-troop-action]').count()>0
 painted=page.locator('canvas[data-troop-action]').evaluate_all('nodes=>nodes.filter(n=>{const a=n.getContext("2d").getImageData(0,0,n.width,n.height).data;return a.some((v,i)=>i%4===3&&v>0)}).length')
 assert painted>0, 'sprites are transparent'
 sizes=page.locator('canvas[data-troop-soldiers]').evaluate_all('nodes=>nodes.filter(n=>{const r=n.getBoundingClientRect();return r.left>0&&r.right<innerWidth&&r.top>0&&r.bottom<innerHeight}).map(n=>({w:n.width,target:Math.ceil(n.getBoundingClientRect().width*devicePixelRatio)}))')
 assert sizes and all(abs(n['w']-n['target'])<=1 for n in sizes),sizes
 geometry=page.locator('.map-unit-position:has(canvas[data-troop-action])').evaluate_all('''nodes=>nodes.map(n=>{const caption=n.querySelector('.commander-caption'),body=n.querySelector('.unit-focal-body'),card=caption.querySelector('.map-unit-token').getBoundingClientRect(),foot=new DOMPoint(0,35).matrixTransform(body.getScreenCTM());return {bottom:card.bottom,foot:foot.y,transform:caption.getAttribute('transform'),text:caption.textContent}})''')
 assert geometry and all(g['bottom']<g['foot'] for g in geometry),geometry
 assert all('scale(0.75)' in g['transform'] for g in geometry),geometry
 assert any('만' in g['text'] for g in geometry)
 page.screenshot(path=str(ROOT/'docs/v511-honor.png'))
 badge=page.locator('.battlefield-honor');assert badge.locator('.honor-hero').count()==1;assert '3배 병력 격파' in badge.inner_text();assert page.locator('.map-stage').get_attribute('data-effective-speed')=='1'
 def alignment():
  return page.evaluate('''()=>{const a=document.querySelector('.battlefield-honor'),svg=document.querySelector('.atlas-map'),stage=document.querySelector('.map-stage'),[x,y]=a.dataset.victoryAnchor.split(',').map(Number),p=new DOMPoint(x,y).matrixTransform(svg.getScreenCTM()),r=stage.getBoundingClientRect();return Math.abs(parseFloat(a.style.left)-(p.x-r.left))}''')
 assert alignment()<1
 before=badge.get_attribute('style');page.keyboard.press('ArrowRight');assert alignment()<1;assert badge.get_attribute('style')!=before
 snapshot=page.locator('canvas[data-troop-action]').first.evaluate('c=>c.toDataURL()');page.clock.run_for(700);assert page.locator('canvas[data-troop-action]').first.evaluate('c=>c.toDataURL()')==snapshot
 page.screenshot(path=str(ROOT/'docs/v511-battle-layout.png'))
 page.keyboard.press('a');page.clock.run_for(990);assert page.locator('.battlefield-honor').count()==1;page.clock.run_for(20);assert page.locator('.battlefield-honor').count()==0
 page.keyboard.press('a');page.screenshot(path=str(ROOT/'docs/v511-battle-layout.png'))
 page.keyboard.press('Escape');page.locator('[data-action=return-live]').click()
 # Complete-state unit layout remains visible at 500% zoom and supports inspection.
 page.locator('[data-action=map-fullscreen]').click();page.evaluate('document.activeElement?.blur()')
 anchor=page.locator('.map-unit-token').evaluate_all('nodes=>{const rows=nodes.map(n=>n.getBoundingClientRect()).filter(r=>r.left>0&&r.right<innerWidth&&r.top>100&&r.bottom<innerHeight-100).sort((a,b)=>Math.hypot(a.x+a.width/2-innerWidth/2,a.y+a.height/2-innerHeight/2)-Math.hypot(b.x+b.width/2-innerWidth/2,b.y+b.height/2-innerHeight/2));return rows.length?[rows[0].x+rows[0].width/2,rows[0].y+rows[0].height/2]:null}')
 assert anchor
 for _ in range(12):page.mouse.move(*anchor);page.mouse.wheel(0,-160);page.clock.run_for(50)
 expect(page.locator('.atlas-scroll')).to_have_attribute('data-zoom','5')
 point=page.locator('.map-unit-token').evaluate_all('nodes=>{const n=nodes.find(n=>{const r=n.getBoundingClientRect();return r.left>0&&r.right<innerWidth&&r.top>0&&r.bottom<innerHeight});if(!n)return null;const r=n.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}')
 assert point, 'No visible commander at500%'
 page.mouse.click(*point);expect(page.locator('[data-commander-overview]')).to_be_visible()
 page.screenshot(path=str(ROOT/'docs/v511-inspection-500.png'))
 assert not errors,errors;assert not failed,failed;b.close();print('PASS offline sprites painted, pause, real upset cutout, geographic camera anchoring and fixed 1.2s honor at16x; no page errors')
