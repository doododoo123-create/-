// Camera math uses screen pixels; no world, ownership, or troop position changes.
export function filmSafeTarget(view,box,viewport,point,{bottom=360,cardWidth=84}={}){
 const sx=viewport.width/box[2],sy=viewport.height/box[3],x=(point[0]-box[0])*sx,y=(point[1]-box[1])*sy;
 const left=Math.min(viewport.width*.3,cardWidth+50),right=Math.max(left+40,viewport.width-left),top=Math.min(180,viewport.height*.24),floor=Math.max(top+50,viewport.height-bottom);
 let dx=x<left?x-left-24:x>right?x-right+24:0,dy=y<top?y-top-24:y>floor?y-floor+24:0;
 if(Math.abs(dx)<1)dx=0;if(Math.abs(dy)<1)dy=0;
 return {needed:!!(dx||dy),from:{...view},to:{...view,x:view.x+dx/sx,y:view.y+dy/sy},safe:{left,right,top,bottom:floor}};
}
export function filmCameraAt(plan,progress){const t=Math.max(0,Math.min(1,progress)),ease=t*t*(3-2*t);return {x:plan.from.x+(plan.to.x-plan.from.x)*ease,y:plan.from.y+(plan.to.y-plan.from.y)*ease};}
export function fitFilmClusters(element){
 const svg=element.querySelector('.atlas-map');if(!svg)return;
 const cards=[...svg.querySelectorAll('.map-unit-position[data-person]')];
 for(const card of cards){card.removeAttribute('data-film-cluster-hidden');card.querySelector('.film-map-cluster')?.remove();}
 const shown=[];
 cards.sort((a,b)=>(Number(!!b.dataset.combatSide)*100+(b.dataset.role==='king'?10:0))-(Number(!!a.dataset.combatSide)*100+(a.dataset.role==='king'?10:0)));
 for(const card of cards){
  const token=card.querySelector('.map-unit-token'),rect=token?.getBoundingClientRect();if(!rect?.width||!rect?.height)continue;
  const other=shown.find(v=>rect.left<v.rect.right-3&&rect.right>v.rect.left+3&&rect.top<v.rect.bottom-3&&rect.bottom>v.rect.top+3);
  if(other&&!card.dataset.combatSide){card.dataset.filmClusterHidden='true';other.count++;}
  else shown.push({card,rect,count:0});
 }
 for(const {card,count} of shown)if(count){const label=document.createElementNS('http://www.w3.org/2000/svg','text');label.setAttribute('class','film-map-cluster');label.setAttribute('text-anchor','middle');label.setAttribute('x','0');label.setAttribute('y',card.dataset.combatSide?'-68':'-42');label.textContent=card.dataset.combatSide?'주변 '+count+'명':'+'+count;card.querySelector('.unit-display-scale')?.append(label);}
}
