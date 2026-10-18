import { clone, neighbors } from '../model/world.js';
import { defaultCartography, validatePolygon, polygonCenter, pointInPolygon, pointInShape, shapeAnchor, MAX_POLYGON_POINTS, setTerritoryLinks } from '../model/cartography.js';
import { freeMapFrom, addFreeTerritory, removeFreeTerritory, moveFreeTerritory, boundaryLinks } from '../model/free-map.js';
import { geometryFor, cellPoints } from './cartography-geometry.js';
import { renderMapDraft } from './map-editor-view.js';
export class MapEditor {
  constructor({getWorld,getSelected,setSelected=()=>{},commit,render,notify}){Object.assign(this,{getWorld,getSelected,setSelected,commit,render,notify});this.mode='select';this.draft=null;this.history=[];this.zoom=1;this.drag=null;}
  reset(){this.mode='select';this.draft=null;this.history=[];this.zoom=1;}
  currentCell(){const world=this.getWorld();return geometryFor(world).cells[world.territories.findIndex(t=>t.id===this.getSelected())];}
  commitMap(next){this.committing=true;try{this.commit(next);}finally{this.committing=false;}}
  save(next){const previous=clone(this.getWorld());this.commitMap(next);this.history.push(previous);if(this.history.length>12)this.history.shift();this.render();}
  designWorld(){const next=clone(this.getWorld());next.cartography||=defaultCartography();return next;}
  select(){if(this.draft&&this.draft.length&&!confirm('적용하지 않은 경계 작업을 취소하고 다른 영토를 선택할까요?'))return false;this.draft=null;if(['reshape','trace','create','move','center'].includes(this.mode))this.mode='select';return true;}
  begin(mode){if(this.draft&&this.draft.length&&!confirm('적용하지 않은 경계 작업을 취소할까요?'))return;this.mode=mode;this.original=null;this.draft=null;if(mode==='reshape'){this.original=cellPoints(this.currentCell());this.draft=clone(this.original);}if(['trace','create'].includes(mode))this.draft=[];this.render();}
  action(action){
    if(!action.startsWith('map-edit-'))return false;
    const key=action.slice(9);if(key==='reference')return false;
    if(['select','paint','reshape','trace','create','move','center','links'].includes(key)){this.begin(key);return true;}
    if(key==='apply')this.apply();
    else if(key==='free'){this.save(this.freeWorld());this.notify('격자 제한을 해제했습니다. 영토를 추가·삭제·이동할 수 있습니다.');}
    else if(key==='delete'){if(confirm('선택한 영토를 삭제할까요? 연결과 수도 지정도 함께 정리됩니다.')){const next=removeFreeTerritory(this.freeWorld(),this.getSelected());this.setSelected(next.territories[0].id);this.mode='select';this.draft=null;this.save(next);}}
    else if(key==='auto-links'){if(confirm('맞닿은 경계로 모든 인접 관계를 다시 계산할까요? 수동 해상 연결은 제거됩니다.')){const next=this.freeWorld();next.cartography.links=boundaryLinks(next);this.save(next);this.notify('경계를 공유하는 영토끼리 연결했습니다.');}}
    else if(key==='cancel'){this.draft=null;this.mode='select';this.render();}
    else if(key==='point-undo'){this.draft?.pop();this.render();}
    else if(key==='undo'){if(this.draft?.length&&!confirm('적용하지 않은 경계 작업을 취소할까요?'))return true;const previous=this.history.at(-1);if(previous){this.commitMap(previous);this.history.pop();this.draft=null;this.mode='select';this.render();this.notify('직전 지도 편집을 되돌렸습니다.');}}
    else if(key==='background')document.querySelector('#map-background-file').click();
    else if(key==='remove-background'){const next=this.designWorld();next.cartography.background=null;this.save(next);}
    else if(key==='reset-shape'&&this.getWorld().mapKind==='free'){this.notify('자유 지도는 경계 다시 그리기 또는 편집 되돌리기를 사용해 주세요.');}
    else if(key==='reset-shape'){const next=this.designWorld();delete next.cartography.polygons[this.getSelected()];this.draft=null;this.mode='select';this.save(next);}
    else if(key==='reset-links'){if(confirm('모든 인접 관계를 원래 지도의 연결로 복원할까요?')){const next=this.designWorld();next.cartography.links=next.mapKind==='free'?boundaryLinks(next):null;this.save(next);}}
    return true;
  }
  freeWorld(){const world=this.getWorld(),geometry=geometryFor(world);return freeMapFrom(world,geometry.cells.map(c=>({...c,points:cellPoints(c)})));}
  apply(){
    if(this.mode==='create'){const result=addFreeTerritory(this.freeWorld(),this.draft);this.setSelected(result.id);this.save(result.world);this.draft=null;this.mode='select';this.render();this.notify('새 영토를 추가했습니다. 이름·소유국과 인접 관계를 확인해 주세요.');return;}
    const points=validatePolygon(this.draft),next=this.designWorld(),geometry=geometryFor(this.getWorld()),id=this.getSelected();
    if(this.mode==='reshape'){
      // Preserve shared vertices so adjusting a border does not create a gap in adjacent territories.
      const moves=this.original.map((p,i)=>({from:p,to:points[i]})).filter(m=>m.to&&(m.from[0]!==m.to[0]||m.from[1]!==m.to[1]));
      next.territories.forEach((t,i)=>{if(t.id===id)return;const old=cellPoints(geometry.cells[i]);let changed=false;const moved=old.map(p=>{const m=moves.find(m=>Math.hypot(p[0]-m.from[0],p[1]-m.from[1])<.002);if(m){changed=true;return [...m.to];}return p;});if(changed){const valid=validatePolygon(moved);Object.defineProperty(next.cartography.polygons,t.id,{value:{points:valid,center:shapeAnchor(valid,geometry.cells[i].holes,geometry.cells[i].center),...(geometry.cells[i].holes?{holes:geometry.cells[i].holes}:{})},enumerable:true,writable:true,configurable:true});}});
    }
    const current=geometry.cells[this.getWorld().territories.findIndex(t=>t.id===id)],holes=this.mode==='reshape'?current.holes||[]:[];
    Object.defineProperty(next.cartography.polygons,id,{value:{points,center:shapeAnchor(points,holes,this.mode==='reshape'?current.center:null),...(holes.length?{holes}:{})},enumerable:true,writable:true,configurable:true});
    // Commit first: failed validation must leave the draft and existing map intact.
    this.save(next);this.draft=null;this.mode='select';this.render();this.notify('영토 경계를 저장했습니다. 인접 관계는 별도로 확인해 주세요.');
  }
  position(event){const svg=event.target.closest('.atlas-map')||document.querySelector('#geographic-editor .atlas-map');const matrix=svg?.getScreenCTM();if(!matrix)return null;const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());return [Math.round(Math.max(0,Math.min(1200,point.x))*1000)/1000,Math.round(Math.max(0,Math.min(800,point.y))*1000)/1000];}
  refreshDraft(){const layer=document.querySelector('#geographic-editor .map-edit-layer');if(layer)layer.outerHTML=renderMapDraft(this.draft,this.mode);const counter=document.querySelector('.cartography-hint strong');if(counter)counter.textContent=`${this.draft?.length||0}개 꼭짓점`;const apply=document.querySelector('[data-action="map-edit-apply"]');if(apply)apply.disabled=(this.draft?.length||0)<3;}
  click(event){
    if(!event.target.closest('#geographic-editor .atlas-map'))return false;
    if(this.mode==='move'){const next=moveFreeTerritory(this.freeWorld(),this.getSelected(),this.position(event));this.mode='select';this.save(next);this.notify('영토를 이동했습니다. 인접 관계에서 연결을 확인해 주세요.');return true;}
    if(['trace','create'].includes(this.mode)){if(this.dragged){this.dragged=false;return true;}if(this.draft.length>=MAX_POLYGON_POINTS)throw new Error('꼭짓점은 최대 2048개입니다.');if(event.target.closest('[data-vertex]'))return true;this.draft.push(this.position(event));this.refreshDraft();return true;}
    if(this.mode==='reshape')return true;
    if(this.mode==='center'){const point=this.position(event),cell=this.currentCell(),points=cellPoints(cell);if(!pointInShape(point,{points,holes:cell.holes}))throw new Error('선택한 영토의 경계 안을 클릭해 주세요.');const next=this.designWorld();Object.defineProperty(next.cartography.polygons,this.getSelected(),{value:{points,center:point,...(cell.holes?{holes:cell.holes}:{})},enumerable:true,writable:true,configurable:true});this.mode='select';this.save(next);return true;}
    if(this.mode==='links'){const tile=event.target.closest('[data-territory]'),id=this.getSelected();if(!tile||tile.dataset.territory===id)return true;const world=this.getWorld(),territory=world.territories.find(t=>t.id===id),other=tile.dataset.territory,selected=neighbors(world,territory).map(n=>n.id),all=world.territories.flatMap(t=>neighbors(world,t).filter(n=>t.id<n.id).map(n=>[t.id,n.id]));const ids=selected.includes(other)?selected.filter(n=>n!==other):[...selected,other];const next=this.designWorld();next.cartography.links=setTerritoryLinks(all,id,ids);this.save(next);this.notify(selected.includes(other)?'인접 연결을 해제했습니다.':'두 영토를 서로 연결했습니다. 새 실행부터 반영됩니다.');return true;}
    return false;
  }
  pointerDown(event){if(!event.target.closest('#geographic-editor')||!['reshape','trace','create'].includes(this.mode))return;const vertex=event.target.closest('[data-vertex]');if(vertex){event.preventDefault();this.drag={index:Number(vertex.dataset.vertex),start:[event.clientX,event.clientY]};this.dragged=false;}}
  pointerMove(event){if(!this.drag)return;const point=this.position(event);if(!point)return;this.draft[this.drag.index]=point;this.dragged||=Math.hypot(event.clientX-this.drag.start[0],event.clientY-this.drag.start[1])>3;this.refreshDraft();}
  pointerUp(){this.drag=null;}
  change(target){
    if(target.id==='map-editor-zoom'){this.zoom=Number(target.value);this.render();return true;}
    if(target.id==='map-art-style'){const next=this.designWorld();next.cartography.style=target.value;this.save(next);return true;}
    if(target.id==='map-color-opacity'){const next=this.designWorld();next.cartography.opacity=Number(target.value)/100;this.save(next);return true;}
    return false;
  }
  async importBackground(file){
    if(!file)return;
    if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>12*1024*1024)throw new Error('12MB 이하의 PNG·JPEG·WebP 이미지를 선택해 주세요.');
    const worldId=this.getWorld().id,url=URL.createObjectURL(file),image=new Image();
    try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('이미지 파일을 읽을 수 없습니다.'));image.src=url;});if(this.getWorld().id!==worldId)throw new Error('세계가 바뀌었습니다. 현재 세계에서 이미지를 다시 선택해 주세요.');
      const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=800;const ctx=canvas.getContext('2d');ctx.fillStyle='#103e48';ctx.fillRect(0,0,1200,800);const scale=Math.min(1200/image.width,800/image.height),w=image.width*scale,h=image.height*scale;ctx.drawImage(image,(1200-w)/2,(800-h)/2,w,h);let data=canvas.toDataURL('image/jpeg',.86);if(data.length>1400000)data=canvas.toDataURL('image/jpeg',.65);if(data.length>1400000)throw new Error('그림이 너무 복잡합니다. 더 작은 이미지로 다시 선택해 주세요.');const next=this.designWorld();next.cartography.background=data;this.save(next);this.notify('배경 그림을 저장했습니다. 영토를 선택하고 경계 다시 그리기로 그림에 맞춰 주세요.');
    }finally{URL.revokeObjectURL(url);}
  }
}
