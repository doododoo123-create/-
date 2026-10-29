import {displayName} from './display-names.js';
// Announce a newly revealed defender, never a future row or an already shown
// member of the original defensive formation.
export function campaignReinforcement(scene){
 if(scene?.campaignPhase!=='dice')return null;
 const g=scene.campaign,index=scene.campaignRow,b=g?.battles[index];if(!b||b.automatic||b.defenderId!==g.opponentId)return null;
 const world=scene.worldBefore,known=new Set();
 for(const group of g.defenseMetadata||[])for(const m of group.members){const p=world.people.find(p=>p.countryId===g.opponentId&&p.role==='general'&&p.slot===m.slot&&p.generation===m.generation);if(p)known.add(p.id);}
 for(const prior of g.battles.slice(0,index))if(!prior.automatic&&prior.defenderId===g.opponentId)known.add(prior.defenderPersonId);
 if(!known.size||known.has(b.defenderPersonId))return null;
 const person=world.people.find(p=>p.id===b.defenderPersonId)||{name:b.defense.name};return {id:b.defenderPersonId,name:displayName(person),army:b.defense.army,key:g.id+':'+b.defenderPersonId};
}
