const FILM_SETTINGS_KEY='saguk-studio.filming.v1';
export function loadFilmingSettings(storage){
 let value;try{value=JSON.parse(storage.getItem(FILM_SETTINGS_KEY)||'null');}catch{}
 return {enabled:value?.enabled===true,infoScale:[1,1.25,1.5].includes(value?.infoScale)?value.infoScale:1,cardScale:[1,1.25,1.5].includes(value?.cardScale)?value.cardScale:1,kingChoiceNormalSpeed:value?.kingChoiceNormalSpeed!==false,massBattlePresentation:value?.massBattlePresentation!==false,clean:false};
}
export function saveFilmingSettings(storage,settings){try{storage.setItem(FILM_SETTINGS_KEY,JSON.stringify({enabled:settings.enabled,infoScale:settings.infoScale,cardScale:settings.cardScale,kingChoiceNormalSpeed:settings.kingChoiceNormalSpeed,massBattlePresentation:settings.massBattlePresentation!==false}));}catch{}}
