import {createContinentV25World} from './continent-v25.js';
import {enableCampaignV28} from '../model/campaign-v28.js';
export const createContinentV28World=()=>enableCampaignV28(createContinentV25World());
