import { cardLabel } from './card-label.js';
import { localNotices } from './local-notices.js';
import { territoryCell } from '../model/cartography-geometry.js';
import { displayEventText } from './display-names.js';
import {esc} from './icons.js';
import { applicationNotice, observedExperience } from './observer-flow.js';
// Exact changes between recorded frames. No game rules or randomness are evaluated here.
const effectKey=p=>`${p.countryId}:${p.slot}`;
const effectSign=n=>n>0?`+${n}`:`−${Math.abs(n)}`;
export function mapEffects(scene,stage=null,record=null) {
  const output={units:[],territories:[],announcement:''};
  if(scene?.kind!=='apply'||!scene.worldBefore||!scene.worldAfter){output.units=localNotices(scene,record,scene?.worldAfter);return output;}
  const before=scene.worldBefore,after=scene.worldAfter,event=scene.event||{};
  const oldCountries=new Map(before.countries.map(c=>[c.id,c]));
  const oldGenerals=new Map(before.people.filter(p=>p.role==='general'||p.role==='king'&&p.slot===-1).map(p=>[effectKey(p),p]));
  const nextGenerals=new Map(after.people.filter(p=>p.role==='general'||p.role==='king'&&p.slot===-1).map(p=>[effectKey(p),p]));
  const add=(countryId,role,slot,type,delta,label,tone)=>output.units.push({countryId,role,slot,type,delta,label,tone});
  for(const c of after.countries){
    const prev=oldCountries.get(c.id);if(!prev)continue;
    const delta=(c.reserve??0)-(prev.reserve??0);
    if(delta&&c.royalTroops===undefined)add(c.id,'king',null,'army',delta,`수도 ${event.type==='resupply'?'배분 ':event.type==='roster'?'이관 ':''}${effectSign(delta)}만명`,delta>0?'positive':event.type==='resupply'||event.type==='roster'?'transfer':'negative');
    const recruitment=c.recruitment-prev.recruitment;
    if(recruitment)add(c.id,'king',null,'recruitment',recruitment,c.production?`누적 충원 ${effectSign(recruitment)}만 · 적용 +${c.production.appliedExtra}만`:`매 라운드 충원 ${effectSign(recruitment)}만`,'upgrade');
    const supply=(c.supplyBonus??0)-(prev.supplyBonus??0);
    if(supply)add(c.id,'king',null,'supply',supply,`지휘한도 ${effectSign(supply)}만`,'upgrade');
    if(c.capitalId&&prev.capitalId!==c.capitalId)add(c.id,'king',null,'capital',0,'수도 이전','neutral');
  }
  for(const key of new Set([...oldGenerals.keys(),...nextGenerals.keys()])){
    const prev=oldGenerals.get(key),next=nextGenerals.get(key),p=next||prev;
    const delta=(next?.troops??0)-(prev?.troops??0);
    if(delta)add(p.countryId,p.role,p.slot,'army',delta,`${event.type==='desertion'?'탈영 ':event.type==='death'&&event.survivors?'이관 ':event.type==='roster'?'이관 ':event.type==='resupply'?'배분 ':''}${effectSign(delta)}만명`,delta>0?'positive':event.type==='roster'?'transfer':'negative');
    if(event.type==='resolve'&&next?.alive!==false&&prev&&next?.generation===prev.generation&&(next.confusion||0)>(prev.confusion||0))add(p.countryId,p.role,p.slot,'confusion',next.confusion-(prev.confusion||0),'혼란 −'+(next.confusion-(prev.confusion||0)),'negative');
    const capacity=(next?.capacity??0)-(prev?.capacity??0);
    if(capacity&&next?.active&&next?.alive&&event.type==='resolve')add(p.countryId,p.role,p.slot,'capacity',capacity,`한도 ${effectSign(capacity)}만`,'upgrade');
    const experience=next&&prev?observedExperience(next,after.rules)-observedExperience(prev,before.rules):0;
    if(experience>0&&next.active&&next.alive&&event.type==='resolve')add(p.countryId,p.role,p.slot,'experience',experience,`전적 보정 ${effectSign(experience)}점`,'upgrade');
    if(prev?.alive&&next?.alive===false)add(p.countryId,p.role,p.slot,'death',0,'전사','negative');
    if((next?.generation??0)>(prev?.generation??0))add(p.countryId,p.role,p.slot,'appointment',0,'후임 부임','upgrade');
  }
  for(let i=0;i<after.territories.length;i++){
    const t=after.territories[i],prev=before.territories[i];
    if(t.ownerId!==prev?.ownerId){const c=after.countries.find(c=>c.id===t.ownerId);output.territories.push({territoryId:t.id,countryId:t.ownerId,label:`${c?.name||'무주지'} 점령`});}
  }
  if(event.type==='resolve'&&!output.units.length&&!output.territories.length&&(!event.success||event.title?.includes('충원 상한')))add(event.nationId,'king',null,'unchanged',0,'+0만 · 변화 없음','neutral');
  if(event.type==='elimination')add(event.targetId,'king',null,'elimination',0,'멸망','negative');
  output.announcement=event.type==='round_end'?'라운드 병력 생산':event.type==='roster'?'지휘 구역 재편':displayEventText(event.title||'');
  if(stage&&stage!=='all'){
    output.units=output.units.filter(e=>stage==='troops'?['army','confusion'].includes(e.type):stage==='territory'?e.type==='capital':stage==='growth'?['capacity','experience','recruitment','supply'].includes(e.type):false);
    if(stage!=='territory')output.territories=[];
    output.announcement=displayEventText(applicationNotice(scene,record,stage));
  }
  const battle=record?.battles?.[scene.battleIndex];
  if(event.type==='resolve'&&battle&&!battle.automatic)output.units=output.units.filter(e=>!(e.type==='army'&&['general','king'].includes(e.role)&&((e.countryId===battle.actorId&&e.slot===battle.slot)||(e.countryId===battle.defenderId&&e.slot===battle.defenseSlot))));
  output.units.push(...localNotices(scene,record,after));output.announcement='';
  return output;
}

