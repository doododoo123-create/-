import {massGlobalTime} from '../ui/mass-battle-plan.js';
// Uses SoundDirector's existing ledger and voice limit. No audio timer is owned
// by the renderer, so pause/re-time/seek cannot replay a hit twice.
export function massBattleSoundCues(scene,{speed=1}={}){
 const plan=scene.massPlan;if(!plan)return [];
 const prefix=plan.id+':',important={death:'general_fallen',capital_fall:'capital_fall',elimination:'country_eliminated',appointment:'general_appointed'};
 if(scene.massCritical)return [{id:important[scene.event.type]||'battle_impact',key:prefix+scene.event.type+':'+scene.event.index,at:0,group:'important',priority:80,maxDuration:1.4}];
 if(scene.massPhase==='summary')return [{id:plan.gained||plan.lost?'territory_capture':'battle_draw',key:prefix+'summary',at:0,group:'battle',priority:45,maxDuration:.6}];
 const cues=plan.cues.map(c=>({...c,at:(massGlobalTime(plan,c.at)-scene.massStart)/speed,key:prefix+c.key,group:'battle',priority:40,maxDuration:Math.min(.5,1/speed)})).filter(c=>c.at>=0&&c.at<(scene.massEnd-scene.massStart)/speed);
 const filtered=[];for(const cue of cues.sort((a,b)=>a.at-b.at))if(!filtered.length||cue.at-filtered.at(-1).at>=(speed>=4?220:140))filtered.push(cue);
 if(scene.massStart===0)filtered.unshift({id:'army_march',key:prefix+'approach',group:'movement',priority:20,at:0,maxDuration:Math.min(.9,1.5/speed)});
 return filtered;
}
