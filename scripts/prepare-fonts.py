"""Prepare checked-in OFL fonts. Build/runtime use only the resulting WOFF2, not Python.
Requires fonttools[woff] and the official Google Fonts TTF sources in /tmp.
"""
from pathlib import Path
from hashlib import sha256
import json
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets/fonts';OUT.mkdir(exist_ok=True)
items=[('NotoSansKR[wght].ttf','NotoSansKR.woff2','Studio Sans','notosanskr',None),('NotoSerifKR[wght].ttf','NotoSerifKR.woff2','Studio Serif','notoserifkr',600),('NotoSansSymbols2-Regular.ttf','NotoSymbols.woff2','Studio Symbols','notosanssymbols2',None),('NotoEmoji[wght].ttf','NotoEmoji.woff2','Studio Emoji','notoemoji',None)]
manifest=[]
for name,target,family,source,weight in items:
 raw=Path('/tmp')/name;font=TTFont(raw,recalcTimestamp=False)
 if weight is not None:font=instantiateVariableFont(font,{'wght':weight},inplace=True)
 if source=='notoemoji':
  options=subset.Options();options.name_IDs=['*'];options.name_legacy=True;options.name_languages=['*'];sub=subset.Subsetter(options=options);sub.populate(unicodes=[0x1f451,0x1f6e1,0xfe0f,0xfffd,0x20]);sub.subset(font)
 for record in font['name'].names:
  value={1:family,2:'Regular',4:family,6:family.replace(' ','-'),16:family,17:'Regular'}.get(record.nameID)
  if value:record.string=value.encode(record.getEncoding(),errors='replace')
 font.recalcTimestamp=False;font.flavor='woff2';font.save(OUT/target)
 cmap=font.getBestCmap();manifest.append({'file':target,'family':family,'source':'https://github.com/google/fonts/tree/main/ofl/'+source,'sourceFile':name,'sourceSha256':sha256(raw.read_bytes()).hexdigest(),'sha256':sha256((OUT/target).read_bytes()).hexdigest(),'bytes':(OUT/target).stat().st_size,'glyphs':len(cmap),'weight':weight or 'variable' if source!='notosanssymbols2' else 400,'license':source+'-OFL.txt','licenseSha256':sha256((OUT/(source+'-OFL.txt')).read_bytes()).hexdigest()});print(target,(OUT/target).stat().st_size,'bytes',len(cmap),'codepoints')
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
