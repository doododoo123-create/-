// Update selection in place: replacing the history list resets its scroll position.
export class HistorySelection {
 constructor({selected,getTurns,onChange=()=>{},root=globalThis.document}){Object.assign(this,{selected,getTurns,onChange,root});this.anchor=null;this.drag=null;this.frame=null;}
 refresh(){
  for(const input of this.root.querySelectorAll('[data-film-turn]')){input.checked=this.selected.has(Number(input.dataset.filmTurn));input.closest('.history-select-row')?.classList.toggle('is-selected',input.checked);}
  for(const count of this.root.querySelectorAll('[data-film-count]'))count.textContent=this.selected.size+'개 선택';
  for(const button of this.root.querySelectorAll('[data-action="film-selected"],[data-action="film-clear-selection"]'))button.disabled=!this.selected.size;
  this.onChange();
 }
 setRange(a,b,value){for(const turn of this.getTurns())if(turn>=Math.min(a,b)&&turn<=Math.max(a,b)){if(value)this.selected.add(turn);else this.selected.delete(turn);}this.refresh();}
 change(input){const turn=Number(input.dataset.filmTurn);if(input.checked)this.selected.add(turn);else this.selected.delete(turn);this.anchor=turn;this.refresh();}
 clear(){this.selected.clear();this.anchor=null;this.refresh();}
 install(){
  this.root.addEventListener('pointerdown',e=>{
   const handle=e.target.closest('[data-film-select]'),input=handle?.querySelector('[data-film-turn]');if(!input||e.button!==0)return;
   e.preventDefault();const turn=Number(input.dataset.filmTurn),value=!this.selected.has(turn);
   if(e.shiftKey&&this.anchor!==null){this.setRange(this.anchor,turn,value);return;}
   this.anchor=turn;this.setRange(turn,turn,value);this.drag={id:e.pointerId,last:turn,value,x:e.clientX,y:e.clientY,list:handle.closest('.history-scroll')};
   handle.setPointerCapture?.(e.pointerId);this.scroll();
  });
  this.root.addEventListener('click',e=>{if(e.detail>0&&e.target.closest('[data-film-select]'))e.preventDefault();});
  this.root.addEventListener('pointermove',e=>{if(this.drag?.id!==e.pointerId)return;this.drag.x=e.clientX;this.drag.y=e.clientY;this.hit();});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])this.root.addEventListener(name,()=>this.end());
  globalThis.addEventListener?.('blur',()=>this.end());
 }
 hit(){const d=this.drag;if(!d)return;const row=this.root.elementFromPoint(d.x,d.y)?.closest('.history-select-row');if(!row||!d.list.contains(row))return;const turn=Number(row.dataset.filmRow);if(turn!==d.last){this.setRange(d.last,turn,d.value);d.last=turn;}}
 scroll(){if(!this.drag)return;const d=this.drag,box=d.list.getBoundingClientRect(),edge=36;const delta=d.y<box.top+edge?-12:d.y>box.bottom-edge?12:0;if(delta){d.list.scrollTop+=delta;this.hit();}this.frame=requestAnimationFrame(()=>this.scroll());}
 end(){this.drag=null;if(this.frame!==null)cancelAnimationFrame(this.frame);this.frame=null;}
}
