import {MASS_TACTICS} from './mass-battle-tactics.js';
const name=id=>MASS_TACTICS.find(t=>t.id===id)?.name||'전열 정돈';
const attackOrders={
 'center-break':['중앙 돌파','중앙 주력을 모아 적 전열에 틈을 내라.'],
 'wing-focus':['편익 집중','표시된 한쪽 날개에 공세를 집중하라. 반대쪽은 유지하라.'],
 oblique:['사선 진격','선두 날개부터 중앙, 반대 날개 순서로 전진하라.'],
 pincer:['양익 협공','중앙은 적을 붙잡고, 양익은 바깥으로 돌아 압박하라.'],
 hook:['측면 우회','한쪽 측면을 돌아 적의 옆을 압박하라.'],
 breach:['돌파구 확대','확보한 틈으로 후속대를 보내 점령 지역을 넓혀라.'],
 waves:['파상 공세','선두 대열을 빼고 다음 대열이 공세를 이어받아라.'],
 pressure:['전면 압박','전열을 맞추고 맞닿은 적을 밀어붙여라.'],
 reserves:['예비대 투입','후열 부대를 표시된 접촉면에 보내 선두를 교대하라.'],
 hold:['전선 유지','확보한 선을 지키며 대열을 정돈하라.'],
 'local-counter':['국지 역습','적이 물러나는 접촉면을 짧게 되밀어라.'],
 'counter-break':['반격 돌파','적 공세를 꺾은 부대가 앞으로 나가 전선을 밀어라.'],
 'staged-retreat':['엄호 후퇴','일부가 엄호하는 동안 나머지를 후방으로 빼라.'],
 'split-retreat':['분산 철수','생존 부대가 서로 다른 퇴로로 빠져나가라.']
};
const responses={
 'center-break':['중앙 보강','중앙에 방어 병력을 모으고 돌파를 막아라.'],
 'wing-focus':['측면 증원','압박받는 날개에 후열 병력을 보내라.'],
 oblique:['순차 대응','접촉한 날개부터 막고 인접 전열을 이어라.'],
 pincer:['양익 엄호','양쪽 날개를 뒤로 굽혀 중앙이 고립되지 않게 하라.'],
 hook:['측면 차단','우회해 오는 부대를 향해 측면 대열을 돌려라.'],
 breach:['후방 방어','뚫린 전열 뒤에서 새 방어선을 만들어라.'],
 waves:['교대 방어','선두를 교대하며 연속 공세를 받아내라.'],
 pressure:['전열 방어','접촉선을 유지하고 적의 진격을 막아라.'],
 reserves:['증원 저지','추가로 들어오는 부대를 막고 대열을 유지하라.'],
 hold:['전선 견제','상대가 정돈하는 동안 접촉면을 압박하라.'],
 'local-counter':['반격 방어','앞서 나간 부대를 거두고 역습을 막아라.'],
 'counter-break':['공세 수습','반격받는 전열을 뒤로 빼고 후속대를 엄호하라.'],
 'staged-retreat':['추격 견제','물러나는 부대를 압박하되 전열을 유지하라.'],
 'split-retreat':['전장 확보','철수하는 적의 빈자리를 확보하라.']
};
export function createTacticalDirector(plan,groups,forced){
 const sides=['attack','defense'],members=side=>plan.units.filter(u=>u.side===side&&u.battleIds.length&&(currentAlive?.get(u.id)!==false)),small=Math.min(...sides.map(s=>plan.units.filter(u=>u.side===s&&u.battleIds.length).length))<3,policies=plan.tactics.selected.map(t=>t.id);
 let currentAlive=null,current=null,lastResult=-1,seenContact=false,reserveNotice=false,phase=0;
 const phases=[];
 function update({time,beats,resolved,contacts,fronts,positions,alive}){
  currentAlive=alive;
  const previous=[...resolved.values()],last=previous.at(-1),capture=previous.some(b=>b.source.takenTerritoryIds?.length),counter=previous.some(b=>b.winner===b.defenseId||b.continuation==='counter');
  const eligible=MASS_TACTICS.filter(t=>!(t.id==='breach'&&!capture)&&!(['local-counter','counter-break'].includes(t.id)&&!counter)&&!(small&&['pincer','hook','oblique','reserves','waves','staged-retreat','split-retreat'].includes(t.id)));
  const requested=typeof forced==='string'?forced:Array.isArray(forced)?forced[phase]:null;
  let id=current?.id,reason='',trigger='',initiative=current?.initiative||'attack';
  if(!current){id=policies.find(p=>eligible.some(t=>t.id===p))||'pressure';reason=small?'소수 부대가 목표 지역으로 접근합니다.':'주력·측면·예비대가 전열을 갖춥니다.';if(plan.engagements[0]?.terrain==='mountain')reason='산악 방어선 앞에서 전열을 갖추고 접근합니다.';trigger='approach';}
  else if(!seenContact&&contacts.length){seenContact=true;id=current.id;reason='양군 전열이 맞닿았습니다. 표시된 명령에 따라 교전합니다.';trigger='contact';}
  else if(last&&last.index!==lastResult){lastResult=last.index;const winner=plan.units.find(u=>u.id===last.winner);initiative=winner?.side||initiative;trigger='result';
   if(resolved.size===beats.length){id='hold';trigger='consolidate';reason='이번 집단전 판정이 끝났습니다. 확보한 전선은 유지하고 패전 부대는 후방으로 모입니다.';}
   else if(last.source.takenTerritoryIds?.length){id=last.winner===last.defenseId||last.continuation==='counter'?'counter-break':'breach';reason=`${last.territoryName} ${last.winner===last.defenseId||last.continuation==='counter'?'역공':'전열 돌파'} 결과에 따라 진격 방향을 바꿉니다.`;trigger='capture';}
   else if(last.winner===last.defenseId){id='local-counter';reason=`${winner?.name||'수비군'}의 방어 성공 뒤 접촉면을 되밉니다.`;}
   else if(last.winner===null){id=small?'pressure':policies.find(p=>['waves','reserves','wing-focus'].includes(p))||'hold';reason='전열이 버텼습니다. 대열을 정돈하고 다음 공세를 준비합니다.';}
   else {id=small?'pressure':policies.find(p=>eligible.some(t=>t.id===p)&&p!==current.id)||'center-break';reason=`${winner?.name||'선두 부대'}의 승리로 생긴 공간을 활용합니다.`;}
   const losses=previous.filter(b=>b.winner&&plan.units.find(u=>u.id===b.winner)?.side===initiative).length;
   if(trigger!=='consolidate'&&!small&&losses>=2&&!last.source.takenTerritoryIds?.length&&policies.includes('staged-retreat')){id='staged-retreat';reason='잇따른 교전으로 흐트러진 부대를 엄호하며 재정렬합니다.';initiative=initiative==='attack'?'defense':'attack';}
  }else if(!small&&!reserveNotice&&time>(current.at+2000)&&fronts.some(f=>[...f.targets.keys()].some(id=>groups.find(g=>g.id===id)?.role==='reserve'&&positions?.get(id)===f.targets.get(id)))&&contacts.length){reserveNotice=true;id='reserves';trigger='reserve';reason='후열 부대가 접촉면에 도착해 선두를 교대합니다.';}
  if(!trigger)return current;
  const fallback=requested&&!eligible.some(t=>t.id===requested)?requested:null;
  if(requested)id=fallback?'pressure':requested;
  if(!eligible.some(t=>t.id===id))id='pressure';
  const leaderLost=current&&Object.values(current.commands).some(c=>c.leaderId&&currentAlive?.get(c.leaderId)===false);
  if(current&&id===current.id&&initiative===current.initiative&&trigger==='result'&&!leaderLost)return current;
  if(leaderLost)reason='지휘관 전사 뒤 생존 지휘관이 명령을 이어받습니다.';
  const before=current?.name||null,previousInitiative=current?.initiative,changeText=before?(before!==name(id)?`${before} → ${name(id)}`:previousInitiative!==initiative?`${initiative==='attack'?'공격군':'수비군'}으로 주도권 이동`:leaderLost?'대표 지휘관 교대':''):'',stage=trigger==='approach'?'전열 배치':trigger==='capture'?'돌파·점령':trigger==='consolidate'?'전장 정리':id.includes('retreat')?'철수·엄호':'동시 교전';
  if(current)current.end=time;
  const lane=plan.tactics.wing<0?'화면 위쪽':'화면 아래쪽',main=attackOrders[id],answer=responses[id];
  const commands={};for(const side of sides){const initiating=side===initiative,[label,text]=initiating?main:answer,own=members(side),leader=[...own].sort((a,b)=>b.startArmy+(b.visualAbility||0)-a.startArmy-(a.visualAbility||0))[0];const visibleText=(trigger==='consolidate'?(side===initiative?'확보한 선을 지켜라. 패전 부대는 후방에서 다시 모여라.':'남은 부대를 후방으로 거두고 방어선을 정리하라.'):text).replace('표시된 한쪽',lane).replace('한쪽 측면',lane+' 측면').replace('압박받는 날개',lane+' 날개');commands[side]={label,text:visibleText,id:initiating?id:'response-'+id,leaderId:leader?.id,leaderName:leader?.name||'',countryId:leader?.countryId,ids:own.map(u=>u.id)};}
  current={id,name:name(id),phase:phase++,at:time,end:Infinity,reason,trigger,stage,initiative,previousName:before,changed:!!changeText,changeText,commands,wing:plan.tactics.wing,eligible:eligible.map(t=>t.id),forced:!!requested,fallback,ids:plan.units.filter(u=>u.battleIds.length).map(u=>u.id)};phases.push(current);return current;
 }
 return {update,phases,small};
}
