"""Bake only the supplied decorative artwork. Game boundaries/IDs are untouched.
Needs Playwright Chromium and Pillow; ordinary builds use the checked-in result.
"""
from pathlib import Path
from hashlib import sha256
from io import BytesIO
import base64,json,math
from PIL import Image
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets/maps/han';TEMP=ROOT/'.artifacts';TEMP.mkdir(exist_ok=True)
data=json.loads((OUT/'art.json').read_text());font=(ROOT/'assets/fonts/NotoSerifKR.woff2').read_bytes()
font_css='@font-face{font-family:"Studio Serif";src:url(data:font/woff2;base64,'+base64.b64encode(font).decode()+');font-weight:700}html,body,#source{margin:0;width:100%;height:100%;overflow:hidden}'
html='<html><head><style>'+font_css+'</style></head><body><div id="source"></div><script>window.art='+json.dumps(data,separators=(',',':')).replace('</','<\\/')+';</script></body></html>'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);ctx=b.new_context(viewport={'width':6144,'height':3618},device_scale_factor=1);page=ctx.new_page();ctx.route('**/bake-han',lambda r:r.fulfill(status=200,content_type='text/html',body=html));ctx.set_offline(True);page.goto('http://localhost:3000/bake-han',wait_until='domcontentloaded',timeout=120000)
 page.evaluate('''async()=>{const shadow=document.querySelector('#source').attachShadow({mode:'open'});shadow.innerHTML=art.svg;const svg=shadow.querySelector('svg');svg.setAttribute('viewBox','0 0 1800 1060');svg.setAttribute('preserveAspectRatio','none');for(const e of svg.querySelectorAll('[data-texture-id]'))if(['sea','terrain'].includes(e.dataset.textureKind))e.setAttribute('href','data:image/jpeg;base64,'+art.textures[e.dataset.textureId]);await document.fonts.load('700 16px "Studio Serif"');await document.fonts.ready;await Promise.all([...svg.querySelectorAll('image')].map(e=>e.getAttribute('href')).filter(Boolean).map(src=>new Promise((ok,bad)=>{const i=new Image();i.onload=ok;i.onerror=bad;i.src=src;})));}''')
 print('Source art decoded; rendering 6144-pixel mainland',flush=True);page.screenshot(path=str(TEMP/'han-main-6144.png'),timeout=180000)
 page.set_viewport_size({'width':2304,'height':1536});page.evaluate("document.querySelector('#source').shadowRoot.querySelector('svg').setAttribute('viewBox','-1800 -1270 5400 3600')");page.screenshot(path=str(TEMP/'han-ocean-overview.png'),timeout=120000);b.close()
def encoded(im,quality=84):
 f=BytesIO();im.save(f,format='WEBP',quality=quality,method=6);return base64.b64encode(f.getvalue()).decode()
main=Image.open(TEMP/'han-main-6144.png').convert('RGB');overview=Image.open(TEMP/'han-ocean-overview.png').convert('RGB')
preview=main.resize((1536,905),Image.Resampling.LANCZOS)
levels=[]
for width in [3072,6144]:
 height=round(width*1060/1800);image=main.resize((width,height),Image.Resampling.LANCZOS) if width!=6144 else main;tiles=[]
 for y in range(0,height,512):
  for x in range(0,width,512):
   # One-pixel overlap prevents filtering seams between adjacent tile images.
   box=(max(0,x-1),max(0,y-1),min(width,x+513),min(height,y+513))
   tiles.append({'id':str(width)+'-'+str(x)+'-'+str(y),'x':box[0],'y':box[1],'width':box[2]-box[0],'height':box[3]-box[1],'data':encoded(image.crop(box))})
 levels.append({'width':width,'height':height,'tileSize':512,'tiles':tiles})
 print('Encoded',width,'pixels,',len(tiles),'tiles',flush=True)
manifest={'version':'han-raster-v43','sourceVersion':data['manifest']['version'],'sourceSha256':data['manifest']['sourceSha256'],'sourceSvgSha256':data['manifest']['svgSha256'],'fontSha256':sha256(font).hexdigest(),'sourceTextures':476,'territories':160,'landLinks':357,'mainBounds':[0,0,1800,1060],'overviewBounds':[-1800,-1270,5400,3600],'previewWidth':1536,'previewHeight':905,'quality':84,'maxWidth':6144}
raster={'manifest':manifest,'overview':encoded(overview,82),'preview':encoded(preview,86),'levels':levels}
raw=json.dumps(raster,separators=(',',':'));(OUT/'raster.json').write_text(raw);print('Raster JSON bytes',len(raw),'SHA256',sha256(raw.encode()).hexdigest(),flush=True)
