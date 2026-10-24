// Minimal bundling for this dependency-free application. The modular source is authoritative.
// Only local named ESM imports and direct named exports are supported intentionally.
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { syncStudioArt } from './studio-art.mjs';
import { syncKitIcons } from './ui-kit.mjs';
import { syncGeneralPortraits } from './general-portraits.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
await syncStudioArt(root);
await syncKitIcons(root);
await syncGeneralPortraits(root);
const mobileMeta=JSON.parse(await readFile(resolve(root,'assets/maps/continent_160.mobile.json'),'utf8'));
const sourceHash=createHash('sha256').update(await readFile(resolve(root,'assets/maps/continent_160.art.svg'))).digest('hex');
if(mobileMeta.sourceSha256!==sourceHash)throw new Error('지도 원본이 바뀌었습니다. python scripts/mobile-map.py로 모바일 배경을 다시 생성해 주세요.');
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
html = html.replace('<link rel="stylesheet" href="./src/ui/style.css">', `<style>${css}</style>`)
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
  .replace('href="./favicon.svg"', `href="data:image/svg+xml;base64,${favicon}"`);
const dist = resolve(root, 'dist');
await mkdir(dist, { recursive: true });
for(const mobile of [false,true]){
 const script=await scriptFor(mobile),name=mobile?'사국쟁패 Studio 모바일 경량.html':'사국쟁패 Studio.html';
 const output=html.replace('<html lang="ko">',`<html lang="ko" data-performance="${mobile?'mobile':'normal'}">`).replace('<script type="module" src="./src/app.js"></script>',`<script>${script}</script>`);
 await writeFile(resolve(dist,name),output);
 if(process.argv.includes('--release'))await writeFile(resolve(root,name),output);
 console.log(`단독 실행본 생성: dist/${name} (${Math.ceil(Buffer.byteLength(output)/1024)}KB)`);
}
await mkdir(resolve(dist, 'docs'), { recursive: true });
await cp(resolve(root, 'docs/reference'), resolve(dist, 'docs/reference'), { recursive: true });
console.log('일반판과 모바일 경량판은 같은 규칙과 저장 형식으로 작동합니다. 외부 서비스와 설치가 필요 없습니다.');
