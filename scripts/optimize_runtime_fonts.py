"""Convert the prepared OFL Korean faces to compact horizontal TrueType WOFF2."""
from pathlib import Path
from copy import deepcopy
from hashlib import sha256
import json
from fontTools.ttLib import TTFont
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools import subset
def optimize(root):
 root=Path(root)
 for style in ['Sans','Serif']:
  path=root/('Noto'+style+'KR.woff2');source=TTFont(path,recalcTimestamp=False)
  original=source.getBestCmap()
  if 'CFF ' in source:
   order=source.getGlyphOrder();glyph_set=source.getGlyphSet();glyphs={}
   for name in order:
    pen=TTGlyphPen(glyph_set);glyph_set[name].draw(Cu2QuPen(pen,max_err=1.0,reverse_direction=True));glyphs[name]=pen.glyph()
   builder=FontBuilder(source['head'].unitsPerEm,isTTF=True);builder.setupGlyphOrder(order);builder.setupCharacterMap(original)
   builder.setupGlyf(glyphs);builder.setupHorizontalMetrics(source['hmtx'].metrics)
   builder.setupHorizontalHeader(ascent=source['hhea'].ascent,descent=source['hhea'].descent,lineGap=source['hhea'].lineGap)
   builder.setupOS2();builder.setupPost(keepGlyphNames=False);builder.setupMaxp();font=builder.font
   for name in ['name','OS/2','GSUB','GPOS','GDEF','BASE','vhea','vmtx']:
    if name in source:font[name]=deepcopy(source[name])
   for name in ['created','modified','fontRevision','macStyle','lowestRecPPEM']:setattr(font['head'],name,getattr(source['head'],name))
  else:font=source
  opts=subset.Options();opts.name_IDs=['*'];opts.name_legacy=True;opts.name_languages=['*']
  opts.layout_features=['ccmp','ljmo','vjmo','tjmo','kern','mark','mkmk','liga']
  sub=subset.Subsetter(options=opts);sub.populate(unicodes=original.keys());sub.subset(font)
  font.recalcTimestamp=False;font.flavor='woff2';font.save(path)
  assert TTFont(path).getBestCmap().keys()==original.keys()
 rows=json.loads((root/'manifest.json').read_text())
 for row in rows:
  data=(root/row['file']).read_bytes();row['sha256']=sha256(data).hexdigest();row['bytes']=len(data)
  if row['file'] in ['NotoSansKR.woff2','NotoSerifKR.woff2']:
   row['outlineFormat']='TrueType';row['subset']='Full modern Hangul, KS X 1001 Hanja and retained Latin/Japanese/symbol ranges; horizontal Korean layout'
 (root/'manifest.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
