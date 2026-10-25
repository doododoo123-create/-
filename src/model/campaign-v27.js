import { BALANCE_V27_DEFAULTS,BALANCE_V27_SWITCHES } from './balance-v27.js';
import { ADDITIVE_COMBAT_DEFAULTS } from './combat-rules.js';
import { enableCampaignV23 } from './campaign-v23.js';
export function enableCampaignV27(input){const w=structuredClone(input),original=w.rules.battleMode==='v11';if(original)for(const p of w.people)if(p.role==='general')p.ability=Math.max(-4,Math.min(4,p.ability*2));if(original)w.rules={...w.rules,...structuredClone(ADDITIVE_COMBAT_DEFAULTS)};const next=enableCampaignV23(w);next.rules={...ADDITIVE_COMBAT_DEFAULTS,...next.rules,...structuredClone(BALANCE_V27_DEFAULTS),...Object.fromEntries(BALANCE_V27_SWITCHES.map(k=>[k,true])),battleMode:'additive30',fieldCommand:true,advancedCampaign:true,continuousCampaign:true};return next;}
