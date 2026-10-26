import { esc } from './icons.js';
export function cardLabel(text,{y=-36,classes='',attributes='',size=8}={}){
 const texture=/전사|사망|패배|승리|거부|후퇴|퇴각|출정|역공|정비|혼란/.test(text)?'war':/충원|모병|증가|이관|배분|임관|재편/.test(text)?'domestic':'info';
 const width=Math.max(22,[...String(text)].reduce((n,c)=>n+(/[가-힣]/.test(c)?size:size*.58),0)+6);
 return `<g class="card-label-badge" pointer-events="none"><rect class="card-label-background" style="fill:url(#text-box-${texture})" x="${-width/2}" y="${y-size-1}" width="${width}" height="${size+4}" rx="2"/><text class="${classes}" ${attributes} text-anchor="middle" y="${y}">${esc(text)}</text></g>`;
}
