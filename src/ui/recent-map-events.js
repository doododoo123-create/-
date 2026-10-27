import {calendarAtRound} from '../model/calendar.js';
import {displayName,displayEventText} from './display-names.js';
import {esc,format} from './icons.js';
// Published map events only. No simulation calls and no look-ahead into the pending run.
function rowList(record,world){
 const rows=[],territory=id=>world.territories.find(t=>t.id===id),cell=i=>world.territories[i]?.id;
 const push=(event,kind,text,id,extra={})=>{if(id&&territory(id))rows.push({id:`${record.turn}:${event.index}:${kind}:${extra.personId||id}`,turn:record.turn,round:record.round,eventIndex:event.index,kind,text,territoryId:id,territoryName:territory(id).name,...extra});};
 for(const e of record.events||[]){
  const b=record.battles?.[e.battleIndex],frame=record.frames?.[e.index],known=frame?.after||frame?.before||world;
  for(const [order,m] of (record.movements||[]).find(v=>v.eventIndex===e.index)?.moves.entries()||[]){
   const p=known.people.find(p=>p.id===m.personId),name=displayName(p,displayEventText(e.title||'지휘관'));
   if(m.kind==='army-march'&&order>0)continue;
   const action=m.kind==='spacing'?'분산 배치':m.kind==='assembly'?'집결':m.kind==='army-march'?'집단군 진군':m.kind==='retreat'?'후퇴':m.kind==='royal-return'?'수도 복귀':m.kind==='occupation'?'점령지 진입':m.kind==='relief'||m.kind==='return'?'방어 이동':m.kind==='redeploy'?'재배치':m.kind==='home'||m.kind==='recovery'?'복귀':'진군';
   const destination=m.kind==='outbound'&&b?b.territoryId:m.toId;
   push(e,'move',`${m.kind==='army-march'?'집단군 '+e.armyGroup.members.length+'부대 · '+e.armyGroup.army+'만':name} · ${territory(destination)?.name||''} ${action}`,destination,{personId:m.personId,motionOrder:order,motionKind:m.kind});
  }
  if(e.type==='resolve'&&b&&!b.automatic){const won=b.winner===null?null:b.winner===b.actor?b.actorId:b.defenderId,c=world.countries.find(c=>c.id===won);push(e,'battle',`${b.territoryName} 전투 · ${c?c.name+' 승리':'무승부'}`,b.territoryId);}
  if(e.type==='resolve'&&b){const capture=(record.events||[]).find(v=>v.type==='occupation'&&v.battleIndex===b.index)||e;for(const [i,id] of (b.takenTerritoryIds||[]).entries()){const owner=world.countries.find(c=>c.id===(b.captureOwner===b.target?b.defenderId:b.actorId));push(capture,'capture',`${territory(id)?.name||'영토'} 점령 · ${owner?.name||'점령군'}`,id,{captureOrder:i,captureCount:b.takenTerritoryIds.length,battleIndex:b.index});}}
  const country=known.countries.find(c=>c.id===e.nationId),capital=country?.capitalId;
  if(e.type==='resolve'&&!b)push(e,'domestic',displayEventText(e.title||'내정 결과'),capital);
  if(e.type==='desertion')push(e,'supply',`${country?.name||'국가'} · 탈영 −${format(e.loss?.amount||0)}만`,capital);
  if(e.type==='production_settlement'&&e.gain?.gain)push(e,'supply',`${country?.name||'국가'} · 충원 +${format(e.gain.gain)}만`,capital);
  if(e.type==='death')push(e,'death',displayEventText(e.title),b?.territoryId||capital);
  if(e.type==='capital_fall')push(e,'capital',`${country?.name||'국가'} 수도 함락`,cell(e.capital)||b?.territoryId);
  if(e.type==='elimination')push(e,'elimination',displayEventText(e.title),b?.territoryId||cell(e.capital));
 }
 return rows.sort((a,b)=>a.eventIndex-b.eventIndex||({move:0,battle:1,capture:2}[a.kind]??3)-({move:0,battle:1,capture:2}[b.kind]??3)||(a.motionOrder??a.captureOrder??0)-(b.motionOrder??b.captureOrder??0));
}
function mapRevealed(row,record,playback){
 const scene=playback.scene,state=playback.state;if(!state||state.finished||scene?.kind==='summary')return true;
 const cursor=scene?.mapEventIndex??scene?.event?.index??-1;if(scene?.mapEventIndex!==undefined||scene?.campaignPhase==='summary')return row.eventIndex<=cursor;if(row.eventIndex<cursor)return true;if(row.eventIndex>cursor)return false;
 if(row.kind==='capture'){
  if(scene.kind==='capture'&&scene.battleIndex===row.battleIndex)return Math.floor((playback.sceneProgress||0)*row.captureCount+1e-8)>row.captureOrder;
  return ['focus','apply'].includes(scene.kind)&&scene.event?.type==='occupation';
 }
 if(row.kind==='move'){
  if(scene.kind==='movement'){
   const motion=record.movements.find(m=>m.eventIndex===row.eventIndex),active=motion?.moves.findIndex(m=>scene.moves?.some(p=>p.personId===m.personId));
   return active>=0&&row.motionOrder<active;
  }
  if(scene.kind==='route'&&scene.event?.type==='territory')return scene.formationSide==='defense'||row.motionKind==='outbound';
  return !['campaign','roll'].includes(scene.kind);
 }
 return !['movement','route','arrival','capture','roll','campaign'].includes(scene.kind);
}
export function recentMapEvents(run,playback,world){
 const current=playback?.state?.record,turn=current?.turn??run?.history?.at(-1)?.turn??0,history=run?.history||[];let rows=[];
 if(current)rows=rowList(current,world).filter(row=>mapRevealed(row,current,playback)).slice(-4);
 let i=Math.min(history.length-1,turn-(current?2:1));
 for(;i>=0&&rows.length<4;i--){const r=history[i];if(r.turn>turn||current&&r.turn===turn)continue;rows=[...rowList(r,world).slice(-4),...rows].slice(-4);}
 return rows;
}
export function renderRecentMapEvents(entries,selected=''){
 return `<aside class="map-recent-events" aria-label="최근 사건"><header><b>최근 사건</b><small>이전 → 최근</small></header><ol>${entries.length?entries.map(e=>{const calendar=calendarAtRound(e.round);return `<li><button type="button" data-action="focus-map-event" data-id="${esc(e.id)}" data-event-territory="${esc(e.territoryId)}" ${selected===e.id?'aria-current="true"':''} title="${calendar.label} · ${e.turn}차례 · ${esc(e.territoryName)}로 이동"><small>${calendar.year}년 ${calendar.season} · ${e.turn}.${e.eventIndex+1}</small><span>${esc(e.text)}</span><i aria-hidden="true">⌖</i></button></li>`;}).join(''):'<li class="recent-event-empty">진행한 사건이 여기에 표시됩니다.</li>'}</ol></aside>`;
}
export function refreshRecentMapEvents(run,playback,world,selected=''){const node=globalThis.document?.querySelector('.map-recent-events');if(node)node.outerHTML=renderRecentMapEvents(recentMapEvents(run,playback,world),selected);}
