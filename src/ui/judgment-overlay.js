import { royalRoleForScene } from './royal-presentation.js';
import { renderSeasonAnnouncement } from './season-view.js';
import { renderChoiceReel } from './choice-reel.js';
import { sideBonus, renderObserverBonuses, renderObserverScore, veteranStars } from './combat-view.js';
import { vividWorld } from './palette.js';
import { displayName, displayEventText } from './display-names.js';
import {countryPeople,findCountry,ROLES,PERSONALITIES,MINISTER_STYLES} from '../model/world.js';
import {esc} from './icons.js';
import {portraitImage} from './portraits.js';
import {renderDie} from './die-view.js';
const judgmentSign=n=>n>0?`+${n}`:String(n||0);
export function judgmentVisible(playback){
  const scene=playback.scene;
  return !!(playback.state&&!playback.complete&&!(playback.groupDone&&!playback.playing)&&scene&& !['apply','summary','movement','round-settle'].includes(scene.kind)&&scene.event?.type!=='territory');
}
function judgmentPerson(world,country,role,slot){return countryPeople(world,country?.id).find(p=>p.role===role&&(role!=='general'||p.slot===slot));}
function judgmentPortrait(person,country,role,army=null){return `<figure class="judgment-person" style="--nation:${country?.color||'#c0b698'}"><div class="framed-portrait">${portraitImage(person,country,role)}</div><figcaption><strong>${esc(displayName(person,ROLES[role]))}${role==='general'?veteranStars(person):''}</strong><small>${role==='general'?`병력 ${army??person?.troops??0}만`:esc(country?.name||'')+' · '+ROLES[role]}</small></figcaption></figure>`;}
function judgmentTraits(person,role,country){
  const trait=role==='king'?PERSONALITIES[person?.personality||country?.personality]:role==='minister'?MINISTER_STYLES[person?.ministerStyle||'balanced']:`능력 ${judgmentSign(person?.ability)}`;
  return `<p class="judgment-feature">${esc(person?.feature||trait||'')}<span>${role==='minister'?`${esc(trait)} · 능력 ${judgmentSign(person?.ability)}`:role==='king'?esc(trait||''):`능력 ${judgmentSign(person?.ability)}`}</span></p>`;
}
export function renderJudgmentOverlay({world,playback}) {
  if(!judgmentVisible(playback))return '';
  const state=playback.state,scene=playback.scene,event=scene.event||{},record=state.record;
  if(scene.kind==='season')return renderSeasonAnnouncement(scene);
  const phase=state.phase==='departing'?'locked':state.phase;
  world=vividWorld(world);
  const frame=vividWorld(event.type==='appointment'?scene.worldAfter===scene.worldBefore?record.frames?.[event.index]?.after||world:scene.worldAfter:scene.worldBefore||world);
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
      const current=event.type===(attack?'attack_roll':'defense_roll'),seen=result||attack&&event.type==='defense_roll';
      const visible=seen||current&&phase==='locked';
      const die=battle.automatic?'<span class="judgment-auto">—</span>':renderDie(current||seen?info.raw:null,battle.sides||30,current?phase:seen?'locked':'waiting',attack?'⚔':'🛡',sideBonus(info),{rawFace:true});
      return `<div class="judgment-side ${key}" style="--nation:${country?.color||'#fff'}"><div class="mini-fighter-name">${attack?'⚔':'🛡'} ${esc(displayName(person,info.name))}${veteranStars({...person,wins:info.wins??person?.wins})}<small>병력 ${info.army}만</small></div><div class="mini-score-roll">${die}${battle.automatic?'':renderObserverScore(info,visible)}</div>${renderObserverBonuses(info,{all:true})}<div class="mini-bonus-total">보정 합계 ${judgmentSign(sideBonus(info))}</div></div>`;

    };
    body=`<div class="judgment-duel">${side('attack',true)}<span class="judgment-vs">⚔</span>${side('defense',false)}</div>`;

    note=result?battle.winner===null?'무승부':battle.takenCells.length?`${battle.winner===battle.actor?'점령':'역점령'} ${battle.takenCells.length}`:'영토 유지':'';
    return `<aside class="map-judgment is-duel is-compact-duel is-v16-duel is-v17-duel" data-event="${esc(event.type)}" data-phase="${state.phase}" aria-label="${esc(battle.territoryName)} 전투 판정"><header class="mini-combat-header"><span>${esc(battle.territoryName)}</span>${battle.defendersTotal>1?`<small>${battle.wave}/${battle.defendersTotal}</small>`:''}</header>${body}${note?`<p class="mini-combat-result">${esc(note)}</p>`:''}</aside>`;
  }else if(royalRoleForScene(scene,record)==='minister'&&scene.kind!=='reel'){
    const person=judgmentPerson(frame,nation,'minister'),score=record.domesticScore,showDie=scene.kind==='roll'||result;
    const value=scene.kind==='roll'?scene.value:score?.raw,bonus=scene.kind==='roll'?scene.bonus||0:score?.ability||0;
    const die=showDie?renderDie(value,scene.faces||10,scene.kind==='roll'?phase:'locked',event.type==='supply_roll'?'지휘한도 증가':'내정 판정',bonus):'';
    return `<aside class="map-judgment is-royal-die" data-nation="${esc(nation?.id||'')}" data-anchor-role="minister" data-event="${esc(event.type)}" data-phase="${state.phase}" style="--nation:${nation?.color||'#fff'}" aria-label="${esc(nation?.name||'')} 승상 판정"><div class="royal-choice-heading">${esc(nation?.name||'')} · 승상</div>${die}${judgmentTraits(person,'minister',nation)}${result?`<p class="royal-result">${event.success?'내정 성공':'내정 실패'}</p>`:''}</aside>`;
  }else if(event.type==='hold'){
    const person=judgmentPerson(frame,nation,'general',event.slot);
    body=`<div class="judgment-single refusal-person">${judgmentPortrait(person,nation,'general')}</div><p class="dispatch-refusal">출정 거부</p>`;
  }else if(scene.kind==='reel'){
    const role=event.role||'king';
    return `<aside class="map-judgment is-royal-choice" data-anchor-role="${role}" data-nation="${esc(nation?.id||'')}" data-event="${esc(event.type)}" data-phase="${state.phase}" style="--nation:${nation?.color||'#fff'}" aria-label="${esc(nation?.name||'')} ${role==='king'?'국왕':'승상'} 선택"><div class="royal-choice-heading">${esc(nation?.name||'')} · ${role==='king'?'국왕':'승상'}</div>${renderChoiceReel(scene,phase,playback.sceneProgress,{rowHeight:32})}</aside>`;
  }else if(['round_end','roster','waiting','finish','elimination'].includes(event.type)){
    note=event.type==='round_end'?'각 지역에서 병력을 생산합니다.':event.detail;
  }else{
    const role=event.role||(record.type==='domestic'&&event.type==='resolve'?'minister':event.type==='death'||event.type==='survived'?'general':'king');
    const person=judgmentPerson(frame,nation,role,event.slot);
    const score=record.domesticScore;
    const showDie=scene.kind==='roll'||result&&record.type==='domestic';
    const die=showDie?renderDie(scene.kind==='roll'?scene.value:score?.raw,scene.faces||10,scene.kind==='roll'?phase:'locked',event.type==='death_roll'?'전사 판정':event.type==='minister'?'내정 선택':event.type==='war_target'?'공격 국가':event.type==='expedition_roll'?'출전 판정':event.type==='supply_roll'?'지휘한도 증가':'D10 판정',scene.kind==='roll'?scene.bonus||0:score?.ability||0):'';
    body=`<div class="judgment-single">${judgmentPortrait(person,nation,role)}${die}</div>${judgmentTraits(person,role,nation)}`;
    if(result)note=event.success?'내정 성공':'내정 실패 · 변화 없음';
    else if(event.type==='death_roll')note='1~3 전사 · 4~10 생존';
    else if(event.type==='expedition_roll'||!showDie)note=event.detail;
  }
  return `<aside class="map-judgment ${duel?'is-duel':''}" data-event="${esc(event.type||'')}" data-phase="${state.phase}" aria-label="지도 중앙 판정" aria-live="polite"><h2>${esc(duel?battle.territoryName+' 전투':displayEventText(title))}</h2>${duel?`<p class="observer-duel-stage">${esc(displayEventText(title))}</p>`:''}${duel&&battle.defendersTotal>1?`<p class="defense-wave">순차 방어 ${battle.wave} / ${battle.defendersTotal} · 모든 수비대 격파 시 점령</p>`:''}${body}${note?`<p class="judgment-result">${esc(displayEventText(note))}</p>`:''}</aside>`;
}
