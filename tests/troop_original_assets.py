"""Verify all restored WebP frames retain original visible pixels (Pillow)."""
from pathlib import Path
from PIL import Image,ImageChops
root=Path(__file__).resolve().parents[1]/'assets/troops'
files=list((root/'runtime').rglob('*.webp'));assert len(files)==42
for p in files:
 a=Image.open(p).convert('RGBA');b=Image.open(root/'assets'/p.parent.name/(p.stem+'.png')).convert('RGBA');assert a.size==b.size==(1920,640)
 for color in [(0,0,0,255),(255,255,255,255)]:
  aa=Image.alpha_composite(Image.new('RGBA',a.size,color),a).convert('RGB');bb=Image.alpha_composite(Image.new('RGBA',b.size,color),b).convert('RGB');assert ImageChops.difference(aa,bb).getbbox() is None,p
print('PASS all42 original-resolution sheets: original visible RGB on black and white')
