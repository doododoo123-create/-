// Image analysis and connected raster partitioning. No simulation random stream.
export const GENERATOR_WIDTH=180,GENERATOR_HEIGHT=120;
function imageHsv(r,g,b){const hi=Math.max(r,g,b),lo=Math.min(r,g,b),d=hi-lo;let h=!d?0:hi===r?60*((g-b)/d%6):hi===g?60*((b-r)/d+2):60*((r-g)/d+4);if(h<0)h+=360;return [h,hi?d/hi:0,hi];}
export function guessSeaColor(rgba,width,height){
 const bins=new Map();for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(x<3||y<3||x>=width-3||y>=height-3){const i=(y*width+x)*4,c=[rgba[i],rgba[i+1],rgba[i+2]],key=c.map(v=>Math.floor(v/24)).join(',');const bin=bins.get(key)||{sum:[0,0,0],n:0};bin.n++;c.forEach((v,k)=>bin.sum[k]+=v);bins.set(key,bin);}
 const best=[...bins.values()].sort((a,b)=>b.n-a.n)[0];return best?best.sum.map(v=>Math.round(v/best.n)):[16,62,72];
}
export function recognizeLand(rgba,width,height,seaColor,tolerance=30){
 if(rgba.length!==width*height*4)throw new Error('지도 픽셀 크기가 올바르지 않습니다.');
 const sea=imageHsv(...seaColor),raw=new Uint8Array(width*height);
 for(let i=0;i<raw.length;i++){const c=[rgba[i*4],rgba[i*4+1],rgba[i*4+2]],hsv=imageHsv(...c),diff=Math.abs(hsv[0]-sea[0]),distance=Math.hypot(...c.map((v,k)=>v-seaColor[k]));const water=distance<15||(sea[1]<.12?distance<tolerance*2:Math.min(diff,360-diff)<=tolerance&&hsv[1]>=Math.max(.1,sea[1]*.25));raw[i]=water?0:1;}
 const smooth=raw.slice();for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){let sum=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)sum+=raw[(y+dy)*width+x+dx];if(sum>=7)smooth[y*width+x]=1;else if(sum<=2)smooth[y*width+x]=0;}
 return smooth;
}
export function maskComponents(mask,width,height){
 const seen=new Uint8Array(mask.length),components=[];
 for(let i=0;i<mask.length;i++)if(mask[i]&&!seen[i]){const cells=[i];seen[i]=1;for(let j=0;j<cells.length;j++){const at=cells[j],x=at%width,y=Math.floor(at/width);for(const n of [x?at-1:-1,x<width-1?at+1:-1,y?at-width:-1,y<height-1?at+width:-1])if(n>=0&&mask[n]&&!seen[n]){seen[n]=1;cells.push(n);}}components.push(cells);}
 return components.sort((a,b)=>b.length-a.length||a[0]-b[0]);
}
export function prepareLand(mask,width,height,islandMinimum=8){
 if(mask.length!==width*height)throw new Error('육지 영역 크기가 올바르지 않습니다.');
 const components=maskComponents(mask,width,height),kept=islandMinimum===-1?components.slice(0,1):components.filter(c=>c.length>=Math.max(1,islandMinimum)),clean=new Uint8Array(mask.length);for(const c of kept)for(const i of c)clean[i]=1;
 return {mask:clean,components:kept,excluded:components.length-kept.length};
}
function gridNeighbors(at,width,height){const x=at%width,y=Math.floor(at/width);return [x?at-1:-1,x<width-1?at+1:-1,y?at-width:-1,y<height-1?at+width:-1].filter(n=>n>=0);}
export function partitionLand(mask,width,height,count,{islandMinimum=8}={}){
 if(!Number.isInteger(count)||count<1||count>480)throw new Error('영토 수는 1~480개로 입력해 주세요.');
 const prepared=prepareLand(mask,width,height,islandMinimum),components=prepared.components,total=components.reduce((n,c)=>n+c.length,0);
 if(!total)throw new Error('인식된 육지가 없습니다. 바다색을 다시 선택하거나 육지 붓으로 영역을 그려 주세요.');
 if(components.length>count)throw new Error(`육지가 ${components.length}개로 떨어져 있습니다. 영토 수를 늘리거나 섬 처리에서 ‘가장 큰 대륙만’을 선택해 주세요.`);
 if(total<count)throw new Error(`육지 면적에 비해 영토 수가 많습니다. ${total}개 이하로 줄이거나 육지를 넓혀 주세요.`);
 const quotas=components.map(()=>1);for(let n=components.length;n<count;n++){let best=-1,score=-1;components.forEach((c,i)=>{const s=c.length/quotas[i];if(quotas[i]<c.length&&s>score){best=i;score=s;}});quotas[best]++;}
 const seeds=[],dist=new Int32Array(mask.length);dist.fill(2147483647);
 components.forEach((cells,k)=>{
  let sx=0,sy=0;for(const i of cells){sx+=i%width;sy+=Math.floor(i/width);}sx/=cells.length;sy/=cells.length;
  let first=cells[0],best=Infinity;for(const i of cells){const d=(i%width-sx)**2+(Math.floor(i/width)-sy)**2;if(d<best){best=d;first=i;}}
  let seed=first;
  for(let n=0;n<quotas[k];n++){
   seeds.push(seed);dist[seed]=0;const queue=[seed];for(let j=0;j<queue.length;j++){const at=queue[j];for(const next of gridNeighbors(at,width,height))if(prepared.mask[next]&&dist[next]>dist[at]+1){dist[next]=dist[at]+1;queue.push(next);}}
   let far=-1;for(const i of cells)if(dist[i]>far){far=dist[i];seed=i;}
  }
 });
 const assign=starts=>{const labels=new Int32Array(mask.length);labels.fill(-1);const queue=[...starts];starts.forEach((s,i)=>labels[s]=i);for(let j=0;j<queue.length;j++){const at=queue[j];for(const next of gridNeighbors(at,width,height))if(prepared.mask[next]&&labels[next]===-1){labels[next]=labels[at];queue.push(next);}}return labels;};
 let labels=assign(seeds);
 // Recenter once while retaining one distinct seed per connected region.
 const sums=seeds.map(()=>[0,0,0]);labels.forEach((id,i)=>{if(id>=0){sums[id][0]+=i%width;sums[id][1]+=Math.floor(i/width);sums[id][2]++;}});
 const nearest=seeds.slice(),costs=seeds.map(()=>Infinity);labels.forEach((id,i)=>{if(id<0)return;const s=sums[id],d=(i%width-s[0]/s[2])**2+(Math.floor(i/width)-s[1]/s[2])**2;if(d<costs[id]){costs[id]=d;nearest[id]=i;}});labels=assign(nearest);
 const links=new Set();for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x,a=labels[i];if(a<0)continue;for(const j of [x<width-1?i+1:-1,y<height-1?i+width:-1])if(j>=0&&labels[j]>=0&&labels[j]!==a)links.add([a,labels[j]].sort((a,b)=>a-b).join(':'));}
 return {labels,width,height,count,mask:prepared.mask,excluded:prepared.excluded,components:components.length,seeds:nearest,links:[...links].map(k=>k.split(':').map(Number))};
}
function splitTouchingRing(points){const seen=new Map();for(let i=0;i<points.length;i++){const key=points[i].join(',');if(seen.has(key)){const j=seen.get(key);return [...splitTouchingRing(points.slice(j,i)),...splitTouchingRing([...points.slice(0,j),...points.slice(i)])];}seen.set(key,i);}return points.length>=3?[points]:[];}

