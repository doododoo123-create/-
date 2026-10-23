// Pure combat calculations. Troops are expressed in ten-thousands, precise to one soldier.
export const LEGACY_ARMY_BANDS=Object.freeze([[1.25,4],[1.5,10],[2,16],[3,21],[5,25],[10,27],[20,28]]);
export const ADDITIVE_COMBAT_DEFAULTS=Object.freeze({
 battleMode:'additive30',combatSides:30,experiencePerWin:1,experienceWinStep:3,experienceCap:3,mountainBonus:8,
 retreatMode:'home',advancedCampaign:true,territoryArmyLimit:10,fatigueStep:4,fatiguePenalty:2,supplyGainRange:[1,3],
 capitalReserveLimit:10,defenderCounterattack:true,counterCaptureThresholds:[20,40],
 occupationAdvance:true,battlefieldRecovery:true,nearbyRetreat:true,
 fieldCommand:true,troopRounding:'ten-thousand',reliefRadius:3,expeditionChances:[100,85,70,55,40,25],
 armyBands:[[1,0],[1.5,1],[2,3],[3,5],[4,7],[5,9],[7,12],[10,15],[15,18],[20,20]],
 captureThresholds:[20,40],lossThresholds:[10,20,40],casualtyBasis:'own',
 commandReform:true,baseCapacity:7,capacityCap:25,capacityWinStep:3,capacityWinCap:9,
 combatLosses:{narrow:[.15,.2],clear:[.1,.3],major:[.08,.4],rout:[.05,.5],draw:[.15,.15]},
});
export const PRE_REFORM_COMBAT=Object.freeze({commandReform:false,baseCapacity:20,casualtyBasis:'smaller',captureThresholds:[8,16],combatLosses:{narrow:[.1,.2],clear:[.08,.35],rout:[.05,.6],draw:[.15,.15]}});
export const preciseTroops=n=>Math.round(n*10000)/10000;
export const roundedTroops=(n,rules)=>rules.troopRounding==='ten-thousand'?Math.round(n):preciseTroops(n);
export const isModernCombat=rules=>rules.battleMode==='additive30';
export function armyRatioBonus(own,enemy,rules){
 if(own<=enemy||enemy<=0)return 0;const ratio=own/enemy;let bonus=0;
 for(const [threshold,score] of rules.armyBands)if(ratio>=threshold)bonus=score;
 return bonus;
}
export function combatBonuses(own,enemy,ability,wins,terrain,rules){
 const armyBonus=armyRatioBonus(own,enemy,rules),experienceBonus=Math.min(rules.experienceCap,Math.floor(Math.max(0,wins||0)/(rules.experienceWinStep??1))*rules.experiencePerWin),terrainBonus=terrain==='mountain'?rules.mountainBonus:0;
 return {ability,armyBonus,experienceBonus,terrainBonus,bonus:ability+armyBonus+experienceBonus+terrainBonus};
}
export function combatGrade(margin,rules){
 if(rules.casualtyBasis==='own'){const [clear,major,rout]=rules.lossThresholds;return margin>=rout?'rout':margin>=major?'major':margin>=clear?'clear':'narrow';}
 return margin>=rules.captureThresholds[1]?'rout':margin>=rules.captureThresholds[0]?'clear':'narrow';
}
export function combatCasualties(own,enemy,result,margin,rules){
 const grade=result==='draw'?'draw':combatGrade(margin,rules),rate=rules.combatLosses[grade][result==='loss'?1:0],basis=rules.casualtyBasis==='own'?own:Math.min(own,enemy);
 return {base:rate*100,grade,basis,amount:Math.min(own,roundedTroops(basis*rate,rules))};
}
