// Position against the measured label, not a fixed map-unit offset. Camera zoom
// and inverse-scaled text must keep a small, constant screen gap.
export function alignMountainLabels(root){
 const svg=root.querySelector('.atlas-map'),matrix=svg?.getScreenCTM?.();if(!matrix)return;
 const labels=new Map([...root.querySelectorAll('[data-territory-label]')].map(e=>[e.dataset.territoryLabel,e]));
 for(const marker of root.querySelectorAll('[data-mountain-id]')){
  const name=labels.get(marker.dataset.mountainId);if(!name)continue;
  const textMatrix=name.getScreenCTM(),box=name.getBoundingClientRect();if(!textMatrix||!box.width)continue;
  const baseline=new DOMPoint(Number(name.getAttribute('x')),Number(name.getAttribute('y'))).matrixTransform(textMatrix),at=new DOMPoint(box.right+4,baseline.y).matrixTransform(matrix.inverse());
  marker.setAttribute('x',String(at.x));marker.setAttribute('y',String(at.y));marker.setAttribute('text-anchor','start');
  const size=parseFloat(getComputedStyle(name).fontSize)*Math.hypot(textMatrix.a,textMatrix.b)/Math.hypot(matrix.a,matrix.b);marker.style.fontSize=size+'px';
 }
}
