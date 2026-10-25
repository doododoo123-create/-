import {createContinentV25World} from './continent-v25.js';
import {enableCampaignV27} from '../model/campaign-v27.js';
export const createContinentV27World=()=>enableCampaignV27(createContinentV25World());
