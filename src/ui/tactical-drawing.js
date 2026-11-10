// Light vector cues on the existing canvas; no extra sprites/DOM/physics.
const text=(ctx,value,x,y,color='#fff',size=13)=>{ctx.font=`600 ${size}px "Studio Sans",sans-serif`;ctx.lineWidth=3;ctx.strokeStyle='#15231bed';ctx.strokeText(value,x,y);ctx.fillStyle=color;ctx.fillText(value,x,y);};
export function drawTacticalGround(ctx,plan,state){
 ctx.save();ctx.globalAlpha=.12;ctx.fillStyle=plan.countries[0]?.color||'#f44';ctx.fillRect(10,45,100,plan.height-80);ctx.fillStyle=plan.countries[1]?.color||'#49f';ctx.fillRect(plan.width-110,45,100,plan.height-80);ctx.globalAlpha=1;
 text(ctx,'공격군 후방',20,28,'#d9e3d4',12);ctx.textAlign='right';text(ctx,'수비군 후방',plan.width-20,28,'#d9e3d4',12);ctx.textAlign='center';
 const current=state.currentBeat,name=current?.territoryName||'전장',mountain=current?.source?.terrain==='mountain';text(ctx,`${mountain?'▲ 산악 · ':''}목표 ${name}`,plan.width/2,28,'#fff2c9',15);
 if(mountain){ctx.strokeStyle='#3d45337a';ctx.fillStyle='#50593d22';ctx.lineWidth=2;for(let i=0;i<4;i++){const x=plan.width-130-i*25,y=130+i*105;ctx.beginPath();ctx.moveTo(x-45,y+35);ctx.lineTo(x,y-35);ctx.lineTo(x+50,y+35);ctx.closePath();ctx.fill();ctx.stroke();}}
 // The visible contact line follows the actual blocks, not a prerecorded arc.
 const points=state.contacts.map(c=>c.point).sort((a,b)=>a.y-b.y);ctx.strokeStyle='#f4dda0b0';ctx.lineWidth=4;ctx.setLineDash([6,6]);ctx.beginPath();for(let i=0;i<points.length;i++){const p=points[i];if(!i||p.y-points[i-1].y>Math.max(150,plan.story.field.cellHeight*2.6))ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}ctx.stroke();ctx.setLineDash([]);
 const recent=plan.story.reveals.filter(r=>r.kind==='territory'&&r.at<=state.base&&state.base-r.at<3600);
 for(const r of recent){const b=plan.story.beats.find(b=>b.index===r.beatIndex),p=b?.point;if(!p)continue;const color=plan.countries.find(c=>c.id===r.to)?.color||'#fff';ctx.fillStyle=color+'35';ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y,52,31,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(p.x,p.y-45);ctx.lineTo(p.x,p.y-10);ctx.stroke();ctx.fillStyle=color;ctx.fillRect(p.x,p.y-45,25,15);text(ctx,r.recapture?'재탈환':'점령',p.x,p.y-52,'#fff2b3',15);}
 ctx.textAlign='left';text(ctx,'전열 ●   측면 ◆   예비대 ▰   방어선 ▾   점선: 교전선',20,plan.height-15,'#e5e9da',11);ctx.restore();
}
export function drawTacticalPennants(ctx,state){
 ctx.save();for(const g of state.groups){if(!g.visible||!g.figures)continue;const x=g.x+g.footprint.width/2-2,y=g.y-g.footprint.height/2+5;ctx.strokeStyle='#102319';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+15);ctx.stroke();ctx.fillStyle=g.color;ctx.strokeStyle='#fff9';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+19,y);ctx.lineTo(x+16,y+12);ctx.lineTo(x,y+12);ctx.closePath();ctx.fill();ctx.stroke();ctx.textAlign='center';ctx.font='bold 10px "Studio Sans",sans-serif';ctx.lineWidth=2;ctx.strokeStyle='#15231b';ctx.strokeText(String(g.unitNumber),x+8,y+9);ctx.fillStyle='white';ctx.fillText(String(g.unitNumber),x+8,y+9);const role={front:'●',flank:'◆',reserve:'▰',guard:'▾'}[g.role]||'●';ctx.strokeText(role,x+25,y+9);ctx.fillText(role,x+25,y+9);}
 ctx.restore();
}
export function drawTacticalImpacts(ctx,state){
 ctx.save();for(const c of state.contacts){const strike=c.strikers.some(g=>g.action==='attack'&&Math.abs(g.time-340)<105);if(!strike)continue;ctx.save();ctx.translate(c.point.x,c.point.y);ctx.fillStyle='#e9d9a33b';ctx.beginPath();ctx.ellipse(0,5,19,8,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff0bf';ctx.lineWidth=2.5;for(let k=0;k<5;k++){const a=k*Math.PI*2/5;ctx.beginPath();ctx.moveTo(Math.cos(a)*4,Math.sin(a)*4);ctx.lineTo(Math.cos(a)*15,Math.sin(a)*15);ctx.stroke();}ctx.restore();}
 for(const g of state.groups)if(g.hit&&g.visible&&g.figures){ctx.strokeStyle='#ffb68c';ctx.lineWidth=2;const r=8+g.lossAge/30;ctx.globalAlpha=Math.max(0,1-g.lossAge/330);ctx.beginPath();ctx.ellipse(g.x,g.y,r,r*.35,0,0,Math.PI*2);ctx.stroke();}ctx.restore();
}
