// Missing switches retain the v0.21 rules. New Studio worlds opt in explicitly.
export const CAMPAIGN_V22_DEFAULTS=Object.freeze({continuousCampaign:true,routDeath:true,strategicTargets:true,unopposedCaptureLimit:3,routDeathChance:10,strategyCommitment:3,strategyStall:3,strategyWeakLands:7,strategyEmergencyLoss:4,strategyResponseOrders:2,strategySwitchMargin:15});
export function enableCampaignV22(world){return {...world,rules:{...world.rules,...CAMPAIGN_V22_DEFAULTS}};}
