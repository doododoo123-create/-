import { esc } from './icons.js';
import { PERSONALITIES, MINISTER_STYLES } from '../model/world.js';
const ruleField=(name,label,value,min,max,help='',step=1)=>`<label>${label}<input type="number" name="${name}" value="${value}" min="${min}" max="${max}" step="${step}" required><small>${help}</small></label>`;
export function armyBandRow(pair,i){return `<tr><td><input aria-label="병력 배율 ${i+1}" name="army-ratio-${i}" type="number" min="1.001" max="1000" step=".001" value="${pair[0]}" required></td><td><input aria-label="병력 점수 ${i+1}" name="army-score-${i}" type="number" min="0" max="100" value="${pair[1]}" required></td><td><button type="button" class="button subtle" data-action="remove-army-band" data-id="${i}">삭제</button></td></tr>`;}
export function renderRulesEditor(r){
 const f=ruleField;
 return `<div class="notice">전투 D30 점수 가산 · 원본 v11 선택 가능 · 변경한 규칙은 새 실행부터 적용됩니다.</div><form id="rules-form"><div class="rules-grid">
 <section class="panel rules-section rules-combat"><h2>전투 판정</h2><label>전투 방식<select name="battleMode"><option value="additive30" ${r.battleMode==='additive30'?'selected':''}>D30 + 병력 + 장군 + 전적 + 지형</option><option value="v11" ${r.battleMode==='v11'?'selected':''}>원본 v11 D10</option></select></label><p>높은 최종 점수가 승리합니다. 동점은 무승부이며 기적·추가 역전 판정은 없습니다.</p>
 <div class="fields-two">${f('combatSides','전투 주사위 눈금',r.combatSides,10,60)}${f('mountainBonus','산악 방어 보정',r.mountainBonus,0,50)}${f('experiencePerWin','실전 1승당 전적 보정',r.experiencePerWin,0,10)}${f('experienceCap','전적 보정 상한',r.experienceCap,0,50)}${f('capture-0','2개 영토 점령: 점수 차 이상',r.captureThresholds[0],1,200)}${f('capture-1','3개 영토 점령: 점수 차 이상',r.captureThresholds[1],1,200)}</div>
 <h3>병력이 많은 쪽의 가산점</h3><p>실제 맞붙는 부대 병력을 비교합니다. 각 배율 이상일 때 적용하며 큰 구간부터 판정합니다.</p><table><thead><tr><th>상대 대비 배율 이상</th><th>추가 점수</th><th></th></tr></thead><tbody id="army-bands">${r.armyBands.map(armyBandRow).join('')}</tbody></table><button type="button" data-action="add-army-band" class="button outline">보정 구간 추가</button>
 <h3>손실 · 기준 병력 1만 명당</h3><p>양측 중 적은 병력을 기준으로 명 단위 계산합니다. 살아남은 패잔병은 영토 상실 시 남은 자국 주둔지로 이동합니다.</p><div class="fields-two">${[['narrow','근소승'],['clear','확실한 승리'],['rout','압승'],['draw','무승부']].map(([key,label])=>r.combatLosses[key].map((v,i)=>f(`combat-loss-${key}-${i}`,`${label} · ${key==='draw'?(i?'수비':'공격'):(i?'패자':'승자')} 손실(명)`,Math.round(v*10000),0,10000)).join('')).join('')}</div></section>
 <section class="panel rules-section"><h2>국왕의 행동 · D10</h2><p>눈금 이하 내정, 초과 전쟁. 공격 가능한 상대가 없으면 다시 굴립니다.</p><div class="fields-three">${Object.entries(PERSONALITIES).map(([k,v])=>f(`threshold-${k}`,v,r.domesticThresholds[k],0,10)).join('')}</div>${f('successTarget','승상 실행 성공 기준',r.successTarget,1,12)}<h2>승상 행동 선택 · D10</h2>${Object.entries(MINISTER_STYLES).map(([k,v])=>`<h3>${esc(v)}</h3><div class="fields-three">${['모병','충원','보급'].map((label,i)=>f(`weight-${k}-${i}`,label,r.ministerWeights[k][i],0,10)).join('')}</div>`).join('')}</section>
 <section class="panel rules-section"><h2>병력 · 지휘한도 · 보급</h2><div class="fields-two">${[['recruitGain','모병 성공: 수도 예비병 증가'],['productionGain','충원 강화: 라운드 추가 생산'],['supplyGain','보급 강화: 장군 한도 증가'],['baseCapacity','장군 기본 지휘한도'],['minimumReserve','수도에 남길 예비병'],['territoryProduction','영토당 라운드 생산']].map(([key,label])=>f(key,label,r[key],key==='baseCapacity'?1:0,10000)).join('')}</div><label><input type="checkbox" name="seaSupply" ${r.seaSupply?'checked':''}> 바다를 통한 보급 연결</label><p>같은 바다와 자국 육지를 통해 수도에 연결되면 충원을 받습니다. 해상 보급은 공격 범위를 넓히지 않습니다.</p>${f('roundLimit','제한 라운드',r.roundLimit,1,100)}</section>
 <section class="panel rules-section"><h2>원본 v11 전투 설정</h2><p>이 항목은 원본 D10 전투에서만 사용합니다.</p>${f('armyAdvantageBonus','원본 부대 병력 우세 보정',r.armyAdvantageBonus,0,10)}<div class="fields-three">${['win','tie','loss'].map((k,i)=>f(`loss-${k}`,['승리 손실률','무승부 손실률','패배 손실률'][i],Math.round(r.lossRates[k]*100),0,100)).join('')}</div><p>국왕·승상 판정과 후임 대기 3턴은 유지합니다. D30 전투의 장군 능력은 인물 화면에서 −4~+4로 편집합니다.</p></section></div>
 <div class="form-footer"><button type="button" data-action="reset-rules" class="button outline">원본 v11 기본값 복원</button><button type="button" data-action="modern-rules" class="button outline">새 D30 기본값 적용</button><button type="submit" class="button primary">규칙 저장</button></div></form>`;
}
export function rulesFromForm(data,base){
 const r=structuredClone(base);
 for(const k of ['successTarget','recruitGain','productionGain','territoryProduction','armyAdvantageBonus','roundLimit','supplyGain','baseCapacity','minimumReserve','combatSides','mountainBonus','experiencePerWin','experienceCap'])r[k]=Number(data.get(k));
 r.battleMode=data.get('battleMode');r.seaSupply=data.has('seaSupply');r.diceSides=10;
 for(const k of Object.keys(MINISTER_STYLES))r.ministerWeights[k]=[0,1,2].map(i=>Number(data.get(`weight-${k}-${i}`)));
 for(const k of Object.keys(PERSONALITIES))r.domesticThresholds[k]=Number(data.get(`threshold-${k}`));
 for(const k of ['win','tie','loss'])r.lossRates[k]=Number(data.get(`loss-${k}`))/100;
 r.armyBands=[];for(let i=0;data.has(`army-ratio-${i}`);i++)r.armyBands.push([Number(data.get(`army-ratio-${i}`)),Number(data.get(`army-score-${i}`))]);
 r.captureThresholds=[0,1].map(i=>Number(data.get(`capture-${i}`)));
 r.combatLosses=Object.fromEntries(['narrow','clear','rout','draw'].map(k=>[k,[0,1].map(i=>Number(data.get(`combat-loss-${k}-${i}`))/10000)]));return r;
}
