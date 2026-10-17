import { readFileSync } from 'node:fs';
import vm from 'node:vm';
// Execute the two unchanged user-supplied scripts as a browser would.
// The reference implementation is independent of the Studio port.
export function referenceEngine(){
  const html=readFileSync(new URL('../docs/reference/legacy-play.html',import.meta.url),'utf8');
  const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  const context=vm.createContext({structuredClone});
  for(const name of ['SagukAtlas','SagukGame']){
    const source=scripts.find(s=>s.includes(`root.${name}=api`));
    if(!source)throw new Error(`Missing original ${name}`);vm.runInContext(source,context);
  }
  return context.SagukGame;
}
export const plain=v=>JSON.parse(JSON.stringify(v));
