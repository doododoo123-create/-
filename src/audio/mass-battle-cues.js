import {massGlobalTime} from '../ui/mass-battle-plan.js';
// All loops share the normal director, pause ledger, mixer and four-voice cap.
export function massBattleSoundCues(scene,{speed=1}={}){
 const plan=scene.massPlan;if(!plan)return [];
 const prefix=plan.id+':',important={death:'bp_sfx_general_fallen',capital_fall:'capital_fall',elimination:'country_eliminated',appointment:'general_appointed'};
 if(scene.massCritical)return [{id:important[scene.event.type]||'battle_impact',key:prefix+scene.event.type+':'+scene.event.index,at:0,group:'important',priority:80,maxDuration:scene.event.type==='death'?1.9:1.4}];
 if(scene.massPhase==='summary')return [{id:'bp_sfx_battle_end',key:prefix+'summary',at:0,group:'battle',priority:45,maxDuration:2.2}];
 const result=[],contact=Math.min(...plan.units.filter(u=>u.combatant).map(u=>u.visualContact??plan.baseDuration*.24)),combatEnd=plan.baseDuration*.85;
 const loop=(id,from,to,group)=>{const start=massGlobalTime(plan,from),end=massGlobalTime(plan,to),a=Math.max(scene.massStart,start),b=Math.min(scene.massEnd,end);if(b<=a)return;const offset=(a-start)/speed/1000;result.push({id,key:prefix+scene.id+':'+id,at:(a-scene.massStart)/speed,offset,loop:true,sustain:true,scope:'stage',group,priority:15,maxDuration:offset+(b-a)/speed/1000});};
 if(Number.isFinite(contact)){
  loop('bp_foley_army_march_loop',0,contact,'movement');loop('bp_amb_battle_distant_loop',contact,combatEnd,'battle');
  const at=(massGlobalTime(plan,contact)-scene.massStart)/speed;if(at>=0&&at<(scene.massEnd-scene.massStart)/speed)result.push({id:'bp_sfx_first_clash',key:prefix+'first-contact',at,group:'battle',priority:45,maxDuration:1.45});
 }else loop('bp_foley_army_march_loop',0,plan.baseDuration,'movement');
 const sounds=['bp_sfx_clash_metal_01','bp_sfx_shield_01','bp_sfx_clash_metal_02','bp_sfx_shield_02','bp_sfx_clash_metal_03'];let last=-Infinity,n=0;
 for(const c of plan.cues){const at=(massGlobalTime(plan,c.at)-scene.massStart)/speed;if(at<0||at>=(scene.massEnd-scene.massStart)/speed)continue;if(c.id==='ui_confirm'){result.push({...c,at,key:prefix+c.key,group:'ui',priority:20,maxDuration:.4});continue;}if(c.at<contact+500||at-last<(speed>=8?650:speed>=4?400:280))continue;last=at;result.push({id:sounds[n++%sounds.length],at,key:prefix+c.key,group:'battle',priority:35,maxDuration:.68});}
 return result;
}
