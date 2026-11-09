import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
export async function syncBattlePack(root){
 const folder=resolve(root,'assets/battle-pack-v1'),manifest=JSON.parse(await readFile(resolve(folder,'manifest.json'),'utf8')),audio=JSON.parse(await readFile(resolve(folder,'audio/audio_manifest.json'),'utf8'));
 for(const path of ['backgrounds/battle_meadow_2048.webp','textures/cloth_seamless.svg','textures/lacquer_seamless.svg','textures/bronze_seamless.svg','ui/frame_nineslice.png','ui/unit_nameplate.svg']){const data=await readFile(resolve(folder,path));if(createHash('sha256').update(data).digest('hex')!==manifest.files.find(f=>f.path===path)?.sha256)throw Error('첨부 전투 UI의 원본을 확인해 주세요: '+path);}
 const sounds=[];for(const entry of audio.assets){const data=await readFile(resolve(folder,entry.ogg)),expected=manifest.files.find(f=>f.path===entry.ogg);if(!expected||createHash('sha256').update(data).digest('hex')!==expected.sha256)throw Error('첨부 전투 효과음의 원본을 확인해 주세요: '+entry.id);sounds.push({id:'bp_'+entry.id,label:entry.title,duration:entry.duration,loop:entry.loop,volume:entry.recommendedGain,cooldown:entry.loop?0:180,category:entry.category==='ambience'?'battle':entry.category,data:'data:audio/ogg;base64,'+data.toString('base64')});}
 await writeFile(resolve(root,'src/data/battle-sound-art.js'),'// Generated from user-provided battle_assets_pack_v1, preserving OGG bytes.\nexport const BATTLE_SOUND_PACK = '+JSON.stringify(sounds)+';\n');
}
