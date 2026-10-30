// Screen-space framing only. Army location, movement, zoom and game data are
// never edited to make room for the dice table.
const armyPaneDefaults=new WeakMap();
function boxUnion(boxes){const left=Math.min(...boxes.map(b=>b.left)),right=Math.max(...boxes.map(b=>b.right)),top=Math.min(...boxes.map(b=>b.top)),bottom=Math.max(...boxes.map(b=>b.bottom));return {left,right,top,bottom,width:right-left,height:bottom-top};}
export function armySafeTranslation(viewport,pane,army){
 const floor=pane.bottom+18,ceiling=viewport.bottom-12,space=Math.max(0,ceiling-floor-army.height),top=Math.min(floor+Math.min(36,space*.2),Math.max(floor,ceiling-army.height));
 return {x:(viewport.left+viewport.right-army.left-army.right)/2,y:top-army.top};
}
export function followArmyCampaign(camera){
 const root=globalThis.document?.querySelector?.('.map-stage');if(!root)return false;
 const clear=()=>{root.removeAttribute('data-army-aware');root.style.removeProperty('--army-pane-height');root.style.removeProperty('--army-pane-top');root.style.removeProperty('--army-pane-left');};
 const pane=root.querySelector('.campaign-popup:not(.is-inline)');if(!camera.autoFollow||!pane){clear();return false;}
 let ids;try{ids=JSON.parse(pane.dataset.mapArmies||'[]');}catch{ids=[];}
 const groups=[...root.querySelectorAll('.map-unit-position.is-army-group')].filter(c=>ids.includes(c.dataset.armyGroup));if(!groups.length){clear();return false;}
 const svg=root.querySelector('.atlas-map'),matrix=svg?.getScreenCTM?.();if(!matrix)return false;const scale=Math.hypot(matrix.a,matrix.b);if(!Number.isFinite(scale)||scale<=0)return false;
 const viewport=root.getBoundingClientRect(),measure=c=>boxUnion([...c.querySelectorAll('.army-leader-scale .map-unit-token,.army-leader-scale .token-army-caption,.army-leader-scale .unit-pin-tip,.army-mini-unit .map-unit-token')].map(n=>n.getBoundingClientRect()).filter(b=>b.width&&b.height));
 const entries=groups.map(c=>({card:c,box:measure(c)}));let army=boxUnion(entries.map(e=>e.box));
 // Very distant reserve formations must not force a zoom change or hide the
 // acting army. Keep the current attacking formation as the framing priority.
 if(entries.length>1&&(army.width>viewport.width-24||army.height>viewport.height-230))army=(entries.find(e=>e.card.dataset.armyGroup===pane.dataset.mapArmyPrimary)||entries[0]).box;
 let defaults=armyPaneDefaults.get(root);
 if(!defaults||defaults.pane!==pane||defaults.width!==viewport.width||defaults.height!==viewport.height){root.removeAttribute('data-army-aware');const natural=pane.getBoundingClientRect();defaults={pane,width:viewport.width,height:viewport.height,top:natural.top-viewport.top,left:natural.left,right:natural.right};armyPaneDefaults.set(root,defaults);}
 const controls=[...root.querySelectorAll('.map-follow-toggle,.map-play-toggle,.map-sound-toggle,.map-calendar,[data-action=sound-settings]')].map(c=>c.getBoundingClientRect());
 const overlaps=(b,left,right)=>b.left<right&&b.right>left;
 let top=defaults.top,left=(defaults.left+defaults.right)/2;
 if(viewport.height-top-army.height-30<220){
  top=Math.max(16,...controls.filter(b=>overlaps(b,defaults.left,defaults.right)).map(b=>b.bottom-viewport.top+8));
  const latestTop=viewport.height-army.height-20-160,low=controls.filter(b=>overlaps(b,defaults.left,defaults.right)&&b.bottom-viewport.top+8>latestTop),shift=Math.max(0,...low.map(b=>defaults.right-b.left+8));
  // On shorter desktop windows, a small horizontal shift clears the calendar
  // instead of pushing the whole table down over the map army.
  if(shift&&shift<=defaults.left-viewport.left-8){left-=shift;top=Math.max(16,...controls.filter(b=>overlaps(b,defaults.left-shift,defaults.right-shift)).map(b=>b.bottom-viewport.top+8));}
 }
 const maxHeight=Math.max(160,viewport.height-top-army.height-30);
 for(const [key,value] of [['--army-pane-top',top+'px'],['--army-pane-height',maxHeight+'px'],['--army-pane-left',(left-viewport.left)+'px']])if(root.style.getPropertyValue(key)!==value)root.style.setProperty(key,value);
 root.dataset.armyAware='true';const delta=armySafeTranslation(viewport,pane.getBoundingClientRect(),army);
 if(Math.abs(delta.x)>.75||Math.abs(delta.y)>.75){const view=camera.view('simulation');view.x-=delta.x/scale;view.y-=delta.y/scale;camera.clamp(view);camera.update('simulation');}
 return true;
}
