// Pure combat calculations. Troops are expressed in ten-thousands, precise to one soldier.
export const ADDITIVE_COMBAT_DEFAULTS=Object.freeze({
 battleMode:'additive30',combatSides:30,experiencePerWin:1,experienceCap:9,mountainBonus:8,
 armyBands:[[1.25,4],[1.5,10],[2,16],[3,21],[5,25],[10,27],[20,28]],
 captureThresholds:[8,16],
 combatLosses:{narrow:[.1,.2],clear:[.08,.35],rout:[.05,.6],draw:[.15,.15]},
});
export const preciseTroops=n=>Math.round(n*10000)/10000;
export const isModernCombat=rules=>rules.battleMode==='additive30';
export function armyRatioBonus(own,enemy,rules){
 if(own<=enemy||enemy<=0)return 0;const ratio=own/enemy;let bonus=0;
 for(const [threshold,score] of rules.armyBands)if(ratio>=threshold)bonus=score;
 return bonus;
}
export function combatBonuses(own,enemy,ability,wins,terrain,rules){
 const armyBonus=armyRatioBonus(own,enemy,rules),experienceBonus=Math.min(rules.experienceCap,Math.max(0,wins||0)*rules.experiencePerWin),terrainBonus=terrain==='mountain'?rules.mountainBonus:0;
 return {ability,armyBonus,experienceBonus,terrainBonus,bonus:ability+armyBonus+experienceBonus+terrainBonus};
}
export function combatGrade(margin,rules){return margin>=rules.captureThresholds[1]?'rout':margin>=rules.captureThresholds[0]?'clear':'narrow';}
export function combatCasualties(own,enemy,result,margin,rules){
 const grade=result==='draw'?'draw':combatGrade(margin,rules),rate=rules.combatLosses[grade][result==='loss'?1:0],basis=Math.min(own,enemy);
 return {base:rate*100,grade,basis,amount:Math.min(own,preciseTroops(basis*rate))};
}
