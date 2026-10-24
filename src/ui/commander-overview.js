import { esc, format } from './icons.js';
import { portraitImage } from './portraits.js';
import { displayName } from './display-names.js';
import { PERSONALITIES } from '../model/world.js';
import { combatBonuses } from '../model/combat-rules.js';
export function commanderBattles(person,history,presentation=null){
 const scene=presentation?.scenes?.[presentation.index],turn=presentation?.record?.turn??Infinity,complete=!presentation||presentation.finished||scene?.kind==='summary',limit=complete?Infinity:scene?.event?.index??-1;
 const rows=[];
 for(const record of history||[]){
  if(record.turn>turn)continue;
  for(const b of record.battles||[]){
   const side=b.attackerPersonId===person.id?'attack':b.defenderPersonId===person.id?'defense':null;if(!side||b.automatic)continue;
   const resolve=record.events.find(e=>e.type==='resolve'&&e.battleIndex===b.index);
   if(record.turn===turn&&(!resolve||resolve.index>limit||resolve.index===limit&&!['result','apply','capture'].includes(scene?.kind)&&!complete))continue;
   rows.push({turn:record.turn,battleIndex:b.index,round:record.round,territory:b.territoryName,side,result:b.winner===null?'draw':b.winner===(side==='attack'?b.actor:b.target)?'win':'loss',opponent:b[side==='attack'?'defense':'attack'].name,loss:b.losses?.[side]?.amount||0,captures:b.winner===(side==='attack'?b.actor:b.target)?b.takenTerritoryIds?.length||0:0,replayable:record.turn<turn||complete});
  }
 }
 return rows;
}
export function renderCommanderOverview({world,personId,history=[],presentation=null,popover=false}){
 const person=world.people.find(p=>p.id===personId&&p.role==='general');if(!person)return '';
 const country=world.countries.find(c=>c.id===person.countryId),battles=commanderBattles(person,history,presentation),counts={win:0,loss:0,draw:0};for(const b of battles)counts[b.result]++;
 const position=presentation?.scenes?.[presentation.index]?.camps?.[person.id]?.territoryId||person.positionId||person.stationId,place=id=>world.territories.find(t=>t.id===id)?.name||'없음',experience=combatBonuses(1,1,0,person.wins||0,'plain',world.rules).experienceBonus;
 const facts=[['현재 위치',place(position)],['담당 주둔지',place(person.stationId)],['병력 / 지휘한도',`${format(person.troops||0)}만 / ${format(person.capacity||0)}만`],['고유 능력',`${person.ability>=0?'+':''}${person.ability||0}`],['누적 승수 / 전적 보정',`${person.wins||0}승 / +${experience}`],['성향',PERSONALITIES[person.personality]||'보통']];
 const neighbors=world.people.filter(p=>p.role==='general'&&p.active&&p.alive&&p.id!==person.id&&(presentation?.scenes?.[presentation.index]?.camps?.[p.id]?.territoryId||p.positionId||p.stationId)===position);
 return `<aside class="commander-overview ${popover?'commander-popover':''}" data-commander-overview="${esc(person.id)}" style="--nation:${country?.color||'#fff'}" aria-label="${esc(displayName(person))} 지휘관 개요"><header>${portraitImage(person,country,'general')}<div><h2>${esc(displayName(person))}</h2><p>${esc(country?.name||'무소속')} · ${person.alive===false?'전사':person.active===false?'대기':'활동 중'}</p></div><button type="button" class="commander-close" data-action="close-commander" aria-label="지휘관 개요 닫기">×</button></header><dl class="commander-facts">${facts.map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${person.feature?`<p>${esc(person.feature)}</p>`:''}<h3>전적 · ${counts.win}승 ${counts.loss}패 ${counts.draw}무</h3><p>공개된 실제 전투 ${battles.length}회 · 점령 ${battles.reduce((n,b)=>n+b.captures,0)}개</p><h3>주요 전투 · 최근 5회</h3>${battles.length?battles.slice(-5).reverse().map(b=>`<button type="button" class="commander-battle-link" data-action="commander-replay" data-id="${b.turn}" ${b.replayable?'':'disabled'}>${b.turn}차례 · ${esc(b.territory||'전장')} · ${{win:'승리',loss:'패배',draw:'무승부'}[b.result]}<small>${b.side==='attack'?'공격':'수비'} · 상대 ${esc(displayName({name:b.opponent}))} · 손실 ${format(b.loss)}만명${b.captures?` · 점령 ${b.captures}개`:''}</small></button>`).join(''):'<p>이 시점까지 기록된 전투가 없습니다.</p>'}${neighbors.length?`<h3>같은 지역 지휘관</h3><div class="commander-stack-list">${neighbors.map(p=>`<button type="button" data-action="focus-unit" data-id="${esc(p.id)}">${esc(displayName(p))}</button>`).join('')}</div>`:''}</aside>`;
}
