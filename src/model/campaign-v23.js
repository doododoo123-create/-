import { enableCampaignV22 } from './campaign-v22.js';
export const CAMPAIGN_V23_DEFAULTS=Object.freeze({recoveryPriority:true,underdogExperience:true,frontierReserves:true,experienceWinStep:3,experiencePerWin:2,experienceCap:6,roundLimit:null});
export function enableCampaignV23(world){const next=enableCampaignV22(world);return {...next,rules:{...next.rules,...CAMPAIGN_V23_DEFAULTS}};}
