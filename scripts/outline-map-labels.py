"""Replace the four generated map labels by outlines from the bundled OFL serif.
The original user SVG remains untouched; map coordinates and territory paths do not change.
"""
from pathlib import Path
import xml.etree.ElementTree as E
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
ROOT=Path(__file__).resolve().parents[1];p=ROOT/'assets/maps/continent_160.art.svg';ns='http://www.w3.org/2000/svg';E.register_namespace('',ns)
font=TTFont(ROOT/'assets/fonts/NotoSerifKR.woff2');glyphs=font.getGlyphSet();cmap=font.getBestCmap();upem=font['head'].unitsPerEm;tree=E.parse(p);count=0
inherited_keys=['font-size','letter-spacing','text-anchor']
def walk(parent,inherited):
 global count
 values={**inherited,**{k:parent.attrib[k] for k in inherited_keys if k in parent.attrib}}
 for child in list(parent):
  if child.tag=='{'+ns+'}text':
   v={**values,**child.attrib};text=''.join(child.itertext());size=float(v.get('font-size','12'));scale=size/upem;spacing=float(v.get('letter-spacing','0'));width=sum(font['hmtx'][cmap[ord(c)]][0]*scale for c in text)+max(0,len(text)-1)*spacing;x=float(v.get('x','0'));y=float(v.get('y','0'))
   if v.get('text-anchor')=='middle':x-=width/2
   if v.get('text-anchor')=='end':x-=width
   group=E.Element('{'+ns+'}g',{k:w for k,w in child.attrib.items() if k not in ['x','y','font-size','font-family','font-weight','letter-spacing','text-anchor']});group.set('aria-label',text)
   for char in text:
    key=cmap[ord(char)];pen=SVGPathPen(glyphs);glyphs[key].draw(pen);d=pen.getCommands()
    if d:E.SubElement(group,'{'+ns+'}path',{'d':d,'transform':f'translate({x:.5f} {y:.5f}) scale({scale:.8f} {-scale:.8f})'})
    x+=font['hmtx'][key][0]*scale+spacing
   index=list(parent).index(child);parent.remove(child);parent.insert(index,group);count+=1
  else:walk(child,values)
 parent.attrib.pop('font-family',None)
walk(tree.getroot(),{});tree.write(p,encoding='unicode');print('Outlined map labels:',count)
