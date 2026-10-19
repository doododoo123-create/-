// Minimal bundling for this dependency-free application. The modular source is authoritative.
// Only local named ESM imports and direct named exports are supported intentionally.
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncStudioArt } from './studio-art.mjs';
import { syncKitIcons } from './ui-kit.mjs';
import { syncGeneralPortraits } from './general-portraits.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
await syncStudioArt(root);
await syncKitIcons(root);
await syncGeneralPortraits(root);
const visited = new Set(), chunks = [];
async function bundle(path) {
  path = resolve(path);
  if (visited.has(path)) return;
  visited.add(path);
  let source = await readFile(path, 'utf8');
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
await bundle(resolve(root, 'src/app.js'));
const script = `(() => {\n'use strict';\n${chunks.join('\n')}\n})();`.replace(/<\/script/gi, '<\\/script');
const css = await readFile(resolve(root, 'src/ui/style.css'), 'utf8');
const visuals = await readFile(resolve(root, 'src/ui/visuals.css'), 'utf8');
const mapStage = await readFile(resolve(root, 'src/ui/map-stage.css'), 'utf8');
const mapEditorCss = await readFile(resolve(root, 'src/ui/map-editor.css'), 'utf8');
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
  .replace('href="./favicon.svg"', `href="data:image/svg+xml;base64,${favicon}"`)
  .replace('<script type="module" src="./src/app.js"></script>', `<script>${script}</script>`);
const dist = resolve(root, 'dist');
await mkdir(dist, { recursive: true });
await writeFile(resolve(dist, '사국쟁패 Studio.html'), html);
if (process.argv.includes('--release')) {
  await writeFile(resolve(root, '사국쟁패 Studio.html'), html);
  console.log('GitHub ZIP에 포함할 루트 실행본도 갱신했습니다.');
}
await mkdir(resolve(dist, 'docs'), { recursive: true });
await cp(resolve(root, 'docs/reference'), resolve(dist, 'docs/reference'), { recursive: true });
console.log(`단독 실행본 생성: dist/사국쟁패 Studio.html (${Math.ceil(Buffer.byteLength(html) / 1024)}KB)\n브라우저에서 더블클릭해 실행할 수 있습니다. 외부 서비스와 설치가 필요 없습니다.`);
