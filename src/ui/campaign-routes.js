import { mapAnchor } from '../model/cartography-geometry.js';
import { neighbors } from '../model/world.js';
import { battleRoute } from './battle-map.js';
import { esc } from './icons.js';

// Aggregate only revealed engagements, independently of the duel cards' display positions.
export function groupedOperations(campaign){
 const groups=new Map();
 for(const r of campaign.routes){
  const fromId=r.fromId,key=[r.countryId,r.side,(r.path||[fromId,r.toId]).join('>')].join(':');if(fromId===r.toId)continue;
  if(!groups.has(key))groups.set(key,{...r,fromId,key,count:0,active:false,people:new Set()});
  const g=groups.get(key);g.count++;g.active||=r.active;if(r.personId)g.people.add(r.personId);
 }
 return [...groups.values()];
}
export function renderOperationalFront(world,geometry,campaign,frontPath){
 if(campaign.settled||!campaign.opponentId)return '';
 const paths=[],seen=new Set(),cell=id=>geometry.cells[world.territories.findIndex(t=>t.id===id)];
 for(const a of world.territories.filter(t=>t.ownerId===campaign.actorId))for(const b of neighbors(world,a))if(b.ownerId===campaign.opponentId){
  const key=[a.id,b.id].sort().join(':');if(seen.has(key))continue;seen.add(key);
  const d=frontPath(geometry,cell(a.id),cell(b.id));if(d)paths.push(d);
 }
 return paths.length?`<g class="operational-front" pointer-events="none" data-front-actor="${esc(campaign.actorId)}" data-front-opponent="${esc(campaign.opponentId)}"><path d="${paths.join(' ')}"/></g>`:'';
}
export function renderCampaignRoutes(world,geometry,campaign,{frontPath,scene,progress=0,selectedPersonId=null,speed=1}={}){
 const country=id=>world.countries.find(c=>c.id===id),anchor=(id,kind='station')=>mapAnchor(world,id,kind,geometry);
 const operations=groupedOperations(campaign).map(r=>{
  const from=anchor(r.fromId,'reference'),to=anchor(r.toId,'battle');if(!from||!to)return '';
  const names=[...r.people].map(id=>world.people.find(p=>p.id===id)?.name).filter(Boolean).join(' · '),label=`${country(r.countryId)?.name||''} · ${names} · 이 구간 ${r.count}회 전투`;
  const count=r.count>1?`<text class="operation-count" x="${(from[0]+to[0])/2}" y="${(from[1]+to[1])/2-7}">×${r.count}</text>`:'';
  return `<g class="operation-arrow" data-operation-from="${esc(r.fromId)}" data-operation-to="${esc(r.toId)}" data-operation-count="${r.count}"><title>${esc(label)}</title>${battleRoute(from,to,r.side,country(r.countryId)?.color,{id:r.key,active:r.active,points:(r.path||[r.fromId,r.toId]).map((id,i,a)=>anchor(id,i===a.length-1?'battle':'station'))})}${count}</g>`;
 }).join('');
 const fronts=campaign.fronts.map(f=>{
  const cell=id=>geometry.cells[world.territories.findIndex(t=>t.id===id)],d=frontPath(geometry,cell(f.fromId),cell(f.toId));
  return d?`<g class="round-stalemate" data-front-from="${esc(f.fromId)}" data-front-to="${esc(f.toId)}"><path class="front-shadow" d="${d}"/><path class="front-line" d="${d}"/></g>`:'';
 }).join('');
 const moving=scene?.kind==='movement'?scene.moves||[]:[],shown=new Map();
 for(const m of campaign.movements)if(['retreat','redeploy'].includes(m.kind)||selectedPersonId===m.personId&&!['outbound','return','relief'].includes(m.kind))shown.set(m.key,m);
 for(const m of moving)if(!['outbound','return','relief'].includes(m.kind))shown.set(`live:${m.personId}`,{...m,key:`live:${m.personId}`,live:true});
 const liveIds=new Set(moving.map(m=>m.personId)),dedup=new Set();
 const marches=[...shown.values()].map(m=>{
  if(!m.live&&liveIds.has(m.personId))return '';
  const key=[m.kind,m.countryId,m.fromId,m.toId].join(':');if(dedup.has(key)&&!m.live)return '';dedup.add(key);
  const visualFrom=m.visualFromId||m.fromId,visualPath=m.visualFromId?[visualFrom,m.toId]:m.path;
  const points=visualPath.map((id,i)=>anchor(id,i===0&&m.visualFromId?'battle':'station')).filter(Boolean);if(points.length<2||visualFrom===m.toId)return '';
  const color=country(m.countryId)?.color||'#fff',person=world.people.find(p=>p.id===m.personId),label=esc(person?.name||'지휘관');
  if(m.kind==='redeploy')return `<g class="round-relocation ${m.live?'is-moving':''}" data-relocation-from="${esc(m.fromId)}" data-relocation-to="${esc(m.toId)}"><title>${label} · 경로 없는 재배치</title>${[points[0],points.at(-1)].map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="7" style="stroke:${color}"/>`).join('')}</g>`;
  const d=`M${points.map(p=>p.join(',')).join(' L')}`;
  if(m.kind==='retreat'){
   return `<g class="round-retreat" data-retreat-from="${esc(visualFrom)}" data-retreat-actual-from="${esc(m.fromId)}" data-retreat-to="${esc(m.toId)}" data-retreat-person="${esc(m.personId)}"><title>${label} · 후퇴</title>${battleRoute(points[0],points.at(-1),'attack',color,{id:'retreat-'+m.key,active:true})}</g>`;
  }
  let dot='';
  if(m.live){
   const fraction=Math.max(0,Math.min(1,progress));
   dot=`<circle class="march-progress-dot" cx="0" cy="0" r="3" style="fill:${color};offset-path:path('${d}');--march-time:${1.6/speed}s;--march-delay:${-1.6*fraction/speed}s"/>`;

  }
  return `<g class="operation-movement ${m.live?'is-moving':'is-selected'}" data-round-move="${esc(m.key)}"><title>${label} · 실제 이동</title><path class="round-march ${esc(m.kind)}" style="stroke:${color}" d="${d}"/>${dot}</g>`;
 }).join('');
 return `<g class="round-campaign-history" pointer-events="none">${marches}${operations}${fronts}</g>`;
}
