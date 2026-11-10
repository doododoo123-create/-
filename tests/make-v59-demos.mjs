import {mkdir,writeFile} from 'node:fs/promises';
import {tacticalStressFixture,tacticalFixture,tacticalPlans} from './tactical-v57-fixture.mjs';
import {massBattlePlan} from '../src/ui/mass-battle-plan.js';
await mkdir('.artifacts/v59',{recursive:true});
const cases=[{id:'one',label:'1만 대1만',countA:1,totalA:1,countB:1,totalB:1},{id:'five',label:'5지휘관5만 대3지휘관30만',countA:5,totalA:5,countB:3,totalB:30,attackLossQuanta:0,defenseLossQuanta:1},{id:'fifteen',label:'15지휘관60만 대1지휘관1만',countA:15,totalA:60,countB:1,totalB:1,winner:'b',attackLossQuanta:1,defenseLossQuanta:0}];
const index=[];for(const row of cases){const f=tacticalStressFixture(row),p=massBattlePlan(f.group,f.record);p.group={id:p.group.id,frontName:row.label+' · 표시 계층 검수'};await writeFile('.artifacts/v59/'+row.id+'.json',JSON.stringify(p));index.push({...row,duration:p.baseDuration,initialFigures:p.units.reduce((n,u)=>n+u.figures,0),field:p.story.field});}
for(const kind of ['normal','advance','counter','death']){const f=tacticalFixture(kind),p=tacticalPlans(f)[0];p.group={id:p.group.id,frontName:'기존 실제 기록 · '+kind};await writeFile('.artifacts/v59/'+kind+'.json',JSON.stringify(p));index.push({id:kind,label:kind,duration:p.baseDuration,initialFigures:p.units.reduce((n,u)=>n+u.figures,0),field:p.story.field});}
await writeFile('.artifacts/v59/index.json',JSON.stringify(index,null,2));console.log(JSON.stringify(index));
