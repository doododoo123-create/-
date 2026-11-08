"""Regenerate small runtime WebP sheets and their offline data from preserved PNGs.
Requires Pillow. Never edits the original troop sheets or game data.
"""
from pathlib import Path
from PIL import Image
from io import BytesIO
import base64,json
root=Path(__file__).resolve().parents[1];source=root/'assets/troops';meta=json.loads((source/'frames.json').read_text());data={}
for tier,entry in meta['tiers'].items():
 data[tier]={}
 for action,info in entry['actions'].items():
  value={'durations':info['durations_ms'],'loop':info['loop']}
  for part in ['body','shade']:
   original=Image.open(source/'assets'/tier/f'{action}-{part}.png');sheet=Image.new('RGBA',(825,276))
   for f in range(10):
    frame=original.crop((f%5*384,f//5*320,f%5*384+384,f//5*320+320)).resize((165,138),Image.Resampling.LANCZOS);sheet.paste(frame,(f%5*165,f//5*138))
   buf=BytesIO();sheet.save(buf,format='WEBP',lossless=True,method=6);raw=buf.getvalue();dest=source/'runtime'/tier;dest.mkdir(parents=True,exist_ok=True);(dest/f'{action}-{part}.webp').write_bytes(raw);value[part]='data:image/webp;base64,'+base64.b64encode(raw).decode()
  data[tier][action]=value
(root/'src/data/troop-art.js').write_text('// Generated runtime sheets; original user PNGs are preserved in assets/troops.\nexport const TROOP_ART = '+json.dumps(data,separators=(',',':'))+';\n')
