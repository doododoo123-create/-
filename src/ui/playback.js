import { calendarAtRound } from '../model/calendar.js';
import { choiceFor } from './choice-reel.js';
import { applicationSteps, applicationWorld, observerDuration } from './observer-flow.js';
// Presentation reads committed engine events. Its clock never consumes game randomness.
export const leadGeneral = (world,id) => world.people.find(p=>p.countryId===id&&p.role==='general'&&p.active&&p.alive)||null;
export function makeTurnScenes(record,before) {
  const scenes=[];let camps=record.campsBefore||before.visualCamps||{};
  if(record.seasonStart??record.turn===1){const calendar=calendarAtRound(record.round);scenes.push({id:'season-'+record.round,kind:'season',event:{type:'season',index:-1,round:record.round,...calendar},title:calendar.label,worldBefore:before,worldAfter:before,camps});}
  for(const event of record.events) {
    const frame=record.frames?.[event.index]||{before,after:before};
    const motion=record.movements?.find(m=>m.eventIndex===event.index);
    if(motion){scenes.push({id:`move-${event.index}`,kind:'movement',event,battleIndex:event.battleIndex,title:motion.moves.some(m=>m.kind==='redeploy')?'생존 지휘관 재배치':'지휘관 출정·복귀',worldBefore:frame.before,worldAfter:frame.before,campsBefore:camps,camps:motion.camps,moves:motion.moves});camps=motion.camps;}
    if(event.type==='expedition_roll')continue;
    const start=scenes.length;
    const roll=record.rolls[event.rollIndex];
    const attempts=event.type==='king'?(roll?.attempts||[]):roll?[roll.value]:[];
    if(attempts.length) attempts.forEach((value,attempt)=>scenes.push({
      id:`${event.type}-${event.index}-${attempt}`,kind:['king','minister','war_target'].includes(event.type)?'reel':'roll',choice:choiceFor(event,frame.before,value),role:event.role,event,
      battleIndex:event.battleIndex,diceIndices:[event.rollIndex],value,faces:roll.sides,
      title:attempt<attempts.length-1?'전쟁 대상 없음 · 국왕 주사위 다시 굴림':event.type==='king'?'국왕의 행동 선택':event.type==='minister'?'승상의 내정 선택':event.type==='war_target'?'공격 국가 선택':event.type==='expedition_roll'?'지휘관의 출전 판정':event.title,
      lockedTitle:attempt<attempts.length-1?'공격 가능한 국가가 없어 재판정':event.title,
      detail:event.detail,worldBefore:frame.before,worldAfter:frame.before,
      bonus:event.side?(event.side.bonus??event.side.ability+event.side.armyBonus):event.type==='domestic_roll'?event.ability:0,
    }));
    else scenes.push({id:`${event.type}-${event.index}`,kind:event.type==='resolve'?'result':'focus',role:event.role,event,battleIndex:event.battleIndex,title:event.title,detail:event.detail,worldBefore:frame.before,worldAfter:frame.before});
    if(event.type==='resolve'||frame.after!==frame.before)scenes.push({id:`apply-${event.index}`,kind:'apply',event,battleIndex:event.battleIndex,title:'병력과 영토에 결과 반영',detail:event.detail,worldBefore:frame.before,worldAfter:frame.after});
    for(let i=start;i<scenes.length;i++)scenes[i].camps=camps;
  }
  scenes.push({id:'result',kind:'summary',title:record.title,detail:record.detail,camps:record.campsAfter||camps,worldBefore:record.finalWorld||before,worldAfter:record.finalWorld||before});
  return scenes;
}
export class TurnPlayback {
  constructor({onChange=()=>{},onFinish=()=>{},speed=()=>1,reducedMotion=()=>false,schedule=(callback,delay)=>setTimeout(callback,delay),cancel=handle=>clearTimeout(handle),now=()=>Date.now()}={}) {
    Object.assign(this,{onChange,onFinish,speed,reducedMotion,schedule,cancel,now});
    this.groupEnd=null;this.groupDone=false;this.state=null;this.handle=null;this.remaining=0;this.deadline=0;this.scheduledSpeed=1;
  }
  get scene(){return this.state?.scenes[this.state.index]||null;}
  get playing(){return !!this.state?.playing;}
  get complete(){return !this.state||this.state.finished;}
  get showingResult(){return this.scene?.kind==='summary';}
  get displayWorld(){return this.state?.finished?this.state.after:this.scene?.kind==='apply'&&this.state.phase!=='settled'?applicationWorld(this.scene,this.state.effectStage):this.scene?.worldAfter;}
  get movementProgress(){if(this.scene?.kind!=='movement')return 0;const left=this.playing&&this.handle!==null?Math.max(0,(this.deadline-this.now())*this.scheduledSpeed):this.remaining;return Math.max(0,Math.min(1,1-left/this.duration()));}
  get sceneProgress(){if(!this.scene)return 0;const left=this.playing&&this.handle!==null?Math.max(0,(this.deadline-this.now())*this.scheduledSpeed):this.remaining;return Math.max(0,Math.min(1,1-left/this.duration()));}
  duration(){return observerDuration(this.scene,this.state.record,this.state.phase==='departing'?'departing':this.state.effectStage||this.state.phase,this.reducedMotion());}
  clearTimer(){if(this.handle!==null)this.cancel(this.handle);this.handle=null;}
  load(record,before,after,play=true,history=[]){
    this.clearTimer();this.groupEnd=null;this.groupDone=false;const scenes=makeTurnScenes(record,before);scenes.at(-1).worldAfter=after;
    this.state={record,before,after,scenes,index:0,roundRecords:history.filter(r=>r.round===record.round&&r.turn<record.turn),phase:['roll','reel'].includes(scenes[0].kind)?'rolling':'holding',playing:play,finished:false};
    this.remaining=this.duration();this.onChange();if(play)this.arm();
  }
  arm(){if(!this.state?.playing||this.state.finished)return;this.clearTimer();this.scheduledSpeed=Math.max(.1,Number(this.speed())||1);this.deadline=this.now()+this.remaining/this.scheduledSpeed;this.handle=this.schedule(()=>{this.handle=null;this.advance();},this.remaining/this.scheduledSpeed);}
  pause(){if(!this.state||!this.playing)return;if(this.handle!==null)this.remaining=Math.max(0,(this.deadline-this.now())*this.scheduledSpeed);this.clearTimer();this.state.playing=false;}
  resume(){if(!this.state||this.state.finished)return;this.groupEnd=null;this.groupDone=false;this.state.playing=true;this.onChange();this.arm();}
  advance(){
    if(!this.state||this.state.finished)return;this.clearTimer();
    if(this.scene.kind==='apply'&&this.state.effectStage){const steps=applicationSteps(this.scene,this.state.record),index=steps.indexOf(this.state.effectStage);if(index<steps.length-1){this.state.effectStage=steps[index+1];this.remaining=this.duration();this.onChange();if(this.state.playing)this.arm();return;}}
    if(this.state.phase==='rolling')this.state.phase=this.scene.bonus?'raw':'locked';
    else if(this.state.phase==='raw')this.state.phase='merging';
    else if(this.state.phase==='merging')this.state.phase='locked';
    else if(this.state.phase!=='departing'&&this.state.scenes[this.state.index+1]?.kind==='apply')this.state.phase='departing';
    else if(this.groupEnd===this.state.index&&this.state.index<this.state.scenes.length-1){this.state.playing=false;this.groupDone=true;if(this.scene.kind==='apply')this.state.phase='settled';this.onChange();return;}
    else if(this.state.index<this.state.scenes.length-1){this.state.index++;this.state.phase=['roll','reel'].includes(this.scene.kind)?'rolling':'holding';this.state.effectStage=this.scene.kind==='apply'?applicationSteps(this.scene,this.state.record)[0]:null;}
    else{this.state.finished=true;this.state.playing=false;this.onChange();this.onFinish();return;}
    this.remaining=this.duration();this.onChange();if(this.state.playing)this.arm();
  }
  playGroup(){
    if(!this.state||this.state.finished)return;
    this.pause();if(this.groupDone){this.groupEnd=null;this.groupDone=false;this.advance();}
    const scene=this.scene,event=scene.event;let end=this.state.index;
    if(['territory','attack_roll','defense_roll','domestic_roll','appointment','resupply','round_end','roster','waiting','death','survived','elimination','resolve'].includes(event?.type)){
      const next=this.state.scenes.findIndex((s,i)=>i>=end&&s.kind==='apply'&&(scene.battleIndex!==undefined?s.battleIndex===scene.battleIndex:s.event.index===event.index||event.type==='domestic_roll'&&s.event.type==='resolve'));if(next>=0)end=next;
    }else if(event?.type==='death_roll'){
      const next=this.state.scenes.findIndex((s,i)=>i>end&&s.kind==='apply'&&['death','survived'].includes(s.event?.type));if(next>=0)end=next;
    }
    this.groupEnd=end;this.state.playing=true;this.onChange();this.arm();
  }
  step(){this.pause();this.groupEnd=null;this.groupDone=false;this.advance();}
  finish(){if(!this.state||this.state.finished)return;this.clearTimer();this.state.index=this.state.scenes.length-1;this.state.phase='holding';this.state.finished=true;this.state.playing=false;this.onChange();this.onFinish();}
  reset(){this.clearTimer();this.state=null;this.remaining=0;}
}
