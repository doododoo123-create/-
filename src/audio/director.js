import { presentationSoundCues } from './cues.js';
export class SoundDirector {
 constructor(mixer,{schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id)}={}){Object.assign(this,{mixer,schedule,cancel});this.ledgers=new WeakMap();this.state=null;this.stage=null;this.timers=new Map();this.resumes=new Map();this.sustains=new Map();this.playing=false;this.epoch=0;}
 clearTimers(){for(const id of this.timers.values())this.cancel(id);this.timers.clear();}
 pause(){if(this.playing){this.resumes=new Map(this.mixer.offsets().map(v=>[v.key,v]));for(const [key,cue] of this.sustains){if(this.resumes.has(key)||!this.playback?.scene)continue;const offset=this.playback.duration()/Math.max(.1,this.playback.speed())*this.playback.sceneProgress/1000-cue.at/1000+(cue.offset||0);if(offset>=0&&offset<(this.mixer.sounds.get(cue.id)?.duration||0))this.resumes.set(key,{key,cue,offset});}}this.playing=false;this.clearTimers();this.mixer.stopGameplay();}
 reset(){this.pause();this.state=null;this.stage=null;this.sustains.clear();this.resumes.clear();this.epoch++;}
 suppressStage(playback){this.pause();if(playback?.state){const ledger=this.ledgers.get(playback.state);if(ledger)for(const cue of presentationSoundCues(playback.state,{settings:this.mixer.settings,speed:playback.speed(),duration:playback.duration(),rollingDuration:playback.reducedMotion?.()?80:900}))ledger.add(cue.key);}this.resumes.clear();}
 sync(playback,{audible=true}={}){
  this.playback=playback;const state=playback.state;
  if(state!==this.state){this.clearTimers();this.mixer.stopGameplay();this.state=state;this.stage=null;this.resumes.clear();this.sustains.clear();this.playing=false;this.epoch++;if(state&&!this.ledgers.has(state))this.ledgers.set(state,new Set());}
  if(!state)return;
  if(state.finished){this.clearTimers();this.mixer.stopStage();this.playing=false;return;}
  if(!audible||!playback.playing){this.pause();return;}
  const scene=playback.scene,stage=[scene.id,state.phase,state.effectStage,state.mergeIndex||0].join('|');
  if(stage!==this.stage){this.clearTimers();this.mixer.stopStage();this.stage=stage;this.resumes.clear();this.sustains.clear();}
  this.playing=true;
  const cues=presentationSoundCues(state,{settings:this.mixer.settings,speed:playback.speed(),duration:playback.duration(),rollingDuration:playback.reducedMotion?.()?80:900}),seen=this.ledgers.get(state),duration=playback.duration()/Math.max(.1,playback.speed()),elapsed=duration*playback.sceneProgress,epoch=this.epoch;
  if(!this.mixer.settings.enabled||this.mixer.settings.volume===0){for(const cue of cues)seen.add(cue.key);return;}
  if(!this.mixer.ready)return;
  for(const cue of cues){
   if(this.timers.has(cue.key))continue;
   const resume=cue.sustain&&this.resumes.get(cue.key);if(seen.has(cue.key)&&!resume)continue;
   const delay=cue.at-elapsed;
   if(!resume&&delay<-(cue.priority>=60?700:150)){seen.add(cue.key);continue;}
   const valid=()=>this.state===state&&this.epoch===epoch&&this.stage===stage&&playback.playing&&!playback.complete;
   const perform=()=>{this.timers.delete(cue.key);if(!valid())return;seen.add(cue.key);const left=duration*(1-playback.sceneProgress),entry=resume?{...resume.cue,maxDuration:resume.offset+left/1000}:cue,offset=resume?.offset??(cue.sustain?(cue.offset||0)+Math.max(0,elapsed-cue.at)/1000:0);this.resumes.delete(cue.key);if(cue.sustain)this.sustains.set(cue.key,entry);void this.mixer.play(entry,{offset,valid});};
   if(delay>8&&!resume)this.timers.set(cue.key,this.schedule(perform,delay));else perform();
  }
 }
}
