import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
export async function syncFilmingArt(root){
 const folder=resolve(root,'assets/filming'),manifest=JSON.parse(await readFile(resolve(folder,'manifest.json'),'utf8')),cutouts={};
 for(let i=1;i<=70;i++){
  const number=String(i).padStart(3,'0'),entry=manifest.characters['general_'+number];
  if(entry?.cutout!==`cutouts/general_${number}_cutout.webp`)throw Error('촬영 초상 대응표를 확인해 주세요.');
  const bytes=await readFile(resolve(folder,entry.cutout));if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')throw Error('잘못된 촬영 초상 파일입니다.');
  cutouts['general-'+number]='data:image/webp;base64,'+bytes.toString('base64');
 }
 const frame='data:image/svg+xml;base64,'+(await readFile(resolve(folder,'frames/battle_frame.svg'))).toString('base64'),wreath='data:image/svg+xml;base64,'+(await readFile(resolve(folder,'frames/laurel_wreath.svg'))).toString('base64');
 await writeFile(resolve(root,'src/data/filming-art.js'),'// Generated from the original user-supplied transparent cutouts and decorations.\nexport const FILM_CUTOUTS = '+JSON.stringify(cutouts)+';\nexport const FILM_FRAME = '+JSON.stringify(frame)+';\nexport const FILM_WREATH = '+JSON.stringify(wreath)+';\n');
}
