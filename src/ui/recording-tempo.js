export function recordingDuration(scene,speed=1){
 const s=Math.max(1,speed);
 if(scene?.entryLocation)return s*Math.max(.35,.5*2/s)*1000;
 if(scene?.entryMarch)return s*Math.max(.7,1.2*2/s)*1000;
 if(scene?.batchRetreat)return s*Math.max(.8,1.2*2/s)*1000;
 if(scene?.massRecap)return s*(scene.kind==='capture'?Math.max(1,scene.captureSteps||1):1)*Math.max(scene.kind==='capture'?.55:.7,(scene.kind==='capture'?.85:1.1)*2/s)*1000;
 return null;
}
