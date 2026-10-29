// Screen-space card geometry; the battle icon stays on its territory anchor.
export function duelStacks({left,right,center,width,iconRadius=14,direction=-1,attack=1,defense=1,gap=12}){
 const spaces={left:center-left-iconRadius-gap-8,right:right-center-iconRadius-gap-8};
 const size=Math.min(width,Math.max(24,Math.min(spaces.left,spaces.right)));
 const side=(sign,count)=>{const available=sign<0?spaces.left:spaces.right,step=count>1?Math.max(0,Math.min(size*.75,(available-size)/(count-1))):0;return {sign,width:size,x:center+sign*(iconRadius+gap+size/2),step};};
 return {width:size,attack:side(direction,attack),defense:side(-direction,defense)};
}
