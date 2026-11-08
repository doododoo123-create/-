import {mapAnchor} from '../model/cartography-geometry.js';
import {esc} from './icons.js';
import {armyRatioBonus} from '../model/combat-rules.js';
// Display-only appraisal: never changes combat stats or consumes random numbers.
export function troopTier(person,army,rules){
 const strength=armyRatioBonus(army,7,rules)-armyRatioBonus(7,army,rules)+(person.attackAbility??person.ability??0)/2+(person.defenseAbility??person.ability??0)/2+(person.personalAbility??0)+Math.min(6,Math.floor((person.underdogWins||0)/3)*2);
 return strength>=14?'tier3':strength>=4?'tier2':'tier1';
}
export function troopState(person,scene,record){
 const b=record?.battles?.[scene?.battleIndex],side=b&&(person.id===b.attackerPersonId?'attack':person.id===b.defenderPersonId?'defense':null);
 const move=scene?.kind==='movement'&&scene.moves?.find(m=>m.personId===person.id);
 if(scene?.kind==='apply'&&scene.event?.type==='death'&&scene.event.nationId===person.countryId&&scene.event.slot===person.slot)return {action:'death',side};
 if(move)return {action:move.kind==='retreat'?'retreat':move.kind==='redeploy'?'idle':'walk',side};
 if(side&&!b.automatic){
  if(scene.kind==='apply'&&scene.event?.type==='resolve'&&['troops','all'].includes(scene.effectStage)&&b.losses?.[side]?.amount>0)return {action:'hurt',side};
  if(['route','roll'].includes(scene.kind)&&['territory','attack_roll','defense_roll'].includes(scene.event?.type))return {action:side==='attack'?'attack':'guard',side};
 }
 return {action:'idle',side};
}
export function renderTroopToken(person,country,world,scene,record,group=null){
 if(!person||person.role==='minister'||!person.active||person.alive===false&&scene?.event?.type!=='death')return '';
 const {action,side}=troopState(person,scene,record),b=record?.battles?.[scene?.battleIndex],before=side?scene.worldBefore?.people.find(p=>p.id===person.id):null,army=side?b[side].army:person.troops;
 if(!(person.troops>0)&&action!=='death'&&action!=='hurt')return '';
 const members=group?.members||[person],tiers=members.map(p=>troopTier(side&&p.id===person.id?before||p:p,side&&p.id===person.id?army:p.troops,world.rules));
 const total=group?.army??army,count=total>=15?3:total>=8?2:1;
 let flip=side==='defense';if(side&&b){const a=world.territories.find(t=>t.id===b.fromId),d=world.territories.find(t=>t.id===b.territoryId);if(a&&d){const left=mapAnchor(world,a.id,'reference')[0]<=mapAnchor(world,d.id,'reference')[0];flip=side==='attack'?!left:left;}}
 if(!side&&scene?.moves){const move=scene.moves.find(m=>m.personId===person.id);if(move?.fromId&&move?.toId){const a=mapAnchor(world,move.fromId,'station'),d=mapAnchor(world,move.toId,'station');flip=move.kind==='retreat'?d[0]>a[0]:d[0]<a[0];}}
 return `<foreignObject x="-60" y="-58" width="120" height="100" pointer-events="none" class="troop-token"><canvas xmlns="http://www.w3.org/1999/xhtml" width="360" height="300" data-troop-action="${action}" data-troop-tiers="${tiers.join(',')}" data-troop-count="${count}" data-troop-flip="${flip}" data-troop-color="${esc(country.color)}" aria-label="소속 병력" style="width:120px;height:100px;pointer-events:none"></canvas></foreignObject>`;
}
