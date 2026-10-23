import { esc } from './icons.js';
export function choiceFor(event,world,value){
 if(event.type==='king'){
  const country=world.countries.find(c=>c.id===event.nationId),king=world.people.find(p=>p.countryId===country?.id&&p.role==='king');
  const threshold=world.rules.domesticThresholds[king?.personality||country?.personality||'balanced'];
  return {options:[{label:'내정'},{label:'전쟁'}],selected:value<=threshold?0:1};
 }
 if(event.type==='minister')return {options:['모병','충원력 강화','보급 강화'].map(label=>({label})),selected:event.sub};
 if(event.type==='war_target'){
  const countries=(event.candidates||[]).map(i=>world.countries[i]).filter(Boolean);
  return {options:countries.map(c=>({label:c.name,color:c.color})),selected:Math.max(0,countries.findIndex(c=>c.id===event.targetId))};
 }
 return null;
}
export function renderChoiceReel(scene,phase,progress=0,{rowHeight=54}={}){
 const choice=scene.choice;if(!choice?.options.length)return '';
 const rolling=phase==='rolling',selected=choice.options[choice.selected],items=Array.from({length:12},(_,i)=>choice.options[i%choice.options.length]);items.push(selected);
 return `<div class="choice-reel ${rolling?'is-spinning':'is-selected'}" data-choice="${esc(scene.event.type)}" aria-label="${rolling?'선택 중':esc(selected.label)+' 선택'}" style="--reel-end:-${(items.length-1)*rowHeight}px;--reel-delay:-${Math.min(.899,progress*.9)}s"><span class="choice-pointer">▶</span><div class="choice-window">${rolling?`<div class="choice-track">${items.map(option=>`<div class="choice-item" style="--choice-color:${option.color||'#fff'}">${esc(option.label)}</div>`).join('')}</div>`:`<strong class="choice-item" style="--choice-color:${selected.color||'#fff'}">${esc(selected.label)}</strong>`}</div><span class="choice-pointer">◀</span></div>`;
}
