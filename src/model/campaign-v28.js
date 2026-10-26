import {enableCampaignV27} from './campaign-v27.js';
// Explicit new-run opt-in; old worlds keep their original confusion lifetime.
export function enableCampaignV28(input){const next=enableCampaignV27(input);next.rules.resetConfusionOnRest=true;return next;}