// Feedback lives inside the recipient card's zoom/stack transform, not in world-sized boxes.
export function unitFeedback(effects,marker){
 return effects.units.filter(e=>!['death','appointment'].includes(e.type)&&marker.country.id===e.countryId&&marker.role===e.role&&(e.role!=='general'||marker.person?.slot===e.slot));
}
export function renderUnitFeedback(entries,{combatSide=false,hasLoss=false,hasStatus=false,topY}={}){
 const start=topY??(hasLoss?-55:combatSide||hasStatus?-46:-36);
 return entries.map((e,i)=>cardLabel(e.label,{y:start-i*10,size:e.type==='notice'&&!['desertion','production_settlement'].includes(e.noticeKind)?9:8,classes:`unit-feedback-text ${e.type==='notice'&&!['desertion','production_settlement'].includes(e.noticeKind)?'unit-local-notice':''} ${e.tone==='refusal'?'is-refusal':''}`,attributes:`data-effect="${e.type}" data-notice-kind="${e.noticeKind||''}" data-country="${esc(e.countryId)}" data-role="${e.role}" data-slot="${e.slot??''}" data-delta="${e.delta}"`})).join('');
}
export function renderMapEffects(effects,geometry,world){
 const occupied=[],textWidth=(text,size)=>[...text].reduce((n,c)=>n+(/[가-힣]/.test(c)?size:size*.58),0)+20;
 const territories=effects.territories.map(e=>{
  const t=world.territories.find(t=>t.id===e.territoryId);if(!t)return '';
  const point=territoryCell(world,geometry,t).center,label=e.label.length>17?e.label.slice(0,14)+'… 점령':e.label,width=Math.max(70,textWidth(label,9));
  const spots=[[0,24],[0,-34],[0,52],[0,-58],[70,24],[-70,24],[0,80],[100,50],[-100,50]];
  let chosen;
  for(const [dx,dy] of spots){const box={x:Math.min(1196-width,Math.max(4,point[0]+dx-width/2)),y:Math.min(770,Math.max(4,point[1]+dy-14)),w:width,h:17};if(!occupied.some(o=>box.x<o.x+o.w+4&&box.x+box.w+4>o.x&&box.y<o.y+o.h+4&&box.y+box.h+4>o.y)){chosen=box;break;}}
  chosen ||= {x:point[0]-width/2,y:point[1]+10,w:width,h:17};occupied.push(chosen);
  const x=chosen.x+width/2,y=chosen.y+12;
  return `<g class="map-territory-feedback" data-territory-effect="${esc(t.id)}" transform="translate(${x},${y})"><path d="M${point[0]-x} ${point[1]-y}L0 0"/><rect x="${-width/2}" y="-12" width="${width}" height="17" rx="3"/><text text-anchor="middle" y="0">${esc(label)}</text></g>`;
 }).join('');
 return territories?`<g class="map-feedback-layer" pointer-events="none">${territories}</g>`:'';
}
