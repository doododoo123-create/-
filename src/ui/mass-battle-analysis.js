import {campaignPerson} from './campaign-playback.js';
import {troopTier} from './troop-presentation.js';
import {displayName} from './display-names.js';

// Immutable adapter: country allegiance never changes when a counterattack
// swaps a recorded battle's attack/defense columns.
export function analyzeMassBattle(group,record){
 const before=group.originalScenes[0].worldBefore,after=group.originalScenes.at(-1).worldAfter;
 const lo=Math.min(...group.originalScenes.map(s=>s.event?.index).filter(Number.isFinite)),hi=Math.max(...group.originalScenes.map(s=>s.event?.index).filter(Number.isFinite));
 const events=record.events.filter(e=>e.index>=lo&&e.index<=hi),units=new Map();
 const battles=group.battles.map(b=>{
  const world=record.frames?.[events.find(e=>e.type==='territory'&&e.battleIndex===b.index)?.index]?.before||group.originalScenes.find(s=>s.battleIndex===b.index)?.worldBefore||before;
  const ids={};
  for(const side of ['attack','defense']){
   if(side==='defense'&&b.automatic)continue;
   const countryId=side==='attack'?b.actorId:b.defenderId,p=campaignPerson(world,b,side),id=p?.id||(side==='attack'?b.attackerPersonId:b.defenderPersonId)||`${countryId}:${side==='defense'&&b.defenseRole==='king'?'king':'general'}:${side==='attack'?b.slot:b.defenseSlot}`;
   ids[side]=id;
   if(!units.has(id)){
    const initial=before.people.find(q=>q.id===id)||p,country=before.countries.find(c=>c.id===countryId),army=b[side].army;
    units.set(id,{id,countryId,side:countryId===group.actorId?'attack':'defense',name:displayName(p,b[side].name),role:p?.role||'general',color:country?.color||'#819aba',startArmy:initial?.troops??army,initialAlive:initial?.alive!==false,tier:troopTier(p||{},army,before.rules),firstBattle:b.index,battleIds:[],person:p||initial});
   }
   units.get(id).battleIds.push(b.index);
  }
  return {...b,attackId:ids.attack,defenseId:ids.defense};
 });
 // Include assembled, non-fighting members as actual waiting troops, without
 // inventing opponents or giving those troops any combat damage.
 for(const meta of [group.assemblyMetadata,...group.defenseMetadata||[]].filter(Boolean)){
  const country=before.countries[meta.nation??record.events.find(e=>e.armyGroup===meta)?.nation]||before.countries.find(c=>c.id===group.actorId);
  if(!country)continue;
  for(const m of meta.members){const p=before.people.find(p=>p.countryId===country.id&&p.role==='general'&&p.slot===m.slot&&p.generation===m.generation);
   if(!p||units.has(p.id)||!p.alive||!p.active)continue;
   units.set(p.id,{id:p.id,countryId:country.id,side:country.id===group.actorId?'attack':'defense',name:displayName(p),role:p.role,color:country.color,startArmy:p.troops,initialAlive:true,tier:troopTier(p,p.troops,before.rules),firstBattle:null,battleIds:[],person:p});
  }
 }
 const changes=after.territories.filter(t=>before.territories.find(v=>v.id===t.id)?.ownerId!==t.ownerId).map(t=>({id:t.id,name:t.name,from:before.territories.find(v=>v.id===t.id)?.ownerId,to:t.ownerId}));
 const losses={attack:0,defense:0};for(const b of battles)for(const side of ['attack','defense'])losses[(side==='attack'?b.actorId:b.defenderId)===group.actorId?'attack':'defense']+=b.losses?.[side]?.amount||0;
 const rounds=new Map();for(const b of battles)for(const id of [b.attackId,b.defenseId].filter(Boolean)){if(!rounds.has(id))rounds.set(id,[]);rounds.get(id).push(b);}
 const won=(b,id)=>b.winner!==null&&(b.winner===b.actor?b.attackId:b.defenseId)===id;
 const winners=[...units.values()].filter(u=>rounds.get(u.id)?.some(b=>won(b,u.id))),advancers=battles.filter(b=>b.takenTerritoryIds?.length),defenseWins=battles.filter(b=>!b.automatic&&b.winner===b.target);
 const defeated=[...units.values()].filter(u=>{const b=rounds.get(u.id)?.at(-1);return b&&!b.automatic&&b.winner!==null&&!won(b,u.id);});
 return {id:group.id,actorId:group.actorId,opponentId:group.opponentId,before,after,events,battles,units:[...units.values()],changes,losses,rounds,winners,defeated,advancers,defenseWins,quantum:before.rules.troopRounding==='ten-thousand'?1:.0001,group,record};
}
