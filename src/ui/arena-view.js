import { findCountry, countryPeople, landCount, ROLES, PERSONALITIES } from '../model/world.js';
import { icon, esc, format } from './icons.js';
import { portraitImage } from './portraits.js';
import { diceColor, diceReel } from './dice-colors.js';
const signed=n=>n>0?`+${n}`:String(n||0);
function die(value,sides,phase='waiting',label='주사위',bonus=0) {
  const rolling=phase==='rolling',revealed=Number.isInteger(value)&&!rolling;
  const total=phase==='locked'&&bonus?value+bonus:value;
  return `<div class="visual-die-block" style="--die-ink:${diceColor(revealed?total:null,sides)};${diceReel(sides)}"><span class="die-caption">${esc(label)}</span><div class="visual-die ${rolling?'rolling':''} ${revealed?'locked':''} ${phase==='merging'?'merging':''}" data-die-locked="${revealed}" data-die-value="${revealed?total:''}" data-die-sides="${sides}" aria-label="${esc(label)} ${revealed?total:rolling?'굴리는 중':'대기'}"><span class="die-corner top"></span><span class="die-number">${revealed?total:'?'}</span>${rolling?'<span class="rolling-number" aria-hidden="true"></span>':''}<small>D${sides}${phase==='locked'&&bonus?' + 보정':''}</small><span class="die-corner bottom"></span>${revealed&&bonus&&phase==='merging'?`<b class="merging-bonus">${signed(bonus)}</b>`:''}</div><div class="die-equation ${revealed?'':'waiting-equation'}">${revealed?`${value}${bonus?` <b>${signed(bonus)}</b> = <strong>${value+bonus}</strong>`:' 확정'}`:'눈금 → 보정 → 최종 점수'}</div></div>`;
}
function character(person,country,role,compact=false) {
  return `<figure class="scene-portrait ${compact?'compact':''}" style="--nation:${country?.color||'#8b99aa'}">${portraitImage(person,country,role)}<figcaption><small>${esc(country?.name||'')}</small><strong>${esc(person?.name||`${ROLES[role]||'지휘관'} 미배치`)}</strong><span>${ROLES[role]||'지휘관'}</span></figcaption></figure>`;
}
export function renderArena({world,run,playback,showControls=true}) {
  const state=playback?.state,record=state?.record,scene=playback?.scene,event=scene?.event;
  const frame=scene?.worldBefore||world;
  const actor=findCountry(frame,record?.actorId)||findCountry(frame,run?.schedule[run.scheduleIndex])||frame.countries.find(c=>landCount(frame,c.id)>0)||frame.countries[0];
  const nation=findCountry(frame,event?.nationId)||actor;
  const person=countryPeople(frame,nation?.id).find(p=>event?.role==='general'?p.role==='general'&&p.slot===event.slot:p.role===(event?.role||'king'));
  const b=Number.isInteger(scene?.battleIndex)?record?.battles[scene.battleIndex]:null;
  const phase=state?.phase||'ready',locked=phase==='locked',summary=scene?.kind==='summary',result=scene?.kind==='result'||scene?.kind==='apply';
  const title=locked&&scene?.lockedTitle?scene.lockedTitle:scene?.title||`${actor?.name||'세계'}의 다음 선택`;
  let content='';
  if(b) {
    const a=findCountry(frame,b.actorId),d=findCountry(frame,b.defenderId);
    const attack=countryPeople(frame,a.id).find(p=>p.role==='general'&&p.slot===b.slot),defense=countryPeople(frame,d.id).find(p=>p.role==='general'&&p.slot===b.defenseSlot);
    const side=(c,p,s,isAttack)=>{
      const current=event?.type===(isAttack?'attack_roll':'defense_roll');
      const revealed=result||event?.type==='death_roll'||event?.type==='death'||event?.type==='survived'||(!isAttack?false:event?.type==='defense_roll');
      return `<div class="duel-side ${isAttack?'attacker':'defender'}"><div class="duel-side-label">${isAttack?'공격 장군':'방어 장군'}<span>${format(s?.army||0)}만 명</span></div>${character(p||{name:s?.name},c,'general',true)}${b.automatic?'<div class="automatic-label">전투 주사위 없음</div>':die(current||revealed?s.raw:null,10,current?phase:revealed?'locked':'waiting',isAttack?'공격 판정':'방어 판정',s.ability+s.armyBonus)}<div class="side-modifiers"><span>능력 ${signed(s?.ability)}</span><span>병력 우세 ${signed(s?.armyBonus)}</span></div></div>`;
    };
    content=`<div class="battle-sequence">이번 원정 · ${b.index+1}번째 장군 / ${esc(b.territoryName)}</div><div class="visual-duel">${side(a,attack,b.attack,true)}<div class="duel-vs"><span>VS</span>${icon('sword',22)}</div>${side(d,defense,b.defense,false)}</div>`;
    if(result)content+=b.automatic?'<div class="automatic-banner">방어 병력 없음 · 영토 1개 자동 점령 · 손실 없음</div>':`<div class="battle-losses">${['attack','defense'].map((key,i)=>`<div><small>${i?'방어':'공격'} 장군 손실</small><strong>−${b.losses[key].amount}<span>만</span></strong><p>${b[key].army} → ${b.after[key]}만 · 기본률 ${b.losses[key].base}%</p></div>`).join('')}</div><div class="automatic-banner">${esc(b.summary)} · 점령 ${b.takenCells.length}개</div>`;
    if(event?.type==='death_roll')content+=`<div class="death-judgment">${esc(person?.name)} 전사 판정 ${die(scene.value,10,phase,'1~3 전사 / 4~10 생존')}</div>`;
  } else if(scene?.kind==='roll'||!scene) {
    const role=event?.role||'king';
    content=`<div class="single-judgment">${character(person,nation,role)}${die(scene?.value,scene?.faces||10,phase,event?.type==='minister'?'모병 / 충원 / 보급 선택':event?.type==='domestic_roll'?'선택한 내정의 실행':event?.type==='war_target'?'공격 국가 선택':'국왕의 행동',scene?.bonus||0)}</div><div class="character-description"><strong>${esc(person?.name||nation?.name||'')}<span>${ROLES[role]||'국가 선택'}${role==='king'?` · ${PERSONALITIES[person?.personality||nation?.personality]}`:''}</span></strong><p>${esc(event?.detail||'국왕 → 승상 또는 장군 → 결과 적용. 주사위와 장군별 병력으로 역사가 진행됩니다.')}</p>${event?.type==='domestic_roll'?`<div class="trait-chips"><b>능력 ${signed(event.ability)}</b><b>${frame.rules.successTarget}점 이상 성공</b></div>`:''}</div>`;
  } else {
    content=`<div class="event-information">${icon(summary?'book':event?.type==='appointment'?'people':event?.type==='round_end'?'flag':'compass',52)}<h3>${esc(scene.title)}</h3><p>${esc(scene.detail)}</p>${summary?`<p>내정 ${record.type==='domestic'?record.action:'없음'} · 전투 ${record.battles.length}회 · 점령 ${record.changes.length}개</p>`:''}${event?.type==='round_end'?`<div class="production-details">${record.production.map(p=>`<p>${esc(p.name)} · 생산 ${p.gain}만${p.disconnected?` · 단절 지역 ${p.disconnected}만`:''}</p>`).join('')}</div>`:''}</div>`;
  }
  return `<section data-scene="${scene?.id||'ready'}" data-event="${event?.type||'ready'}" data-phase="${phase}" data-playing="${!!playback?.playing}" class="panel arena-panel ${(result||summary)?'showing-result':''}" style="--nation:${actor?.color||'#8b99aa'}"><div class="arena-top"><span class="arena-nation"><i></i>${esc(actor?.name||'새 세계')}의 차례</span><span>TURN ${String(record?.turn||((run?.turn||0)+1)).padStart(3,'0')}</span></div><div class="scene-position">${scene?`${state.index+1} / ${state.scenes.length} 장면`:'v11 원본 시스템'}</div><div class="arena-heading" aria-live="polite"><span class="eyebrow">${b?'ON THE BATTLEFIELD':'A CHOICE SHAPES HISTORY'}</span><h2>${esc(title)}</h2><p>${esc(scene?.detail||'한 턴 진행으로 시작하세요.')}</p></div>${content}<div class="scene-status"><span class="live-indicator ${playback?.playing?'pulsing':''}"></span>${playback?.playing?'장면 진행 중':state&&!state.finished?'일시정지 · Space 다음 판정 묶음 / Enter 남은 턴':'턴 완료 지점은 자동 저장됩니다.'}</div>${showControls?`<div class="arena-controls"><button class="button outline" data-action="scene-step" ${run?.result&&playback.complete?'disabled':''}>${icon('chevron',15)}한 단계</button><button class="button subtle" data-action="scene-skip" ${!state||state.finished?'disabled':''}>턴 결과 바로 보기 ${icon('arrow',14)}</button></div>`:''}</section>`;
}
