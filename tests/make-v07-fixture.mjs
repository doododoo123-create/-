import { mkdir, writeFile } from 'node:fs/promises';
import { createReferenceWorld } from '../src/data/reference-world.js';
import { createRun, nextTurn } from '../src/engine/simulation.js';
import { saveRun } from '../src/storage/run-store.js';
import { serializeWorld } from '../src/storage/world-store.js';
import { unitMarkers } from '../src/ui/atlas-view.js';
const world = createReferenceWorld(), expected = {};world.rules.fieldCommand=false;world.rules.troopRounding='soldier';
let run = createRun(world, 123456);
for (let i = 0; i < 110; i++) {
  run = nextTurn(run);
  if ([1, 15].includes(run.turn)) expected[run.turn] = {
    owners: run.world.territories.map(t => [t.id, t.ownerId]),
    units: unitMarkers(run.world).map(u => ({ id: u.person.id, troops: u.troops, camp: u.territory.id })),
  };
}
let saved;
saveRun({setItem: (_, value) => {saved = JSON.parse(value);}}, run);
await mkdir(new URL('../.artifacts/', import.meta.url), {recursive:true});
await writeFile(new URL('../.artifacts/v07-browser-fixture.json', import.meta.url), JSON.stringify({world:JSON.parse(serializeWorld(world)), run:saved, expected}));
