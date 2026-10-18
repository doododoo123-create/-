// Bitmap resolution is independent of the 1200×800 editor coordinate system.
// Preserve source detail up to 4K; do not repeatedly recompress an embedded image.
export const MAX_MAP_IMAGE_CHARS=2400000;
export function prepareMapImage(image,source=''){
  const targetWidth=Math.max(1200,Math.min(3840,Math.round(Math.max(image.naturalWidth||image.width,(image.naturalHeight||image.height)*1.5)/3)*3));
  const canvas=document.createElement('canvas');canvas.width=targetWidth;canvas.height=targetWidth*2/3;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#103e48';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingQuality='high';
  const scale=Math.min(canvas.width/image.width,canvas.height/image.height),w=image.width*scale,h=image.height*scale;ctx.drawImage(image,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
  if(/^data:image\/(?:png|jpeg|webp);base64,/.test(source)&&source.length<=MAX_MAP_IMAGE_CHARS&&image.width===canvas.width&&image.height===canvas.height)return {canvas,data:source};
  for(const quality of [.96,.93,.9,.86,.82]){const data=canvas.toDataURL('image/webp',quality);if(data.length<=MAX_MAP_IMAGE_CHARS)return {canvas,data};}
  throw new Error('고해상도 지도 저장 용량을 넘었습니다. 이미지의 크기나 복잡도를 조금 줄여 주세요.');
}
