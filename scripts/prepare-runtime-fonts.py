"""Rebuild offline Korean fonts from the installed OFL Noto CJK KR faces.
Node's Brotli codec can be used when Python's optional Brotli extension is absent.
Only this preparation step uses Python; the shipped game is a standalone HTML.
"""
from pathlib import Path
from hashlib import sha256
import json
import sys
import subprocess
import types
try:
 import brotli
except ImportError:
 def _brotli_compress(data,mode=0,**kwargs):
  js="const z=require('node:zlib'),fs=require('node:fs');process.stdout.write(z.brotliCompressSync(fs.readFileSync(0),{params:{[z.constants.BROTLI_PARAM_MODE]:Number(process.argv[1]),[z.constants.BROTLI_PARAM_QUALITY]:11}}));"
  return subprocess.run(['node','-e',js,str(mode)],input=data,stdout=subprocess.PIPE,check=True).stdout
 def _brotli_decompress(data):
  js="const z=require('node:zlib'),fs=require('node:fs');process.stdout.write(z.brotliDecompressSync(fs.readFileSync(0)));"
  return subprocess.run(['node','-e',js],input=data,stdout=subprocess.PIPE,check=True).stdout
 sys.modules['brotli']=types.SimpleNamespace(MODE_FONT=2,MODE_TEXT=1,compress=_brotli_compress,decompress=_brotli_decompress)
from fontTools.ttLib import TTFont
from fontTools import subset
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/fonts'
rows=json.loads((OUT/'manifest.json').read_text())
chars=set(range(0x20,0x3000))|set(range(0xAC00,0xD7A4))|set(range(0x3130,0x3190))|set(range(0xFF00,0xFFF0))
for a in range(0x81,0xFF):
 for b in range(0x41,0xFF):
  try:chars.add(ord(bytes([a,b]).decode('cp949')))
  except (UnicodeDecodeError,TypeError):pass
for filename,path,family,weight in [
 ('NotoSansKR.woff2','/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc','Studio Sans',400),
 ('NotoSerifKR.woff2','/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc','Studio Serif',700),
]:
 source=Path(path);font=TTFont(source,fontNumber=1,recalcTimestamp=False)
 copyright=font['name'].getDebugName(0)
 options=subset.Options();options.name_IDs=['*'];options.name_legacy=True;options.name_languages=['*']
 sub=subset.Subsetter(options=options);sub.populate(unicodes=chars);sub.subset(font)
 for record in font['name'].names:
  value={1:family,2:'Regular',4:family,6:family.replace(' ','-'),16:family,17:'Regular'}.get(record.nameID)
  if value:record.string=value.encode(record.getEncoding(),errors='replace')
 glyphs=len(font.getBestCmap());font.flavor='woff2';font.save(OUT/filename)
 row=next(r for r in rows if r['file']==filename)
 licensePath=OUT/row['license'];licenseText=licensePath.read_text()
 assert "SIL OPEN FONT LICENSE" in licenseText
 row.update(source='https://github.com/notofonts/noto-cjk',sourceFile=source.name+' (KR face 1)',sourceSha256=sha256(source.read_bytes()).hexdigest(),sha256=sha256((OUT/filename).read_bytes()).hexdigest(),bytes=(OUT/filename).stat().st_size,glyphs=glyphs,weight=weight,licenseSha256=sha256(licensePath.read_bytes()).hexdigest())
 check=TTFont(OUT/filename);assert all(c in check.getBestCmap() for c in range(0xAC00,0xD7A4))
 print(filename,row['bytes'],'bytes',glyphs,'mapped characters')
(OUT/'manifest.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
from optimize_runtime_fonts import optimize
optimize(OUT)
