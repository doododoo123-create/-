import { SOUND_PACK } from '../data/sound-art.js';
import { SOUND_GROUPS,saveSoundSettings,normalizeSoundSettings } from '../audio/settings.js';
import { esc } from './icons.js';
const speakerSvg=muted=>`<svg xmlns="http://www.w3.org/2000/svg" data-sound-icon="" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4Z"/>${muted?'<path d="m17 9 5 6m0-6-5 6"/>':'<path d="M17 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>'}</svg>`;
export function renderSoundButton(settings,compact=false){const muted=!settings.enabled||settings.volume===0;return `<button type="button" class="${compact?'map-sound-toggle':'button outline sound-button'} ${muted?'is-muted':''}" data-action="sound-settings" aria-haspopup="dialog" aria-label="소리 설정${muted?' · 음소거':''}" title="소리 설정 · M 음소거">${speakerSvg(muted)}${compact?'':'<span>소리</span>'}</button>`;}
export function refreshSoundButtons(root,settings){const muted=!settings.enabled||settings.volume===0;for(const button of root.querySelectorAll('[data-action="sound-settings"]')){button.classList.toggle('is-muted',muted);button.setAttribute('aria-label','소리 설정'+(muted?' · 음소거':''));button.querySelector('[data-sound-icon]')?.replaceWith(new DOMParser().parseFromString(speakerSvg(muted),'image/svg+xml').documentElement);}}
export class SoundPanel {
 constructor({mixer,getWorld,storage=globalThis.localStorage,onChange=()=>{}}){Object.assign(this,{mixer,getWorld,storage,onChange});this.dialog=document.querySelector('#sound-dialog');this.dialog.addEventListener('input',e=>this.change(e.target));this.dialog.addEventListener('change',e=>this.change(e.target));this.dialog.addEventListener('click',e=>{if(e.target===this.dialog||e.target.closest('[data-sound-close]'))this.close();const preview=e.target.closest('[data-sound-preview]');if(preview)void this.preview(preview.dataset.soundPreview);});this.dialog.addEventListener('close',()=>this.mixer.stopPreview());}
 open(){
  const s=this.mixer.settings,slider=(name,label,value)=>`<label class="sound-range">${label}<output data-sound-value="${name}">${Math.round(value*100)}%</output><input type="range" min="0" max="100" step="1" name="${name}" value="${Math.round(value*100)}"></label>`;
  this.dialog.innerHTML=`<div class="sound-heading"><div><h2>소리 설정</h2><p>고전 전략 v2 · 효과음 42종</p></div><button type="button" class="icon-button" data-sound-close aria-label="소리 설정 닫기">×</button></div><label><input type="checkbox" name="sound-enabled" ${s.enabled?'checked':''}> 효과음 켜기 <small>M: 음소거 전환</small></label>${slider('sound-volume','전체 음량',s.volume)}<label>듣기 설정<select name="sound-preset">${[['standard','일반 관전'],['recording','녹화용 · 조작음 끄기'],['quiet','조용히 듣기']].map(([v,label])=>`<option value="${v}" ${s.preset===v?'selected':''}>${label}</option>`).join('')}</select></label><details><summary>종류별 음량</summary>${Object.entries(SOUND_GROUPS).map(([key,label])=>slider('sound-group-'+key,label,s.groups[key])).join('')}</details><label><input type="checkbox" name="sound-simplify" ${s.simplify?'checked':''}> 고배속에서 효과음 자동 간소화</label><label><input type="checkbox" name="sound-turn" ${s.turnStart?'checked':''}> 국가 차례 시작음</label><label>주사위 음색<select name="sound-dice">${[['auto','자동 · 현재 연출 길이에 맞춤'],['wood','나무판'],['cloth','천 깐 판'],['cup','가죽 컵'],['ticks','짧은 충돌'],['alternate','나무판 번갈아 듣기']].map(([v,label])=>`<option value="${v}" ${s.diceStyle===v?'selected':''}>${label}</option>`).join('')}</select></label><p class="sound-help">긴 굴림음은 시간이 충분한 장면에서 사용하고,짧은 판정에서는 짧은 음원으로 맞춥니다.</p><label>승패 효과음<select name="sound-perspective"><option value="neutral" ${s.perspective==='neutral'?'selected':''}>중립 관전 · 실제 승자 기준</option><option value="selected" ${s.perspective==='selected'?'selected':''}>선택한 국가의 승리·패배 강조</option></select></label><label>관심 국가<select name="sound-country" ${s.perspective==='neutral'?'disabled':''}>${this.getWorld().countries.map(c=>`<option value="${esc(c.id)}" ${s.countryId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label><details class="sound-library"><summary>효과음 42종 미리듣기</summary><p class="sound-help">미리듣기는 전체 음량을 따릅니다.</p><div class="sound-samples">${SOUND_PACK.map(sound=>`<button type="button" data-sound-preview="${sound.id}"><b>▶ ${esc(sound.label)}</b><small>${sound.duration.toFixed(2)}초</small></button>`).join('')}</div></details><output class="sound-status" data-sound-status role="status">${this.mixer.unsupported?'이 브라우저에서 오디오를 지원하지 않습니다.':'설정은 즉시 적용되며 이 브라우저에 저장됩니다. 새 실행이 필요하지 않습니다.'}</output><div class="sound-footer"><button type="button" class="button primary" data-sound-close>닫기</button></div>`;
  if(!this.dialog.open)this.dialog.showModal();
 }
 change(target){
  if(!target.name?.startsWith('sound-'))return;
  const previous=this.mixer.settings,next=normalizeSoundSettings(previous),name=target.name;
  if(name==='sound-enabled')next.enabled=target.checked;
  if(name==='sound-volume')next.volume=Number(target.value)/100;
  if(name.startsWith('sound-group-'))next.groups[name.slice(12)]=Number(target.value)/100;
  if(name==='sound-preset')next.preset=target.value;
  if(name==='sound-simplify')next.simplify=target.checked;
  if(name==='sound-turn')next.turnStart=target.checked;
  if(name==='sound-dice')next.diceStyle=target.value;
  if(name==='sound-perspective'){next.perspective=target.value;if(!next.countryId)next.countryId=this.getWorld().countries[0]?.id||null;}
  if(name==='sound-country')next.countryId=target.value;
  this.mixer.update(next);if(next.enabled)void this.mixer.unlock();
  const value=this.dialog.querySelector(`[data-sound-value="${name}"]`);if(value)value.textContent=target.value+'%';
  const country=this.dialog.querySelector('[name="sound-country"]');country.disabled=next.perspective!=='selected';if(next.countryId)country.value=next.countryId;
  try{saveSoundSettings(this.storage,next);this.status('설정을 저장했습니다.');}catch{this.status('소리는 적용됐지만 설정을 저장하지 못했습니다.');}this.onChange(next,previous);
 }
 status(text){const e=this.dialog.querySelector('[data-sound-status]');if(e)e.textContent=text;}
 async preview(id){if(!this.mixer.settings.enabled||!this.mixer.settings.volume){this.status('효과음을 켜고 전체 음량을 올려 주세요.');return;}const ok=await this.mixer.preview(id);this.status(ok?(SOUND_PACK.find(s=>s.id===id)?.label||'효과음')+' 미리듣기':this.mixer.unsupported?'이 브라우저에서 오디오를 지원하지 않습니다.':'소리를 시작하지 못했습니다. 미리듣기 버튼을 다시 눌러 주세요.');}
 close(){this.mixer.stopPreview();this.dialog.close();}
}
