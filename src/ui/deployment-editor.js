import { clone,validateWorld } from '../model/world.js';
import { createRun } from '../engine/simulation.js';
import { renderAtlas } from './atlas-view.js';
import { esc } from './icons.js';
export class DeploymentEditor {
 constructor({getWorld,commit,render,notify}){Object.assign(this,{getWorld,commit,render,notify});this.draft=null;this.personId=null;this.mode='position';}
 reset(){this.draft=null;this.personId=null;this.mode='position';}
 prepare(){
  if(this.draft)return;
  if(this.getWorld().rules.battleMode!=='additive30'||!this.getWorld().rules.fieldCommand)throw Error('시작 배치는 D30 실제 출정 규칙에서 사용합니다. 규칙 설정을 확인해 주세요.');
  const world=clone(this.getWorld()),preview=createRun(world,0).world;
  for(const p of preview.people.filter(p=>p.role==='general'&&p.active&&!world.people.some(q=>q.id===p.id)))world.people.push({id:p.id,name:p.name,role:'general',countryId:p.countryId,slot:p.slot,ability:p.ability,commandBonus:p.commandBonus,personality:p.personality||'balanced',feature:p.feature||''});
  const generals=preview.people.filter(p=>p.role==='general'&&p.active&&p.alive).map(p=>({personId:p.id,positionId:p.positionId||p.stationId,stationId:p.stationId,territoryIds:[...p.territoryIds]}));
  this.draft={...world,deployment:{version:1,generals}};this.personId=generals[0]?.personId||world.people.find(p=>p.role==='king')?.id;
 }
 view(){
  try{this.prepare();}catch(error){return `<div class="notice">${esc(error.message)} 국가와 영토를 먼저 준비해 주세요.</div>`;}
  const world=this.draft,person=world.people.find(p=>p.id===this.personId),entry=world.deployment.generals.find(e=>e.personId===this.personId),country=world.countries.find(c=>c.id===person?.countryId),place=id=>world.territories.find(t=>t.id===id)?.name||'없음';
  let preview;try{preview=createRun(world,0).world;}catch{preview=createRun(this.getWorld(),0).world;for(const p of preview.people){const e=world.deployment.generals.find(e=>e.personId===p.id);if(e){p.positionId=e.positionId;p.stationId=e.stationId;p.territoryIds=e.territoryIds;}}for(const t of preview.territories)t.commanderId=world.deployment.generals.find(e=>e.territoryIds.includes(t.id))?.personId||t.commanderId;}
  const choices=world.people.filter(p=>p.countryId&&world.territories.some(t=>t.ownerId===p.countryId)&&(p.role==='king'||p.role==='general'));
  return `<div class="notice">새 실행의 실제 위치·주둔지·관할 영토를 지정합니다. 현재 진행 경기는 바꾸지 않습니다. 지도 카드를 눌러 인물을 고르고 영토를 클릭하세요.</div><div class="deployment-layout"><aside class="panel deployment-controls"><h2>시작 배치</h2><label>인물<select id="deployment-person">${choices.map(p=>`<option value="${esc(p.id)}" ${p.id===this.personId?'selected':''}>${esc(world.countries.find(c=>c.id===p.countryId)?.name)} · ${esc(p.name)}${p.role==='king'?' 👑':''}</option>`).join('')}</select></label><p style="color:${country?.color||'#fff'}">${esc(country?.name||'')}</p><label>지도 클릭 동작<select id="deployment-mode">${(person?.role==='king'?[['capital','수도 / 왕 시작 위치']]:[['position','현재 시작 위치'],['station','복귀할 주둔지'],['territory','관할 영토 배정']]).map(([id,label])=>`<option value="${id}" ${this.mode===id?'selected':''}>${label}</option>`).join('')}</select></label>${entry?`<dl><dt>시작 위치</dt><dd>${esc(place(entry.positionId))}</dd><dt>주둔지</dt><dd>${esc(place(entry.stationId))}</dd><dt>관할 영토 (${entry.territoryIds.length}/${world.rules.territoriesPerCommander})</dt><dd>${entry.territoryIds.map(place).map(esc).join(' · ')||'없음 · 예비 지휘관'}</dd></dl>`:`<p>수도: ${esc(place(country?.capitalId))}</p>`}<p>관할을 옮기면 이전 담당자에게서 넘어옵니다. 주둔지는 본인 관할 안에 지정하며, 관할 없는 장수는 자국 영토에 대기시킬 수 있습니다.</p><button class="button primary full" data-action="deployment-save">초기 배치 저장</button><button class="button outline full" data-action="deployment-auto">자동 배치로 되돌리기</button><p class="field-help">저장 전에 시작 위치와 주둔지의 유효성을 검사합니다. 저장한 배치는 세계 파일에도 포함됩니다.</p></aside><section class="panel deployment-map" id="deployment-map">${renderAtlas(preview,{showNames:true,focusedPerson:this.personId,linkedIds:entry?.territoryIds||[]})}</section></div>`;
 }
 select(id){this.prepare();const p=this.draft.people.find(p=>p.id===id&&['king','general'].includes(p.role));if(!p)return;this.personId=id;this.mode=p.role==='king'?'capital':'position';if(p.role==='general'&&!this.draft.deployment.generals.some(e=>e.personId===id)){const c=this.draft.countries.find(c=>c.id===p.countryId);this.draft.deployment.generals.push({personId:id,positionId:c.capitalId,stationId:c.capitalId,territoryIds:[]});}this.render();}
 click(id){
  this.prepare();const p=this.draft.people.find(p=>p.id===this.personId),t=this.draft.territories.find(t=>t.id===id);if(!p||t?.ownerId!==p.countryId){this.notify('선택한 인물의 자국 영토를 클릭해 주세요.',true);return;}
  if(p.role==='king')this.draft.countries.find(c=>c.id===p.countryId).capitalId=id;
  else{const e=this.draft.deployment.generals.find(e=>e.personId===p.id);if(this.mode==='territory'){
   if(!e.territoryIds.includes(id)&&e.territoryIds.length>=this.draft.rules.territoriesPerCommander){this.notify('장군당 관할 영토 상한을 넘습니다. 규칙 설정에서 상한을 조절할 수 있습니다.',true);return;}
   for(const other of this.draft.deployment.generals)if(other!==e){other.territoryIds=other.territoryIds.filter(v=>v!==id);if(other.territoryIds.length&&!other.territoryIds.includes(other.stationId))other.stationId=other.territoryIds[0];}
   if(!e.territoryIds.includes(id))e.territoryIds.push(id);if(!e.territoryIds.includes(e.stationId))e.stationId=id;
  }else e[this.mode==='station'?'stationId':'positionId']=id;}
  this.render();
 }
 action(action){if(action==='deployment-save'){const next=validateWorld(this.draft);this.commit(next);this.reset();this.notify('초기 배치를 저장했습니다. 새 실행부터 적용됩니다.');this.render();return true;}if(action==='deployment-auto'){const next=clone(this.getWorld());delete next.deployment;this.commit(next);this.reset();this.render();this.notify('자동 초기 배치로 복원했습니다.');return true;}return false;}
 change(target){if(target.id==='deployment-person'){this.select(target.value);return true;}if(target.id==='deployment-mode'){this.mode=target.value;return true;}return false;}
}
