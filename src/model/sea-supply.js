import { geometryFor, cellPoints } from './cartography-geometry.js';
// Physical water is derived from territory geometry, never from ownership or attack links.
// Scan-line filling keeps large generated maps inexpensive and respects inland holes.
export function seaSupplyPorts(world, width=600, height=400){
  const cells=geometryFor(world).cells,land=new Int32Array(width*height).fill(-1),sx=width/1200,sy=height/800;
  cells.forEach((cell,id)=>{
    const rings=[cellPoints(cell),...(cell.holes||[])].map(r=>r.map(([x,y])=>[x*sx,y*sy]));
    const outer=rings[0],lo=Math.max(0,Math.ceil(Math.min(...outer.map(p=>p[1]))-.5)),hi=Math.min(height-1,Math.floor(Math.max(...outer.map(p=>p[1]))-.5));
    for(let y=lo;y<=hi;y++){
      const cuts=[],line=y+.5;for(const ring of rings)for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];if((a[1]>line)!==(b[1]>line))cuts.push(a[0]+(line-a[1])*(b[0]-a[0])/(b[1]-a[1]));}
      cuts.sort((a,b)=>a-b);for(let k=0;k+1<cuts.length;k+=2){const start=Math.max(0,Math.ceil(cuts[k]-.5)),end=Math.min(width-1,Math.floor(cuts[k+1]-.5));for(let x=start;x<=end;x++)land[y*width+x]=id;}
    }
  });
  const water=new Int32Array(land.length).fill(-1),queue=new Int32Array(land.length),open=[],ports=cells.map(()=>new Set());let body=0;
  const visitNeighbors=(i,fn)=>{if(i%width)fn(i-1);if(i%width<width-1)fn(i+1);if(i>=width)fn(i-width);if(i<land.length-width)fn(i+width);};
  for(let first=0;first<land.length;first++){
    if(land[first]>=0||water[first]>=0)continue;let head=0,tail=1,exterior=false;queue[0]=first;water[first]=body;
    while(head<tail){const i=queue[head++];if(i<width||i>=land.length-width||i%width===0||i%width===width-1)exterior=true;visitNeighbors(i,n=>{if(land[n]<0&&water[n]<0){water[n]=body;queue[tail++]=n;}});}
    open[body++]=exterior;
  }
  for(let i=0;i<land.length;i++)if(land[i]>=0)visitNeighbors(i,n=>{const b=water[n];if(b>=0&&open[b])ports[land[i]].add(b);});
  return ports.map(p=>[...p].sort((a,b)=>a-b));
}
