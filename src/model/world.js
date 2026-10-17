export const SCHEMA_VERSION = 1;
export const PERSONALITIES = { balanced: '균형형', peaceful: '내정형', aggressive: '호전형' };
export const ROLES = { king: '국왕', minister: '승상', general: '장군' };
export const DEFAULT_RULES = Object.freeze({
  diceSides: 10, domesticThresholds: { balanced: 5, peaceful: 7, aggressive: 3 },
  successTarget: 6, recruitGain: 3, productionGain: 3, territoryProduction: 1,
  armyAdvantageBonus: 1, lossRates: { win: 0.3, tie: 0.4, loss: 0.5 }, roundLimit: 30,
});
export const clone = value => structuredClone(value);
export const newId = prefix => `${prefix}-${globalThis.crypto.randomUUID()}`;
export const landCount = (world, id) => world.territories.filter(t => t.ownerId === id).length;
export const findCountry = (world, id) => world.countries.find(c => c.id === id);
export const countryPeople = (world, id) => world.people.filter(p => p.countryId === id);
export const totalTroops = world => world.countries.reduce((sum, c) => sum + c.troops, 0);
export const production = (world, country) => landCount(world, country.id) * world.rules.territoryProduction + country.recruitment;
export function neighbors(world, territory) {
  return world.territories.filter(t => Math.abs(t.row - territory.row) + Math.abs(t.col - territory.col) === 1);
}
export function blankWorld({ name = '이름 없는 세계', rows = 8, cols = 10 } = {}) {
  return {
    schemaVersion: SCHEMA_VERSION, id: newId('world'), name, description: '나만의 역사를 시작할 새로운 세계', rows, cols,
    countries: [], people: [], rules: clone(DEFAULT_RULES),
    territories: Array.from({ length: rows * cols }, (_, i) => ({ id: `tile-${i}`, row: Math.floor(i / cols), col: i % cols, name: `영토 ${i + 1}`, ownerId: null })),
  };
}

// Imported data is reconstructed field by field; unrecognized fields never enter application state.
export function validateWorld(input) {
  const fail = message => { throw new Error(message); };
  const object = (v, label) => { if (!v || typeof v !== 'object' || Array.isArray(v)) fail(`${label} 형식이 올바르지 않습니다.`); return v; };
  const text = (v, label, max = 80) => { if (typeof v !== 'string' || !v.trim() || v.length > max) fail(`${label}: 1~${max}자로 입력해 주세요.`); return v.trim(); };
  const number = (v, label, min, max, integer = true) => { if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) fail(`${label}: ${min}~${max} 범위의 ${integer ? '정수' : '숫자'}가 필요합니다.`); return v; };
  const array = (v, label, max) => { if (!Array.isArray(v) || v.length > max) fail(`${label} 형식 또는 개수를 확인해 주세요.`); return v; };
  const id = (v, label) => text(v, label, 100);
  const unique = (items, label) => { if (new Set(items).size !== items.length) fail(`${label}가 중복되었습니다.`); };
  object(input, '세계');
  if (input.schemaVersion !== SCHEMA_VERSION) fail('지원하지 않는 세계 파일 버전입니다. Studio v0.1 세계 JSON 파일을 선택해 주세요.');
  const rows = number(input.rows, '지도 세로', 2, 20), cols = number(input.cols, '지도 가로', 2, 24);
  const countries = array(input.countries, '국가 목록', 100).map(c => {
    object(c, '국가');
    if (!/^#[0-9a-f]{6}$/i.test(c.color)) fail('국가 색은 #RRGGBB 형식이어야 합니다.');
    if (!Object.hasOwn(PERSONALITIES, c.personality)) fail('국가 성향이 올바르지 않습니다.');
    return { id: id(c.id, '국가 ID'), name: text(c.name, '국가명', 40), color: c.color, troops: number(c.troops, '병력', 0, 1000000), recruitment: number(c.recruitment, '추가 충원량', 0, 10000), personality: c.personality };
  });
  unique(countries.map(c => c.id), '국가 ID');
  const countryIds = new Set(countries.map(c => c.id));
  const owner = (value, label) => { if (value !== null && !countryIds.has(value)) fail(`${label}가 존재하지 않는 국가를 가리킵니다.`); return value; };
  const people = array(input.people, '인물 목록', 2000).map(p => {
    object(p, '인물');
    if (!Object.hasOwn(ROLES, p.role) || !Object.hasOwn(PERSONALITIES, p.personality)) fail('인물 직책 또는 성향이 올바르지 않습니다.');
    return { id: id(p.id, '인물 ID'), name: text(p.name, '인물명', 40), countryId: owner(p.countryId, '인물 소속'), role: p.role, ability: number(p.ability, '능력 보정', -5, 5), personality: p.personality };
  });
  unique(people.map(p => p.id), '인물 ID');
  for (const c of countries) for (const role of ['king', 'minister']) {
    if (people.filter(p => p.countryId === c.id && p.role === role).length > 1) fail(`${c.name}의 ${ROLES[role]}은 1명만 둘 수 있습니다.`);
  }
  const territories = array(input.territories, '영토 목록', 480).map(t => {
    object(t, '영토');
    return { id: id(t.id, '영토 ID'), row: number(t.row, '영토 행', 0, rows - 1), col: number(t.col, '영토 열', 0, cols - 1), name: text(t.name, '영토명', 24), ownerId: owner(t.ownerId, '영토 소유국') };
  });
  if (territories.length !== rows * cols) fail('지도 크기와 영토 수가 일치하지 않습니다.');
  unique(territories.map(t => t.id), '영토 ID');
  unique(territories.map(t => `${t.row},${t.col}`), '영토 좌표');
  territories.sort((a, b) => a.row - b.row || a.col - b.col);
  const r = object(input.rules, '규칙'), thresholds = object(r.domesticThresholds, '성향별 내정 구간'), losses = object(r.lossRates, '손실률');
  const diceSides = number(r.diceSides, '주사위 면 수', 2, 100);
  const rules = {
    diceSides, domesticThresholds: Object.fromEntries(Object.keys(PERSONALITIES).map(k => [k, number(thresholds[k], `${PERSONALITIES[k]} 내정 구간`, 0, diceSides)])),
    successTarget: number(r.successTarget, '내정 성공 기준', 1, diceSides + 5),
    recruitGain: number(r.recruitGain, '모병 성공 병력', 0, 10000), productionGain: number(r.productionGain, '충원 강화 증가량', 0, 10000),
    territoryProduction: number(r.territoryProduction, '영토당 생산', 0, 10000), armyAdvantageBonus: number(r.armyAdvantageBonus, '병력 우세 보정', 0, 10),
    lossRates: Object.fromEntries(['win', 'tie', 'loss'].map(k => [k, number(losses[k], '손실률', 0, 1, false)])), roundLimit: number(r.roundLimit, '제한 라운드', 1, 1000),
  };
  return { schemaVersion: SCHEMA_VERSION, id: id(input.id, '세계 ID'), name: text(input.name, '세계 이름'), description: typeof input.description === 'string' ? input.description.slice(0, 300) : '', rows, cols, countries, people, territories, rules };
}
export function removeCountry(world, countryId) {
  const next = clone(world);
  next.countries = next.countries.filter(c => c.id !== countryId);
  next.people.forEach(p => { if (p.countryId === countryId) p.countryId = null; });
  next.territories.forEach(t => { if (t.ownerId === countryId) t.ownerId = null; });
  return validateWorld(next);
}
