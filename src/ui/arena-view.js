import { findCountry, countryPeople, landCount, ROLES, PERSONALITIES } from '../model/world.js';
import { icon, esc, format } from './icons.js';
import { portraitImage } from './portraits.js';
import { leadGeneral } from './playback.js';
const signed = value => value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '+0';
function die(value,sides,rolling=false,label='주사위',bonus=null) {
  const revealed=Number.isInteger(value)&&!rolling;
  const reelStyle=[4,7,2,9,1,6,3].map((face,i)=>`--face-${i+1}:'${1+(face-1)%sides}'`).join(';');
  return `<div class="visual-die-block"><span class="die-caption">${esc(label)}</span><div style="${reelStyle}" class="visual-die ${rolling?'rolling':''} ${revealed?'locked':''}" data-die-locked="${revealed}" aria-label="${esc(label)} ${rolling?'굴리는 중':revealed?`${value} 확정`:'대기'}"><span class="die-corner top"></span><span class="die-number">${revealed?value:'?'}</span>${rolling?'<span class="rolling-number" aria-hidden="true"></span>':''}<small>D${sides}</small><span class="die-corner bottom"></span></div>${revealed&&bonus!==null?`<div class="die-equation"><span>${value}</span><b>${signed(bonus)}</b><span>=</span><strong>${value+bonus}</strong></div>`:'<div class="die-equation waiting-equation">눈금 → 보정 → 최종 점수</div>'}</div>`;
}
function character(person,country,role,compact=false) {
  return `<figure class="scene-portrait ${compact?'compact':''}" style="--nation:${country?.color||'#8b99aa'}">${portraitImage(person,country,role)}<figcaption><small>${esc(country?.name||'무주지')}</small><strong>${esc(person?.name||`${ROLES[role]} 미배치`)}</strong><span>${ROLES[role]}</span></figcaption></figure>`;
}
export function renderArena({world,run,playback}) {
  const state=playback?.state, record=state?.record, scene=playback?.scene;
  const before=state?.before||world, actor=findCountry(before,record?.actorId)||before.countries.find(c=>landCount(before,c.id)>0)||before.countries[0];
  const king=actor?countryPeople(before,actor.id).find(p=>p.role==='king'):null;
  const minister=actor?countryPeople(before,actor.id).find(p=>p.role==='minister'):null;
  const general=actor?leadGeneral(before,actor.id):null;
  const defender=findCountry(before,record?.defenderId), defenderGeneral=defender?leadGeneral(before,defender.id):null;
  const locked=state?.phase==='locked', result=scene?.kind==='result';
  const stageId=scene?.id||'ready';
  const war=record?.type==='war'&&stageId!=='action';
  const title=scene?(locked&&scene.lockedTitle?scene.lockedTitle:scene.title):(actor?`${king?.name||actor.name}의 다음 선택`:'역사의 무대를 준비하세요');
  let content='';
  if(war) {
    const b=record.battle;
    const attackRevealed=result||stageId==='defense'||(stageId==='attack'&&locked);
    const defenseRevealed=result||(stageId==='defense'&&locked);
    const rawA=attackRevealed?b?.attackRaw:null,rawD=defenseRevealed?b?.defenseRaw:null;
    const side=(country,person,isAttack)=>`<div class="duel-side ${isAttack?'attacker':'defender'}"><div class="duel-side-label">${isAttack?'공격군':'수비군'}<span>${format((isAttack?b?.attackBefore:b?.defenseBefore)??country?.troops??0)}만 명</span></div>${country?character(person,country,'general',true):`<div class="neutral-target">${icon('flag',42)}<b>무주지</b></div>`}${b?die(isAttack?rawA:rawD,before.rules.diceSides,state.phase==='rolling'&&stageId===(isAttack?'attack':'defense'),isAttack?'공격 판정':'방어 판정',isAttack?b.attackBonus:b.defenseBonus):'<div class="automatic-label">전투 판정 없음</div>'}${country?`<div class="side-modifiers"><span>장군 ${signed(person?.ability||0)}</span><span>병력 ${signed((isAttack?b?.attackBonus:b?.defenseBonus)-(person?.ability||0)||0)}</span></div>`:''}</div>`;
    content=`<div class="visual-duel">${side(actor,general,true)}<div class="duel-vs"><span>VS</span>${icon('sword',22)}</div>${side(defender,defenderGeneral,false)}</div>${b?`<div class="battle-comparison"><span style="--nation:${actor.color}">${esc(actor.name)}</span><div class="army-comparison-bar"><i style="width:${b.attackBefore/(b.attackBefore+b.defenseBefore)*100}%;background:${actor.color}"></i><i style="flex:1;background:${defender.color}"></i></div><span style="--nation:${defender.color}">${esc(defender.name)}</span></div>`:`<div class="automatic-banner">${icon('flag',19)}${defender?'상대 병력 0 · 전투 없이 점령':'무주지를 국가 영토로 편입'}</div>`}`;
    if(result&&b) content+=`<div class="battle-losses"><div><small>공격군 손실</small><strong>−${b.attackLoss}<span>만</span></strong><p>${b.attackBefore} → ${b.attackBefore-b.attackLoss}만</p></div><div><small>수비군 손실</small><strong>−${b.defenseLoss}<span>만</span></strong><p>${b.defenseBefore} → ${b.defenseBefore-b.defenseLoss}만</p></div></div>`;
  } else {
    const domestic=stageId==='domestic'||(result&&record?.type==='domestic');
    const person=domestic?minister:king,role=domestic?'minister':'king';
    const index=domestic?1:0, raw=(locked||result)?record?.rolls[index]?.value:null;
    content=`<div class="single-judgment">${character(person,actor,role)}${die(raw,before.rules.diceSides,state?.phase==='rolling',domestic?'승상의 실행':'국왕의 행동',domestic?(minister?.ability||0):null)}</div><div class="character-description"><strong>${esc(person?.name||`${ROLES[role]} 미배치`)}<span>${ROLES[role]} · ${domestic?`능력 ${signed(person?.ability||0)}`:PERSONALITIES[person?.personality||actor?.personality||'balanced']}</span></strong><p>${domestic?`${record.action==='recruit'?'모병':'충원 강화'}를 실행합니다. ${before.rules.successTarget}점 이상이면 성공합니다.`:'나라의 다음 행동을 선택합니다. 눈금이 정해지면 내정 또는 전쟁으로 이어집니다.'}</p>${domestic?`<div class="trait-chips"><b>실행 보정 ${signed(minister?.ability||0)}</b><b>성공 기준 ${before.rules.successTarget}점</b></div>`:`<div class="trait-chips"><b>${PERSONALITIES[king?.personality||actor?.personality||'balanced']}</b><b>내정 ${Math.round((before.rules.domesticThresholds[king?.personality||actor?.personality||'balanced']/before.rules.diceSides)*100)}%</b><b>전쟁 ${100-Math.round((before.rules.domesticThresholds[king?.personality||actor?.personality||'balanced']/before.rules.diceSides)*100)}%</b></div>`}</div>`;
  }
  const stages=[{id:'action'},{id:'judgment'},{id:'result'}];
  const progressIndex=stageId==='ready'||stageId==='action'?0:result?2:1;
  const stageNames={action:'행동 선택',judgment:'주사위 판정',result:'결과'};
  return `<section data-scene="${stageId}" data-phase="${state?.phase||'ready'}" data-playing="${!!playback?.playing}" class="panel arena-panel ${result?'showing-result':''}" style="--nation:${actor?.color||'#8b99aa'}"><div class="arena-top"><span class="arena-nation"><i></i>${esc(actor?.name||'새로운 세계')}${actor?'의 차례':''}</span><span>TURN ${String(record?.turn||((run?.turn||0)+1)).padStart(3,'0')}</span></div><ol class="scene-progress" aria-label="현재 턴의 판정 단계">${stages.map((s,i)=>`<li class="${state?i<progressIndex?'complete':i===progressIndex?'current':'':i===0?'current':''}"><span>${stageNames[s.id]||'판정'}</span></li>`).join('')}</ol><div class="arena-heading" aria-live="polite"><span class="eyebrow">${result?'HISTORY IN THE MAKING':war?'ON THE BATTLEFIELD':'A CHOICE SHAPES HISTORY'}</span><h2>${esc(title)}</h2><p>${esc(scene?.detail||'국왕의 선택부터 마지막 결과까지, 한 장면씩 역사를 확인하세요.')}</p></div>${content}${result?`<div class="scene-result ${record.success?'success':'failure'}">${icon(record.type==='war'?'sword':record.success?'check':'x',18)}<span>${esc(record.title)}</span></div>${record.eliminatedIds.length?`<div class="fall-announcement">${icon('flag',22)}${record.eliminatedIds.map(id=>esc(findCountry(before,id)?.name)).join(' · ')} 멸망</div>`:''}${record.production.length?`<div class="scene-production"><b>라운드 ${record.round} 종료 · 병력 생산</b><span>${record.production.map(p=>`${esc(p.name)} +${p.gain}만`).join(' · ')}</span></div>`:''}`:`<div class="scene-status"><span class="live-indicator ${playback?.playing?'pulsing':''}"></span>${playback?.playing?'장면 진행 중':state&&!state.finished?'일시정지 · 이어서 보거나 한 단계씩 진행하세요.':'한 턴 진행을 누르면 주사위가 굴러갑니다.'}</div>`}<div class="arena-controls"><button class="button outline" data-action="scene-step" ${run?.result&&playback.complete?'disabled':''}>${icon('chevron',15)}한 단계</button><button class="button subtle" data-action="scene-skip" ${!state||state.finished?'disabled':''}>결과 바로 보기 ${icon('arrow',14)}</button></div></section>`;
}