export function vectorizePartition(partition){
 const {labels,width,height,count,seeds}=partition,groups=Array.from({length:count},()=>[]),step=width+1;
 const add=(id,x,y,xx,yy,dir)=>groups[id].push({from:y*step+x,to:yy*step+xx,dir});
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x,id=labels[i];if(id<0)continue;if(y===0||labels[i-width]!==id)add(id,x,y,x+1,y,0);if(x===width-1||labels[i+1]!==id)add(id,x+1,y,x+1,y+1,1);if(y===height-1||labels[i+width]!==id)add(id,x+1,y+1,x,y+1,2);if(x===0||labels[i-1]!==id)add(id,x,y+1,x,y,3);}
 const vertexNeighbors=new Map();for(const edges of groups)for(const e of edges){if(!vertexNeighbors.has(e.from))vertexNeighbors.set(e.from,new Set());if(!vertexNeighbors.has(e.to))vertexNeighbors.set(e.to,new Set());vertexNeighbors.get(e.from).add(e.to);vertexNeighbors.get(e.to).add(e.from);}
 const smoothVertex=p=>{const list=[...(vertexNeighbors.get(p[1]*step+p[0])||[])];if(list.length!==2)return p;return [p[0]*.5+(list[0]%step+list[1]%step)*.25,p[1]*.5+(Math.floor(list[0]/step)+Math.floor(list[1]/step))*.25];};
 const scale=p=>[Math.round(p[0]*1200/width*1000)/1000,Math.round(p[1]*800/height*1000)/1000];
 return groups.map((edges,id)=>{
  const starts=new Map();edges.forEach((e,i)=>{const list=starts.get(e.from)||[];list.push(i);starts.set(e.from,list);});const used=new Uint8Array(edges.length),rings=[];
  for(let i=0;i<edges.length;i++){if(used[i])continue;let edgeIndex=i;const first=edges[i].from,points=[];for(let n=0;n<=edges.length;n++){const edge=edges[edgeIndex];used[edgeIndex]=1;points.push([edge.from%step,Math.floor(edge.from/step)]);if(edge.to===first)break;const options=(starts.get(edge.to)||[]).filter(j=>!used[j]);if(!options.length)throw new Error('경계를 닫을 수 없습니다. 육지·바다 보정을 확인해 주세요.');const rank=dir=>[1,0,3,2].indexOf((dir-edge.dir+4)%4);options.sort((a,b)=>rank(edges[a].dir)-rank(edges[b].dir));edgeIndex=options[0];}
   for(const part of splitTouchingRing(points)){if(part.length>=3)rings.push(part);}
  }
  const area=ring=>ring.reduce((n,p,i)=>{const q=ring[(i+1)%ring.length];return n+p[0]*q[1]-q[0]*p[1];},0)/2;rings.sort((a,b)=>Math.abs(area(b))-Math.abs(area(a)));
  if(!rings.length||rings.slice(1).some(r=>area(r)>0))throw new Error('너무 좁은 연결 지점이 있습니다. 육지 붓으로 연결을 넓히거나 바다 지우개로 분리해 주세요.');
  const vertexScale=p=>scale(smoothVertex(p)),holes=rings.slice(1).map(r=>r.map(vertexScale));return {points:rings[0].map(vertexScale),center:scale([seeds[id]%width+.5,Math.floor(seeds[id]/width)+.5]),...(holes.length?{holes}:{})};
 });
}
