// A presentation-only scale. Values above the die's maximum keep the deepest red.
export function diceColor(value,sides=10) {
  const amount=Number.isFinite(value)&&sides>1?Math.min(1,Math.max(0,(value-1)/(sides-1))):0;
  const start=[255,255,255],end=[255,65,57];
  return `rgb(${start.map((channel,i)=>Math.round(channel+(end[i]-channel)*amount)).join(', ')})`;
}
export function diceReel(sides=10) {
  return [4,7,2,9,1,6,3].map((face,i)=>{
    const value=1+(face-1)%sides;
    return `--face-${i+1}:'${value}';--face-color-${i+1}:${diceColor(value,sides)}`;
  }).join(';');
}
