// Optional map design, independent of the v11 rules and simulation random stream.
export const MAP_WIDTH=1200, MAP_HEIGHT=800;
export const MAX_POLYGON_POINTS=2048;
export const defaultCartography=()=>({version:1,style:'illustrated',opacity:.3,background:null,polygons:{},links:null});
export function polygonArea(points){return points.reduce((s,a,i)=>{const b=points[(i+1)%points.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2;}
export function pointInPolygon(point,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export function polygonCenter(points){
  const cross=(a,b)=>a[0]*b[1]-b[0]*a[1],area=polygonArea(points);
  const c=[0,1].map(k=>points.reduce((n,a,i)=>{const b=points[(i+1)%points.length];return n+(a[k]+b[k])*cross(a,b);},0)/(6*area));
  if(pointInPolygon(c,points))return c;
  // A point inside the widest horizontal scanline also works for concave coastal provinces.
  for(let step=1;step<20;step++){const ys=points.map(p=>p[1]),y=Math.min(...ys)+(Math.max(...ys)-Math.min(...ys))*step/20,xs=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if((a[1]>y)!==(b[1]>y))xs.push(a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]));}xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2)if(xs[i+1]-xs[i]>1)return [(xs[i]+xs[i+1])/2,y];}
  return points[0];
}
export function validatePolygon(points){
  if(!Array.isArray(points)||points.length<3||points.length>MAX_POLYGON_POINTS)throw new Error('영토 경계는 꼭짓점 3~2048개로 그려 주세요.');
  const clean=points.map(p=>{if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<0||p[0]>MAP_WIDTH||p[1]<0||p[1]>MAP_HEIGHT)throw new Error('영토 좌표가 지도 범위를 벗어났습니다.');return p.map(n=>Math.round(n*1000)/1000);});
  if(new Set(clean.map(p=>p.join(','))).size!==clean.length)throw new Error('경계 꼭짓점이 겹칩니다.');
  const orient=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const on=(a,b,p)=>Math.abs(orient(a,b,p))<.000001&&p[0]>=Math.min(a[0],b[0])&&p[0]<=Math.max(a[0],b[0])&&p[1]>=Math.min(a[1],b[1])&&p[1]<=Math.max(a[1],b[1]);
  const intersects=(a,b,c,d)=>orient(a,b,c)*orient(a,b,d)<0&&orient(c,d,a)*orient(c,d,b)<0||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);
  for(let i=0;i<clean.length;i++)for(let j=i+1;j<clean.length;j++){if(j===i+1||i===0&&j===clean.length-1)continue;if(intersects(clean[i],clean[(i+1)%clean.length],clean[j],clean[(j+1)%clean.length]))throw new Error('경계선이 서로 교차합니다. 꼭짓점 순서를 확인해 주세요.');}
  if(Math.abs(polygonArea(clean))<4)throw new Error('영토 면적이 너무 작습니다.');
  return clean;
}
export function validateCartography(input,territories){
  if(input===undefined)return undefined;
  if(!input||typeof input!=='object'||input.version!==1||!['illustrated','classic'].includes(input.style)||!Number.isFinite(input.opacity)||input.opacity<0||input.opacity>1)throw new Error('지도 디자인 설정이 올바르지 않습니다.');
  const background=input.background??null;
  if(background!==null&&(typeof background!=='string'||background.length>2400000||!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(background)))throw new Error('지도 배경은 저장 용량 2.4MB 이하의 PNG·JPEG·WebP 이미지여야 합니다.');
  const ids=new Set(territories.map(t=>t.id)),polygons={};
  if(!input.polygons||typeof input.polygons!=='object'||Array.isArray(input.polygons)||Object.keys(input.polygons).length>territories.length)throw new Error('영토 경계 목록이 올바르지 않습니다.');
  for(const [id,shape] of Object.entries(input.polygons)){
    if(!ids.has(id))throw new Error('지도 경계가 없는 영토를 가리킵니다.');
    const points=validatePolygon(shape?.points),holes=shape?.holes??[];
    if(!Array.isArray(holes)||holes.length>128)throw new Error('영토 내부 바다 영역이 너무 복잡합니다.');
    const cleanHoles=holes.map(validatePolygon);
    for(let i=0;i<cleanHoles.length;i++){
      const hole=cleanHoles[i];if(hole.some(p=>!pointInPolygon(p,points)&&!onPolygonBoundary(p,points))||ringsCross(points,hole))throw new Error('내부 바다는 해당 영토 경계 안에 있어야 합니다.');
      for(let j=0;j<i;j++)if(ringsCross(hole,cleanHoles[j])||pointInPolygon(polygonCenter(hole),cleanHoles[j])||pointInPolygon(polygonCenter(cleanHoles[j]),hole))throw new Error('내부 바다 영역이 겹칩니다.');
    }
    const center=shape.center??polygonCenter(points),result={points,center,...(cleanHoles.length?{holes:cleanHoles}:{})};
    if(!Array.isArray(center)||center.length!==2||!center.every(Number.isFinite)||!pointInShape(center,result))throw new Error('영토 이름·부대 위치는 해당 육지 경계 안에 놓아 주세요.');
    if(shape.anchors!==undefined){if(!shape.anchors||typeof shape.anchors!=='object'||Array.isArray(shape.anchors))throw new Error('표시 위치 형식을 확인해 주세요.');result.anchors={};for(const key of ['reference','label','station','battle']){const p=shape.anchors[key];if(p===undefined)continue;if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||!pointInShape(p,result))throw new Error('표시 위치는 해당 영토의 육지 안에 놓아 주세요.');result.anchors[key]=p.map(v=>Math.round(v*1000)/1000);}}
    Object.defineProperty(polygons,id,{value:{...result,center:[...center]},enumerable:true,writable:true,configurable:true});
  }
  let links=null;
  if(input.links!==null&&input.links!==undefined){if(!Array.isArray(input.links)||input.links.length>10000)throw new Error('인접 관계 목록이 올바르지 않습니다.');const keys=new Set();links=input.links.map(pair=>{if(!Array.isArray(pair)||pair.length!==2||pair[0]===pair[1]||!pair.every(id=>ids.has(id)))throw new Error('인접 관계가 없는 영토 또는 자기 자신을 가리킵니다.');const p=[...pair].sort(),key=JSON.stringify(p);if(keys.has(key))throw new Error('인접 관계가 중복되었습니다.');keys.add(key);return p;});}
  if(input.plate!==undefined&&!['reference','continent160'].includes(input.plate))throw new Error('지원하지 않는 지도 삽화입니다.');
  return {version:1,style:input.style,opacity:input.opacity,background,polygons,links,...(input.plate?{plate:input.plate}:{})};
}
export function setTerritoryLinks(existing,territoryId,selectedIds){
  return [...existing.filter(pair=>!pair.includes(territoryId)),...selectedIds.filter(id=>id!==territoryId).map(id=>[territoryId,id])];
}

