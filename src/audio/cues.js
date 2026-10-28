import {campaignSummary} from '../ui/campaign-playback.js';
import { SOUND_PACK } from '../data/sound-art.js';
import { SOUND_DEFAULTS } from './settings.js';
// Visible presentation only. Never import or advance the simulation RNG here.
export function soundHash(text){let h=2166136261;for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
export function presentationSoundCues(state,{speed=1,settings=SOUND_DEFAULTS,duration=900,rollingDuration=900}={}){
 if(!state||state.finished)return [];
 const scene=state.scenes?.[state.index];if(!scene)return [];
 const e=scene.event||{},record=state.record||{},b=record.battles?.[scene.battleIndex],phase=state.phase==='departing'?'locked':state.phase,actual=duration/Math.max(.1,speed),simple=settings.simplify,fast=simple&&speed>=4,veryFast=simple&&speed>=8;
 const result=[],eventKey=String(e.index??scene.id),prefix=`${record.turn}:${eventKey}`,cue=(id,key=scene.id,group='battle',extra={})=>result.push({id,key:prefix+':'+key,group,priority:{ui:10,dice:30,movement:20,battle:40,important:60}[group],at:0,...extra});
 const notable=(id,key,priority)=>cue(id,key,'important',{priority,maxDuration:speed>=4?.65:undefined});
 if(scene.kind==='season'){notable(['season_spring','season_summer','season_autumn','season_winter'][e.seasonIndex??(record.round-1)%4],'season:'+record.round,60);return result;}
 if(e.type==='capital_fall'){notable('capital_fall','capital',70);return result;}
 if(e.type==='elimination'){notable('country_eliminated','elimination',90);return result;}
 if(e.type==='finish'&&(e.result?.reason==='conquest'||record.result?.reason==='unification')){notable('campaign_complete','unification',100);return result;}
 if(scene.kind==='apply'&&e.type==='death'){notable('general_fallen','death',80);return result;}
 if(scene.kind==='army-forming'&&scene.formationGroup?.members.length>=2){cue('turn_start','army-formed:'+scene.formationGroup.id,'important',{priority:55,maxDuration:fast?.3:.85});return result;}
 if(scene.kind==='campaign'){
  if(scene.campaignPhase==='combat'){const info=campaignSummary(scene);if(info.combats)cue('sword_clash','campaign-clash:'+scene.id,'battle',{maxDuration:.24});}
  if(scene.campaignPhase==='summary'){const info=campaignSummary(scene);cue(info.notices.length?'battle_impact':info.net>0?'territory_capture':info.wins>info.losses?'battle_victory':info.wins<info.losses?'battle_defeat':'battle_draw','campaign-summary:'+scene.id,'battle',{priority:45,maxDuration:.65});}
  return result;
 }
 if(scene.kind==='apply'&&e.type==='roster'){const old=new Map(scene.worldBefore?.people.map(p=>[p.id,p])||[]);if(scene.worldAfter?.people.some(p=>p.role==='general'&&p.active&&p.alive&&(!old.get(p.id)?.active||old.get(p.id)?.generation<p.generation)))cue('general_appointed','roster-appointment','important',{priority:55,maxDuration:fast?.5:undefined});}
 if(scene.kind==='apply'&&e.type==='appointment')cue('general_appointed','appointment','important',{priority:55,maxDuration:fast?.5:undefined});
 if(scene.kind==='roll'||scene.kind==='reel'){
  if(e.type==='expedition_roll')return [];
  if(phase==='rolling'&&!fast){
   if(scene.kind==='reel'){
    if(scene.choice?.options.length>1)for(let i=0;i<4;i++)cue('ui_click',scene.id+':reel:'+i,'ui',{gain:1.5,at:actual*i*.22,maxDuration:Math.min(.12,actual/5000),scope:'stage'});
    if(settings.turnStart&&e.type==='king'&&!(state.scenes||[]).some(s=>s.kind==='season'))cue('turn_start','turn-start','important',{priority:50,maxDuration:.8});
   }else{
    const style=settings.diceStyle,short=actual>=1150,material=['wood','cloth','alternate'].includes(style)&&actual>=300;
    const id=material?(style==='cloth'?'dice_roll_cloth':style==='alternate'&&soundHash(record.turn+':'+scene.id)%2?'dice_roll_wood_alt':'dice_roll'):style==='cup'&&actual>=700?'dice_cup_shake':style==='auto'&&short?'dice_roll_wood_short':actual>=700?'dice_drop_single':'dice_tick';
    if(style==='ticks'||actual<300||id==='dice_tick'){for(let i=0;i<(actual>=300?3:1);i++)cue('dice_tick',scene.id+':tick:'+i,'dice',{gain:1.5,at:actual*i*.28,maxDuration:Math.min(.065,actual/1000),scope:'stage'});}
    else{const length=SOUND_PACK.find(s=>s.id===id)?.duration||0,offset=material||style==='cup'?Math.max(0,length-actual/1000):0;cue(id,scene.id+':rolling','dice',{gain:1.5,offset,sustain:true,scope:'stage',maxDuration:offset+actual/1000,slot:'rolling'});}
   }
  }else if(phase==='raw'&&!fast&&!(['wood','cloth','alternate'].includes(settings.diceStyle)&&rollingDuration/Math.max(.1,speed)>=300))cue(settings.diceStyle==='ticks'?'dice_settle':'dice_land',scene.id+':raw','dice',{scope:'stage',maxDuration:actual/1000});
  else if(phase==='merging'&&!fast){const item=scene.bonusItems?.filter(i=>i.value)[state.mergeIndex||0];if(item)cue(item.value>0?'bonus_add':'bonus_penalty',scene.id+':merge:'+(state.mergeIndex||0),'dice',{...(item.value>0?{gain:1.5}:{}),scope:'stage',maxDuration:actual/1000});}
  else if(phase==='locked'){
   if(scene.kind==='reel'){cue('ui_confirm',scene.id+':choice','ui',{maxDuration:fast?.2:undefined});}
   else if(scene.bonusItems?.some(i=>i.value)||!(['wood','cloth','alternate'].includes(settings.diceStyle)&&rollingDuration/Math.max(.1,speed)>=300))cue(scene.bonusItems?.some(i=>i.value)?'score_lock':settings.diceStyle==='ticks'?'dice_settle':'dice_land',scene.id+':locked','dice',{maxDuration:fast?.16:undefined});
  }
  return result;
 }
 if(scene.kind==='movement'&&!fast&&scene.moves?.some(m=>!m.presentationOnly&&m.kind!=='redeploy'&&m.fromId!==m.toId&&m.path?.length>1))cue('army_march',scene.id+':march','movement',{sustain:true,scope:'stage',maxDuration:actual/1000,slot:'march'});
 if(scene.kind==='route'&&b&&!b.automatic&&!fast){
  if(scene.formationSide==='attack')cue('attack_whoosh','approach:'+b.index,'battle',{maxDuration:actual/1000});
  if(scene.formationSide==='defense')cue(b.wave>1||b.continuation&&b.continuation!=='initial'?'sword_clash':'battle_impact','engage:'+b.index,'battle',{maxDuration:Math.min(1.1,actual/1000+.25)});
 }
 if(scene.kind==='capture'&&b?.takenTerritoryIds?.length)cue('territory_capture','capture:'+b.index,'battle',{maxDuration:fast?.3:undefined});
 if(scene.kind==='apply'&&e.type==='resolve'){
  if(b&&!b.automatic&&(state.effectStage==='outcome'||state.effectStage==='all'||!state.effectStage)){
   const selected=settings.perspective==='selected'&&[b.actorId,b.defenderId].includes(settings.countryId),winner=b.winner===b.actor?b.actorId:b.winner===b.target?b.defenderId:null,grade=b.losses?.attack.grade,major=['major','rout'].includes(grade);
   const id=b.winner===null?'battle_draw':selected?(winner===settings.countryId?'battle_victory':'battle_defeat'):major?'battle_victory':'sword_clash';cue(id,'outcome:'+b.index,'battle',{priority:45,maxDuration:fast?.4:undefined});
  }else if(!b&&record.type==='domestic'){
   const before=scene.worldBefore,after=scene.worldAfter,c0=before?.countries.find(c=>c.id===record.actorId),c1=after?.countries.find(c=>c.id===record.actorId),old=new Map(before?.people.map(p=>[p.id,p])||[]);
   const id=!e.success?'domestic_failure':c1&&c0&&c1.troops>c0.troops?'recruit':c1&&c0&&c1.recruitment>c0.recruitment?'production':after?.people.some(p=>(p.capacity||0)>(old.get(p.id)?.capacity||0))?'supply':'domestic_success';cue(id,'domestic-result','battle',{maxDuration:fast?.35:undefined});
  }
 }
 if(e.type==='hold'&&scene.kind==='focus')cue('domestic_failure','refusal','battle',{maxDuration:fast?.25:undefined});
 if(scene.kind==='apply'&&e.type==='resupply'&&e.refilled>0&&!fast)cue('supply','resupply','battle',{gain:.6});
 if(scene.kind==='apply'&&e.type==='round_end'&&e.gains?.some(g=>g.gain>0))cue('production','season-production','battle',{maxDuration:fast?.3:undefined});
 return result;
}

