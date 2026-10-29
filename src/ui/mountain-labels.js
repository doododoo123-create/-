// Position against the measured label, not a fixed map-unit offset. Camera zoom
// and inverse-scaled text must keep a small, constant screen gap.
export function alignMountainLabels(root){
 const svg=root.querySelector('.atlas-map'),matrix=svg?.getScreenCTM?.();if(!matrix)return;
 const labels=new Map([...root.querySelectorAll('[data-territory-label]')].map(e=>[e.dataset.territoryLabel,e]));
 const placements=[],inverse=matrix.inverse(),scale=Math.hypot(matrix.a,matrix.b);
 for(const marker of root.querySelectorAll('[data-mountain-id]')){
  const name=labels.get(marker.dataset.mountainId);if(!name)continue;
  const textMatrix=name.getScreenCTM(),box=name.getBoundingClientRect();if(!textMatrix||!box.width)continue;
  const baseline=new DOMPoint(Number(name.getAttribute('x')),Number(name.getAttribute('y'))).matrixTransform(textMatrix),at=new DOMPoint(box.right+4,baseline.y).matrixTransform(inverse);
  const size=parseFloat(getComputedStyle(name).fontSize)*Math.hypot(textMatrix.a,textMatrix.b)/scale;placements.push({marker,at,size});
 }
 // Read all text bounds before changing any marker: interleaving reads/writes
 // caused a complete SVG layout for every mountain at every camera update.
 for(const {marker,at,size} of placements){for(const [key,value] of [['x',String(at.x)],['y',String(at.y)],['text-anchor','start']])if(marker.getAttribute(key)!==value)marker.setAttribute(key,value);if(marker.style.fontSize!==size+'px')marker.style.fontSize=size+'px';}
}
