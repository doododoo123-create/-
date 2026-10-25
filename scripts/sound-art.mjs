import {SOUND_LEVEL_GAINS,SOUND_OUTPUT_GAIN} from '../src/audio/loudness.js';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
export async function syncSoundArt(root){
 const base=resolve(root,'assets/sounds/classic-v2'),manifest=JSON.parse(await readFile(resolve(base,'manifest.json'),'utf8')),hashes=JSON.parse(await readFile(resolve(base,'SHA256SUMS.json'),'utf8'));
 if(manifest.sounds.length!==42||new Set(manifest.sounds.map(s=>s.id)).size!==42)throw Error('효과음 목록 42종을 확인해 주세요.');
 const levels=JSON.parse(await readFile(resolve(base,'balance-v25.json'),'utf8'));if(levels.sounds.length!==42||levels.outputGain!==SOUND_OUTPUT_GAIN)throw Error('효과음 음량 보정표를 확인해 주세요.');
 const sounds=[];for(const s of manifest.sounds){if(!/^[a-z_]+$/.test(s.id))throw Error('잘못된 효과음 식별자');const data=await readFile(resolve(base,s.id+'.mp3'));if(createHash('sha256').update(data).digest('hex')!==hashes[s.mp3])throw Error(s.id+' 효과음 원본 해시 불일치');const level=levels.sounds.find(v=>v.id===s.id);if(!level||level.sha256!==hashes[s.mp3]||level.gain!==SOUND_LEVEL_GAINS[s.id]||level.gain<.7||level.gain>2.75)throw Error(s.id+' 음량 보정표가 원본과 일치하지 않습니다.');sounds.push({id:s.id,label:s.label,category:s.category,duration:s.duration,volume:s.volume,cooldown:s.cooldown_ms,priority:s.priority,data:'data:audio/mpeg;base64,'+data.toString('base64')});}
 await writeFile(resolve(root,'src/data/sound-art.js'),'// Generated from the supplied classic-v2 MP3 assets. Do not edit.\nexport const SOUND_PACK = '+JSON.stringify(sounds)+';\n');
}
