import {troopCenterOffset,troopGrid} from './troop-layout.js';
import {mapAnchor} from '../model/cartography-geometry.js';
import {esc} from './icons.js';
import {armyRatioBonus} from '../model/combat-rules.js';
// Display-only appraisal: never changes combat stats or consumes random numbers.
export function troopTier(person,army,rules){
 const strength=armyRatioBonus(army,7,rules)-armyRatioBonus(7,army,rules)+(person.attackAbility??person.ability??0)/2+(person.defenseAbility??person.ability??0)/2+(person.personalAbility??0)+Math.min(6,Math.floor((person.underdogWins||0)/3)*2);
 return strength>=14?'tier3':strength>=4?'tier2':'tier1';
}
export function troopState(person,scene,record){
 const b=record?.battles?.[scene?.battleIndex],side=!scene?.massRecap&&b&&(person.id===b.attackerPersonId?'attack':person.id===b.defenderPersonId?'defense':null);
 const move=scene?.kind==='movement'&&scene.moves?.find(m=>m.personId===person.id);
 if(scene?.kind==='apply'&&scene.event?.type==='death'&&scene.event.nationId===person.countryId&&scene.event.slot===person.slot)return {action:'death',side};
 if(move)return {action:scene.batchRetreat?'retreat':move.kind==='retreat'?'retreat':move.kind==='redeploy'?'idle':'walk',side};
 if(side&&!b.automatic){
  if(scene.kind==='apply'&&scene.event?.type==='resolve'&&['troops','all'].includes(scene.effectStage)&&b.losses?.[side]?.amount>0)return {action:'hurt',side};
  if(['route','roll'].includes(scene.kind)&&['territory','attack_roll','defense_roll'].includes(scene.event?.type))return {action:side==='attack'?'attack':'guard',side};
 }
 return {action:'idle',side};
}
export const troopCount=army=>army>0?(army>=15?3:army>=8?2:1):0;
export function troopGroups(markers,scene,armies=new Map()){
 const groups=new Map(),byPerson=new Map();
 for(const m of markers){const p=m.person;if(!p||p.role==='minister'||!p.active||p.alive===false&&!m.ghost)continue;
  const moving=scene?.kind==='movement'&&scene.moves?.some(v=>v.personId===p.id),key='unit:'+p.id;
  if(!groups.has(key))groups.set(key,{leaderId:p.id,members:[],ids:new Set()});const g=groups.get(key);
  for(const member of armies.get(p.id)?.members||[p])if(!g.ids.has(member.id)){g.ids.add(member.id);g.members.push(member);}
  byPerson.set(p.id,g);
 }
 return byPerson;
}
export function renderTroopToken(person,country,world,scene,record,group=null){
 if(!person||person.role==='minister'||!person.active||person.alive===false&&scene?.event?.type!=='death')return '';
 if(group?.leaderId&&group.leaderId!==person.id)return '';
 const members=group?.members||[person],seen=new Set(),soldiers=[];
 for(const p of members){if(seen.has(p.id))continue;seen.add(p.id);
  const state=troopState(p,scene,record),b=record?.battles?.[scene?.battleIndex],before=state.side?scene.worldBefore?.people.find(q=>q.id===p.id):null,army=state.side?b[state.side].army:p.troops;
  if(!(p.troops>0)&&!['death','hurt'].includes(state.action))continue;
  const tier=troopTier(before||p,army,world.rules);let flip=state.side==='defense';
  if(state.side&&b){const left=mapAnchor(world,b.fromId,'reference')[0]<=mapAnchor(world,b.territoryId,'reference')[0];flip=state.side==='attack'?!left:left;}
  const move=scene?.kind==='movement'&&scene.moves?.find(m=>m.personId===p.id);if(!state.side&&move){const a=mapAnchor(world,move.fromId,'station'),d=mapAnchor(world,move.toId,'station');flip=move.kind==='retreat'?d[0]>a[0]:d[0]<a[0];}
  for(let n=0;n<Math.max(state.action==='death'?1:0,troopCount(army));n++)soldiers.push({tier,action:state.action,personId:p.id,flip,active:!!state.side&&!b?.automatic&&['territory','attack_roll','defense_roll','resolve'].includes(scene?.event?.type)&&!['capture','arrival','summary'].includes(scene?.kind)});
 }
 if(!soldiers.length)return '';
 const grid=troopGrid(soldiers.length),x=-grid.width/2,y=35-grid.height/2;
 return `<foreignObject x="${x}" y="${y}" width="${grid.width}" height="${grid.height}" pointer-events="none" class="troop-token"><canvas xmlns="http://www.w3.org/1999/xhtml" width="${grid.width}" height="${grid.height}" data-troop-action="${soldiers[0].action}" data-troop-tiers="${soldiers.map(s=>s.tier).join(',')}" data-troop-count="${soldiers.length}" data-troop-soldiers="${esc(JSON.stringify(soldiers))}" data-troop-color="${esc(country.color)}" data-troop-width="${grid.width}" data-troop-height="${grid.height}" data-troop-origin-y="${grid.height/2+troopCenterOffset(soldiers.length)}" style="width:${grid.width}px;height:${grid.height}px;pointer-events:none" aria-label="소속 병력"></canvas></foreignObject>`;
}
