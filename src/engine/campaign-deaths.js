import { reorganizeSurvivors } from './campaign-survivors.js';
export function campaignDeath(ctx,b,g,nation,suffix){
 if(!g||!g.alive||b.automatic||b.winner===null)return false;
 const empty=g.troops===0,margin=Math.abs(b.attack.score-b.defense.score),r=ctx.rules;
 if(!empty&&(!r.routDeath||!r.routDeathChance||margin<r.captureThresholds[1]))return false;
 const faces=empty||r.routDeathChance%10===0?10:100,threshold=empty?3:r.routDeathChance/(faces===10?10:1),value=ctx.die(`death:${b.slot}${suffix}`,faces),died=value<=threshold;
 ctx.emit('death_roll',g.name+' 전사 판정',empty?'D10 1~3 전사 / 4~10 생존':`3칸 점령 등급의 점수차 ${margin} · D${faces} ${threshold} 이하 전사`,{battleIndex:b.index,nation,slot:g.slot,role:g.role||'general',roll:value,faces,died,reason:empty?'annihilation':'rout',empty,threshold,margin});
 if(!died){ctx.emit('survived',g.name+' 생존',empty?'병력 0만명 · 충원 대기':'대패 전사 판정에서 생존',{nation,slot:g.slot,role:g.role||'general',battleIndex:b.index,empty},true);return false;}
 const c=ctx.s.countries[nation],survivors=g.troops;c.reorganization=(c.reorganization||0)+survivors;g.troops=0;g.alive=false;if(g.role==='king')c.kingName='섭정';g.waited=0;g.position=null;g.stranded=false;
 c.fallen.push({name:g.name,round:ctx.s.round,turn:ctx.s.turns+1,slot:g.slot,generation:g.generation});c.fallen=c.fallen.slice(-30);
 const transfer=reorganizeSurvivors(ctx.s,nation,r,ctx.helpers.capacity,ctx.helpers.minimumReserveFor(ctx.s,nation));ctx.helpers.syncArmy(c);
 ctx.emit('death',g.name+' 전사',`자국 3턴 후 후임 임명${survivors?` · 잔여 ${survivors}만명 재편`:''}`,{nation,slot:g.slot,role:g.role||'general',battleIndex:b.index,survivors,transfer},true);return true;
}
