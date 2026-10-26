import {enableCampaignV28} from './campaign-v28.js';
export function enableCampaignV31(input){const next=enableCampaignV28(input);next.rules.resetConfusionOnRest=false;next.rules.seasonRestConfusion=true;next.rules.royalCapitalGuard=true;return next;}
