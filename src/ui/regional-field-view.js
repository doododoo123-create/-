const fieldViews=new WeakMap();
export function regionalFieldView(plan){if(!fieldViews.has(plan))fieldViews.set(plan,{zoom:1,x:plan.width/2,y:plan.height/2});return fieldViews.get(plan);}
export function bindRegionalField(root,canvas,plan,redraw){
 const view=regionalFieldView(plan),fit=()=>Math.min(canvas.clientWidth/plan.width,canvas.clientHeight/plan.height),clamp=()=>{view.x=Math.max(0,Math.min(plan.width,view.x));view.y=Math.max(0,Math.min(plan.height,view.y));};
 const focus=id=>{const node=plan.field.byId.get(id);if(!node)return;Object.assign(view,{zoom:Math.min(5,Math.max(1,Math.min(plan.width/node.width,plan.height/node.height)*.85)),x:node.x+node.width/2,y:node.y+node.height/2});redraw();};
 for(const button of root.querySelectorAll('[data-mass-region]'))button.onclick=()=>focus(button.dataset.massRegion);
 for(const button of root.querySelectorAll('[data-board-mode]'))button.onclick=()=>{if(button.dataset.boardMode==='all')Object.assign(view,{zoom:1,x:plan.width/2,y:plan.height/2});else view.zoom=Math.max(1,Math.min(5,view.zoom*(button.dataset.boardMode==='in'?1.35:1/1.35)));if(view.zoom===1)Object.assign(view,{x:plan.width/2,y:plan.height/2});redraw();};
 canvas.onwheel=e=>{e.preventDefault();e.stopPropagation();const box=canvas.getBoundingClientRect(),scale=fit()*view.zoom,dx=e.clientX-box.left-box.width/2,dy=e.clientY-box.top-box.height/2,anchor={x:view.x+dx/scale,y:view.y+dy/scale};view.zoom=Math.max(1,Math.min(5,view.zoom*Math.exp(-Math.max(-100,Math.min(100,e.deltaY))*.004)));view.x=anchor.x-dx/(fit()*view.zoom);view.y=anchor.y-dy/(fit()*view.zoom);if(view.zoom===1)Object.assign(view,{x:plan.width/2,y:plan.height/2});clamp();redraw();};
 let drag=null,moved=false;
 canvas.onpointerdown=e=>{if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,center:{x:view.x,y:view.y}};moved=false;canvas.setPointerCapture(e.pointerId);};
 canvas.onpointermove=e=>{if(!drag||drag.id!==e.pointerId||view.zoom===1)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;moved||=Math.hypot(dx,dy)>4;view.x=drag.center.x-dx/(fit()*view.zoom);view.y=drag.center.y-dy/(fit()*view.zoom);clamp();redraw();};
 canvas.onpointerup=e=>{if(!drag||drag.id!==e.pointerId)return;drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);};canvas.onpointercancel=()=>{drag=null;};
 canvas.onclick=e=>{if(moved)return;const box=canvas.getBoundingClientRect(),scale=fit()*view.zoom,x=view.x+(e.clientX-box.left-box.width/2)/scale,y=view.y+(e.clientY-box.top-box.height/2)/scale;const node=plan.field.nodes.filter(n=>x>=n.label.x&&x<=n.label.x+n.label.w&&y>=n.label.y&&y<=n.label.y+n.label.h||Math.hypot(x-n.cx,y-n.cy)<55).sort((a,b)=>Math.hypot(x-a.cx,y-a.cy)-Math.hypot(x-b.cx,y-b.cy))[0];if(node)focus(node.id);};
}
function regionalPolygonPath(ctx,poly){
 ctx.beginPath();for(const ring of [poly.points,...(poly.holes||[])]){ring.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.closePath();}
}
export function drawRegionalField(ctx,p,state){
 const f=p.field;ctx.save();ctx.fillStyle='#234752';ctx.fillRect(0,0,p.width,p.height);
 for(const poly of f.polygons){const color=f.countries.find(c=>c.id===(state.owners.get(poly.id)??poly.ownerId))?.color||'#aaa585';regionalPolygonPath(ctx,poly);ctx.fillStyle='#b4ad83';ctx.fill('evenodd');ctx.globalAlpha=.17;ctx.fillStyle=color;ctx.fill('evenodd');ctx.globalAlpha=1;}
 // Only existing terrain metadata is marked; no invented rivers or roads.
 for(const poly of f.polygons.filter(p=>p.terrain==='mountain')){const a=poly.points.reduce((v,p)=>({x:v.x+p.x/poly.points.length,y:v.y+p.y/poly.points.length}),{x:0,y:0});if(f.nodes.some(n=>Math.hypot(n.cx-a.x,n.cy-a.y)<140))continue;ctx.strokeStyle='#4a584144';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(a.x-14,a.y+9);ctx.lineTo(a.x,a.y-12);ctx.lineTo(a.x+14,a.y+9);ctx.stroke();}
 for(const u of state.units){const o=u.orders.find(o=>state.base>=o.start&&state.base<o.end);if(!o||!u.visible||o.teleport||o.fromRegion===o.toRegion||!['walk','retreat'].includes(o.kind))continue;ctx.strokeStyle=u.color;ctx.globalAlpha=.5;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(o.from.x,o.from.y);for(const q of o.path?.slice(1)||[o.to])ctx.lineTo(q.x,q.y);ctx.stroke();ctx.globalAlpha=1;}
 for(const n of f.nodes){const active=state.region?.territoryId===n.id,country=f.countries.find(c=>c.id===state.owners.get(n.id)),color=country?.color||'#d0c6a1';
  ctx.strokeStyle='#172822';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(n.cx,n.cy-26);ctx.lineTo(n.cx,n.cy+8);ctx.stroke();ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(n.cx,n.cy-26);ctx.lineTo(n.cx+25,n.cy-17);ctx.lineTo(n.cx,n.cy-8);ctx.closePath();ctx.fill();ctx.fillStyle=active?'#ffe18d':'#e8dcc0';ctx.beginPath();ctx.arc(n.cx,n.cy+8,active?7:4,0,Math.PI*2);ctx.fill();
  const b=n.label;ctx.fillStyle='#10252bdd';ctx.fillRect(b.x,b.y,b.w,b.h);ctx.font='bold 29px serif';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#14272b';ctx.fillStyle=active?'#ffe19c':'#f4ead1';ctx.strokeText(n.name,b.x+b.w/2,b.y+30,b.w-12);ctx.fillText(n.name,b.x+b.w/2,b.y+30,b.w-12);
  if(active){ctx.fillStyle='#f5ce70';ctx.font='22px sans-serif';ctx.fillText(state.region.automatic?'⚑ 진입':state.base<state.region.contact?'접근':state.base>=state.region.start+state.region.duration*.86?state.region.outcome:'⚔ 교전',b.x+b.w/2,b.y-7);}
 }
 ctx.restore();
}
export function drawRegionalOverview(canvas,p,state,view,viewport){
 if(!canvas)return;canvas.hidden=view.zoom===1;if(canvas.hidden)return;
 canvas.width=280;canvas.height=180;const ctx=canvas.getContext('2d'),scale=Math.min(270/p.width,170/p.height),ox=(280-p.width*scale)/2,oy=(180-p.height*scale)/2;
 ctx.fillStyle='#234752';ctx.fillRect(0,0,280,180);ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);
 for(const poly of p.field.polygons){ctx.fillStyle='#819786';regionalPolygonPath(ctx,poly);ctx.fill('evenodd');}
 for(const n of p.field.nodes){ctx.fillStyle=n.id===state.region?.territoryId?'#ffdf83':'#fff';ctx.beginPath();ctx.arc(n.cx,n.cy,9,0,Math.PI*2);ctx.fill();}
 for(const u of state.units.filter(u=>u.visible&&u.alive)){ctx.fillStyle=u.color;ctx.beginPath();ctx.arc(u.x,u.y,8,0,Math.PI*2);ctx.fill();}
 const fit=Math.min(viewport.width/p.width,viewport.height/p.height)*view.zoom;
 ctx.strokeStyle='#fff';ctx.lineWidth=2/scale;ctx.strokeRect(view.x-viewport.width/(2*fit),view.y-viewport.height/(2*fit),viewport.width/fit,viewport.height/fit);ctx.restore();
}
