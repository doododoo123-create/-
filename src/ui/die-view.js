import { esc } from './icons.js';
import { diceColor, diceReel } from './dice-colors.js';
const diceSigned=n=>n>0?`+${n}`:String(n||0);
export function renderDie(value,sides,phase='waiting',label='주사위',bonus=0) {
  const rolling=phase==='rolling',revealed=Number.isInteger(value)&&!rolling;
  const total=phase==='locked'&&bonus?value+bonus:value;
  return `<div class="visual-die-block" style="--die-ink:${diceColor(revealed?total:null,sides)};${diceReel(sides)}"><span class="die-caption">${esc(label)}</span><div class="visual-die ${rolling?'rolling':''} ${revealed?'locked':''} ${phase==='merging'?'merging':''}" data-die-locked="${revealed}" data-die-value="${revealed?total:''}" data-die-sides="${sides}" aria-label="${esc(label)} ${revealed?total:rolling?'굴리는 중':'대기'}"><span class="die-corner top"></span><span class="die-number">${revealed?total:'?'}</span>${rolling?'<span class="rolling-number" aria-hidden="true"></span>':''}<small>D${sides}${phase==='locked'&&bonus?' + 보정':''}</small><span class="die-corner bottom"></span>${revealed&&bonus&&phase==='merging'?`<b class="merging-bonus">${diceSigned(bonus)}</b>`:''}</div><div class="die-equation ${revealed?'':'waiting-equation'}">${revealed?`${value}${bonus?` <b>${diceSigned(bonus)}</b> = <strong>${value+bonus}</strong>`:' 확정'}`:'눈금 → 보정 → 최종 점수'}</div></div>`;
}
