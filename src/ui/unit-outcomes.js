// Visual effects read recorded outcomes; they never infer or change a battle result.
export function unitOutcome(scene,record,person){
 if(!person||person.role!=='general'||scene?.kind!=='apply')return '';
 const e=scene.event;
 if(e?.type==='death'&&e.nationId===person.countryId&&e.slot===person.slot)return 'death';
 const b=record?.battles?.[scene.battleIndex];if(e?.type!=='resolve'||!b||b.automatic||b.winner===null)return '';
 const attack=person.countryId===b.actorId&&person.slot===b.slot,defense=person.countryId===b.defenderId&&person.slot===b.defenseSlot;
 if(!attack&&!defense)return '';return b.winner===(attack?b.actor:b.target)?'victory':'defeat';
}
