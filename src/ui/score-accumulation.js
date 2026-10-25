import { renderDie } from './die-view.js';
import { diceColor } from './dice-colors.js';
import { esc } from './icons.js';
export function scoreBonusItems(side,ability=0){
 return side?[['장군',side.ability||0],['병력',side.armyBonus||0],[side.underdogWins!==undefined?'역전':'전적',side.experienceBonus||0],['지형',side.terrainBonus||0],['피로',side.fatigueBonus||0]].map(([label,value])=>({label,value})):[{label:'능력',value:ability||0}];
}
export function accumulatedScore(raw,items,phase,index=0){
 const active=items.filter(i=>i.value),count=phase==='locked'?active.length:phase==='merging'?index:0;
 const before=raw+active.slice(0,count).reduce((sum,i)=>sum+i.value,0),item=phase==='merging'?active[index]:null;
 return {before,after:before+(item?.value||0),item};
}
export function renderAccumulatingDie(value,sides,phase,label,items=[],{mergeIndex=0,progress=0,speed=1}={}){
 const rolling=phase==='rolling',waiting=!Number.isInteger(value),score=waiting?null:accumulatedScore(value,items,phase,mergeIndex),shown=score?.after??null;
 let html=renderDie(rolling?value:shown,sides,phase,label,0,{rawFace:true});
 html=html.replace('class="visual-die-block"',`class="visual-die-block accumulating-die" data-score-phase="${phase}" data-raw-value="${!rolling&&!waiting?value:''}" data-score-visible="${phase==='locked'&&!waiting}"`);
 html=html.replace(/<div class="die-equation[\s\S]*?<\/div><\/div>$/,`<div class="die-equation">${rolling||waiting?'눈금 → 보정 합산':phase==='locked'?'최종 점수':phase==='merging'?'보정 합산 중':'기본 눈금'}</div></div>`);
 if(score?.item&&!rolling){
  const signed=score.item.value>0?'+'+score.item.value:String(score.item.value),duration=.5/Math.max(.1,speed),style=`--flight-time:${duration}s;--flight-delay:${-duration*progress}s`;
  html=html.replace(/<span class="die-number">[\s\S]*?<\/span>/,`<span class="die-number score-number" style="${style}"><span class="score-before">${score.before}</span><span class="score-after">${score.after}</span></span><span class="bonus-flight" data-bonus-label="${esc(score.item.label)}" data-bonus-value="${score.item.value}" style="${style}">${esc(score.item.label)} ${signed}</span>`);
 }
 if(!rolling&&!waiting)html=html.replace('style="--die-ink:',`data-score-before="${score.before}" data-score-after="${score.after}" style="--die-ink:`).replace(/--die-ink:[^;]+;/,`--die-ink:${diceColor(shown,sides)};`);
 return html;
}
