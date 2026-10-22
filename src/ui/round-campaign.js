import { cellPoints, mapAnchor } from '../model/cartography-geometry.js';
import { battleRoute } from './battle-map.js';
import { esc } from './icons.js';

// Only revealed events are read. This round-long display never changes engine ownership or RNG.
export function completedRoundPresentation(run){
 const record=run?.history?.at(-1);if(!record)return null;
 return {record,scenes:[],index:0,finished:true,roundRecords:run.history.filter(r=>r.round===record.round&&r.turn<record.turn)};
}
export function roundCampaign(world,presentation){
 const record=presentation?.record,empty={captures:new Map(),routes:[],fronts:[],movements:[],baseOwners:new Map(),settled:true};
 if(!record)return empty;
 const scene=presentation.scenes?.[presentation.index],events=record.events||[],roundEnd=events.find(e=>e.type==='round_end');
 if(presentation.finished&&(roundEnd||record.result)||scene&&((roundEnd&&scene.event?.index>=roundEnd.index)||scene.event?.type==='finish'))return empty;
 const past=(presentation.roundRecords||[]).filter(r=>r.round===record.round&&r.turn<record.turn),records=[...past,record];
 const before=presentation.before||record.frames?.[0]?.before;
 const baseOwners=new Map((before||world).territories.map(t=>[t.id,t.ownerId]));
 if(!before)for(const c of [...(record.changes||[])].reverse())baseOwners.set(c.territoryId,c.from);
 for(const r of [...past].reverse())for(const c of [...(r.changes||[])].reverse())baseOwners.set(c.territoryId,c.from);
 const captures=new Map(),routes=[],fronts=new Map(),movements=[],lanes=new Map();
 const limit=presentation.finished?Infinity:scene?.event?.index??-1;
 const applied=r=>r!==record||presentation.finished;
 for(const r of records){
  for(const motion of r.movements||[])if(applied(r)||motion.eventIndex<limit||motion.eventIndex===limit&&scene?.kind!=='movement')for(const m of motion.moves)if(m.kind!=='redeploy')movements.push({...m,key:`${r.turn}:${motion.eventIndex}:${m.personId}`});
  for(const b of r.battles||[]){
   const event=r.events.find(e=>e.type==='territory'&&e.battleIndex===b.index),resolve=r.events.find(e=>e.type==='resolve'&&e.battleIndex===b.index);
   const revealed=applied(r)||event&&(event.index<limit||event.index===limit&&scene?.kind!=='movement');
   if(!revealed)continue;
   const frame=r.frames?.[event?.index]?.before,motion=r.movements?.find(m=>m.eventIndex===event?.index);
   for(const [side,countryId,slot] of [['attack',b.actorId,b.slot],['defense',b.defenderId,b.defenseSlot]]){
    if(side==='defense'&&b.automatic)continue;
    const moving=motion?.moves.find(m=>m.countryId===countryId&&m.slot===slot),person=frame?.people.find(p=>p.role==='general'&&p.countryId===countryId&&p.slot===slot);
    const fromId=moving?.fromId||person?.positionId||person?.stationId||(side==='attack'?b.fromId:b.territoryId);
    const laneKey=`${side}:${fromId}:${b.territoryId}`,lane=lanes.get(laneKey)||0;lanes.set(laneKey,lane+1);
    routes.push({key:`${r.turn}-${b.index}-${side}`,side,countryId,fromId,toId:b.territoryId,lane,active:r===record&&scene?.battleIndex===b.index&&presentation.phase!=='settled'});
   }
   const resolved=applied(r)||resolve&&(resolve.index<limit||resolve.index===limit&&scene?.kind==='apply'&&(presentation.phase==='settled'||['territory','growth','all'].includes(presentation.effectStage)));
   if(!resolved)continue;
   for(const id of b.takenTerritoryIds||[])captures.set(id,{territoryId:id,ownerId:b.captureOwner===b.target?b.defenderId:b.actorId,baseOwnerId:baseOwners.get(id)});
   if(b.captureOwner===b.target&&b.takenTerritoryIds?.length){
    const toId=b.takenTerritoryIds[0],laneKey=`defense:${b.territoryId}:${toId}`,lane=lanes.get(laneKey)||0;lanes.set(laneKey,lane+1);
    routes.push({key:`${r.turn}-${b.index}-counter`,side:'defense',countryId:b.defenderId,fromId:b.territoryId,toId,lane,active:r===record&&scene?.battleIndex===b.index&&presentation.phase!=='settled'});
   }
   const key=[b.fromId,b.territoryId].sort().join('|');
   if(b.winner===null)fronts.set(key,{fromId:b.fromId,toId:b.territoryId});else fronts.delete(key);
  }
 }
 const owned=new Map(world.territories.map(t=>[t.id,t.ownerId]));
 for(const [id,c] of captures)if(owned.get(id)!==c.ownerId)captures.delete(id);
 return {captures,routes,movements,fronts:[...fronts.values()].filter(f=>owned.get(f.fromId)!==owned.get(f.toId)),baseOwners,settled:false};
}
const frontPathCache=new WeakMap();
export function sharedFrontPath(geometry,a,b){
 if(!a||!b)return '';
 if(!frontPathCache.has(geometry))frontPathCache.set(geometry,new Map());const cache=frontPathCache.get(geometry),key=[a.id,b.id].sort().join(':');if(cache.has(key))return cache.get(key);
 const paths=[];
 for(const ringA of [cellPoints(a),...(a.holes||[])])for(let i=0;i<ringA.length;i++){
  const p=ringA[i],q=ringA[(i+1)%ringA.length],dx=q[0]-p[0],dy=q[1]-p[1],length=Math.hypot(dx,dy);if(!length)continue;
  for(const ringB of [cellPoints(b),...(b.holes||[])])for(let j=0;j<ringB.length;j++){
   const r=ringB[j],s=ringB[(j+1)%ringB.length];
   if(Math.abs(dx*(r[1]-p[1])-dy*(r[0]-p[0]))/length>.015||Math.abs(dx*(s[1]-p[1])-dy*(s[0]-p[0]))/length>.015)continue;
   const at=v=>((v[0]-p[0])*dx+(v[1]-p[1])*dy)/(length*length),lo=Math.max(0,Math.min(at(r),at(s))),hi=Math.min(1,Math.max(at(r),at(s)));
   if(hi-lo>.0001)paths.push(`M${p[0]+lo*dx},${p[1]+lo*dy} L${p[0]+hi*dx},${p[1]+hi*dy}`);
  }
 }
 const path=paths.join(' ');cache.set(key,path);return path;
}
export function campaignHatchDefs(world){return world.countries.map((c,i)=>`<pattern id="round-hatch-${i}" patternUnits="userSpaceOnUse" width="8" height="8"><path d="M0 0H8M0 0V8" fill="none" stroke="${c.color}" stroke-width="2.5"/><path d="M1 1H8M1 1V8" fill="none" stroke="#000" stroke-opacity=".3" stroke-width=".5"/></pattern>`).join('');}
export function renderRoundCaptures(world,geometry,campaign){return `<g class="round-captures" pointer-events="none">${[...campaign.captures.values()].map(c=>{const i=world.territories.findIndex(t=>t.id===c.territoryId),owner=world.countries.findIndex(n=>n.id===c.ownerId);return `<path class="round-captured-territory" data-round-capture="${esc(c.territoryId)}" data-capture-owner="${esc(c.ownerId)}" d="${geometry.cells[i].path}" fill="url(#round-hatch-${owner})" fill-rule="evenodd" stroke="${world.countries[owner]?.color||'#fff'}" stroke-width="1.5"/>`;}).join('')}</g>`;}
export function renderRoundRoutes(world,geometry,campaign){
 const country=id=>world.countries.find(c=>c.id===id);
 const routes=campaign.routes.map(r=>battleRoute(mapAnchor(world,r.fromId,'station',geometry),mapAnchor(world,r.toId,'battle',geometry),r.side,country(r.countryId)?.color,{id:r.key,lane:r.lane,active:r.active})).join('');
 const frontLines=campaign.fronts.map(f=>{const a=geometry.cells[world.territories.findIndex(t=>t.id===f.fromId)],b=geometry.cells[world.territories.findIndex(t=>t.id===f.toId)],d=sharedFrontPath(geometry,a,b);return d?`<g class="round-stalemate" data-front-from="${esc(f.fromId)}" data-front-to="${esc(f.toId)}"><path class="front-shadow" d="${d}"/><path class="front-line" d="${d}"/></g>`:'';}).join('');
 const marches=campaign.movements.map(m=>`<path class="round-march ${esc(m.kind)}" data-round-move="${esc(m.key)}" style="stroke:${country(m.countryId)?.color||'#fff'}" d="M${m.path.map(id=>mapAnchor(world,id,'station',geometry)).filter(Boolean).map(p=>p.join(',')).join(' L')}"/>`).join('');
 return `<g class="round-campaign-history" pointer-events="none">${marches}${routes}${frontLines}</g>`;
}
