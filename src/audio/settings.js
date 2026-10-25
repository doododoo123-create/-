export const SOUND_STORAGE_KEY='saguk-studio.sound.v1';
export const SOUND_GROUPS=Object.freeze({ui:'조작',dice:'주사위',movement:'이동',battle:'전투·내정',important:'중요 사건'});
export const SOUND_DEFAULTS=Object.freeze({enabled:true,volume:.5,preset:'standard',simplify:true,turnStart:false,diceStyle:'auto',perspective:'neutral',countryId:null,groups:{ui:.55,dice:1,movement:.75,battle:.9,important:1}});
const soundNumber=(value,fallback)=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(1,value)):fallback;
export function normalizeSoundSettings(value={}){
 const v=value&&typeof value==='object'?value:{};
 return {enabled:typeof v.enabled==='boolean'?v.enabled:true,volume:soundNumber(v.volume,.5),preset:['standard','recording','quiet'].includes(v.preset)?v.preset:'standard',simplify:typeof v.simplify==='boolean'?v.simplify:true,turnStart:typeof v.turnStart==='boolean'?v.turnStart:false,diceStyle:['auto','wood','cloth','cup','ticks','alternate'].includes(v.diceStyle)?v.diceStyle:'auto',perspective:v.perspective==='selected'?'selected':'neutral',countryId:typeof v.countryId==='string'?v.countryId.slice(0,100):null,groups:Object.fromEntries(Object.keys(SOUND_GROUPS).map(k=>[k,soundNumber(v.groups?.[k],SOUND_DEFAULTS.groups[k])]))};
}
export function loadSoundSettings(storage){try{return normalizeSoundSettings(JSON.parse(storage.getItem(SOUND_STORAGE_KEY)||'{}'));}catch{return normalizeSoundSettings();}}
export function saveSoundSettings(storage,settings){storage.setItem(SOUND_STORAGE_KEY,JSON.stringify(normalizeSoundSettings(settings)));}
export function soundGroupGain(settings,group){if(group==='ui'&&settings.preset==='recording')return 0;const quiet=settings.preset==='quiet'?(group==='important'?.7:group==='ui'?.35:.55):1;return (settings.groups[group]??1)*quiet;}
