import { prepareMapImage } from './map-image.js';
import { GENERATOR_WIDTH, GENERATOR_HEIGHT, guessSeaColor, recognizeLand, prepareLand, partitionLand, vectorizePartition } from '../model/map-generation.js';
import { generatedWorld } from '../model/free-map.js';
import { polygonPath } from '../model/cartography-geometry.js';
import { REFERENCE_ART } from '../data/reference-art.js';
export class MapGenerator {
 constructor({getWorld,apply,notify}){Object.assign(this,{getWorld,apply,notify});this.session=0;this.dialog=null;this.state=null;}
 open(){
  this.session++;const world=this.getWorld();this.state={worldId:world.id,source:null,rgba:null,mask:null,sea:[16,62,72],tolerance:30,minimum:8,mode:'land',brush:36,count:80,result:null,history:[],busy:false};
  if(!this.dialog){this.dialog=document.createElement('dialog');this.dialog.id='map-generator';this.dialog.setAttribute('aria-labelledby','map-generator-title');document.body.append(this.dialog);this.dialog.addEventListener('click',e=>this.click(e));this.dialog.addEventListener('change',e=>this.change(e));this.dialog.addEventListener('pointerdown',e=>this.down(e));this.dialog.addEventListener('pointermove',e=>this.move(e));this.dialog.addEventListener('pointerup',()=>this.up());this.dialog.addEventListener('pointercancel',()=>this.up());this.dialog.addEventListener('close',()=>{this.session++;this.painting=false;});}
  const current=world.cartography?.background||(world.cartography?.plate==='reference'?REFERENCE_ART:null);
  this.dialog.innerHTML=`<div class="generator-head"><div><span class="eyebrow">MAP MAKER</span><h2 id="map-generator-title">지도 자동 제작</h2><p>지도 그림의 육지를 확인하고 원하는 개수의 영토로 나누세요.</p></div><button type="button" data-generate="close" class="button outline" aria-label="지도 자동 제작 닫기">닫기</button></div>
  <div class="generator-layout"><aside class="generator-settings"><label class="generator-file button primary">① 지도 파일 넣기<input type="file" id="generator-file" accept="image/png,image/jpeg,image/webp"></label><button type="button" data-generate="current" class="button outline" ${current?'':'disabled'}>현재 지도 그림 사용</button>
  <label>② 만들 영토 수<input id="generator-count" type="number" min="1" max="480" value="80"></label><label>섬 처리<select id="generator-islands"><option value="8">작은 섬 제외</option><option value="0">모든 섬 포함</option><option value="-1">가장 큰 대륙만</option></select></label>
  <div class="generator-correction"><b>육지·바다 보정</b><div class="generator-brush-buttons"><button type="button" data-generate="land" class="button outline active">육지 붓</button><button type="button" data-generate="sea" class="button outline">바다 지우개</button><button type="button" data-generate="pick" class="button outline">바다색 찍기</button></div><label>붓 크기<input id="generator-brush" type="range" min="12" max="120" value="36"></label><label>바다 구분 범위<input id="generator-tolerance" type="range" min="8" max="75" value="30"></label><small>바다색·구분 범위를 바꾸면 붓 보정이 초기화됩니다.</small><div><button type="button" data-generate="undo" class="button subtle" disabled>붓 되돌리기</button><button type="button" data-generate="recognize" class="button subtle">처음 인식으로</button></div></div>
  <button type="button" data-generate="generate" class="button primary" disabled>③ 영토 자동 분할</button><button type="button" data-generate="apply" class="button outline" disabled>④ 이 지도로 적용</button><p class="generator-apply-note">적용하면 기존 영토가 교체됩니다. 국가·인물·규칙은 유지하며 새 영토는 무주지로 만듭니다. 적용 후 소유국을 칠하고 새 실행을 시작하세요. 편집 되돌리기로 복원할 수 있습니다.</p></aside>
  <div class="generator-workspace"><div class="generator-preview"><canvas id="generator-canvas" width="1200" height="800" aria-label="지도 육지 보정과 자동 영토 미리보기"></canvas><span class="generator-empty">지도 파일을 넣거나 현재 지도 그림을 선택하세요.</span><svg class="generator-boundaries" viewBox="0 0 1200 800" aria-hidden="true"></svg></div><p class="generator-legend"><i></i> 초록: 생성할 육지 · 바다에는 영토를 만들지 않습니다. 그림 위를 끌어 보정하세요.</p><p id="generator-status" role="status">아직 기존 세계에는 변경이 없습니다.</p></div></div>`;
  this.currentSource=current;this.dialog.showModal();
 }
 status(message,error=false){const el=this.dialog.querySelector('#generator-status');el.textContent=message;el.classList.toggle('error',error);}
 invalidate(){this.state.result=null;this.dialog.querySelector('[data-generate="apply"]').disabled=true;this.dialog.querySelector('.generator-boundaries').innerHTML='';}
 async load(source){
  const token=++this.session;this.setBusy(true);try{this.status('지도 그림을 읽고 있습니다.');const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('지도 그림을 읽을 수 없습니다.'));image.src=source;});if(token!==this.session||!this.dialog.open)return;
  const {canvas,data}=prepareMapImage(image,source);
  const small=document.createElement('canvas');small.width=GENERATOR_WIDTH;small.height=GENERATOR_HEIGHT;const sx=small.getContext('2d',{willReadFrequently:true});sx.drawImage(canvas,0,0,small.width,small.height);this.state.source=data;this.state.image=canvas;this.state.rgba=sx.getImageData(0,0,small.width,small.height).data;this.state.sea=guessSeaColor(this.state.rgba,small.width,small.height);this.recognize();
  this.dialog.querySelector('.generator-empty').hidden=true;this.dialog.querySelector('[data-generate="generate"]').disabled=false;
  }finally{if(token===this.session)this.setBusy(false);}
 }
 setBusy(busy){this.state.busy=busy;this.dialog.toggleAttribute('aria-busy',busy);if(busy)this.dialog.setAttribute('aria-busy','true');this.dialog.querySelectorAll('.generator-settings button,.generator-settings input,.generator-settings select').forEach(el=>el.disabled=busy);if(!busy){this.dialog.querySelector('[data-generate="current"]').disabled=!this.currentSource;this.dialog.querySelector('[data-generate="generate"]').disabled=!this.state.mask;this.dialog.querySelector('[data-generate="apply"]').disabled=!this.state.result;this.dialog.querySelector('[data-generate="undo"]').disabled=!this.state.history.length;}}
 recognize(){if(!this.state.rgba)return;this.invalidate();this.state.mask=recognizeLand(this.state.rgba,GENERATOR_WIDTH,GENERATOR_HEIGHT,this.state.sea,this.state.tolerance);this.state.history=[];this.draw();}
 draw(){
  const state=this.state;if(!state.mask)return;const prepared=prepareLand(state.mask,GENERATOR_WIDTH,GENERATOR_HEIGHT,state.minimum),canvas=this.dialog.querySelector('#generator-canvas'),ctx=canvas.getContext('2d');ctx.clearRect(0,0,1200,800);ctx.drawImage(state.image,0,0,1200,800);
  if(!state.result){const small=document.createElement('canvas');small.width=GENERATOR_WIDTH;small.height=GENERATOR_HEIGHT;const paint=small.getContext('2d'),data=paint.createImageData(small.width,small.height);for(let i=0;i<prepared.mask.length;i++)if(prepared.mask[i]){data.data[i*4]=80;data.data[i*4+1]=225;data.data[i*4+2]=145;data.data[i*4+3]=110;}paint.putImageData(data,0,0);ctx.imageSmoothingEnabled=false;ctx.drawImage(small,0,0,1200,800);ctx.imageSmoothingEnabled=true;}
  this.dialog.querySelector('[data-generate="undo"]').disabled=!state.history.length;
  if(!state.result)this.status(`육지 ${prepared.components.length}개 덩어리${prepared.excluded?` · 작은 섬 ${prepared.excluded}개 제외`:''}. 바다가 초록색이면 지우개나 바다색 찍기로 보정하세요.`);
 }
 async generate(){
  if(!this.state.mask||this.state.busy)return;const count=Number(this.dialog.querySelector('#generator-count').value);if(!Number.isInteger(count)||count<1||count>480)throw new Error('영토 수는 1~480개로 입력해 주세요.');
  const token=this.session;this.setBusy(true);this.status('육지를 나누고 경계와 인접 관계를 확인하고 있습니다…');
  try{await new Promise(resolve=>setTimeout(resolve,30));if(token!==this.session||!this.dialog.open)return;
   const partition=partitionLand(this.state.mask,GENERATOR_WIDTH,GENERATOR_HEIGHT,count,{islandMinimum:this.state.minimum}),shapes=vectorizePartition(partition);const next=generatedWorld(this.getWorld(),shapes,partition.links,this.state.source);
   this.state.result={shapes,links:partition.links,world:next};this.draw();this.dialog.querySelector('.generator-boundaries').innerHTML=shapes.map((s,i)=>`<path d="${polygonPath(s.points,s.holes)}" fill-rule="evenodd" style="--region-hue:${i*137.508%360}"/>`).join('');this.dialog.querySelector('[data-generate="apply"]').disabled=false;
   this.status(`${shapes.length}개 영토 · 인접 연결 ${partition.links.length}개를 만들었습니다. 미리보기를 확인한 뒤 적용하세요.`);
  }finally{if(token===this.session){this.setBusy(false);}}
 }
 async click(event){const action=event.target.closest('[data-generate]')?.dataset.generate;if(!action)return;try{
  if(action==='close'){this.dialog.close();return;}if(this.state.busy)return;
  if(action==='current')await this.load(this.currentSource);
  else if(['land','sea','pick'].includes(action)){this.state.mode=action;this.dialog.querySelectorAll('.generator-brush-buttons button').forEach(b=>b.classList.toggle('active',b.dataset.generate===action));this.status(action==='pick'?'지도에서 바다인 부분을 한 번 클릭하세요.':action==='land'?'그림 위를 끌어 육지를 더하세요.':'그림 위를 끌어 바다 영역을 지우세요.');}
  else if(action==='recognize')this.recognize();
  else if(action==='undo'){const mask=this.state.history.pop();if(mask){this.state.mask=mask;this.invalidate();this.draw();}}
  else if(action==='generate')await this.generate();
  else if(action==='apply'&&this.state.result){if(this.getWorld().id!==this.state.worldId)throw new Error('세계가 바뀌었습니다. 현재 세계에서 다시 제작해 주세요.');const next=generatedWorld(this.getWorld(),this.state.result.shapes,this.state.result.links,this.state.source);this.apply(next);this.dialog.close();this.notify('자동 제작 지도를 적용했습니다. 소유국을 칠한 뒤 새 실행을 시작하세요.');}
 }catch(error){this.status(error.message,true);}}
 async change(event){const target=event.target;try{
  if(target.id==='generator-file'){const file=target.files?.[0];target.value='';if(!file)return;if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>32*1024*1024)throw new Error('32MB 이하의 PNG·JPEG·WebP 파일을 선택해 주세요.');const url=URL.createObjectURL(file);try{await this.load(url);}finally{URL.revokeObjectURL(url);}}
  else if(target.id==='generator-islands'){this.state.minimum=Number(target.value);this.invalidate();this.draw();}
  else if(target.id==='generator-tolerance'){this.state.tolerance=Number(target.value);this.recognize();}
  else if(target.id==='generator-brush')this.state.brush=Number(target.value);
  else if(target.id==='generator-count')this.invalidate();
 }catch(error){this.status(error.message,true);}}
 point(event){const box=this.dialog.querySelector('#generator-canvas').getBoundingClientRect();return [Math.max(0,Math.min(GENERATOR_WIDTH-1,(event.clientX-box.x)/box.width*GENERATOR_WIDTH)),Math.max(0,Math.min(GENERATOR_HEIGHT-1,(event.clientY-box.y)/box.height*GENERATOR_HEIGHT))];}
 down(event){if(event.target.id!=='generator-canvas'||!this.state.mask||this.state.busy)return;event.preventDefault();const p=this.point(event);if(this.state.mode==='pick'){const i=(Math.floor(p[1])*GENERATOR_WIDTH+Math.floor(p[0]))*4;this.state.sea=[...this.state.rgba.slice(i,i+3)];this.recognize();return;}
  this.invalidate();this.state.history.push(this.state.mask.slice());if(this.state.history.length>15)this.state.history.shift();this.painting=true;this.last=p;event.target.setPointerCapture(event.pointerId);this.paint(p);}
 paint(p,draw=true){const radius=this.state.brush/1200*GENERATOR_WIDTH/2;for(let y=Math.max(0,Math.floor(p[1]-radius));y<=Math.min(GENERATOR_HEIGHT-1,Math.ceil(p[1]+radius));y++)for(let x=Math.max(0,Math.floor(p[0]-radius));x<=Math.min(GENERATOR_WIDTH-1,Math.ceil(p[0]+radius));x++)if(Math.hypot(x+.5-p[0],y+.5-p[1])<=radius)this.state.mask[y*GENERATOR_WIDTH+x]=this.state.mode==='land'?1:0;if(draw)this.draw();}
 move(event){if(!this.painting)return;const p=this.point(event),last=this.last,steps=Math.max(1,Math.ceil(Math.hypot(p[0]-last[0],p[1]-last[1])));for(let i=1;i<=steps;i++)this.paint([last[0]+(p[0]-last[0])*i/steps,last[1]+(p[1]-last[1])*i/steps],false);this.last=p;this.draw();}
 up(){this.painting=false;}
}
