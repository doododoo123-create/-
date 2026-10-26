import {createContinentV30World} from './continent-v30.js';
import {enableCampaignV31} from '../model/campaign-v31.js';
export const createContinentV31World=()=>enableCampaignV31(createContinentV30World());
