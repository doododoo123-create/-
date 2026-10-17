import { clone, validateWorld, landCount, countryPeople, neighbors, production } from '../model/world.js';
import { seedNumber, randomInt, roll } from './random.js';
export const ENGINE_VERSION = 'studio-0.1';
export const livingCountries = world => world.countries.filter(c => landCount(world, c.id) > 0);
export function createRun(definition, seed = '20261017') {
  const world = validateWorld(definition);
  if (livingCountries(world).length < 2) throw new Error('영토를 가진 국가가 2개 이상 필요합니다. 지도에서 국가별 영토를 지정해 주세요.');
  for (const country of world.countries) if (!landCount(world, country.id)) country.troops = 0;
  return { engineVersion: ENGINE_VERSION, seed: String(seed), rng: seedNumber(seed), world, initialWorld: clone(world), round: 1, turn: 0, schedule: livingCountries(world).map(c => c.id), scheduleIndex: 0, history: [], result: null };
}
export function currentActor(run) {
  if (run.result) return null;
  return run.world.countries.find(c => c.id === run.schedule[run.scheduleIndex]) || null;
}
export function casualty(own, enemy, rate) {
  if (!own || !enemy || rate === 0) return 0;
  return Math.min(own, Math.max(1, Math.round(own * rate * (2 * enemy) / (own + enemy))));
}
function finish(run, reason) {
  let winners = livingCountries(run.world);
  if (reason === 'limit') {
    const mostLand = Math.max(...winners.map(c => landCount(run.world, c.id)));
    winners = winners.filter(c => landCount(run.world, c.id) === mostLand);
    const mostTroops = Math.max(...winners.map(c => c.troops));
    winners = winners.filter(c => c.troops === mostTroops);
  }
  run.result = { reason, winnerIds: winners.map(c => c.id), round: run.round, turn: run.turn };
}
function role(world, id, name) { return countryPeople(world, id).find(p => p.role === name); }
function general(world, id) {
  // Equal candidates follow persisted person order, not locale-dependent string sorting.
  return countryPeople(world, id).filter(p => p.role === 'general').reduce((best, p) => !best || p.ability > best.ability ? p : best, null);
}
export function borderTargets(world, countryId) {
  const own = new Set(world.territories.filter(t => t.ownerId === countryId).map(t => t.id));
  return world.territories.filter(t => t.ownerId !== countryId && neighbors(world, t).some(n => own.has(n.id)));
}
export function nextTurn(input) {
  if (input.result) return clone(input);
  const run = { ...input, world: clone(input.world), schedule: [...input.schedule], history: [...input.history] };
  const world = run.world, rules = world.rules, actor = currentActor(run);
  if (!actor) throw new Error('행동할 국가를 찾을 수 없습니다. 새 실행을 시작해 주세요.');
  const record = { turn: ++run.turn, round: run.round, actorId: actor.id, actorName: actor.name, color: actor.color, type: 'domestic', title: '', detail: '', rolls: [], changes: [], production: [], eliminatedIds: [] };
  const die = label => { const value = roll(run, rules.diceSides); record.rolls.push({ label, value, sides: rules.diceSides }); return value; };
  const king = role(world, actor.id, 'king'), personality = king?.personality || actor.personality;
  const actionDie = die(king ? `${king.name} · 행동` : '국가 행동');
  const targets = actor.troops > 0 ? borderTargets(world, actor.id) : [];
  const domestic = actionDie <= rules.domesticThresholds[personality] || !targets.length;
  if (domestic) {
    const minister = role(world, actor.id, 'minister'), action = randomInt(run, 2) === 0 ? 'recruit' : 'production';
    const value = die(minister ? `${minister.name} · 내정` : '내정 실행'), ability = minister?.ability || 0, score = value + ability;
    const success = score >= rules.successTarget;
    const actionName = action === 'recruit' ? '모병' : '충원 강화';
    record.title = `${actor.name}, ${actionName} ${success ? '성공' : '실패'}`;
    record.detail = `${value} ${ability < 0 ? '−' : '+'} ${Math.abs(ability)} = ${score}점 · ${rules.successTarget}점 이상 성공.`;
    if (!targets.length && actionDie > rules.domesticThresholds[personality]) record.detail += ' 공격할 수 없어 내정으로 전환했습니다.';
    if (success) {
      if (action === 'recruit') { actor.troops += rules.recruitGain; record.detail += ` 병력 +${rules.recruitGain}만.`; }
      else { actor.recruitment += rules.productionGain; record.detail += ` 라운드당 추가 충원 +${rules.productionGain}만.`; }
    }
    record.action = action; record.success = success;
  } else {
    const target = targets[randomInt(run, targets.length)], defender = world.countries.find(c => c.id === target.ownerId);
    record.type = 'war'; record.targetId = target.id; record.targetName = target.name; record.defenderId = defender?.id || null;
    const attackBefore = actor.troops, defenseBefore = defender?.troops || 0;
    let won = true, tied = false;
    if (defender && defenseBefore > 0) {
      const attackerGeneral = general(world, actor.id), defenderGeneral = general(world, defender.id);
      const attackRaw = die(attackerGeneral ? `${attackerGeneral.name} · 공격` : '공격');
      const defenseRaw = die(defenderGeneral ? `${defenderGeneral.name} · 방어` : '방어');
      const attackBonus = (attackerGeneral?.ability || 0) + (attackBefore > defenseBefore ? rules.armyAdvantageBonus : 0);
      const defenseBonus = (defenderGeneral?.ability || 0) + (defenseBefore > attackBefore ? rules.armyAdvantageBonus : 0);
      const attackScore = attackRaw + attackBonus, defenseScore = defenseRaw + defenseBonus;
      won = attackScore > defenseScore; tied = attackScore === defenseScore;
      const attackLoss = casualty(attackBefore, defenseBefore, rules.lossRates[won ? 'win' : tied ? 'tie' : 'loss']);
      const defenseLoss = casualty(defenseBefore, attackBefore, rules.lossRates[won ? 'loss' : tied ? 'tie' : 'win']);
      actor.troops -= attackLoss; defender.troops -= defenseLoss;
      record.battle = { attackRaw, defenseRaw, attackBonus, defenseBonus, attackScore, defenseScore, attackBefore, defenseBefore, attackLoss, defenseLoss };
      record.detail = `공격 ${attackScore}점 (${attackRaw}${attackBonus < 0 ? '' : '+'}${attackBonus}) · 방어 ${defenseScore}점 (${defenseRaw}${defenseBonus < 0 ? '' : '+'}${defenseBonus}). 병력 손실: ${actor.name} ${attackLoss}만 / ${defender.name} ${defenseLoss}만.`;
    } else {
      record.detail = defender ? '상대 국가의 병력이 없어 전투 없이 점령했습니다.' : '인접한 무주지를 전투 없이 편입했습니다.';
    }
    if (won) {
      const before = target.ownerId; target.ownerId = actor.id;
      record.changes.push({ territoryId: target.id, name: target.name, from: before, to: actor.id });
      record.title = `${actor.name}, ${target.name} ${defender ? '점령' : '편입'}`;
      if (defender && landCount(world, defender.id) === 0) {
        defender.troops = 0; record.eliminatedIds.push(defender.id); record.detail += ` ${defender.name} 멸망.`;
      }
    } else record.title = `${target.name} 전투 · ${tied ? '무승부' : `${defender.name} 방어 성공`}`;
    record.success = won;
  }
  run.scheduleIndex++;
  while (run.scheduleIndex < run.schedule.length && landCount(world, run.schedule[run.scheduleIndex]) === 0) run.scheduleIndex++;
  if (run.scheduleIndex >= run.schedule.length) {
    for (const country of livingCountries(world)) {
      const gain = production(world, country); country.troops += gain;
      record.production.push({ countryId: country.id, name: country.name, gain });
    }
    if (livingCountries(world).length <= 1) finish(run, 'unification');
    else if (run.round >= rules.roundLimit) finish(run, 'limit');
    else { run.round++; run.schedule = livingCountries(world).map(c => c.id); run.scheduleIndex = 0; }
  } else if (livingCountries(world).length <= 1) finish(run, 'unification');
  record.result = run.result ? clone(run.result) : null;
  run.history.push(record);
  return run;
}
