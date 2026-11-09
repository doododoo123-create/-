import {massSeed} from './mass-battle-tactics.js';
const FREE_ORDERS={
 'pincer':'중앙은 적을 붙잡아라. 양익은 돌아 들어가라!',hook:'외곽 부대는 측면으로 우회하라!',
 'wing-focus':'한쪽 날개에 힘을 모아 돌파하라!',oblique:'좌우 진형을 엇갈려 밀어붙여라!',
 reserves:'후속대는 빈 전선을 지원하라!',waves:'앞 부대를 엄호하며 다음 대열을 투입하라!',
 hold:'전열을 유지하고 적의 공격을 막아라!','center-break':'중앙에 힘을 모아 돌파하라!',pressure:'적의 정면을 쉬지 말고 압박하라!',
 'local-counter':'공격을 받아낸 뒤 함께 반격하라!','counter-break':'적이 물러난다. 전열을 밀어붙여라!',breach:'돌파구로 진형을 넓혀라!',
 'staged-retreat':'서로 엄호하며 뒤로 물러나라!','split-retreat':'대열을 나눠 안전한 곳으로 후퇴하라!'};
// A separate, deterministic editorial timeline. Dice order is never used as a
// choreography dependency. Actual identity, statistics and endpoint state remain authoritative.
export function freeBattlePresentation(plan,a){
 const hash=id=>{let x=massSeed(plan.seed+':'+id);x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;return x>>>0;},small=Math.min(...['attack','defense'].map(s=>plan.units.filter(u=>u.side===s&&u.battleIds.length).length))<3;
 const D=plan.baseDuration=small?6000:plan.units.length>=12?18000:16000;
 const attackTactics=plan.tactics.selected.filter(t=>!['hold','local-counter','counter-break','staged-retreat','split-retreat'].includes(t.id));
 const defenseTactics=plan.tactics.selected.filter(t=>['hold','local-counter','counter-break'].includes(t.id));
 const commands=[];
 for(const side of ['attack','defense']){
  const countryId=plan.countries[side==='attack'?0:1]?.id,list=plan.units.filter(u=>u.side===side),choice=side==='attack'?attackTactics:defenseTactics;
  if(!small&&list.length){const fallback=side==='attack'?{id:'pressure',name:'집중 압박'}:{id:'hold',name:'전선 유지'};
   for(let i=0;i<Math.min(2,Math.max(1,choice.length));i++){const tactic=choice[i]||fallback,leader=[...list].sort((x,y)=>y.startArmy-x.startArmy)[0];commands.push({...tactic,side,countryId,leaderId:leader.id,leaderName:leader.name,at:D*(i? .46:.10),end:D*(i?.63:.27),text:FREE_ORDERS[tactic.id],ids:list.filter(u=>u.battleIds.length).map(u=>u.id)});}
  }
 }
 plan.tacticalPhases=commands;plan.freePresentation=true;
 const ordersFor=u=>commands.filter(c=>c.side===u.side),front=D*.24,finish=D*.85;
 for(const side of ['attack','defense']){
  const list=plan.units.filter(u=>u.side===side).sort((x,y)=>hash(x.id)-hash(y.id)),sign=side==='attack'?1:-1,n=list.length;
  list.forEach((u,i)=>{
   const rank=Math.floor(i/6),lane=i%6,count=Math.min(6,n-rank*6),spread=Math.min(145,(plan.height-170)/Math.max(1,count));
   u.home={x:plan.width/2-sign*(220+rank*125),y:plan.center+(lane-(count-1)/2)*spread};u.formationRole=i===0?'left':i===n-1?'right':rank?'reserve':'center';
   const ownOrders=ordersFor(u),first=ownOrders[0],second=ownOrders[1],reserveCommand=ownOrders.find(c=>['reserves','waves'].includes(c.id)),reserve=n>=3&&i>=Math.ceil(n*.66)&&!!reserveCommand,wing=i<n/2?-1:1,flank=!small&&u.role!=='king'&&['pincer','hook','oblique','wing-focus'].includes(first?.id)&&i%3!==1;
   if(reserve){u.formationRole='reserve';u.home.x-=sign*100;}let from={...u.home},at=0;u.orders=[];
   const add=(kind,end,to,curveY=0)=>{if(end<=at)return;u.orders.push({kind,start:at,end,from:{...from},to:{...to},curve:0,curveY});from={...to};at=end;};
   add('guard',reserve?Math.max(D*.18,reserveCommand.at+300):D*.12,from);
   const line={x:plan.width/2-sign*(62+rank*105),y:u.home.y+(hash(u.id+':lane')%31-15)};
   if(flank){add('walk',D*.22,{x:plan.width/2-sign*130,y:Math.max(60,Math.min(plan.height-70,line.y+wing*100))},wing*70);line.x=plan.width/2+sign*32;}
   add('walk',(reserve?Math.max(D*.18,reserveCommand.at+300)+D*.16:front)+(hash(u.id+':arrival')%450),line,flank?wing*70:0);u.visualContact=at;u.contactPoint={...line};
   const rounds=a.rounds.get(u.id)||[],last=rounds.filter(b=>!b.automatic).at(-1),won=last&&last.winner!==null&&(last.winner===last.actor?last.attackId:last.defenseId)===u.id;
   const engaged=rounds.some(b=>!b.automatic);u.combatant=engaged;u.fightOffset=hash(u.id+':fight')%950;
   if(second&&u.role!=='king'){
    add(engaged?'attack':'guard',D*.48,from);
    const target={x:from.x+sign*(side==='defense'? -45:35),y:Math.max(65,Math.min(plan.height-65,from.y+wing*(['reserves','waves'].includes(second.id)?45:80)))};
    add('walk',D*.60,target,wing*40);
   }
   add(engaged?'attack':'guard',finish,{x:from.x+sign*(won?25:-15),y:from.y});
   if(u.role==='king')add('retreat',D*.97,u.home);
   else add(won?'walk':'retreat',D*.97,{x:from.x+sign*(won?110:-160),y:from.y+wing*30});
   add('guard',D,from);u.exitAt=won?undefined:D*.97;if(!engaged){u.orders=[{kind:'guard',start:0,end:D,from:{...u.home},to:{...u.home},curve:0,curveY:0}];u.exitAt=undefined;}
   // Partition final losses in the original quantum, with staggered visual hit
   // times. Genuine reinforcement/reorganization remains an explicit positive step.
   const target=a.after.people.find(p=>p.id===u.id),final=target?.troops??0,firstRound=rounds[0],firstArmy=firstRound?(firstRound.attackId===u.id?firstRound.attack.army:firstRound.defense.army):0,strength=Math.max(u.startArmy,firstArmy||0),loss=Math.max(0,strength-final),q=a.quantum;u.visualArmy=strength;
   u.troops=[{at:0,value:u.startArmy}];u.labels=[];if(strength>u.startArmy){u.troops.push({at:D*.18,value:strength});u.labels.push({at:D*.18,end:D*.25,text:'증원 도착',kind:'win'});}u.status=[{at:0,alive:u.initialAlive}];
   let previous=0;for(let k=1;k<=5;k++){const amount=Math.min(loss,Math.round(loss/q*k/5)*q),hitAt=D*(.28+k*.105)+(hash(u.id+':hit'+k)%500-250);u.troops.push({at:hitAt,value:Math.max(0,Math.round((strength-amount)*10000)/10000)});if(amount>previous)u.labels.push({at:hitAt,end:hitAt+900,text:`−${Math.round((amount-previous)*10000)/10000}만`,kind:'loss'});previous=amount;}
   if(final>strength){u.troops.push({at:D*.77,value:final});u.labels.push({at:D*.77,end:D*.86,text:'병력 재편',kind:'win'});}
   u.troops.push({at:D*.88,value:final},{at:D,value:final});u.troops.sort((x,y)=>x.at-y.at);
   u.finalArmy=final;u.finalAlive=target?.alive!==false;delete u.deathAt;
   if(!u.finalAlive){u.deathAt=D*(.70+(hash(u.id+':death')%130)/1000);u.status.push({at:u.deathAt,alive:false});u.troops.push({at:u.deathAt,value:0});u.troops=u.troops.filter(s=>s.at<=u.deathAt||s.value===0).sort((x,y)=>x.at-y.at);}
   u.status.push({at:D,alive:u.finalAlive,confusion:target?.confusion||0});
  });
 }
 const byId=new Map(plan.units.map(u=>[u.id,u]));
 plan.engagements=plan.engagements.map(e=>({...e,start:front,contact:front,visualContact:front,resolve:D*.82,end:finish,visualEnd:finish}));
 const important=a.events.filter(e=>['death','capital_fall','elimination','appointment'].includes(e.type));
 plan.eventTimes=new Map(a.events.map(e=>[e.index,D*.82]));
 for(const e of important){const frame=a.record.frames?.[e.index],dead=e.type==='death'&&plan.units.find(u=>u.deathAt!==undefined&&frame?.before.people.some(p=>p.id===u.id&&p.countryId===e.nationId&&p.slot===e.slot&&p.role===(e.role||'general')));plan.eventTimes.set(e.index,dead?dead.deathAt:D*(e.type==='capital_fall'?.88:e.type==='elimination'?.94:.92));}
 plan.holds=important.map(e=>({event:e,base:plan.eventTimes.get(e.index)})).sort((x,y)=>x.base-y.base||x.event.index-y.event.index).map((h,i)=>({...h,start:h.base+i*1600,end:h.base+(i+1)*1600}));
 plan.duration=D+plan.holds.length*1600;
 plan.cues=[];for(let t=front;t<finish;t+=800)plan.cues.push({at:t,id:'sword_clash',key:'free-clash:'+t});
 for(const c of commands)plan.cues.push({at:c.at,id:'ui_confirm',key:'command:'+c.side+':'+c.at});
}
