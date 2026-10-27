import {writeFileSync,mkdirSync} from 'node:fs';
import {campaign28Fixture,campaign28Controls} from './campaign-v28-fixture.mjs';
import {createRun,nextTurn} from '../src/engine/simulation.js';
import {exportHistoryData} from '../src/storage/history-file.js';
const w=structuredClone(campaign28Fixture().initialWorld);Object.assign(w.rules,{fatiguePenalty:2,warReadiness:false,resetConfusionOnRest:false,captureThresholds:[40,60]});let run=createRun(w,777);const controls=campaign28Controls();for(const key of Object.keys(controls.rolls))if(key.startsWith('attack:'))controls.rolls[key]=30;controls.armyAssembly=true;run=nextTurn(run,controls);while(run.turn<3)run=nextTurn(run,{armyAssembly:true,rolls:{king:1,minister:1,domestic:1}});mkdirSync('.artifacts',{recursive:true});writeFileSync('.artifacts/v34-history.history.json',JSON.stringify(await exportHistoryData(run)));console.log('v34 fixtures: actual three-officer assembly, fatigue, three battles, exact portable history');
