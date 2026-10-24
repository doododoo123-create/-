import { esc } from './icons.js';
export function cardLabel(text,{y=-36,classes='',attributes='',size=8}={}){
 const width=Math.max(22,[...String(text)].reduce((n,c)=>n+(/[가-힣]/.test(c)?size:size*.58),0)+6);
 return `<g class="card-label-badge" pointer-events="none"><rect class="card-label-background" x="${-width/2}" y="${y-size-1}" width="${width}" height="${size+4}" rx="2"/><text class="${classes}" ${attributes} text-anchor="middle" y="${y}">${esc(text)}</text></g>`;
}
