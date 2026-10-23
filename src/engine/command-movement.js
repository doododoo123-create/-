import { neighbors } from '../model/world.js';
export function fieldCamps(world){
 const camps={};for(const p of world.people)if(p.role==='general'&&p.active&&p.alive&&p.positionId&&p.positionId!==p.stationId)Object.defineProperty(camps,p.id,{value:{territoryId:p.positionId,homeId:p.stationId},enumerable:true,writable:true,configurable:true});return validCamps(world,camps);
}
function recordedFieldMovements(record,before,after){
 record.campsBefore=fieldCamps(before);record.movements=[];
 for(const event of record.events){
  if(event.type!=='territory'&&!event.moves)continue;
  const battle=record.battles[event.battleIndex],frame=record.frames[event.index];
  const moves=(event.moves||battle?.moves||[]).map(m=>{
   const countryId=before.countries[m.nation].id,person=frame.before.people.find(p=>p.role==='general'&&p.countryId===countryId&&p.slot===m.slot&&p.generation===m.generation);
   return person?{personId:person.id,countryId,slot:m.slot,kind:m.kind,...(Number.isInteger(m.battlefieldFrom)?{visualFromId:before.territories[m.battlefieldFrom].id,presentationOnly:!!m.presentationOnly,encircled:!!m.encircled}:{}),fromId:before.territories[m.from].id,toId:before.territories[m.to].id,path:m.path.map(i=>before.territories[i].id)}:null;
  }).filter(Boolean);
  if(moves.length){const camps=fieldCamps(frame.after);for(const m of moves)Object.defineProperty(camps,m.personId,{value:{territoryId:m.toId,homeId:frame.after.people.find(p=>p.id===m.personId)?.stationId},enumerable:true,writable:true,configurable:true});record.movements.push({eventIndex:event.index,battleIndex:event.battleIndex,moves,camps});}
 }
 record.campsAfter=fieldCamps(after);return record.campsAfter;
}
// The legacy branch plans visual camps; the field branch reads authoritative recorded moves. Neither consumes RNG.
export function validCamps(world,camps={}){
  const result={};if(!camps||typeof camps!=='object')return result;for(const p of world.people){const camp=Object.hasOwn(camps,p.id)?camps[p.id]:null;if(p.role==='general'&&p.active&&p.alive&&camp&&world.territories.some(t=>t.id===camp.territoryId&&t.ownerId===p.countryId))Object.defineProperty(result,p.id,{value:{territoryId:camp.territoryId,homeId:p.stationId},enumerable:true,writable:true,configurable:true});}return result;
}
export function friendlyPaths(world,countryId,start){
  const first=world.territories.find(t=>t.id===start&&t.ownerId===countryId),paths=new Map();if(!first)return paths;
  paths.set(start,[start]);const queue=[first];for(let i=0;i<queue.length;i++)for(const n of neighbors(world,queue[i]))if(n.ownerId===countryId&&!paths.has(n.id)){paths.set(n.id,[...paths.get(queue[i].id),n.id]);queue.push(n);}return paths;
}
export function planCommandMovements(record,before,after,initial={}){
  if(before.rules.battleMode==='additive30'&&before.rules.fieldCommand)return recordedFieldMovements(record,before,after);
  let camps=validCamps(before,initial);record.campsBefore=structuredClone(camps);record.movements=[];
  for(const event of record.events){
    const frame=record.frames?.[event.index],world=frame?.before||before;
    camps=validCamps(world,camps);
    if(event.type!=='territory'||!Number.isInteger(event.battleIndex))continue;
    const battle=record.battles[event.battleIndex];if(!battle)continue;const moves=[];
    const move=(countryId,slot,kind)=>{
      const person=world.people.find(p=>p.countryId===countryId&&p.slot===slot&&p.role==='general'&&p.active&&p.alive);if(!person)return;
      const fromId=camps[person.id]?.territoryId||person.stationId,paths=friendlyPaths(world,countryId,fromId);
      let toId=person.stationId;
      if(kind==='outbound'){
        const target=world.territories.find(t=>t.id===battle.territoryId),front=target?neighbors(world,target).filter(t=>t.ownerId===countryId&&paths.has(t.id)):[];
        front.sort((a,b)=>(Number(b.id===battle.fromId)-Number(a.id===battle.fromId))||paths.get(a.id).length-paths.get(b.id).length||(a.id<b.id?-1:a.id>b.id?1:0));toId=front[0]?.id||fromId;
      }
      const path=paths.get(toId);if(!path)return;
      if(toId!==fromId)moves.push({personId:person.id,countryId,slot,kind,fromId,toId,path});
      if(toId===person.stationId)delete camps[person.id];else Object.defineProperty(camps,person.id,{value:{territoryId:toId,homeId:person.stationId},enumerable:true,writable:true,configurable:true});
    };
    move(battle.defenderId,battle.defenseSlot,'return');move(battle.actorId,battle.slot,'outbound');
    if(moves.length)record.movements.push({eventIndex:event.index,battleIndex:event.battleIndex,moves,camps:structuredClone(camps)});
  }
  record.campsAfter=validCamps(after,camps);return record.campsAfter;
}
