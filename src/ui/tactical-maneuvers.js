import {MASS_TACTICS,massSeed} from './mass-battle-tactics.js';
export const TACTICAL_ORDERS={
 'center-break':'중앙 대열을 좁혀라. 돌파 뒤 전열을 넓혀라.',
 'wing-focus':'한쪽 정면에 병력을 모아라. 반대 날개는 유지하라.',
 oblique:'선두 날개부터 중앙, 반대 날개 순으로 진격하라.',
 pincer:'중앙은 붙잡고 양익은 바깥으로 돌아 측면을 압박하라.',
 hook:'한쪽 외곽을 돌아 측면으로 진입하라.',
 breach:'앞서 열린 돌파구로 통과한 뒤 좌우로 전개하라.',
 waves:'앞 대열을 교대하라. 다음 대열이 같은 접촉면을 이어받는다.',
 pressure:'같은 전면을 유지하며 짧게 반복해서 밀어붙여라.',
 reserves:'후속대는 대기하라. 압박받는 틈으로 투입한다.',
 hold:'기준선을 지켜라. 짧게 물러나 전열을 다시 맞춰라.',
 'local-counter':'공격을 받아낸 뒤 가까운 전선까지만 되밀어라.',
 'counter-break':'반격을 시작하라. 적의 기준선을 넘어 진격하라.',
 'staged-retreat':'앞 대열이 엄호하라. 후열부터 물러나 다시 엄호하라.',
 'split-retreat':'생존 부대는 서로 다른 퇴로로 나누어 철수하라.'};
