import { mobileProfile } from './performance-profile.js';
// Keep unchanged SVG layers and decoded pictures alive during mobile playback.
// The normal edition continues to use its original rendering path.
const mobileMarkup=new WeakMap();
function syncAttributes(old,next){for(const a of [...old.attributes])if(!next.hasAttribute(a.name))old.removeAttribute(a.name);for(const a of next.attributes)if(old.getAttribute(a.name)!==a.value)old.setAttribute(a.name,a.value);}
function updateMobileUnits(old,next){
 const people=new Map([...old.children].map(n=>[n.dataset.person,n]));let cursor=old.firstElementChild;
 for(const n of [...next.children]){const existing=people.get(n.dataset.person);people.delete(n.dataset.person);const live=existing?.outerHTML===n.outerHTML?existing:n;if(existing&&live!==existing){existing.replaceWith(live);if(cursor===existing)cursor=live;}if(live!==cursor)old.insertBefore(live,cursor);cursor=live.nextElementSibling;}
 for(const n of people.values())n.remove();
}
function updateMobileMap(old,next){
 syncAttributes(old,next);const svg=old.querySelector('.atlas-map'),nextSvg=next.querySelector('.atlas-map');
 if(!svg||!nextSvg)return next;
 syncAttributes(svg,nextSvg);
 // Layer names are stable; children such as cards and their event listeners are delegated.
 const previous=new Map([...svg.children].map(n=>[n.getAttribute('class')||n.tagName,n]));
 let cursor=svg.firstElementChild;
 for(const n of [...nextSvg.children]){
  const key=n.getAttribute('class')||n.tagName,existing=previous.get(key),markup=n.outerHTML;
  let live=existing;
  if(existing){previous.delete(key);if(mobileMarkup.get(existing)!==markup){if(key==='country-tokens'){updateMobileUnits(existing,n);mobileMarkup.set(existing,markup);}else{existing.replaceWith(n);mobileMarkup.set(n,markup);if(cursor===existing)cursor=n;live=n;}}}
  else{live=n;mobileMarkup.set(n,markup);}
  if(live!==cursor)svg.insertBefore(live,cursor);
  cursor=live.nextElementSibling;
 }
 for(const n of previous.values())n.remove();
 for(const n of [...old.children])if(n!==svg)n.remove();
 for(const n of [...next.children])if(n!==nextSvg)old.append(n);
 return old;
}
export function renderApp(root,html){
 if(!mobileProfile()){root.innerHTML=html;return;}
 const template=document.createElement('template');template.innerHTML=html;
 for(const next of template.content.querySelectorAll('.atlas-scroll[data-map-camera]')){
  const old=[...root.querySelectorAll('.atlas-scroll[data-map-camera]')].find(n=>n.dataset.mapCamera===next.dataset.mapCamera);
  if(old){const map=updateMobileMap(old,next);if(map===old)next.replaceWith(old);}
  else for(const n of next.querySelector('.atlas-map')?.children||[])mobileMarkup.set(n,n.outerHTML);
 }
 root.replaceChildren(template.content);
}
