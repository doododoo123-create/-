// Retain generated SVG layers without reparsing unchanged geometry on every die
// phase. Sources are bounded and view-only; no world data or live animation DOM
// is used as the source of truth. Node renderers keep returning ordinary SVG.
export class AtlasFragmentCache {
 constructor(limit=96){this.limit=limit;this.entries=new Map();this.revision=0;}
 retain(key,html){
  let entry=this.entries.get(key);if(entry?.html!==html)entry={html,revision:++this.revision};
  this.entries.delete(key);this.entries.set(key,entry);
  while(this.entries.size>this.limit)this.entries.delete(this.entries.keys().next().value);
  return entry;
 }
 get(key){return this.entries.get(key);}
}
const atlasFragments=new AtlasFragmentCache();let retainedAtlasActive=false;
export function retainedAtlasEnabled(){return retainedAtlasActive;}
export function enableRetainedAtlas(){retainedAtlasActive=true;}
export function retainAtlasLayer(context,name,html){
 if(!retainedAtlasActive)return html;
 const key=context+':'+name,entry=atlasFragments.retain(key,html);
 return `<g data-atlas-fragment="${key}" data-atlas-revision="${entry.revision}"></g>`;
}
export function atlasFragmentSource(node){return atlasFragments.get(node.dataset.atlasFragment);}
export function materializeAtlasFragment(node){
 const entry=atlasFragmentSource(node);if(!entry)return node;
 const template=document.createElement('template');template.innerHTML='<svg xmlns="http://www.w3.org/2000/svg">'+entry.html+'</svg>';
 const layer=template.content.firstElementChild.firstElementChild;
 if(!layer)throw Error('지도 표시 레이어를 읽지 못했습니다.');
 layer.dataset.atlasMounted='true';layer.dataset.atlasFragment=node.dataset.atlasFragment;layer.dataset.atlasRevision=String(entry.revision);
 return layer;
}
export function hydrateAtlasFragments(root){for(const node of root.querySelectorAll('[data-atlas-fragment]'))if(node.dataset.atlasMounted!=='true')node.replaceWith(materializeAtlasFragment(node));}
