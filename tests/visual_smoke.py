"""End-to-end checks for portraits, map overlays, scene timing and recording layout."""
from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.artifacts';OUT.mkdir(exist_ok=True)
passed=[];errors=[]
def success(label):
    print('PASS:',label,flush=True);passed.append(label)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1600,'height':1000},accept_downloads=True)
    page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
    page.goto(os.environ.get('STUDIO_TEST_URL','http://127.0.0.1:3000'),wait_until='networkidle')
    page.locator('nav [data-page="simulation"]').click()
    expect(page.locator('.atlas-map')).to_have_count(1)
    expect(page.locator('.map-country-token')).to_have_count(7)
    assert page.locator('img').evaluate_all('(imgs)=>imgs.every(i=>i.complete&&i.naturalWidth>0)')
    page.screenshot(path=str(OUT/'visual-ready.png'),full_page=True)
    success('원본 초상화와 대륙 지도·7개 국가 병력 카드가 실제 이미지로 표시됨')

    page.locator('[data-action="step"]').click()
    expect(page.locator('.arena-panel')).to_have_attribute('data-phase','rolling')
    expect(page.locator('.pending-entry')).to_have_count(1)
    expect(page.locator('.scene-result')).to_have_count(0)
    expect(page.locator('.visual-die[data-die-locked="true"]')).to_have_count(0)
    page.locator('[data-action="auto"]').click()
    phase=page.locator('.arena-panel').get_attribute('data-phase')
    page.wait_for_timeout(1300)
    assert page.locator('.arena-panel').get_attribute('data-phase')==phase
    assert page.locator('.visual-die').evaluate('(el)=>getComputedStyle(el).animationPlayState')=='paused'
    page.locator('[data-action="auto"]').click()
    expect(page.locator('.arena-panel')).to_have_attribute('data-phase','locked',timeout=2500)
    page.locator('[data-action="auto"]').click()
    expect(page.locator('.history-entry')).to_have_count(1)
    page.locator('[data-action="scene-skip"]').click()
    expect(page.locator('.scene-result')).to_be_visible()
    expect(page.locator('.pending-entry')).to_have_count(0)
    page.wait_for_timeout(900)
    expect(page.locator('.history-entry')).to_have_count(1)
    success('실제 주사위 시간 진행, 미공개 결과 숨김, 중간 정지·재개·결과 건너뛰기')

    fixture=page.evaluate('''async()=>{
      const {createDemoWorld}=await import('/src/data/demo-world.js');
      const {createRun,nextTurn}=await import('/src/engine/simulation.js');
      const world=createDemoWorld();world.rules.domesticThresholds={balanced:0,peaceful:0,aggressive:0};
      for(let seed=0;seed<100;seed++) {const run=nextTurn(createRun(world,String(seed)));const r=run.history[0];
        if(r.battle&&r.success) { localStorage.setItem('saguk-studio.world.v1',JSON.stringify({kind:'saguk-studio-world',version:1,world}));return {seed:String(seed),record:r,after:run.world};}
      }throw Error('Missing winning battle fixture');
    }''')
    page.reload(wait_until='networkidle');page.locator('nav [data-page="simulation"]').click();page.locator('#sim-seed').fill(fixture['seed'])
    page.locator('[data-action="scene-step"]').click() # load action, paused
    expect(page.locator('.arena-panel')).to_have_attribute('data-scene','action')
    expect(page.locator('.map-campaign')).to_have_count(0)
    page.locator('[data-action="scene-step"]').click() # lock action
    page.locator('[data-action="scene-step"]').click() # target
    expect(page.locator('.arena-panel')).to_have_attribute('data-scene','target')
    expect(page.locator('.campaign-route.attack')).to_have_count(1)
    expect(page.locator('.campaign-route.defense')).to_have_count(1)
    expect(page.locator('.battle-target')).to_have_count(1)
    expect(page.locator('.visual-die[data-die-locked="true"]')).to_have_count(0)
    page.locator('[data-action="scene-step"]').click() # attack rolling
    page.locator('[data-action="scene-step"]').click() # attack locked
    expect(page.locator('.visual-die[data-die-locked="true"]')).to_have_count(1)
    page.locator('[data-action="scene-step"]').click() # defense rolling
    page.locator('[data-action="scene-step"]').click() # defense locked
    expect(page.locator('.visual-die[data-die-locked="true"]')).to_have_count(2)
    assert page.locator('.die-equation>strong').evaluate_all('(els)=>els.every(el=>getComputedStyle(el).opacity==="1")')
    expect(page.locator('.scene-result')).to_have_count(0)
    page.screenshot(path=str(OUT/'visual-battle-dice.png'),full_page=True)
    page.locator('[data-action="scene-step"]').click() # result
    expect(page.locator('.battle-losses')).to_be_visible()
    expect(page.locator('.scene-result')).to_contain_text(fixture['record']['title'])
    assert page.locator('.scene-result').evaluate('(el)=>getComputedStyle(el).opacity')=='1'
    expect(page.locator('.captured')).to_have_count(1)
    expect(page.locator('.army-delta')).to_have_count(2)
    target=fixture['record']['targetId'];actor=next(c for c in fixture['after']['countries'] if c['id']==fixture['record']['actorId'])
    expect(page.locator(f'[data-territory="{target}"]')).to_have_attribute('title',f"{fixture['record']['targetName']} · {actor['name']}")
    page.screenshot(path=str(OUT/'visual-battle-result.png'),full_page=True)
    success('공격·방어 경로와 목표 강조, 양쪽 주사위 순차 공개, 실제 점령·손실·병력 변화 표시')

    page.locator('[data-action="scene-skip"]').click()
    page.locator('#map-style').select_option('grid');expect(page.locator('.territory-grid')).to_have_count(1)
    page.locator('#map-style').select_option('atlas');expect(page.locator('.atlas-map')).to_have_count(1)
    page.locator('.visual-nation-card').last.click()
    expected_country=page.locator('.visual-nation-card').last.get_attribute('data-id')
    expect(page.locator('.visual-nation-card.active')).to_have_attribute('data-id',expected_country)
    success('격자·대륙 표시 전환과 국가 선택·지휘부 연결')

    page.locator('nav [data-page="people"]').click()
    page.locator('.person-card [data-action="edit-person"]').first.click()
    dialog=page.locator('#editor-dialog');dialog.locator('[name="portraitKey"][value="n2-minister"]').check()
    person_id=page.locator('.person-card').first.locator('[data-action="edit-person"]').first.get_attribute('data-id')
    expected_src=dialog.locator('[name="portraitKey"][value="n2-minister"]+img').get_attribute('src')
    dialog.locator('button[type="submit"]').click()
    expect(page.locator('.person-card .photo-avatar img').first).to_have_attribute('src',expected_src)
    saved=page.evaluate("JSON.parse(localStorage.getItem('saguk-studio.world.v1')).world")
    assert next(p for p in saved['people'] if p['id']==person_id)['portraitKey']=='n2-minister'
    page.reload(wait_until='networkidle');page.locator('nav [data-page="people"]').click()
    expect(page.locator('.person-card .photo-avatar img').first).to_have_attribute('src',expected_src)
    success('인물 초상화 선택과 저장·새로고침 복구')

    page.locator('nav [data-page="simulation"]').click()
    page.locator('[data-action="recording"]').click()
    for width,height in [(1920,1080),(1366,768)]:
      page.set_viewport_size({'width':width,'height':height})
      assert page.evaluate('document.documentElement.scrollHeight<=innerHeight'),f'recording height {width}'
      assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'recording width {width}'
      expect(page.locator('.arena-panel')).to_be_visible()
      expect(page.locator('.atlas-map')).to_be_visible()
      if width==1920:page.screenshot(path=str(OUT/'visual-recording-1920.png'),full_page=True)
    page.keyboard.press('Escape');page.set_viewport_size({'width':390,'height':844})
    assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
    page.screenshot(path=str(OUT/'visual-mobile.png'),full_page=True)
    success('1920×1080·1366×768 녹화 화면 맞춤, Esc 복귀, 모바일 가로 넘침 없음')

    page.set_viewport_size({'width':1600,'height':1000})
    elimination=page.evaluate('''async()=>{
      const {createDemoWorld}=await import('/src/data/demo-world.js');const {blankWorld}=await import('/src/model/world.js');
      const base=createDemoWorld(),world=blankWorld({name:'멸망 연출 검증',rows:2,cols:2});world.countries=base.countries.slice(0,2);
      world.people=base.people.filter(p=>world.countries.some(c=>c.id===p.countryId));world.countries[1].troops=0;
      world.territories.forEach((t,i)=>{t.ownerId=i===1?world.countries[1].id:world.countries[0].id;});
      world.rules.domesticThresholds={balanced:0,peaceful:0,aggressive:0};return world;
    }''')
    page.locator('#world-file').set_input_files({'name':'elimination.world.json','mimeType':'application/json','buffer':json.dumps({'kind':'saguk-studio-world','version':1,'world':elimination}).encode()})
    page.locator('nav [data-page="simulation"]').click();page.locator('[data-action="step"]').click();page.locator('[data-action="scene-skip"]').click()
    expect(page.locator('.result-banner')).to_be_visible();expect(page.locator('.fall-announcement')).to_contain_text('적연국 멸망')
    expect(page.locator('.visual-nation-card.eliminated')).to_have_count(1);expect(page.locator('.map-country-token')).to_have_count(1)
    expect(page.locator('.automatic-banner')).to_be_visible();expect(page.locator('[data-action="step"]')).to_be_disabled()
    page.screenshot(path=str(OUT/'visual-elimination.png'),full_page=True)
    success('무방비 점령·국가 멸망·승리 화면과 지도 소유권 동기화')

    assert not errors,errors
    context.close();browser.close()
(OUT/'visual-results.json').write_text(json.dumps({'passed':passed,'errors':errors},ensure_ascii=False,indent=2))
print(f'{len(passed)}개 시각화 시나리오 통과')
