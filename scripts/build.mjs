import {packStandalone} from './standalone-pack.mjs';
import {syncLicensedFonts} from './licensed-fonts.mjs';
import { syncSoundArt } from './sound-art.mjs';
import { syncTextBoxArt } from './text-box-art.mjs';
// Minimal bundling for this dependency-free application. The modular source is authoritative.
// Only local named ESM imports and direct named exports are supported intentionally.
import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { syncStudioArt } from './studio-art.mjs';
import { syncKitIcons } from './ui-kit.mjs';
import { syncGeneralPortraits } from './general-portraits.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
await syncLicensedFonts(root);
await syncStudioArt(root);
await syncTextBoxArt(root);
await syncSoundArt(root);
await syncKitIcons(root);
await syncGeneralPortraits(root);
const hanMapData=await readFile(resolve(root,'assets/maps/han/art.json'),'utf8');
const hanManifest=JSON.parse(await readFile(resolve(root,'assets/maps/han/manifest.json'),'utf8'));
if(createHash('sha256').update(await readFile(resolve(root,'assets/maps/han/original.zip'))).digest('hex')!==hanManifest.sourceSha256)throw Error('지도 원본이 바뀌었습니다. python scripts/import-han-map.py로 내장 자료를 갱신해 주세요.');
const visited = new Set(), chunks = [];
let mobileBuild=false;
async function bundle(path) {
  path = resolve(path);
  if (visited.has(path)) return;
  visited.add(path);
  let source = await readFile(path, 'utf8');
  if(mobileBuild&&path===resolve(root,'src/data/continent160-art.js'))source='export const CONTINENT160_ART = '+JSON.stringify('data:image/webp;base64,'+(await readFile(resolve(root,'assets/maps/continent_160.mobile.webp'))).toString('base64'))+';';
  const imports = [...source.matchAll(/^import\s+\{[^}]*\}\s+from\s+['"]([^'"]+)['"];?\s*$/gm)];
  for (const match of imports) {
    if (!match[1].startsWith('.')) throw new Error('Only local imports are supported');
    await bundle(resolve(dirname(path), match[1]));
  }
  source = source.replace(/^import\s+\{[^}]*\}\s+from\s+['"][^'"]+['"];?\s*$/gm, '');
  source = source.replace(/^export\s+(?=(?:const|let|(?:async\s+)?function|class)\b)/gm, '');
  if (/^\s*(import|export)\s/m.test(source)) throw new Error(`Unsupported module syntax in ${path}`);
  chunks.push(`\n// ${path.slice(root.length + 1)}\n${source}`);
}
async function scriptFor(mobile){mobileBuild=mobile;visited.clear();chunks.length=0;await bundle(resolve(root,'src/app.js'));return `(() => {\n'use strict';\n${chunks.join('\n')}\n})();`.replace(/<\/script/gi,'<\\/script');}
let fontCss=await readFile(resolve(root,'src/ui/fonts-licensed.css'),'utf8');
for(const match of [...fontCss.matchAll(/url\('([^']+\.woff2)'\)/g)])fontCss=fontCss.replace(match[0],`url('data:font/woff2;base64,${(await readFile(resolve(root,'src/ui',match[1]))).toString('base64')}')`);
const v39Css=await readFile(resolve(root,'src/ui/studio-v39.css'),'utf8');
const v40Css=await readFile(resolve(root,'src/ui/studio-v40.css'),'utf8');
const v38Css=await readFile(resolve(root,'src/ui/studio-v38.css'),'utf8');
const v37Css=await readFile(resolve(root,'src/ui/studio-v37.css'),'utf8');
const v36Css=await readFile(resolve(root,'src/ui/studio-v36.css'),'utf8');
const v35Css=await readFile(resolve(root,'src/ui/studio-v35.css'),'utf8');
const v34Css=await readFile(resolve(root,'src/ui/studio-v34.css'),'utf8');
const v33Css=await readFile(resolve(root,'src/ui/studio-v33.css'),'utf8');
const v32Css=await readFile(resolve(root,'src/ui/studio-v32.css'),'utf8');
const v30Css=await readFile(resolve(root,'src/ui/studio-v30.css'),'utf8');
const css = await readFile(resolve(root, 'src/ui/style.css'), 'utf8');
const visuals = await readFile(resolve(root, 'src/ui/visuals.css'), 'utf8');
const mapStage = await readFile(resolve(root, 'src/ui/map-stage.css'), 'utf8');
const mapEditorCss = await readFile(resolve(root, 'src/ui/map-editor.css'), 'utf8');
const reformCss=await readFile(resolve(root,'src/ui/studio-v11.css'),'utf8');
const v13Css=await readFile(resolve(root,'src/ui/studio-v13.css'),'utf8');
const v14Css=await readFile(resolve(root,'src/ui/studio-v14.css'),'utf8');
const v15Css=await readFile(resolve(root,'src/ui/studio-v15.css'),'utf8');
const v20Css=await readFile(resolve(root,'src/ui/studio-v20.css'),'utf8');
const v21Css=await readFile(resolve(root,'src/ui/studio-v21.css'),'utf8');
const v24Css=await readFile(resolve(root,'src/ui/studio-v24.css'),'utf8');
const v23Css=await readFile(resolve(root,'src/ui/studio-v23.css'),'utf8');
const v22Css=await readFile(resolve(root,'src/ui/studio-v22.css'),'utf8');
const v19Css=await readFile(resolve(root,'src/ui/studio-v19.css'),'utf8');
const v18Css=await readFile(resolve(root,'src/ui/studio-v18.css'),'utf8');
const v17Css=await readFile(resolve(root,'src/ui/studio-v17.css'),'utf8');
const v16Css=await readFile(resolve(root,'src/ui/studio-v16.css'),'utf8');
const latestCss=await readFile(resolve(root,'src/ui/studio-v10.css'),'utf8');
const campaignCss=await readFile(resolve(root,'src/ui/studio-v09.css'),'utf8');
const fieldCss=await readFile(resolve(root,'src/ui/studio-v08.css'),'utf8');
const studioCss = await readFile(resolve(root, 'src/ui/studio-v07.css'), 'utf8');
const mapRefinementsCss = await readFile(resolve(root, 'src/ui/map-refinements.css'), 'utf8');
// Keep each skin image in one CSS variable and inline local assets for offline delivery.
let lacquerCss = await readFile(resolve(root, 'src/ui/lacquer-bronze.css'), 'utf8');
for (const match of [...lacquerCss.matchAll(/url\("(\.\.\/\.\.\/assets\/ui-kit\/[^"\n]+)"\)/g)]) {
  const path = resolve(root, 'src/ui', match[1]);
  const mime = path.endsWith('.svg') ? 'image/svg+xml' : 'image/webp';
  const data = Buffer.from(await readFile(path)).toString('base64');
  lacquerCss = lacquerCss.replace(match[0], `url("data:${mime};base64,${data}")`);
}
const favicon = Buffer.from(await readFile(resolve(root, 'favicon.svg'))).toString('base64');
let html = await readFile(resolve(root, 'index.html'), 'utf8');
html = html.replace('<link rel="stylesheet" href="./src/ui/fonts-licensed.css">',`<style>${fontCss}</style>`).replace('<link rel="stylesheet" href="./src/ui/style.css">', `<style>${css}</style>`)
  .replace('<link rel="stylesheet" href="./src/ui/visuals.css">', `<style>${visuals}</style>`)
  .replace('<link rel="stylesheet" href="./src/ui/map-stage.css">', `<style>${mapStage}</style>`)
  .replace('<link rel="stylesheet" href="./src/ui/map-editor.css">', `<style>${mapEditorCss}</style>`)
  .replace('<link rel="stylesheet" href="./src/ui/lacquer-bronze.css">', `<style>${lacquerCss}</style>`)
  .replace('<link rel="stylesheet" href="./src/ui/map-refinements.css">', `<style>${mapRefinementsCss}</style>`)
  .replace('<link rel="stylesheet" href="./src/ui/studio-v07.css">', `<style>${studioCss}</style>`)
  .replace('<link rel="stylesheet" href="./src/ui/studio-v08.css">', `<style>${fieldCss}</style>`)
  .replace('<link rel="stylesheet" href="./src/ui/studio-v09.css">', `<style>${campaignCss}</style>`)
  .replace('<link rel="stylesheet" href="./src/ui/studio-v10.css">', `<style>${latestCss}</style>`)
  .replace('<link rel="stylesheet" href="./src/ui/studio-v11.css">', `<style>${reformCss}</style>`)
  .replace('<link rel="stylesheet" href="./src/ui/studio-v13.css">', `<style>${v13Css}</style>`)
  .replace('<link rel="stylesheet" href="./src/ui/studio-v14.css">', `<style>${v14Css}</style>`)
  .replace('<link rel="stylesheet" href="./src/ui/studio-v15.css">', `<style>${v15Css}</style>`)
  .replace('<link rel="stylesheet" href="./src/ui/studio-v16.css">', `<style>${v16Css}</style>`)
  .replace('<link rel="stylesheet" href="./src/ui/studio-v17.css">', `<style>${v17Css}</style>`)
  .replace('<link rel="stylesheet" href="./src/ui/studio-v18.css">', `<style>${v18Css}</style>`)
  .replace('<link rel="stylesheet" href="./src/ui/studio-v19.css">', `<style>${v19Css}</style>`)
  .replace('<link rel="stylesheet" href="./src/ui/studio-v20.css">', `<style>${v20Css}</style>`)
  .replace('<link rel="stylesheet" href="./src/ui/studio-v21.css">', `<style>${v21Css}</style>`)
  .replace('<link rel="stylesheet" href="./src/ui/studio-v22.css">', `<style>${v22Css}</style>`)
  .replace('<link rel="stylesheet" href="./src/ui/studio-v23.css">', `<style>${v23Css}</style>`)
  .replace('<link rel="stylesheet" href="./src/ui/studio-v24.css">', `<style>${v24Css}</style>`)
  .replace('<link rel="stylesheet" href="./src/ui/studio-v30.css">', `<style>${v30Css}</style>`)
  .replace('<link rel="stylesheet" href="./src/ui/studio-v32.css">', '<style>'+v32Css+'</style>')
  .replace('<link rel="stylesheet" href="./src/ui/studio-v33.css">', '<style>'+v33Css+'</style>')
  .replace('<link rel="stylesheet" href="./src/ui/studio-v34.css">', '<style>'+v34Css+'</style>')
  .replace('<link rel="stylesheet" href="./src/ui/studio-v35.css">', '<style>'+v35Css+'</style>')
  .replace('<link rel="stylesheet" href="./src/ui/studio-v36.css">', '<style>'+v36Css+'</style>')
  .replace('<link rel="stylesheet" href="./src/ui/studio-v37.css">', '<style>'+v37Css+'</style>')
  .replace('<link rel="stylesheet" href="./src/ui/studio-v38.css">', '<style>'+v38Css+'</style>')
  .replace('<link rel="stylesheet" href="./src/ui/studio-v39.css">', '<style>'+v39Css+'</style>')
  .replace('<link rel="stylesheet" href="./src/ui/studio-v40.css">', '<style>'+v40Css+'</style>')
  .replace('href="./favicon.svg"', `href="data:image/svg+xml;base64,${favicon}"`);
const dist = resolve(root, 'dist');
await mkdir(dist, { recursive: true });
await rm(resolve(dist,'사국쟁패 Studio 모바일 경량.html'),{force:true});
{
 const script=await scriptFor(false),name='사국쟁패 Studio.html';
 const mapData='<script id="studio-han-art" type="application/json">'+hanMapData.replace(/<\/script/gi,'<\\/script')+'<'+'/script>';
 const rawOutput=html.replace('<html lang="ko">','<html lang="ko" data-performance="normal">').replace('<script type="module" src="./src/app.js"></script>',mapData+`<script>${script}</script>`);
 const output=packStandalone(rawOutput,false);
 await writeFile(resolve(dist,name),output);
 if(process.argv.includes('--release'))await writeFile(resolve(root,name),output);
 console.log(`단독 실행본 생성: dist/${name} (${Math.ceil(Buffer.byteLength(output)/1024)}KB)`);
}
await mkdir(resolve(dist, 'docs'), { recursive: true });
await cp(resolve(root, 'docs/reference'), resolve(dist, 'docs/reference'), { recursive: true });
console.log('일반판 HTML만 제작합니다. 첨부 지도와 질감은 내장되어 인터넷 없이 실행됩니다.');
