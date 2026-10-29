import {preserveHanMaps,mountHanMaps} from './han-map.js';
// Reuse unchanged map layers/cards in the normal edition. Compare generated
// markup, so transforms written by the camera and animation clock survive.
const mobileMarkup=new WeakMap();
const generatedAttributes=new WeakMap();
function mapLayerEntries(svg){const seen=new Map();return [...svg.children].map(n=>{const name=n.getAttribute('class')||n.tagName,order=seen.get(name)||0;seen.set(name,order+1);return [name+':'+order,n];});}
function syncAttributes(old,next){
 const before=generatedAttributes.get(old)||new Map([...old.attributes].map(a=>[a.name,a.value])),after=new Map([...next.attributes].map(a=>[a.name,a.value]));
 for(const name of before.keys())if(!after.has(name))old.removeAttribute(name);
 for(const [name,value] of after)if(before.get(name)!==value)old.setAttribute(name,value);
 generatedAttributes.set(old,after);
}
function updateMobileUnits(old,next){
 const people=new Map([...old.children].map(n=>[n.dataset.person,n]));let cursor=old.firstElementChild;
 for(const n of [...next.children]){const existing=people.get(n.dataset.person);people.delete(n.dataset.person);const markup=n.outerHTML,live=existing&&mobileMarkup.get(existing)===markup?existing:n;if(live===n)mobileMarkup.set(n,markup);if(existing&&live!==existing){existing.replaceWith(live);if(cursor===existing)cursor=live;}if(live!==cursor)old.insertBefore(live,cursor);cursor=live.nextElementSibling;}
 for(const n of people.values())n.remove();
}
function updateMobileMap(old,next){
 syncAttributes(old,next);const svg=old.querySelector('.atlas-map'),nextSvg=next.querySelector('.atlas-map');
 if(!svg||!nextSvg)return next;
 syncAttributes(svg,nextSvg);
 // Layer names are stable; children such as cards and their event listeners are delegated.
 const previous=new Map(mapLayerEntries(svg));
 let cursor=svg.firstElementChild;
 for(const [key,n] of mapLayerEntries(nextSvg)){
  const existing=previous.get(key),markup=n.outerHTML;
  let live=existing;
  if(existing){previous.delete(key);if(mobileMarkup.get(existing)!==markup){if(n.classList.contains('country-tokens')){updateMobileUnits(existing,n);mobileMarkup.set(existing,markup);}else{existing.replaceWith(n);mobileMarkup.set(n,markup);if(cursor===existing)cursor=n;live=n;}}}
  else{live=n;mobileMarkup.set(n,markup);if(n.classList.contains('country-tokens'))for(const card of n.children)mobileMarkup.set(card,card.outerHTML);}
  if(live!==cursor)svg.insertBefore(live,cursor);
  cursor=live.nextElementSibling;
 }
 for(const n of previous.values())n.remove();
 for(const n of [...old.children])if(n!==svg)n.remove();
 for(const n of [...next.children])if(n!==nextSvg)old.append(n);
 return old;
}
function updateFullscreenStage(old,next){
 syncAttributes(old,next);const previous=new Map(mapLayerEntries(old));let cursor=old.firstElementChild;
 for(const [key,n] of mapLayerEntries(next)){
  const existing=previous.get(key),markup=n.outerHTML;let live=n;
  if(existing){previous.delete(key);
   if(n.classList.contains('map-stage-atlas')){
    const map=existing.querySelector('.atlas-scroll'),nextMap=n.querySelector('.atlas-scroll');
    if(map&&nextMap){const patched=updateMobileMap(map,nextMap);if(patched!==map)map.replaceWith(patched);syncAttributes(existing,n);live=existing;}
   }else if(mobileMarkup.get(existing)===markup)live=existing;
   if(live!==existing){existing.replaceWith(live);if(cursor===existing)cursor=live;}
  }
  mobileMarkup.set(live,markup);if(live!==cursor)old.insertBefore(live,cursor);cursor=live.nextElementSibling;
 }
 for(const n of previous.values())n.remove();
}
export function renderApp(root,html){
 preserveHanMaps(root);
 const template=document.createElement('template');template.innerHTML=html;
 const stage=root.querySelector(':scope > .map-stage'),first=template.content.firstElementChild,nextStage=first?.matches('.map-stage')?first:null;
 if(stage&&nextStage){updateFullscreenStage(stage,nextStage);mountHanMaps(root);return;}
 for(const next of template.content.querySelectorAll('.atlas-scroll[data-map-camera]')){
  const old=[...root.querySelectorAll('.atlas-scroll[data-map-camera]')].find(n=>n.dataset.mapCamera===next.dataset.mapCamera);
  if(old){const map=updateMobileMap(old,next);if(map===old)next.replaceWith(old);}
  else for(const n of next.querySelector('.atlas-map')?.children||[]){mobileMarkup.set(n,n.outerHTML);if(n.classList.contains('country-tokens'))for(const card of n.children)mobileMarkup.set(card,card.outerHTML);}
 }
 root.replaceChildren(template.content);
 mountHanMaps(root);
}
