import { readFile,readdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
export async function syncGeneralPortraits(root){
  const directory=resolve(root,'assets/portraits'),pictures={},labels={};
  const notes=await readFile(resolve(directory,'SOURCE-NOTES.txt'),'utf8');
  for(const line of notes.split(/\r?\n/)){const m=/^(general_\d{3})\.jpg : (.+)$/.exec(line);if(m)labels[m[1].replace('_','-')]=m[2].split(' · ').slice(0,2).join(' · ');}
  for(const name of (await readdir(directory)).filter(n=>/^general_\d{3}\.jpg$/.test(n)).sort())pictures[name.slice(0,-4).replace('_','-')]='data:image/jpeg;base64,'+(await readFile(resolve(directory,name))).toString('base64');
  if(Object.keys(pictures).length!==70)throw new Error('70개의 장수 초상화가 모두 필요합니다.');
  await writeFile(resolve(root,'src/data/general-portraits.js'),'// User-supplied general portraits, optimized for offline use. Generated from assets/portraits.\nexport const GENERAL_PORTRAITS = '+JSON.stringify(pictures)+';\nexport const GENERAL_PORTRAIT_LABELS = '+JSON.stringify(labels)+';\n');
}
