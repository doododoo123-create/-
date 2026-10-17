// A reproducible generator. UI animations must never use this generator.
export function seedNumber(seed) {
  const value = String(seed);
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash;
}
export function randomInt(state, max) {
  if (!Number.isInteger(max) || max < 1) throw new Error('추첨 후보가 없습니다.');
  state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
  return Math.floor((state.rng / 4294967296) * max);
}
export const roll = (state, sides) => 1 + randomInt(state, sides);
