"""Build inert vector artwork and game geometry from the supplied SVG, using stdlib only."""
from pathlib import Path
import xml.etree.ElementTree as E
import json,re,base64,hashlib
ROOT=Path(__file__).resolve().parents[1];SOURCE=ROOT/'assets/maps/continent_160.original.svg';raw=SOURCE.read_bytes()
if b'<!ENTITY' in raw or b'<!DOCTYPE' in raw:raise ValueError('External XML declarations are not supported')
E.register_namespace('', 'http://www.w3.org/2000/svg')
root=E.fromstring(raw);data=json.loads(next(x.text for x in root if x.attrib.get('id')=='map-data'));entries=data['territories']
if len(entries)!=160 or len({t['id'] for t in entries})!=160:raise ValueError('Expected exactly 160 unique territories')
paths={x.attrib['id']:x.attrib['d'] for x in root.iter() if x.attrib.get('class')=='territory'}
def point(p):return [round(p[0]*2/3,3),round((p[1]+70)*2/3,3)]
output=[]
for t in entries:
 d=paths[t['id']]
 if re.sub(r'[MLZmlz0-9.,+\-\s]','',d):raise ValueError('Expected straight polygon paths')
 nums=[float(x) for x in re.findall(r'-?\d+(?:\.\d+)?',d)];pts=[point(nums[i:i+2])for i in range(0,len(nums),2)]
 pts=[p for i,p in enumerate(pts)if i==0 or p!=pts[i-1]]
 if pts[0]==pts[-1]:pts.pop()
 output.append({'id':t['id'],'name':t['name'],'points':pts,'center':point(t['center']),'terrain':'mountain' if t['terrain']=='산악' else 'plain','sourceTerrain':t['terrain'],'coastal':t['coastal'],'neighbors':t['neighbors']})
ids={t['id']for t in entries};byid={t['id']:t for t in entries}
for t in entries:
 for n in t['neighbors']:
  if n not in ids or t['id']not in byid[n]['neighbors'] or n==t['id']:raise ValueError('Invalid asymmetric adjacency')
# Remove executable/interactive material. Never run the supplied script.
remove={'script','metadata','style','title','desc'};layers={'layer-territories','layer-labels'}
for parent in list(root.iter()):
 for x in list(parent):
  if x.tag.split('}')[-1]in remove or x.attrib.get('id')in layers:parent.remove(x)
for x in root.iter():
 for k,v in list(x.attrib.items()):
  if k.lower().startswith('on')or k in ['tabindex','role']or k.startswith('aria-'):del x.attrib[k]
  if k.endswith('href')and not v.startswith('#'):raise ValueError('External SVG reference')
# A single SVG contains land and an extended ocean, aligned with the editor coordinate system.
root.attrib.update({'viewBox':'-1800 -1270 5400 3600','width':'5400','height':'3600'})
for layer in root:
 if layer.attrib.get('id') in ['layer-ocean','layer-paper']:
  for x in layer:
   if x.tag.endswith('rect'):x.attrib.update({'x':'-1800','y':'-1270','width':'5400','height':'3600'})
# Keep the original ocean gradient positions when enlarging the water rectangle.
sea=next(x for x in root.iter()if x.attrib.get('id')=='sea');sea.attrib.update({'gradientUnits':'userSpaceOnUse','x1':'0','y1':'0','x2':'1620','y2':'1060'})
svg=E.tostring(root,encoding='utf-8');(ROOT/'assets/maps/continent_160.art.svg').write_bytes(svg)
(ROOT/'src/data/continent160-map.js').write_text('// Generated from the uploaded continent_160.svg by scripts/import-continent160.py.\nexport const CONTINENT160_CELLS = '+json.dumps(output,ensure_ascii=False,separators=(',',':'))+';\nexport const CONTINENT160_SOURCE_SHA256 = '+json.dumps(hashlib.sha256(raw).hexdigest())+';\n')
(ROOT/'src/data/continent160-art.js').write_text('// Inert vector artwork embedded by scripts/studio-art.mjs.\nexport const CONTINENT160_ART = '+json.dumps('data:image/svg+xml;base64,'+base64.b64encode(svg).decode())+';\n')
print(f'{len(output)} territories; {sum(len(t["neighbors"])for t in entries)//2} land links; {sum(t["terrain"]=="mountain"for t in output)} mountains; inert artwork {len(svg)} bytes')