export function eligibleTacticalManeuvers(beat,context){
 const n=context.attackGroups,d=context.defenseGroups,win=beat.winner===beat.attackId,defWin=beat.winner===beat.defenseId&&!beat.automatic,advance=!!beat.source.takenTerritoryIds?.length;
 return MASS_TACTICS.filter(t=>({
 'center-break':win&&!beat.automatic,'wing-focus':n>=2,oblique:n>=3,pincer:n>=3&&d>=2,hook:n>=2&&d>=1,
 breach:context.priorBreak&&win,waves:n>=2,pressure:!beat.automatic,reserves:n>=3,
 hold:!beat.automatic,'local-counter':defWin&&!advance,'counter-break':advance&&(defWin||beat.continuation==='counter'&&win),
 'staged-retreat':beat.winner!==null&&Math.min(n,d)>=2,'split-retreat':beat.winner!==null&&Math.min(n,d)>=2
 }[t.id]));
}
export function chooseTacticalManeuver(beat,context,seed,forced){
 const eligible=eligibleTacticalManeuvers(beat,context);let selected=eligible.find(t=>t.id===forced);
 if(!selected){if((beat.winner===beat.defenseId||beat.continuation==='counter')&&beat.source.takenTerritoryIds?.length)selected=eligible.find(t=>t.id==='counter-break');else if(context.priorBreak&&beat.continuation==='advance')selected=eligible.find(t=>t.id==='breach');else if(Math.min(context.attackCommanders,context.defenseCommanders)<3)selected=eligible.find(t=>t.id===(beat.winner===beat.defenseId?'hold':'pressure'));else selected=eligible[massSeed(seed+':'+beat.index)%Math.max(1,eligible.length)];}
 return {...selected||{id:'hold',name:'전선 유지'},forced:!!forced,fallback:forced&&selected?.id!==forced?forced:null,eligible:eligible.map(t=>t.id)};
}
// Every policy supplies a distinct path/response, using a few group waypoints.
// Fractions are relative to one real recorded engagement, never a new battle.
export function tacticalManeuverRoute(id,{side,index,count,center,face,home,sign,winning,hasCapture}){
 const wing=index%2?-1:1,spread=(index-(count-1)/2)*22,front={x:face.x,y:face.y},path=[];
 const put=(at,x,y,action='walk',formation='line')=>path.push({at,point:{x,y},action,formation});
 if(side==='attack')switch(id){
  case 'center-break':put(.12,center.x-sign*135,center.y+spread*.3,'walk','wedge');put(.40,front.x,front.y,'attack','wedge');break;
  case 'wing-focus':put(.20,center.x-sign*160,center.y-90+spread*.55);put(.43,front.x,front.y,'attack');break;
  case 'oblique':put(.12+index/Math.max(1,count-1)*.22,home.x+sign*40,home.y);put(.36+index/Math.max(1,count-1)*.22,front.x,front.y,'attack');break;
  case 'pincer':if(index%3===1){put(.28,front.x,front.y,'guard');}else{put(.18,center.x-sign*135,center.y+wing*145);put(.38,center.x+sign*75,center.y+wing*145);put(.53,front.x,front.y,'attack');}break;
  case 'hook':if(index%2){put(.20,center.x-sign*120,center.y-165);put(.40,center.x+sign*110,center.y-145);put(.55,front.x,front.y,'attack');}else put(.32,front.x,front.y,'attack');break;
  case 'breach':put(.18,center.x-sign*95,center.y+spread*.2,'walk','column');put(.38,center.x+sign*70,center.y+spread*.2,'walk','column');put(.54,front.x,front.y,'attack','line');break;
  case 'waves':if(index%2){put(.25,center.x-sign*170,center.y+spread,'idle');put(.54,front.x,front.y,'attack');}else{put(.28,front.x,front.y,'attack');put(.62,front.x-sign*70,front.y,'guard');}break;
  case 'pressure':put(.25,front.x,front.y,'attack');put(.42,front.x+sign*9,front.y,'attack');put(.53,front.x-sign*6,front.y,'attack');put(.64,front.x+sign*10,front.y,'attack');break;
  case 'reserves':if(index>=count/2){put(.34,center.x-sign*180,center.y+spread,'idle');put(.57,front.x,front.y,'attack');}else put(.27,front.x,front.y,'attack');break;
  default:put(.30,front.x,front.y,'attack');
 }else{
  if(['pincer','hook'].includes(id)){put(.15,front.x-sign*20,front.y+wing*40,'guard');put(.49,front.x,front.y,'guard','bent');}
  else if(id==='wing-focus'){put(.20,front.x-sign*16,front.y-45,'guard');put(.43,front.x,front.y,'guard');}
  else if(id==='breach'){put(.30,front.x-sign*50,front.y+wing*45,'guard');put(.54,front.x,front.y,'guard','inward');}
  else if(id==='hold'){put(.28,front.x,front.y,'guard');put(.46,front.x-sign*18,front.y,'guard');put(.58,front.x,front.y,'guard');}
  else if(id==='local-counter'){put(.26,front.x,front.y,'guard');put(.44,front.x-sign*24,front.y,'guard');put(.61,front.x+sign*22,front.y,'attack');}
  else if(id==='counter-break'){put(.26,front.x,front.y,'guard');put(.43,front.x-sign*18,front.y,'guard');put(.62,front.x+sign*80,front.y,'attack','wedge');}
  else put(.32,front.x,front.y,'guard');
 }
 // The actual win/loss, rather than the selected maneuver, decides the endpoint.
 if(id==='staged-retreat'&&!winning){put(.72,front.x-sign*(index%2?80:0),front.y,index%2?'retreat':'guard');put(.85,front.x-sign*(index%2?85:100),front.y,index%2?'guard':'retreat');put(1,front.x-sign*130,front.y,'guard');}
 else if(id==='split-retreat'&&!winning){put(.78,front.x-sign*70,front.y+wing*55,'retreat');put(1,front.x-sign*145,front.y+wing*90,'guard');}
 else {put(.72,front.x,front.y,side==='attack'?'attack':'guard');put(1,front.x+sign*(winning?(hasCapture?105:35):-85),front.y,winning?'walk':'retreat');}
 return path;
}
