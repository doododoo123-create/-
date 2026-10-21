"""Prepare the display-only mobile plate. The original SVG and game geometry stay intact.
Requires Pillow, Playwright and Chromium only when regenerating this checked-in asset.
"""
from pathlib import Path
from io import BytesIO
from hashlib import sha256
import json
from PIL import Image
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
source=root/'assets/maps/continent_160.art.svg'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'],headless=True)
    page=browser.new_page(viewport={'width':3600,'height':2400},device_scale_factor=1)
    page.set_content('<style>html,body{margin:0;width:3600px;height:2400px}svg{width:3600px;height:2400px;display:block}</style>'+source.read_text())
    image=Image.open(BytesIO(page.screenshot(omit_background=True))).convert('RGB')
    target=root/'assets/maps/continent_160.mobile.webp'
    image.save(target,'WEBP',quality=84,method=6)
    browser.close()
(root/'assets/maps/continent_160.mobile.json').write_text(json.dumps({'sourceSha256':sha256(source.read_bytes()).hexdigest(),'width':3600,'height':2400,'quality':84},indent=2)+'\n')
print(f'Mobile background: {target.stat().st_size:,} bytes, 3600×2400')
