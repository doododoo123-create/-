// Bounded connected growth for larger districts. Original four-cell enumeration stays intact.
export function assignScaledRegions(state,atlas,id,slots,limit){
 const own=state.cells.filter(c=>c.owner===id),byId=new Map(own.map(c=>[c.id,c]));if(!own.length)return;
 const adjacent=new Map(own.map(c=>[c.id,atlas.cells[c.id].neighbors.filter(n=>byId.has(n))]));
 const parts=ids=>{const left=new Set(ids),out=[];while(left.size){const first=left.values().next().value,part=[first];left.delete(first);for(let k=0;k<part.length;k++)for(const n of adjacent.get(part[k]))if(left.delete(n))part.push(n);out.push(part);}return out;};
 const old=slots.map(k=>own.filter(c=>c.commander===k).map(c=>c.id));
 if(old.every(p=>p.length&&p.length<=limit&&parts(p).length===1)&&old.flat().length===own.length)return;
 const left=new Set(own.map(c=>c.id)),patches=[];
 const score=patch=>{const occupied=new Set(patch),rest=parts([...left].filter(n=>!occupied.has(n))),p=patch.map(n=>atlas.cells[n].center),box=(Math.max(...p.map(v=>v[0]))-Math.min(...p.map(v=>v[0])))*(Math.max(...p.map(v=>v[1]))-Math.min(...p.map(v=>v[1])))/10000;return rest.reduce((n,part)=>n+Math.ceil(part.length/limit),0)*10000+rest.length*100+patch.reduce((n,id)=>n+adjacent.get(id).filter(k=>left.has(k)&&!occupied.has(k)).length,0)*3+box;};
 while(left.size){
  const component=parts([...left]).sort((a,b)=>a.length-b.length||a[0]-b[0])[0],available=new Set(component),wanted=Math.min(limit,component.length);
  const seeds=[...component].sort((a,b)=>adjacent.get(a).filter(n=>left.has(n)).length-adjacent.get(b).filter(n=>left.has(n)).length||a-b).slice(0,16);
  let best=null,bestScore=Infinity;
  for(const seed of seeds){const patch=[seed];while(patch.length<wanted){const candidates=[...new Set(patch.flatMap(n=>adjacent.get(n)).filter(n=>available.has(n)&&!patch.includes(n)))];if(!candidates.length)break;candidates.sort((a,b)=>score([...patch,a])-score([...patch,b])||a-b);patch.push(candidates[0]);}const value=score(patch);if(value<bestScore){bestScore=value;best=patch;}}
  patches.push(best);best.forEach(n=>left.delete(n));
 }
 const distance=(a,b)=>Math.min(...a.flatMap(x=>b.map(y=>Math.hypot(atlas.cells[x].center[0]-atlas.cells[y].center[0],atlas.cells[x].center[1]-atlas.cells[y].center[1]))));
 while(patches.length>slots.length){let best=null,d=Infinity;for(let a=0;a<patches.length;a++)for(let b=a+1;b<patches.length;b++)if(patches[a].length+patches[b].length<=limit){const value=distance(patches[a],patches[b]);if(value<d){best=[a,b];d=value;}}if(!best)break;patches[best[0]].push(...patches[best[1]]);patches.splice(best[1],1);}
 if(patches.length>slots.length){patches.sort((a,b)=>b.length-a.length||a[0]-b[0]);const extra=patches.splice(slots.length).flat();for(const id of extra){const eligible=patches.filter(p=>p.length<limit).sort((a,b)=>distance(a,[id])-distance(b,[id]));eligible[0].push(id);}}
 const remaining=new Set(patches.map((_,i)=>i)),free=new Set(slots);
 while(remaining.size){let selected=null,overlap=-1;for(const p of remaining)for(const slot of free){const value=patches[p].filter(n=>byId.get(n).commander===slot).length;if(value>overlap){overlap=value;selected=[p,slot];}}const [p,slot]=selected;patches[p].forEach(n=>byId.get(n).commander=slot);remaining.delete(p);free.delete(slot);}
}
