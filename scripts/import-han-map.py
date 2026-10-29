"""Import the supplied artwork without executing its embedded map/UI scripts."""
from pathlib import Path
from zipfile import ZipFile
from lxml import etree
from hashlib import sha256
import json,re,copy
ROOT=Path(__file__).resolve().parents[1];source=ROOT/'assets/maps/han/original.zip'
with ZipFile(source) as z:
 html=z.read('continent_160.html').decode();data=json.loads(z.read('map-data.json'))
 for name in ['map-data.json','CODEX_HANDOFF.md','map-engine.js']:(source.parent/name).write_bytes(z.read(name))
a=html.index('<svg ');b=html.index('</svg>',a)+6
svg=etree.fromstring(html[a:b].encode(),etree.XMLParser(huge_tree=True,no_network=True));ns='{http://www.w3.org/2000/svg}'
original=etree.parse(str(ROOT/'assets/maps/continent_160.original.svg'))
old={e.get('id'):e.get('d') for e in original.iter() if e.get('d')}
paths=svg.xpath('//*[@id="layer-territories"]/*');assert len(paths)==160
assert all(old[e.get('id')]==e.get('d') for e in paths)
banknode=svg.xpath('//*[@id="texture-assets"]')[0];bank=json.loads(banknode.text);assert len(bank)==476
for node in list(svg.iter()):
 if etree.QName(node).localname in ['metadata','script']:node.getparent().remove(node)
for style in svg.findall(ns+'style'):
 style.text=re.sub(r'@font-face\s*\{[^}]*\}', '',style.text or '',flags=re.I)+ '\ntext{font-family:"Studio Serif"!important}*{pointer-events:none!important}'
ground=svg.xpath('//*[@id="layer-ground"]')[0]
for node in ground.xpath('.//*[@data-ground-mode]'):node.set('style','' if node.get('data-ground-mode')==data['groundTexture']['style'] else 'display:none')
for node in ground.xpath('.//*[@data-strength-weight]'):node.set('opacity',str(float(node.get('data-strength-weight'))*data['groundTexture']['strength']/100))
sea=svg.xpath('//*[@id="layer-sea-texture"]')[0]
for node in sea.xpath('.//*[@data-sea-weight]'):node.set('opacity',str(float(node.get('data-sea-weight'))*data['seaTexture']['strength']/100))
# Keep the source sea at its exact coordinates and repeat its preview outside the
# supplied rectangle, where the game's freely pannable camera can also travel.
defs=svg.find(ns+'defs');pattern=etree.SubElement(defs,ns+'pattern',id='studio-sea-extension',patternUnits='userSpaceOnUse',width='1800',height='1060')
etree.SubElement(pattern,ns+'rect',width='1800',height='1060',fill='url(#sea)')
preview=copy.deepcopy(sea)
for e in list(preview.iter()):
 if e.get('data-texture-id'):e.getparent().remove(e)
 elif 'id' in e.attrib:del e.attrib['id']
pattern.append(preview)
ext=etree.Element(ns+'rect',x='-1800',y='-1270',width='5400',height='3600',fill='url(#studio-sea-extension)')
svg.insert(list(svg).index(svg.xpath('//*[@id="layer-ocean"]')[0]),ext)
svg.set('viewBox','-1800 -1270 5400 3600');svg.set('width','100%');svg.set('height','100%');svg.set('style','display:block;width:100%;height:100%;pointer-events:none')
art=etree.tostring(svg,encoding='unicode');assert '<script' not in art
manifest={'version':data['artVersion'],'sourceSha256':sha256(source.read_bytes()).hexdigest(),'territories':160,'landLinks':357,'textures':476,'nativePixelsPerWorldUnit':5,'viewBox':[0,0,1800,1060],'transform':{'scale':2/3,'translateY':70/1.5},'svgSha256':sha256(art.encode()).hexdigest(),'textureBankSha256':sha256(json.dumps(bank,separators=(',',':')).encode()).hexdigest()}
(source.parent/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(source.parent/'art.json').write_text(json.dumps({'svg':art,'textures':bank,'manifest':manifest},ensure_ascii=False,separators=(',',':')))
print(json.dumps({'territories':160,'pathsIdentical':160,'textureCells':len(bank),'artBytes':len(art.encode()),'generatedBytes':(source.parent/'art.json').stat().st_size}))
