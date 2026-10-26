import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoWorld } from '../src/data/demo-world.js';
import { validateWorld, removeCountry, blankWorld, landCount, neighbors } from '../src/model/world.js';
import { serializeWorld, parseWorld, saveWorld, loadWorld, STORAGE_KEY, fileName } from '../src/storage/world-store.js';

test('original example is data-driven: seven countries, 49 people, 80 territories', () => {
  const world = validateWorld(createDemoWorld());
  assert.equal(world.countries.length, 7); assert.equal(world.people.length, 49); assert.equal(world.territories.length, 80);
  assert.deepEqual(world.countries.map(c => landCount(world, c.id)), [20, 16, 13, 11, 9, 7, 4]);
});
test('world export/import preserves all edited entities and rules', () => {
  const world = createDemoWorld(); world.name = '가상 대륙'; world.territories[0].name = '서울'; world.territories[0].ownerId = null;
  world.rules.recruitGain = 12; world.people[0].name = '새 국왕';
  assert.deepEqual(parseWorld(serializeWorld(world)), validateWorld(world));
});
test('country deletion preserves people and clears their ownership references', () => {
  const original = createDemoWorld(), next = removeCountry(original, 'nation-0');
  assert.equal(next.countries.length, 6); assert.equal(next.people.length, 49);
  assert.equal(next.people.filter(p => p.countryId === null).length, 7);
  assert.equal(next.territories.filter(t => t.ownerId === null).length, 20);
  assert.equal(original.countries.length, 7); assert.equal(landCount(original, 'nation-0'), 20);
});
test('blank worlds have variable dimensions and work without countries', () => {
  const world = validateWorld(blankWorld({ name: '새 대륙', rows: 3, cols: 4 }));
  assert.equal(world.territories.length, 12); assert.equal(world.countries.length, 0);
  assert.equal(neighbors(world, world.territories[0]).length, 2);
  assert.equal(neighbors(world, world.territories[5]).length, 4);
});
test('rejects unsupported/malformed files and accepts valid world JSON beyond the former5MiB gate', () => {
  assert.throws(() => parseWorld('invalid'), /JSON/);
  assert.throws(() => parseWorld('{}'), /세계 JSON/);
  assert.throws(() => parseWorld('x'.repeat(5 * 1024 * 1024 + 1)), /JSON/);
  assert.equal(parseWorld(' '.repeat(6*1024*1024)+serializeWorld(createDemoWorld())).countries.length,7);
  const world = createDemoWorld(); world.schemaVersion = 10; assert.throws(() => validateWorld(world), /버전/);
});
test('rejects duplicate IDs, coordinates, foreign ownership and color injection', () => {
  const cases = [
    [w => w.countries.push(w.countries[0]), /중복/],
    [w => w.people.push({ ...w.people[1], id: 'other-minister' }), /1명/],
    [w => w.territories[0].ownerId = 'missing', /존재하지/],
    [w => w.territories[1].col = w.territories[0].col, /중복/],
    [w => w.countries[0].color = 'red; background: url(x)', /색/],
    [w => w.countries[0].troops = -1, /병력/],
    [w => w.rules.domesticThresholds.balanced = 1000, /내정 구간/],
    [w => w.rules.lossRates.win = Infinity, /손실률/],
    [w => w.territories.pop(), /영토 수/],
  ];
  for (const [mutate, pattern] of cases) { const world = createDemoWorld(); mutate(world); assert.throws(() => validateWorld(world), pattern); }
});
test('unknown imported properties never survive normalization', () => {
  const world = createDemoWorld(); world.executable = 'evil'; world.countries[0].extra = 123;
  assert.equal(validateWorld(world).executable, undefined); assert.equal(validateWorld(world).countries[0].extra, undefined);
});
test('browser storage supports round trip and reports storage failures', () => {
  const store = new Map(), storage = { setItem: (k, v) => store.set(k, v), getItem: k => store.get(k) || null };
  assert.equal(loadWorld(storage), null);
  saveWorld(storage, createDemoWorld()); assert.ok(store.has(STORAGE_KEY)); assert.deepEqual(loadWorld(storage), createDemoWorld());
  assert.throws(() => saveWorld({ setItem() { throw new DOMException('full', 'QuotaExceededError'); } }, createDemoWorld()), /파일로 내보내/);
  assert.equal(fileName('a/b:c*?"d<e>|'), 'a_b_c___d_e__');
});
