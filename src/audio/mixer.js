import { SOUND_OUTPUT_GAIN,soundLevelGain } from './loudness.js';
import { SOUND_PACK } from '../data/sound-art.js';
import { normalizeSoundSettings,soundGroupGain,SOUND_GROUPS } from './settings.js';
const audioBytes=url=>{const text=atob(url.slice(url.indexOf(',')+1)),bytes=new Uint8Array(text.length);for(let i=0;i<text.length;i++)bytes[i]=text.charCodeAt(i);return bytes.buffer;};
export class SoundMixer {
 constructor({sounds=SOUND_PACK,settings,contextFactory=()=>{const C=globalThis.AudioContext||globalThis.webkitAudioContext;return C?new C():null;},now=()=>performance.now(),onPlay=()=>{}}={}){
  Object.assign(this,{contextFactory,now,onPlay});this.sounds=new Map(sounds.map(s=>[s.id,s]));this.settings=normalizeSoundSettings(settings);this.context=null;this.unlocked=false;this.unsupported=false;this.voices=new Set();this.buffers=new Map();this.pending=new Map();this.cacheBytes=0;this.cacheLimit=8*1024*1024;this.last=new Map();this.epochs={game:0,action:0,preview:0};this.maxVoices=4;this.unlocking=null;
 }
 get ready(){return this.unlocked&&this.context?.state==='running';}
 async unlock(){
  if(this.ready)return true;if(this.unsupported)return false;if(this.unlocking)return this.unlocking;
  this.unlocking=(async()=>{try{if(!this.context){this.context=this.contextFactory();if(!this.context){this.unsupported=true;return false;}this.master=this.context.createGain();this.limiter=this.context.createDynamicsCompressor();this.limiter.threshold.value=-5;this.limiter.knee.value=4;this.limiter.ratio.value=20;this.limiter.attack.value=0;this.limiter.release.value=.08;this.master.connect(this.limiter);this.limiter.connect(this.context.destination);this.buses={};for(const group of [...Object.keys(SOUND_GROUPS),'preview']){const bus=this.context.createGain();bus.connect(this.master);this.buses[group]=bus;}}
   if(this.context.state!=='running')await this.context.resume();this.unlocked=this.context.state==='running';this.refreshMix();if(this.unlocked)this.prime();return this.unlocked;
  }catch{return false;}})();const pending=this.unlocking;try{return await pending;}finally{if(this.unlocking===pending)this.unlocking=null;}
 }
 prime(){for(const id of ['ui_click','ui_confirm','dice_drop_single','dice_tick','dice_land','bonus_add','bonus_penalty','score_lock'])void this.buffer(id).catch(()=>{});}
 async buffer(id){
  if(this.buffers.has(id)){const b=this.buffers.get(id);this.buffers.delete(id);this.buffers.set(id,b);return b;}
  if(this.pending.has(id))return this.pending.get(id);const sound=this.sounds.get(id);if(!sound||!this.context)throw Error('오디오가 준비되지 않았습니다.');
  const job=this.context.decodeAudioData(audioBytes(sound.data)).then(b=>{this.buffers.set(id,b);this.cacheBytes+=b.length*b.numberOfChannels*4;while(this.cacheBytes>this.cacheLimit&&this.buffers.size>1){const [key,old]=this.buffers.entries().next().value;this.buffers.delete(key);this.cacheBytes-=old.length*old.numberOfChannels*4;}return b;}).finally(()=>this.pending.delete(id));this.pending.set(id,job);return job;
 }
 update(settings){const next=normalizeSoundSettings(settings);this.settings=next;if(!next.enabled||next.volume===0)this.stopAll();this.refreshMix();}
 refreshMix(){
  if(!this.context||!this.master)return;const time=this.context.currentTime,major=[...this.voices].some(v=>v.priority>=60);
  const set=(node,value)=>{node.gain.cancelScheduledValues(time);node.gain.setTargetAtTime(value,time,.015);};set(this.master,this.settings.enabled?this.settings.volume*SOUND_OUTPUT_GAIN:0);
  for(const [group,bus] of Object.entries(this.buses)){const base=group==='preview'?1:soundGroupGain(this.settings,group),duck=major&&group!=='important'&&group!=='preview'?(group==='movement'?.15:group==='ui'?.25:.4):1;set(bus,base*duck);}
 }
 offsets(){return [...this.voices].filter(v=>v.kind==='game'&&v.cue.sustain).map(v=>({key:v.cue.key,cue:v.cue,offset:v.offset+Math.max(0,this.context.currentTime-v.started)}));}
 stopVoice(voice){if(voice.stopping)return;voice.stopping=true;this.voices.delete(voice);try{const t=this.context.currentTime;voice.gain.gain.cancelScheduledValues(t);voice.gain.gain.setValueAtTime(voice.gain.gain.value,t);voice.gain.gain.linearRampToValueAtTime(0,t+.025);voice.source.stop(t+.03);}catch{}this.refreshMix();}
 stopStage(){for(const v of [...this.voices])if(v.kind==='game'&&v.cue.scope==='stage')this.stopVoice(v);}
 stopGameplay(){this.epochs.game++;for(const v of [...this.voices])if(v.kind==='game')this.stopVoice(v);}
 stopPreview(){this.epochs.preview++;for(const v of [...this.voices])if(v.kind==='preview')this.stopVoice(v);}
 stopAll(){for(const kind of Object.keys(this.epochs))this.epochs[kind]++;for(const v of [...this.voices])this.stopVoice(v);}
 async play(cue,{offset=0,valid=()=>true,preview=false}={}){
  const s=this.sounds.get(cue.id),kind=preview?'preview':cue.transport===false?'action':'game',epoch=this.epochs[kind],requested=this.now(),group=preview?'preview':cue.group||'battle';
  if(!s||!this.ready||!this.settings.enabled||!this.settings.volume||!preview&&soundGroupGain(this.settings,group)===0)return false;
  try{
   const buffer=await this.buffer(cue.id),late=Math.max(0,this.now()-requested)/1000;
   if(epoch!==this.epochs[kind]||!valid()||!this.ready||!this.settings.enabled||late>(cue.priority>=60?.7:.25))return false;
   const start=offset+(cue.sustain?late:0),allowed=cue.maxDuration===undefined?Infinity:cue.maxDuration-offset-late,duration=Math.min(buffer.duration-start,allowed);if(duration<=.012)return false;
   const priority=preview?110:cue.priority??40,stamp=this.now(),lastKey=kind+':'+cue.id;
   if(!cue.sustain&&stamp-(this.last.get(lastKey)??-Infinity)<Math.min(s.cooldown,group==='ui'?90:150))return false;
   if(priority>=50){if([...this.voices].some(v=>v.priority>priority&&v.kind!=='preview'))return false;for(const v of [...this.voices])if(v.priority>=50&&v.priority<=priority)this.stopVoice(v);}
   if(cue.slot)for(const v of [...this.voices])if(v.kind===kind&&v.cue.slot===cue.slot)this.stopVoice(v);
   if(this.voices.size>=this.maxVoices){const lowest=[...this.voices].sort((a,b)=>a.priority-b.priority||a.started-b.started)[0];if(lowest.priority>priority)return false;this.stopVoice(lowest);}
   const source=this.context.createBufferSource(),gain=this.context.createGain(),t=this.context.currentTime;source.buffer=buffer;source.connect(gain);gain.connect(this.buses[group]||this.buses.battle);
   const level=s.volume*soundLevelGain(s.id)*(cue.gain??1),fade=Math.min(.035,duration/4);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(level,t+.008);gain.gain.setValueAtTime(level,t+Math.max(.008,duration-fade));gain.gain.linearRampToValueAtTime(0,t+duration);
   const voice={source,gain,cue,kind,offset:start,started:t,priority,stopping:false};this.voices.add(voice);source.onended=()=>{this.voices.delete(voice);try{source.disconnect();gain.disconnect();}catch{}this.refreshMix();};
   source.start(t,start,duration);source.stop(t+duration+.01);this.last.set(lastKey,stamp);this.refreshMix();this.onPlay({id:cue.id,key:cue.key,group,priority,offset:start,duration});return true;
  }catch{return false;}
 }
 async action(id){await this.unlock();return this.play({id,group:'ui',priority:10,transport:false});}
 async preview(id){await this.unlock();this.stopPreview();return this.play({id,priority:110},{preview:true});}
}
