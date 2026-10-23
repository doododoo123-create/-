export function calendarAtRound(round=1){
 const index=Math.max(0,Math.floor(Number(round)||1)-1),seasonIndex=index%4,season=['봄','여름','가을','겨울'][seasonIndex],year=Math.floor(index/4)+1;
 return {year,season,seasonIndex,label:`${year}년차 ${season}`};
}
