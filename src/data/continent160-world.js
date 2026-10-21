import { createReferenceWorld } from './reference-world.js';
import { continent160Layout } from '../model/continent160-layout.js';
export function createContinent160World(){const world=continent160Layout(createReferenceWorld());world.id='seven-realms-continent160';world.name='칠국의 대륙 · 160영토';world.description='첨부 continent_160.svg의 160영토·357개 인접 연결·21개 산악 · 장군당8영토·영토당5만 상한·2영토당1만 생산';return world;}
