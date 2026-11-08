// Viewer-only selection. Missing turns are restored by replayTurn, never simulated here.
export function selectedTurnQueue(selected,history,pending=null){
 const completed=new Set(history.filter(r=>r.turn!==pending).map(r=>r.turn));
 return [...new Set([...selected].map(Number))].filter(t=>Number.isInteger(t)&&completed.has(t)).sort((a,b)=>a-b);
}
export function nextReplayTurn(session){
 if(session.queue){const index=session.queue.indexOf(session.turn);return index<0?null:session.queue[index+1]??null;}
 return session.turn<session.endTurn?session.turn+1:null;
}
