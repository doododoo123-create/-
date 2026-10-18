import {esc} from './icons.js';
// Exact changes between recorded frames. No game rules or randomness are evaluated here.
const effectKey=p=>`${p.countryId}:${p.slot}`;
const effectSign=n=>n>0?`+${n}`:`−${Math.abs(n)}`;
export function mapEffects(scene) {
  const output={units:[],territories:[],announcement:''};
  if(scene?.kind!=='apply'||!scene.worldBefore||!scene.worldAfter)return output;
  const before=scene.worldBefore,after=scene.worldAfter,event=scene.event||{};
  const oldCountries=new Map(before.countries.map(c=>[c.id,c]));
  const oldGenerals=new Map(before.people.filter(p=>p.role==='general').map(p=>[effectKey(p),p]));
  const nextGenerals=new Map(after.people.filter(p=>p.role==='general').map(p=>[effectKey(p),p]));
  const add=(countryId,role,slot,type,delta,label,tone)=>output.units.push({countryId,role,slot,type,delta,label,tone});
  for(const c of after.countries){
    const prev=oldCountries.get(c.id);if(!prev)continue;
    const delta=(c.reserve??0)-(prev.reserve??0);
    if(delta)add(c.id,'king',null,'army',delta,`수도 ${effectSign(delta)}만`,delta>0?'positive':'negative');
    const recruitment=c.recruitment-prev.recruitment;
    if(recruitment)add(c.id,'king',null,'recruitment',recruitment,`매 라운드 충원 ${effectSign(recruitment)}만`,'upgrade');
    const supply=(c.supplyBonus??0)-(prev.supplyBonus??0);
    if(supply)add(c.id,'king',null,'supply',supply,`지휘한도 ${effectSign(supply)}만`,'upgrade');
    if(c.capitalId&&prev.capitalId!==c.capitalId)add(c.id,'king',null,'capital',0,'수도 이전','neutral');
  }
  for(const key of new Set([...oldGenerals.keys(),...nextGenerals.keys()])){
    const prev=oldGenerals.get(key),next=nextGenerals.get(key),p=next||prev;
    const delta=(next?.troops??0)-(prev?.troops??0);
    if(delta)add(p.countryId,'general',p.slot,'army',delta,`${event.type==='roster'&&delta<0?'이관 ':''}${effectSign(delta)}만`,delta>0?'positive':'negative');
    const capacity=(next?.capacity??0)-(prev?.capacity??0);
    if(capacity&&next?.active&&next?.alive&&event.type==='resolve')add(p.countryId,'general',p.slot,'capacity',capacity,`한도 ${effectSign(capacity)}만`,'upgrade');
    if(prev?.alive&&next?.alive===false)add(p.countryId,'general',p.slot,'death',0,'전사','negative');
    if((next?.generation??0)>(prev?.generation??0))add(p.countryId,'general',p.slot,'appointment',0,'후임 부임','upgrade');
  }
  for(let i=0;i<after.territories.length;i++){
    const t=after.territories[i],prev=before.territories[i];
    if(t.ownerId!==prev?.ownerId){const c=after.countries.find(c=>c.id===t.ownerId);output.territories.push({territoryId:t.id,countryId:t.ownerId,label:`${c?.name||'무주지'} 점령`});}
  }
  if(event.type==='resolve'&&!output.units.length&&!output.territories.length&&!event.success)add(event.nationId,'king',null,'unchanged',0,'+0만 · 변화 없음','neutral');
  if(event.type==='elimination')add(event.targetId,'king',null,'elimination',0,'멸망','negative');
  output.announcement=event.type==='round_end'?'라운드 병력 생산':event.type==='roster'?'지휘 구역 재편':event.title||'';
  return output;
}

export function renderMapEffects(effects,geometry,world,currentMarkers,beforeMarkers=[]) {
  const same=(m,e)=>m.country.id===e.countryId&&m.role===e.role&&(e.role==='king'||m.person?.slot===e.slot);
  const stacks=new Map(),occupied=[];
  const textWidth=(text,size)=>[...text].reduce((n,c)=>n+(/[가-힣]/.test(c)?size:size*.58),0)+20;
  const labels=effects.units.map(e=>{
    const marker=currentMarkers.find(m=>same(m,e))||beforeMarkers.find(m=>same(m,e));if(!marker)return '';
    const key=`${e.countryId}:${e.role}:${e.slot}`,row=stacks.get(key)||0;stacks.set(key,row+1);
    const width=Math.min(300,Math.max(74,textWidth(e.label,17)));
    const x=Math.min(1200-width/2-4,Math.max(width/2+4,marker.point[0]));
    const y=Math.max(28,marker.point[1]-38-row*26);
    occupied.push({x:x-width/2,y:y-22,w:width,h:26});
    return `<g class="map-unit-feedback ${e.tone}" data-effect="${e.type}" data-country="${esc(e.countryId)}" data-role="${e.role}" data-slot="${e.slot??''}" data-delta="${e.delta}" transform="translate(${x},${y})"><path d="M0 4V12"/><rect x="${-width/2}" y="-22" width="${width}" height="26" rx="5"/><text text-anchor="middle" y="-4">${esc(e.label)}</text></g>`;
  }).join('');
  const territories=effects.territories.map(e=>{
    const t=world.territories.find(t=>t.id===e.territoryId);if(!t)return '';
    const point=geometry.cells[t.row*world.cols+t.col].center,label=e.label.length>17?e.label.slice(0,14)+'… 점령':e.label,width=Math.max(90,textWidth(label,13));
    const spots=[[0,24],[0,-34],[0,52],[0,-58],[70,24],[-70,24],[0,80],[100,50],[-100,50]];
    let chosen;
    for(const [dx,dy] of spots){const box={x:Math.min(1196-width,Math.max(4,point[0]+dx-width/2)),y:Math.min(770,Math.max(4,point[1]+dy-14)),w:width,h:21};if(!occupied.some(o=>box.x<o.x+o.w+4&&box.x+box.w+4>o.x&&box.y<o.y+o.h+4&&box.y+box.h+4>o.y)){chosen=box;break;}}
    chosen ||= {x:point[0]-width/2,y:point[1]+10,w:width,h:21};occupied.push(chosen);
    const x=chosen.x+width/2,y=chosen.y+14;
    return `<g class="map-territory-feedback" data-territory-effect="${esc(t.id)}" transform="translate(${x},${y})"><path d="M${point[0]-x} ${point[1]-y}L0 0"/><rect x="${-width/2}" y="-14" width="${width}" height="21" rx="4"/><text text-anchor="middle" y="1">${esc(label)}</text></g>`;
  }).join('');
  return labels||territories?`<g class="map-feedback-layer" pointer-events="none">${territories}${labels}</g>`:'';
}
