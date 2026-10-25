export function visibleCommanderBattles(person,history,presentation=null){
 const scene=presentation?.scenes?.[presentation.index],turn=presentation?.record?.turn??Infinity,complete=!presentation||presentation.finished||scene?.kind==='summary',limit=complete?Infinity:scene?.event?.index??-1;
 const rows=[];
 for(const record of history||[]){
  if(record.turn>turn)continue;
  for(const b of record.battles||[]){
   const side=b.attackerPersonId===person.id?'attack':b.defenderPersonId===person.id?'defense':null;if(!side||b.automatic)continue;
   const resolve=record.events.find(e=>e.type==='resolve'&&e.battleIndex===b.index);
   if(record.turn===turn&&(!resolve||resolve.index>limit||resolve.index===limit&&!['result','apply','capture'].includes(scene?.kind)&&!complete))continue;
   rows.push({turn:record.turn,battleIndex:b.index,round:record.round,territory:b.territoryName,side,result:b.winner===null?'draw':b.winner===(side==='attack'?b.actor:b.target)?'win':'loss',opponent:b[side==='attack'?'defense':'attack'].name,loss:b.losses?.[side]?.amount||0,captures:b.winner===(side==='attack'?b.actor:b.target)?b.takenTerritoryIds?.length||0:0,replayable:record.turn<turn||complete});
  }
 }
 return rows;
}