export function pointInShape(point,shape){return pointInPolygon(point,shape.points)&&!(shape.holes||[]).some(h=>pointInPolygon(point,h)||onPolygonBoundary(point,h));}
function onPolygonBoundary(p,ring){return ring.some((a,i)=>{const b=ring[(i+1)%ring.length];return Math.abs((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]))<.00001&&p[0]>=Math.min(a[0],b[0])&&p[0]<=Math.max(a[0],b[0])&&p[1]>=Math.min(a[1],b[1])&&p[1]<=Math.max(a[1],b[1]);});}
function ringsCross(a,b){const side=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);return a.some((p,i)=>b.some((r,j)=>{const q=a[(i+1)%a.length],s=b[(j+1)%b.length];return side(p,q,r)*side(p,q,s)<-.000001&&side(r,s,p)*side(r,s,q)<-.000001;}));}
export function shapeAnchor(points,holes=[],preferred=null){
 const shape={points,holes};if(preferred&&pointInShape(preferred,shape))return [...preferred];const center=polygonCenter(points);if(pointInShape(center,shape))return center;
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),left=Math.min(...xs),top=Math.min(...ys),width=Math.max(...xs)-left,height=Math.max(...ys)-top;
 for(let y=1;y<40;y++)for(let x=1;x<40;x++){const p=[left+width*x/40,top+height*y/40];if(pointInShape(p,shape))return p;}throw new Error('영토 안의 육지 표시 위치를 찾지 못했습니다. 경계를 조금 넓혀 주세요.');
}
