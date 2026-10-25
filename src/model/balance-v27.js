// Missing switches are legacy, so old worlds and historical RNG remain unchanged.
export const BALANCE_V27_DEFAULTS=Object.freeze({warReadiness:false,territoryRecruitment:false,capitalDisruption:false,overCapacityDesertion:false,finishStrategy:false,royalDefense:false,restMargin:10,restTroops:2,restFraction:.5,confusionStep:2,confusionCap:6,extraRecruitmentRatio:1,capitalDisruptionRate:.5,capitalDisruptionSettlements:2,desertionRate:.25,finishPowerRatio:1.3,finishBands:[[4,60],[8,40],[12,20]],recoveryScorePerLand:4,recoveryScoreCap:20});
export const BALANCE_V27_SWITCHES=Object.freeze(['warReadiness','territoryRecruitment','capitalDisruption','overCapacityDesertion','finishStrategy','royalDefense']);
export function validateBalanceV27(raw,number,fail){
 const r={...BALANCE_V27_DEFAULTS,...raw},out={};
 for(const key of BALANCE_V27_SWITCHES){if(typeof r[key]!=='boolean')fail('밸런스 설정은 켜기 또는 끄기여야 합니다.');out[key]=r[key];}
 for(const [key,min,max,integer] of [['restMargin',1,200,true],['restTroops',0,10000,true],['restFraction',0,1,false],['confusionStep',0,100,true],['confusionCap',0,100,true],['extraRecruitmentRatio',0,10,false],['capitalDisruptionRate',0,1,false],['capitalDisruptionSettlements',1,20,true],['desertionRate',0,1,false],['finishPowerRatio',1,10,false],['recoveryScorePerLand',0,100,true],['recoveryScoreCap',0,1000,true]])out[key]=number(r[key],key,min,max,integer);
 if(!Array.isArray(r.finishBands)||r.finishBands.length!==3)fail('마무리 전략의 세 구간을 확인해 주세요.');
 out.finishBands=r.finishBands.map((a,i)=>{if(!Array.isArray(a)||a.length!==2)fail('마무리 전략 구간이 올바르지 않습니다.');const v=[number(a[0],'잔여 영토',1,480),number(a[1],'마무리 가산',0,1000)];if(i&&(v[0]<=r.finishBands[i-1][0]||v[1]>r.finishBands[i-1][1]))fail('잔여 영토는 증가,가산점은 감소 순서로 지정해 주세요.');return v;});return out;
}
