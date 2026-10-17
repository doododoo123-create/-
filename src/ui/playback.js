import { countryPeople, findCountry, PERSONALITIES } from '../model/world.js';
export const leadGeneral = (world, id) => countryPeople(world,id).filter(p=>p.role==='general').reduce((best,p)=>!best||p.ability>best.ability?p:best,null);
export function makeTurnScenes(record, before) {
  const actor = findCountry(before, record.actorId), king = countryPeople(before,actor.id).find(p=>p.role==='king');
  const personality = king?.personality || actor.personality;
  const threshold = before.rules.domesticThresholds[personality];
  const action = record.type==='war' ? '전쟁' : '내정';
  const scenes = [{ id:'action', kind:'roll', role:'king', diceIndices:[0], title:'국왕의 행동 선택', lockedTitle:record.type==='domestic'&&record.rolls[0].value>threshold?'공격할 수 없어 내정으로 전환':`${actor.name}, ${action} 선택`, detail:`${PERSONALITIES[personality]} · ${threshold ? `1~${threshold} 내정` : '내정 구간 없음'} / ${threshold<before.rules.diceSides ? `${threshold+1}~${before.rules.diceSides} 전쟁` : '전쟁 구간 없음'}`, person:king }];
  if(record.type==='domestic') {
    scenes.push({ id:'domestic',kind:'roll',role:'minister',diceIndices:[1],title:`승상의 ${record.action==='recruit'?'모병':'충원 강화'} 판정`,lockedTitle:record.success?'내정 성공':'내정 실패',detail:`주사위 + 승상 능력 ≥ ${before.rules.successTarget}점이면 성공`,person:countryPeople(before,actor.id).find(p=>p.role==='minister') });
  } else {
    scenes.push({id:'target',kind:'focus',role:'general',title:`${record.targetName}, 공격 목표 확정`,detail:'붉은 화살표는 공격 경로, 푸른 화살표는 방어 국가를 표시합니다.'});
    if(record.battle) {
      scenes.push({id:'attack',kind:'roll',role:'general',diceIndices:[1],title:'공격군의 전투 판정',lockedTitle:'공격 점수 확정',detail:'주사위 + 장군 능력 + 병력 우세 보정'});
      scenes.push({id:'defense',kind:'roll',role:'general',diceIndices:[2],title:'수비군의 전투 판정',lockedTitle:'양측 전투 점수 확정',detail:'공격 점수가 더 높으면 목표 영토를 점령합니다.'});
    }
  }
  scenes.push({id:'result',kind:'result',role:record.type==='war'?'general':'minister',title:record.title,detail:record.detail});
  return scenes;
}

// Presentation owns its own clock. It never calls the engine or consumes game randomness.
export class TurnPlayback {
  constructor({onChange=()=>{},onFinish=()=>{},speed=()=>1,reducedMotion=()=>false,schedule=(callback,delay)=>setTimeout(callback,delay),cancel=handle=>clearTimeout(handle),now=()=>Date.now()}={}) {
    this.onChange=onChange; this.onFinish=onFinish; this.speed=speed; this.reducedMotion=reducedMotion; this.schedule=schedule; this.cancel=cancel; this.now=now;
    this.state=null; this.handle=null; this.remaining=0; this.deadline=0; this.scheduledSpeed=1;
  }
  get scene() { return this.state?.scenes[this.state.index] || null; }
  get playing() { return !!this.state?.playing; }
  get complete() { return !this.state || this.state.finished; }
  get showingResult() { return this.scene?.kind==='result'; }
  duration() { return this.state.phase==='rolling' ? (this.reducedMotion()?80:1000) : this.scene.kind==='result'?1500:this.scene.kind==='focus'?750:800; }
  clearTimer() { if(this.handle!==null) this.cancel(this.handle); this.handle=null; }
  load(record,before,after,play=true) {
    this.clearTimer(); this.state={record,before,after,scenes:makeTurnScenes(record,before),index:0,phase:'rolling',playing:play,finished:false};
    this.remaining=this.duration(); this.onChange(); if(play) this.arm();
  }
  arm() {
    if(!this.state?.playing||this.state.finished)return;
    this.clearTimer(); this.scheduledSpeed=Math.max(.1,Number(this.speed())||1);
    this.deadline=this.now()+this.remaining/this.scheduledSpeed;
    this.handle=this.schedule(()=>{this.handle=null;this.advance();},this.remaining/this.scheduledSpeed);
  }
  pause() {
    if(!this.state||!this.playing)return;
    if(this.handle!==null) this.remaining=Math.max(0,(this.deadline-this.now())*this.scheduledSpeed);
    this.clearTimer(); this.state.playing=false;
  }
  resume() { if(!this.state||this.state.finished)return; this.state.playing=true;this.onChange();this.arm(); }
  advance() {
    if(!this.state||this.state.finished)return;
    this.clearTimer();
    if(this.state.phase==='rolling')this.state.phase='locked';
    else if(this.state.index<this.state.scenes.length-1) { this.state.index++;this.state.phase=this.scene.kind==='roll'?'rolling':'holding'; }
    else { this.state.finished=true;this.state.playing=false;this.onChange();this.onFinish();return; }
    this.remaining=this.duration();this.onChange();if(this.state.playing)this.arm();
  }
  step() { this.pause();this.advance(); }
  finish() {
    if(!this.state||this.state.finished)return;
    this.clearTimer();this.state.index=this.state.scenes.length-1;this.state.phase='holding';this.state.finished=true;this.state.playing=false;
    this.onChange();this.onFinish();
  }
  reset() { this.clearTimer();this.state=null;this.remaining=0; }
}
