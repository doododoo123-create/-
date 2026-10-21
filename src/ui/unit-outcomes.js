// Visual effects read recorded outcomes; they never infer or change a battle result.
export function unitBattling(scene,record,person){
 if(!person||person.role!=='general'||!scene||!['territory','attack_roll','defense_roll','resolve'].includes(scene.event?.type)||scene.kind==='apply')return false;
 const b=record?.battles?.[scene.battleIndex];
 return !!b&&!b.automatic&&((person.countryId===b.actorId&&person.slot===b.slot)||(person.countryId===b.defenderId&&person.slot===b.defenseSlot));
}
export function unitOutcome(scene,record,person){
 if(!person||person.role!=='general'||scene?.kind!=='apply')return '';
 const e=scene.event;
 if(e?.type==='appointment'&&e.nationId===person.countryId&&e.slot===person.slot&&person.active&&person.alive)return 'appointment';
 if(e?.type==='roster'&&person.active&&person.alive){const before=scene.worldBefore?.people.find(p=>p.role==='general'&&p.countryId===person.countryId&&p.slot===person.slot);if(!before?.active||before.alive===false||before.generation<person.generation)return 'appointment';}
 if(e?.type==='death'&&e.nationId===person.countryId&&e.slot===person.slot)return 'death';
 const b=record?.battles?.[scene.battleIndex];if(e?.type!=='resolve'||!b||b.automatic||b.winner===null)return '';
 const attack=person.countryId===b.actorId&&person.slot===b.slot,defense=person.countryId===b.defenderId&&person.slot===b.defenseSlot;
 if(!attack&&!defense)return '';return b.winner===(attack?b.actor:b.target)?'victory':'defeat';
}
