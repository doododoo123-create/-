import {retainedAtlasEnabled} from './atlas-fragments.js';
// Completed rows are already immutable in the campaign view. Send a tiny slot
// through the HTML parser, retaining the real row and its SVG dice in the DOM.
let campaignFragmentGroup=null,campaignFragmentSources=new Map();
export function retainCampaignRow(group,index,html){
 if(!retainedAtlasEnabled())return html;
 if(campaignFragmentGroup!==group){campaignFragmentGroup=group;campaignFragmentSources=new Map();}
 const key=String(index);campaignFragmentSources.set(key,html);
 return `<article class="campaign-duel" data-duel-index="${group.battles[index].index}" data-campaign-fragment="${key}"></article>`;
}
export function campaignFragmentSource(node){return node.hasAttribute('data-campaign-fragment')?campaignFragmentSources.get(node.dataset.campaignFragment):null;}
export function materializeCampaignFragment(node){
 const html=campaignFragmentSource(node);if(!html)return node;
 const template=document.createElement('template');template.innerHTML=html;return template.content.firstElementChild;
}
export function hydrateCampaignFragments(root){for(const node of root.querySelectorAll('[data-campaign-fragment]'))node.replaceWith(materializeCampaignFragment(node));}

export function releaseCampaignFragments(){campaignFragmentGroup=null;campaignFragmentSources.clear();}
