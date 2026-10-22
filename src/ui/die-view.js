import { esc } from './icons.js';
import { diceColor, diceReel } from './dice-colors.js';
import { DICE_ART } from '../data/studio-art.js';
let dieArtInstance=0;
const diceSigned=n=>n>0?`+${n}`:String(n||0);
function attachedDie(value){
 const prefix=`dice-art-${++dieArtInstance}-`,source=DICE_ART[value]||DICE_ART[1];
 return source.replace(/(<text\b[^>]*\by=")103(")/g,(_,a,b)=>a+'91'+b).replace('<svg ',`<svg class="dice-art ${DICE_ART[value]?'':'blank-face'}" aria-hidden="true" `).replace(/id="([^"]+)"/g,(_,id)=>`id="${prefix}${id}"`).replace(/url\(#([^)]+)\)/g,(_,id)=>`url(#${prefix}${id})`);
}
export function renderDie(value,sides,phase='waiting',label='주사위',bonus=0,options={}){
 const rolling=phase==='rolling',revealed=Number.isInteger(value)&&!rolling,total=!options.rawFace&&phase==='locked'&&bonus?value+bonus:value;
 const face=revealed?total:null,frames=[1,.22,.53,.87,.36,1,.68].map(n=>Math.max(1,Math.min(60,Math.round(n*sides))));
 const artwork=rolling?`<span class="die-art-stack">${frames.map((n,i)=>`<span class="die-art-frame" style="--frame:${i};--die-ink:${diceColor(n,sides)}">${attachedDie(n)}</span>`).join('')}</span>`:attachedDie(face);
 return `<div class="visual-die-block" style="--die-ink:${diceColor(revealed?total:null,sides)};${diceReel(sides)}"><span class="die-caption">${esc(label)}</span><div class="visual-die attached-die ${rolling?'rolling':''} ${revealed?'locked':''} ${phase==='merging'?'merging':''} ${!DICE_ART[face]&&!rolling?'custom-die-value':''}" data-die-locked="${revealed}" data-die-value="${revealed?total:''}" data-die-sides="${sides}" aria-label="${esc(label)} ${revealed?total:rolling?'굴리는 중':'대기'}">${artwork}<span class="die-number">${revealed?total:'?'}</span><small>D${sides}${!options.rawFace&&phase==='locked'&&bonus?' + 보정':''}</small>${revealed&&bonus&&phase==='merging'?`<b class="merging-bonus">${diceSigned(bonus)}</b>`:''}</div><div class="die-equation ${revealed?'':'waiting-equation'}">${revealed?`${value}${bonus?` <b>${diceSigned(bonus)}</b> = <strong>${value+bonus}</strong>`:' 확정'}`:'눈금 → 보정 → 최종 점수'}</div></div>`;
}
