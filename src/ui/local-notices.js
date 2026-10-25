// Game messages attach to their subject; only season, capital fall and elimination are global.
export function localNotices(scene,record,world){
 if(!scene||['season','summary','route','arrival'].includes(scene.kind))return [];
 const e=scene.event||{},countryId=e.nationId||record?.actorId,items=[];
 const add=(label,role='general',tone='neutral',country=countryId,slot=e.slot)=>items.push({countryId:country,role,slot,type:'notice',noticeKind:e.type,delta:0,label,tone});
 if(scene.kind==='movement')return [];
 if(e.type==='hold')add('출정 거부','general','refusal');
 if(e.type==='skip')add(e.detail?.includes('0만')?'병력 0 · 충원 대기':'출정 불가');
 if(e.type==='retreat')add(e.title?.includes('인근')?'인근 후퇴':e.title?.includes('재배치')?'재배치':'후퇴');
 if(e.type==='empty_return')add(e.reason==='home'?'주둔지 복귀':'수도 복귀');
 if(e.type==='frontier_reserve')add('전선 대기');
 if(e.type==='occupation')add('점령지 진입');
 if(e.type==='survived')add(e.empty===false?'대패 생존':'생존 · 충원 대기');
 if(e.type==='counteroffensive')add('역공 개시');
 if(e.type==='reorganization')add('생존 병력 재편','king');
 if(e.type==='resolve'&&record?.type==='domestic')add(`${record.action} ${e.success?'성공':'실패'}`,'minister',e.success?'positive':'negative');
 if(e.type==='resupply')add('수도 병력 배분','king');
 if(e.type==='round_end')for(const g of record?.production||[])add('계절 병력 생산','king','neutral',g.countryId,null);
 if(e.type==='roster')add('지휘 구역 재편','king');
 if(e.type==='waiting')add('후임 대기','king');
 if(e.type==='finish')for(const id of record?.result?.winnerIds||[])add(record.result.reason==='unification'?'천하 통일':'최종 우승','king','positive',id,null);
 return items;
}
