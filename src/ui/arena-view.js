import {royalCommandPerson} from './royal-presentation.js';
import {renderCampaignOverlay} from './campaign-view.js';
import { renderAccumulatingDie, scoreBonusItems } from './score-accumulation.js';
import { renderSeasonAnnouncement } from './season-view.js';
import { renderChoiceReel } from './choice-reel.js';
import { sideBonus, renderCombatBonuses, veteranStars } from './combat-view.js';
import { vividWorld } from './palette.js';
import { displayName, displayEventText } from './display-names.js';
import { findCountry, countryPeople, landCount, ROLES, PERSONALITIES } from '../model/world.js';
import { icon, esc, format } from './icons.js';
import { portraitImage } from './portraits.js';
import { renderDie } from './die-view.js';
const signed=n=>n>0?`+${n}`:String(n||0);
function character(person,country,role,compact=false,army=null) {
  return `<figure class="scene-portrait ${compact?'compact':''}" style="--nation:${country?.color||'#8b99aa'}"><div class="framed-portrait">${portraitImage(person,country,role)}</div><figcaption><small>${esc(country?.name||'')}</small><strong>${esc(displayName(person,`${ROLES[role]||'지휘관'} 미배치`))}${(role==='general'||role==='king'&&person?.slot===-1)?veteranStars(person):''}</strong><span>${(role==='general'||role==='king'&&person?.slot===-1)?`병력 ${army??person?.troops??0}만`:ROLES[role]||'지휘관'}</span></figcaption></figure>`;
}
export function renderArena({world,run,playback,showControls=true}) {
  if(playback?.scene?.campaign&&!(playback.scene.campaignPhase==='map'&&playback.scene.kind==='roll'))return '<section class="panel arena-panel campaign-arena">'+renderCampaignOverlay({playback,inline:true})+'</section>';
  const state=playback?.state,record=state?.record,scene=playback?.scene,event=scene?.event;
  if(scene?.kind==='season')return `<section class="panel arena-panel season-panel" data-event="season" data-scene="${scene.id}">${renderSeasonAnnouncement(scene)}<p>${esc(scene.title)}</p>${showControls?`<div class="arena-controls"><button class="button outline" data-action="scene-step">${icon('chevron',15)}한 단계</button><button class="button subtle" data-action="scene-skip">턴 결과 바로 보기 ${icon('arrow',14)}</button></div>`:''}</section>`;
  const frame=vividWorld(event?.type==='appointment'&&event.role==='king'?(record.frames?.[event.index]?.after||scene?.worldBefore||world):scene?.worldBefore||world);
  const actor=findCountry(frame,record?.actorId)||findCountry(frame,run?.schedule[run.scheduleIndex])||frame.countries.find(c=>landCount(frame,c.id)>0)||frame.countries[0];
  const nation=findCountry(frame,event?.nationId)||actor;
  const person=royalCommandPerson(countryPeople(frame,nation?.id).find(p=>event?.role==='general'?(p.role==='general'||p.role==='king'&&p.slot===-1)&&p.slot===event.slot:p.role===(event?.role||'king')),frame);
  const b=Number.isInteger(scene?.battleIndex)?record?.battles[scene.battleIndex]:null;
  const phase=state?.phase||'ready',locked=phase==='locked',summary=scene?.kind==='summary',result=scene?.kind==='result'||scene?.kind==='apply';
  const title=locked&&scene?.lockedTitle?scene.lockedTitle:scene?.title||`${actor?.name||'세계'}의 다음 선택`;
  let content='';
  if(b?.automatic&&scene.automaticEntry){const c=findCountry(frame,b.actorId),p=countryPeople(frame,c.id).find(p=>p.id===b.attackerPersonId);content=`<div class="single-judgment unopposed-judgment">${character(p,c,'general',false,b.attack.army)}</div><div class="automatic-banner">${esc(b.territoryName)} · 수비대 없음${scene.kind==='capture'?' · '+b.takenTerritoryIds.length+'개 영토 점령':' · 바로 진입'}</div>`;}
  else if(b) {
    const a=findCountry(frame,b.actorId),d=findCountry(frame,b.defenderId);
    const attack=countryPeople(frame,a.id).find(p=>(p.role==='general'||p.role==='king'&&p.slot===-1)&&p.slot===b.slot),defense=countryPeople(frame,d.id).find(p=>p.role===(b.defenseRole||'general')&&p.slot===b.defenseSlot);
    const side=(c,p,s,isAttack)=>{
      const current=event?.type===(isAttack?'attack_roll':'defense_roll');
      const revealed=result||event?.type==='death_roll'||event?.type==='death'||event?.type==='survived'||(!isAttack?false:event?.type==='defense_roll');
      return `<div class="duel-side ${isAttack?'attacker':'defender'}"><div class="duel-side-label">${isAttack?'공격 장군':'방어 장군'}<span>${format(s?.army||0)}만 명</span></div>${character({...p,name:p?.name||s?.name,wins:s?.wins??p?.wins,...(s?.underdogWins!==undefined?{underdogWins:s.underdogWins}:{})},c,p?.role||'general',true,s?.army)}${b.automatic?'<div class="automatic-label">전투 주사위 없음</div>':renderAccumulatingDie(current||revealed?s.raw:null,b.sides||10,current?phase:revealed?'locked':'waiting',isAttack?'공격 판정':'방어 판정',scoreBonusItems(s),{mergeIndex:state?.mergeIndex||0,progress:playback.sceneProgress,speed:playback.animationSpeed||playback.speed()})}${renderCombatBonuses(s)}</div>`;
    };
    content=`<div class="battle-sequence">이번 원정 · ${b.index+1}번째 전투${b.defendersTotal>1?` · 순차 방어 ${b.wave}/${b.defendersTotal}`:''} / ${esc(b.territoryName)}</div><div class="visual-duel">${side(a,attack,b.attack,true)}<div class="duel-vs"><span>VS</span>${icon('sword',22)}</div>${side(d,defense,b.defense,false)}</div>`;
    if(result)content+=b.automatic?`<div class="automatic-banner">${b.returnBlocked?'복귀 차단 · 구원군 없음':'방어 병력 없음'} · 영토 1개 자동 점령 · 손실 없음</div>`:`<div class="battle-losses">${['attack','defense'].map((key,i)=>`<div><small>${i?'방어':'공격'} 장군 손실</small><strong>−${format(b.losses[key].amount)}<span>만</span></strong><p>${b[key].army} → ${b.after[key]}만 · ${b.losses[key].grade?({narrow:'신승',clear:'승리',major:'대승',rout:'압승',draw:'무승부'}[b.losses[key].grade]):'원본 손실식'}</p></div>`).join('')}</div><div class="automatic-banner">${esc(displayEventText(b.summary))} · 점령 ${b.takenCells.length}개</div>`;
    if(event?.type==='death_roll')content+=`<div class="death-judgment">${esc(displayEventText(person?.name))} 전사 판정 ${renderDie(scene.value,10,phase,'1~3 전사 / 4~10 생존')}</div>`;
  } else if(event?.type==='hold'){
    content=`<div class="single-judgment refusal-person">${character(person,nation,'general')}</div><p class="dispatch-refusal">출정 거부</p>`;
  } else if(scene?.kind==='reel'){
    content=`<div class="single-judgment">${character(person,nation,event.role||'king')}${renderChoiceReel(scene,phase,playback.sceneProgress)}</div>`;
  } else if(scene?.kind==='roll'||!scene) {
    const role=event?.role||'king';
    content=`<div class="single-judgment">${character(person,nation,role)}${renderAccumulatingDie(scene?.value,scene?.faces||10,phase,event?.type==='minister'?'모병 / 충원 / 보급 선택':event?.type==='domestic_roll'?'선택한 내정의 실행':event?.type==='war_target'?'공격 국가 선택':event?.type==='expedition_roll'?'거리별 출전 판정':event?.type==='supply_roll'?'지휘한도 증가':'국왕의 행동',scene?.bonusItems||scoreBonusItems(null,scene?.bonus||0),{mergeIndex:state?.mergeIndex||0,progress:playback?.sceneProgress||0,speed:playback?.animationSpeed||playback?.speed?.()||1})}</div><div class="character-description"><strong>${esc(displayName(person,nation?.name||''))}<span>${ROLES[role]||'국가 선택'}${role==='king'?` · ${PERSONALITIES[person?.personality||nation?.personality]}`:''}</span></strong><p>${esc(displayEventText(event?.detail||'국왕 → 승상 또는 장군 → 결과 적용. 주사위와 장군별 병력으로 역사가 진행됩니다.'))}</p>${event?.type==='domestic_roll'?`<div class="trait-chips"><b>능력 ${signed(event.ability)}</b><b>${frame.rules.successTarget}점 이상 성공</b></div>`:''}</div>`;
  } else {
    content=`<div class="event-information">${icon(summary?'book':event?.type==='appointment'?'people':event?.type==='round_end'?'flag':'compass',52)}<h3>${esc(displayEventText(scene.title))}</h3><p>${esc(displayEventText(scene.detail))}</p>${summary?`<p>내정 ${record.type==='domestic'?record.action:'없음'} · 전투 ${record.battles.length}회 · 점령 ${record.changes.length}개</p>`:''}${event?.type==='round_end'?`<div class="production-details">${record.production.map(p=>`<p>${esc(p.name)} · 생산 ${p.gain}만${p.disconnected?` · 단절 지역 ${p.disconnected}만`:''}</p>`).join('')}</div>`:''}</div>`;
  }
  return `<section data-scene="${scene?.id||'ready'}" data-event="${event?.type||'ready'}" data-phase="${phase}" data-playing="${!!playback?.playing}" class="panel arena-panel ${(result||summary)?'showing-result':''}" style="--nation:${actor?.color||'#8b99aa'}"><div class="arena-top"><span class="arena-nation"><i></i>${esc(actor?.name||'새 세계')}의 차례</span><span>TURN ${String(record?.turn||((run?.turn||0)+1)).padStart(3,'0')}</span></div><div class="scene-position">${scene?`${state.index+1} / ${state.scenes.length} 장면`:'v11 원본 시스템'}</div><div class="arena-heading" aria-live="polite"><span class="eyebrow">${b?'ON THE BATTLEFIELD':'A CHOICE SHAPES HISTORY'}</span><h2>${esc(displayEventText(title))}</h2><p>${esc(displayEventText((scene?.kind==='reel'?'':scene?.detail)||'선택과 판정이 순서대로 진행됩니다.'))}</p></div>${content}<div class="scene-status"><span class="live-indicator ${playback?.playing?'pulsing':''}"></span>${playback?.playing?'장면 진행 중':state&&!state.finished?'일시정지 · Space 다음 판정 묶음 / Enter 남은 턴':'턴 완료 지점은 자동 저장됩니다.'}</div>${showControls?`<div class="arena-controls"><button class="button outline" data-action="scene-step" ${run?.result&&playback.complete?'disabled':''}>${icon('chevron',15)}한 단계</button><button class="button subtle" data-action="scene-skip" ${!state||state.finished?'disabled':''}>턴 결과 바로 보기 ${icon('arrow',14)}</button></div>`:''}</section>`;
}
