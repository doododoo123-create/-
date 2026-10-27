export const PLAYBACK_SPEEDS=Object.freeze([.5,1,2,4,8,16]);
export const PLAYBACK_STORAGE_KEY='saguk-studio.playback.v1';
export function normalizePlaybackSettings(value={}){
 const v=value&&typeof value==='object'?value:{};
 return {compactCampaigns:typeof v.compactCampaigns==='boolean'?v.compactCampaigns:true,kingChoiceNormalSpeed:typeof v.kingChoiceNormalSpeed==='boolean'?v.kingChoiceNormalSpeed:true};
}
export function loadPlaybackSettings(storage){try{return normalizePlaybackSettings(JSON.parse(storage.getItem(PLAYBACK_STORAGE_KEY)||'{}'));}catch{return normalizePlaybackSettings();}}
export function savePlaybackSettings(storage,value){storage.setItem(PLAYBACK_STORAGE_KEY,JSON.stringify(normalizePlaybackSettings(value)));}
