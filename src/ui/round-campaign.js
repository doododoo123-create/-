import { cellPoints, mapAnchor } from '../model/cartography-geometry.js';
import { renderCampaignRoutes } from './campaign-routes.js';
import { esc } from './icons.js';

// Only revealed events are read. This round-long display never changes engine ownership or RNG.
export function completedRoundPresentation(run){
 const record=run?.history?.at(-1);if(!record)return null;
 return {record,scenes:[],index:0,finished:true,roundRecords:run.history.filter(r=>r.round===record.round&&r.turn<record.turn)};
}
export function roundCampaign(world,presentation){
 const record=presentation?.record,empty={captures:new Map(),routes:[],fronts:[],movements:[],battleSites:[],baseOwners:new Map(),settled:true};
 if(!record)return empty;
 const scene=presentation.scenes?.[presentation.index],events=record.events||[];
 // A summary has no event index: it still contains every revealed result of this turn.
 // Keep season effects through production and the inter-turn pause. The next round's
 // first record naturally starts with an empty history at its season announcement.
 const complete=!!presentation.finished||scene?.kind==='summary';
 const past=(presentation.roundRecords||[]).filter(r=>r.round===record.round&&r.turn<record.turn),records=[...past,record];
 const before=presentation.before||record.frames?.[0]?.before;
 const baseOwners=new Map((before||world).territories.map(t=>[t.id,t.ownerId]));
 if(!before)for(const c of [...(record.changes||[])].reverse())baseOwners.set(c.territoryId,c.from);
 for(const r of [...past].reverse())for(const c of [...(r.changes||[])].reverse())baseOwners.set(c.territoryId,c.from);
 const captures=new Map(),routes=[],fronts=new Map(),movements=[],lanes=new Map(),battleSites=new Map();
 const limit=complete?Infinity:scene?.event?.index??-1;
 const applied=r=>r!==record||complete;
 for(const r of records){
  for(const motion of r.movements||[])for(const m of motion.moves)if(applied(r)||motion.eventIndex<limit||motion.eventIndex===limit&&(scene?.kind!=='movement'||['retreat','redeploy'].includes(m.kind)))movements.push({...m,key:`${r.turn}:${motion.eventIndex}:${m.personId}`});
  for(const b of r.battles||[]){
   const event=r.events.find(e=>e.type==='territory'&&e.battleIndex===b.index),resolve=r.events.find(e=>e.type==='resolve'&&e.battleIndex===b.index);
   const revealed=applied(r)||event&&(event.index<limit||event.index===limit&&scene?.kind!=='movement');
   if(!revealed)continue;
   if(!b.automatic){const site=battleSites.get(b.territoryId)||{territoryId:b.territoryId,count:0};site.count++;battleSites.set(b.territoryId,site);}
   const frame=r.frames?.[event?.index]?.before,motion=r.movements?.find(m=>m.eventIndex===event?.index);
   for(const [side,countryId,slot] of [['attack',b.actorId,b.slot],['defense',b.defenderId,b.defenseSlot]]){
    if(side==='defense'&&b.automatic)continue;
    const moving=motion?.moves.find(m=>m.countryId===countryId&&m.slot===slot),person=frame?.people.find(p=>p.role==='general'&&p.countryId===countryId&&p.slot===slot);
    const fromId=moving?.fromId||person?.positionId||person?.stationId||(side==='attack'?b.fromId:b.territoryId);
    if(side==='defense'&&fromId===b.territoryId)continue;
    const laneKey=`${side}:${fromId}:${b.territoryId}`,lane=lanes.get(laneKey)||0;lanes.set(laneKey,lane+1);
    routes.push({key:`${r.turn}-${b.index}-${side}`,side,countryId,fromId,frontId:b.fromId,personId:person?.id||(side==='attack'?b.attackerPersonId:b.defenderPersonId),toId:b.territoryId,lane,active:r===record&&scene?.battleIndex===b.index&&presentation.phase!=='settled'});
   }
   const resolved=applied(r)||resolve&&(resolve.index<limit||resolve.index===limit&&scene?.kind==='apply'&&(presentation.phase==='settled'||['territory','growth','all'].includes(presentation.effectStage)));
   if(!resolved)continue;
   for(const id of b.takenTerritoryIds||[])captures.set(id,{territoryId:id,ownerId:b.captureOwner===b.target?b.defenderId:b.actorId,baseOwnerId:baseOwners.get(id)});
   if(b.captureOwner===b.target&&b.takenTerritoryIds?.length){
    const toId=b.takenTerritoryIds[0],laneKey=`defense:${b.territoryId}:${toId}`,lane=lanes.get(laneKey)||0;lanes.set(laneKey,lane+1);
    routes.push({key:`${r.turn}-${b.index}-counter`,side:'defense',counterattack:true,countryId:b.defenderId,personId:b.defenderPersonId,fromId:b.territoryId,toId,lane,active:r===record&&scene?.battleIndex===b.index&&presentation.phase!=='settled'});
   }
   const key=[b.fromId,b.territoryId].sort().join('|');
   if(b.winner===null)fronts.set(key,{fromId:b.fromId,toId:b.territoryId});else fronts.delete(key);
  }
 }
 const owned=new Map(world.territories.map(t=>[t.id,t.ownerId]));
 for(const [id,c] of captures)if(owned.get(id)!==c.ownerId)captures.delete(id);
 const target=events.find(e=>e.type==='war_target'&&(e.index<limit||complete||e.index===limit&&['locked','departing'].includes(presentation.phase)));
 return {captures,routes,movements,battleSites:[...battleSites.values()],actorId:record.actorId,opponentId:target?.targetId,fronts:[...fronts.values()].filter(f=>owned.get(f.fromId)!==owned.get(f.toId)),baseOwners,settled:false};
}
const frontPathCache=new WeakMap();
export function sharedFrontSegments(geometry,a,b){
 if(!a||!b)return [];
 if(!frontPathCache.has(geometry))frontPathCache.set(geometry,new Map());const cache=frontPathCache.get(geometry),key=[geometry.cells.indexOf(a),geometry.cells.indexOf(b)].sort((x,y)=>x-y).join(':');if(cache.has(key))return cache.get(key);
 const paths=[];
 for(const ringA of [cellPoints(a),...(a.holes||[])])for(let i=0;i<ringA.length;i++){
  const p=ringA[i],q=ringA[(i+1)%ringA.length],dx=q[0]-p[0],dy=q[1]-p[1],length=Math.hypot(dx,dy);if(!length)continue;
  for(const ringB of [cellPoints(b),...(b.holes||[])])for(let j=0;j<ringB.length;j++){
   const r=ringB[j],s=ringB[(j+1)%ringB.length];
   if(Math.abs(dx*(r[1]-p[1])-dy*(r[0]-p[0]))/length>.015||Math.abs(dx*(s[1]-p[1])-dy*(s[0]-p[0]))/length>.015)continue;
   const at=v=>((v[0]-p[0])*dx+(v[1]-p[1])*dy)/(length*length),lo=Math.max(0,Math.min(at(r),at(s))),hi=Math.min(1,Math.max(at(r),at(s)));
   if(hi-lo>.0001)paths.push([[p[0]+lo*dx,p[1]+lo*dy],[p[0]+hi*dx,p[1]+hi*dy]]);
  }
 }
 cache.set(key,paths);return paths;
}
export function sharedFrontPath(geometry,a,b){return sharedFrontSegments(geometry,a,b).map(([p,q])=>`M${p} L${q}`).join(' ');}
export function campaignHatchDefs(world){return world.countries.map((c,i)=>`<pattern id="round-hatch-${i}" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(28)"><path d="M0 0V4" fill="none" stroke="${c.color}" stroke-width="1.4"/><path d="M1 0V4" fill="none" stroke="#000" stroke-opacity=".3" stroke-width=".35"/></pattern>`).join('');}
export function renderRoundCaptures(world,geometry,campaign){return `<g class="round-captures" pointer-events="none">${[...campaign.captures.values()].map(c=>{const i=world.territories.findIndex(t=>t.id===c.territoryId),owner=world.countries.findIndex(n=>n.id===c.ownerId);return `<path class="round-captured-territory" data-round-capture="${esc(c.territoryId)}" data-capture-owner="${esc(c.ownerId)}" d="${geometry.cells[i].path}" fill="url(#round-hatch-${owner})" fill-rule="evenodd" stroke="${world.countries[owner]?.color||'#fff'}" stroke-width="1.5"/>`;}).join('')}</g>`;}
export function renderRoundRoutes(world,geometry,campaign,options={}){
 return renderCampaignRoutes(world,geometry,campaign,{frontPath:sharedFrontPath,...options});
}
