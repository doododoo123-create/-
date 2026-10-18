import {countryPeople,findCountry,ROLES,PERSONALITIES,MINISTER_STYLES} from '../model/world.js';
import {esc} from './icons.js';
import {portraitImage} from './portraits.js';
import {renderDie} from './die-view.js';
const judgmentSign=n=>n>0?`+${n}`:String(n||0);
export function judgmentVisible(playback){
  const scene=playback.scene;
  return !!(playback.state&&!playback.complete&&!(playback.groupDone&&!playback.playing)&&scene&& !['apply','summary'].includes(scene.kind)&&scene.event?.type!=='territory');
}
function judgmentPerson(world,country,role,slot){return countryPeople(world,country?.id).find(p=>p.role===role&&(role!=='general'||p.slot===slot));}
function judgmentPortrait(person,country,role){return `<figure class="judgment-person" style="--nation:${country?.color||'#c0b698'}">${portraitImage(person,country,role)}<figcaption><strong>${esc(person?.name||ROLES[role])}</strong><small>${esc(country?.name||'')} · ${ROLES[role]}</small></figcaption></figure>`;}
function judgmentTraits(person,role,country){
  const trait=role==='king'?PERSONALITIES[person?.personality||country?.personality]:role==='minister'?MINISTER_STYLES[person?.ministerStyle||'balanced']:`능력 ${judgmentSign(person?.ability)}`;
  return `<p class="judgment-feature">${esc(person?.feature||trait||'')}<span>${role==='minister'?`${esc(trait)} · 능력 ${judgmentSign(person?.ability)}`:role==='king'?esc(trait||''):`능력 ${judgmentSign(person?.ability)}`}</span></p>`;
}
export function renderJudgmentOverlay({world,playback}) {
  if(!judgmentVisible(playback))return '';
  const state=playback.state,scene=playback.scene,event=scene.event||{},record=state.record;
  const phase=state.phase==='departing'?'locked':state.phase;
  const frame=event.type==='appointment'?scene.worldAfter===scene.worldBefore?record.frames?.[event.index]?.after||world:scene.worldAfter:scene.worldBefore||world;
  const nation=findCountry(frame,event.nationId||record.actorId);
  const battle=record.battles[scene.battleIndex];
  const duel=!!battle&&['attack_roll','defense_roll','resolve','battle_auto'].includes(event.type);
  const result=scene.kind==='result';
  const title=phase==='locked'&&scene.lockedTitle?scene.lockedTitle:scene.title;
  let body='',note='';
  if(duel){
    const side=(key,attack)=>{
      const info=battle[key],country=findCountry(frame,attack?battle.actorId:battle.defenderId);
      const person=judgmentPerson(frame,country,'general',attack?battle.slot:battle.defenseSlot);
      const current=event.type===(attack?'attack_roll':'defense_roll');
      const seen=result||attack&&event.type==='defense_roll';
      const die=battle.automatic?'<span class="judgment-auto">전투 판정 없음</span>':renderDie(current||seen?info.raw:null,10,current?phase:seen?'locked':'waiting',attack?'공격':'수비',(info.ability||0)+(info.armyBonus||0));
      return `<div class="judgment-side ${key}"><div class="judgment-side-label">${attack?'공격':'수비'} · ${esc(country?.name)} <small>${info.army}만</small></div><div class="judgment-roll">${judgmentPortrait(person||{name:info.name},country,'general')}${die}</div>${judgmentTraits(person,'general',country)}</div>`;
    };
    body=`<div class="judgment-duel">${side('attack',true)}<span class="judgment-vs">VS</span>${side('defense',false)}</div>`;
    if(result)note=battle.automatic?'무방비 영토 · 1개 점령 · 병력 손실 없음':`공격 −${battle.losses.attack.amount}만 · 수비 −${battle.losses.defense.amount}만 · 영토 ${battle.takenCells.length}개 점령`;
  }else if(['round_end','roster','waiting','finish','elimination'].includes(event.type)){
    note=event.type==='round_end'?'각 지역에서 병력을 생산합니다.':event.detail;
  }else{
    const role=event.role||(record.type==='domestic'&&event.type==='resolve'?'minister':event.type==='death'||event.type==='survived'?'general':'king');
    const person=judgmentPerson(frame,nation,role,event.slot);
    const score=record.domesticScore;
    const showDie=scene.kind==='roll'||result&&record.type==='domestic';
    const die=showDie?renderDie(scene.kind==='roll'?scene.value:score?.raw,scene.faces||10,scene.kind==='roll'?phase:'locked',event.type==='death_roll'?'전사 판정':event.type==='minister'?'내정 선택':event.type==='war_target'?'공격 국가':'D10 판정',scene.kind==='roll'?scene.bonus||0:score?.ability||0):'';
    body=`<div class="judgment-single">${judgmentPortrait(person,nation,role)}${die}</div>${judgmentTraits(person,role,nation)}`;
    if(result)note=event.success?'내정 성공':'내정 실패 · 변화 없음';
    else if(event.type==='death_roll')note='1~3 전사 · 4~10 생존';
    else if(!showDie)note=event.detail;
  }
  return `<aside class="map-judgment ${duel?'is-duel':''}" data-event="${esc(event.type||'')}" data-phase="${state.phase}" aria-label="지도 중앙 판정" aria-live="polite"><h2>${esc(title)}</h2>${body}${note?`<p class="judgment-result">${esc(note)}</p>`:''}</aside>`;
}
