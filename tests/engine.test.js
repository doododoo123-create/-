import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoWorld } from '../src/data/demo-world.js';
import { blankWorld, DEFAULT_RULES, clone, landCount } from '../src/model/world.js';
import { createRun, nextTurn, casualty, currentActor, borderTargets, livingCountries } from '../src/engine/simulation.js';
import { randomInt, roll } from '../src/engine/random.js';
function smallWorld() {
  const world = blankWorld({ name: '검증 세계', rows: 2, cols: 2 });
  world.countries = ['a', 'b'].map((id, i) => ({ id, name: id, color: ['#112233', '#445566'][i], troops: 10, recruitment: 0, personality: 'balanced' }));
  world.territories.forEach((t, i) => { t.ownerId = i % 2 === 0 ? 'a' : 'b'; });
  return world;
}
function play(world, seed) { let run = createRun(world, seed); for (let i = 0; i < 5000 && !run.result; i++) run = nextTurn(run); assert.ok(run.result); return run; }

test('same world and seed produce identical complete histories and states', () => {
  const a = play(createDemoWorld(), '역사-1'), b = play(createDemoWorld(), '역사-1');
  assert.deepEqual(a, b); assert.ok(a.turn > 0); assert.equal(a.round, 30);
  const c = play(createDemoWorld(), '역사-2'); assert.notDeepEqual(a.history, c.history);
});
test('step does not mutate the editor world or preceding run', () => {
  const world = smallWorld(), before = clone(world), run = createRun(world, 'test'), snapshot = clone(run);
  const stepped = nextTurn(run); assert.deepEqual(run, snapshot); assert.deepEqual(world, before); assert.equal(stepped.turn, 1);
  world.countries[0].name = 'edited'; assert.equal(stepped.world.countries[0].name, 'a');
});
test('zero or one landed nation cannot start a simulation', () => {
  const world = smallWorld(); world.territories.forEach(t => { t.ownerId = 'a'; });
  assert.throws(() => createRun(world), /2개 이상/);
  assert.throws(() => createRun(blankWorld()), /2개 이상/);
});
test('every living country acts once per round, then all receive production', () => {
  const world = smallWorld(); world.rules.domesticThresholds = { balanced: 10, peaceful: 10, aggressive: 10 };
  world.rules.recruitGain = 0; world.rules.productionGain = 0;
  world.countries[0].recruitment = 3;
  let run = createRun(world, 'round'); run = nextTurn(run);
  assert.equal(run.round, 1); assert.equal(currentActor(run).id, 'b'); assert.equal(run.history[0].production.length, 0);
  run = nextTurn(run); assert.equal(run.round, 2); assert.equal(currentActor(run).id, 'a');
  assert.equal(run.world.countries[0].troops, 15); assert.equal(run.world.countries[1].troops, 12);
  assert.equal(run.history[1].production.length, 2);
});
test('king personality takes priority over country personality', () => {
  const world = smallWorld(); world.rules.domesticThresholds.balanced = 0; world.rules.domesticThresholds.peaceful = 10;
  world.people.push({ id: 'king', name: '왕', countryId: 'a', role: 'king', ability: 5, personality: 'peaceful' });
  assert.equal(nextTurn(createRun(world, 'king')).history[0].type, 'domestic');
});
test('minister ability changes domestic success; absent roles use zero bonus', () => {
  const world = smallWorld(); world.rules.domesticThresholds.balanced = 10; world.rules.successTarget = 11;
  world.people.push({ id: 'minister', name: '승상', countryId: 'a', role: 'minister', ability: 5, personality: 'balanced' });
  let compared = 0;
  for (let seed = 0; seed < 20; seed++) {
    const withPerson = nextTurn(createRun(world, seed)); const noPeople = clone(world); noPeople.people = [];
    const withoutPerson = nextTurn(createRun(noPeople, seed));
    assert.equal(withoutPerson.history[0].success, false);
    if (withPerson.history[0].success) compared++;
  }
  assert.ok(compared > 0);
});
test('neutral borders can be occupied without battle rolls or losses', () => {
  const world = smallWorld(); world.territories[1].ownerId = null; world.rules.domesticThresholds.balanced = 0;
  let exercised = false;
  for (let seed = 0; seed < 30; seed++) {
    const run = nextTurn(createRun(world, seed)), record = run.history[0];
    if (record.targetId === world.territories[1].id) {
      exercised = true; assert.equal(record.rolls.length, 1); assert.equal(run.world.countries[0].troops, 10); assert.equal(run.world.territories[1].ownerId, 'a'); break;
    }
  }
  assert.ok(exercised);
});
test('loss formula uses simultaneous starting armies and honors zero loss rates', () => {
  assert.equal(casualty(20, 12, 0.3), 5); assert.equal(casualty(12, 20, 0.5), 8);
  assert.equal(casualty(1, 1, 0.3), 1); assert.equal(casualty(0, 10, 0.3), 0); assert.equal(casualty(10, 10, 0), 0);
  assert.equal(casualty(1, 1000000, 1), 1);
});
test('unification skips eliminated countries, clears their remaining troops and terminates', () => {
  const world = smallWorld(); world.territories[3].ownerId = 'a'; world.countries[1].troops = 0; world.rules.domesticThresholds.balanced = 0;
  const run = nextTurn(createRun(world, 'capture'));
  assert.equal(run.result.reason, 'unification'); assert.deepEqual(run.result.winnerIds, ['a']);
  assert.deepEqual(run.history[0].eliminatedIds, ['b']); assert.equal(run.world.countries[1].troops, 0);
  assert.equal(livingCountries(run.world).length, 1); assert.equal(currentActor(run), null);
  assert.deepEqual(nextTurn(run), run);
});
test('round limit terminates after production; exact tie yields joint winners', () => {
  const world = smallWorld(); world.rules.roundLimit = 1; world.rules.domesticThresholds.balanced = 10;
  world.rules.recruitGain = 0; world.rules.productionGain = 0;
  const run = play(world, 'tie'); assert.equal(run.turn, 2); assert.equal(run.round, 1);
  assert.equal(run.result.reason, 'limit'); assert.deepEqual(run.result.winnerIds, ['a', 'b']);
  assert.equal(run.world.countries[0].troops, 12); assert.equal(run.world.countries[1].troops, 12);
});
test('zero-army nations use domestic actions; only cardinal border cells are targets', () => {
  const world = smallWorld(); world.countries[0].troops = 0; world.rules.domesticThresholds.balanced = 0;
  assert.equal(nextTurn(createRun(world, 'zero')).history[0].type, 'domestic');
  world.territories.forEach((t, i) => { t.ownerId = i === 0 ? 'a' : 'b'; });
  assert.deepEqual(borderTargets(world, 'a').map(t => t.id), ['tile-1', 'tile-2']);
});
test('non-D10 dice and changed rules complete; invariants hold for multiple seeds', () => {
  for (let seed = 0; seed < 12; seed++) {
    const world = smallWorld(); world.rules = { ...clone(DEFAULT_RULES), diceSides: 6, successTarget: 4, domesticThresholds: { balanced: 3, peaceful: 4, aggressive: 2 }, roundLimit: 10 };
    const run = play(world, seed);
    assert.equal(run.world.territories.length, 4);
    for (const country of run.world.countries) assert.ok(Number.isInteger(country.troops) && country.troops >= 0);
    for (const record of run.history) for (const die of record.rolls) assert.ok(die.value >= 1 && die.value <= 6);
    assert.ok(run.turn <= 20);
  }
});
test('ten nations work without hard-coded country count or person requirements', () => {
  const world = blankWorld({ rows: 2, cols: 5 });
  world.countries = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, name: `국가${i}`, color: '#aabbcc', troops: 10, recruitment: 1, personality: 'balanced' }));
  world.territories.forEach((t, i) => { t.ownerId = `c${i}`; }); world.rules.roundLimit = 2;
  const run = play(world, 'ten'); assert.ok(run.turn > 1); assert.equal(run.world.countries.length, 10);
});
test('dice generator is bounded and repeatable', () => {
  const a = { rng: 123 }, b = { rng: 123 };
  for (let i = 0; i < 1000; i++) { const v = roll(a, 10); assert.equal(v, roll(b, 10)); assert.ok(v >= 1 && v <= 10); }
  assert.throws(() => randomInt(a, 0), /후보/);
});

test('countries without starting territory do not retain armies in a run', () => {
  const world = smallWorld(); world.countries.push({ id: 'c', name: '대기국', color: '#abcdef', troops: 100, recruitment: 5, personality: 'balanced' });
  const run = createRun(world, 'landless');
  assert.equal(run.world.countries[2].troops, 0); assert.equal(world.countries[2].troops, 100);
  assert.deepEqual(run.schedule, ['a', 'b']);
});
