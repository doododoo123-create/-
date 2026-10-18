export const UNIT_CARD_WIDTH=52,UNIT_CARD_HEIGHT=90;
// Deterministic display placement; station IDs and simulation coordinates stay unchanged.
export function arrangeUnits(units){
  const occupied=[];
  return units.map(unit=>{
    const anchor=[...unit.point],offsets=[[0,0],[-28,0],[28,0],[-55,0],[55,0],[0,-48],[0,48],[-28,-48],[28,-48],[-28,48],[28,48],[-55,-48],[55,-48],[-55,48],[55,48],[0,-96],[0,96],[-82,0],[82,0]];
    let best=null,bestScore=Infinity;
    for(const [dx,dy] of offsets){
      const x=Math.min(1168,Math.max(32,anchor[0]+dx)),y=Math.min(746,Math.max(54,anchor[1]+dy));
      const box={x:x-UNIT_CARD_WIDTH/2-3,y:y-UNIT_CARD_HEIGHT/2-3,w:UNIT_CARD_WIDTH+6,h:UNIT_CARD_HEIGHT+6};
      const overlap=occupied.reduce((sum,o)=>sum+Math.max(0,Math.min(box.x+box.w,o.x+o.w)-Math.max(box.x,o.x))*Math.max(0,Math.min(box.y+box.h,o.y+o.h)-Math.max(box.y,o.y)),0);
      const score=overlap*1000+Math.hypot(x-anchor[0],y-anchor[1]);if(score<bestScore){bestScore=score;best={point:[x,y],box};}if(!score)break;
    }
    occupied.push(best.box);return {...unit,point:best.point,anchorPoint:anchor};
  });
}
