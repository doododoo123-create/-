import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
async function walk(path) { const out = []; for (const entry of await readdir(path, { withFileTypes: true })) { const full = resolve(path, entry.name); if (entry.isDirectory()) out.push(...await walk(full)); else if (/\.(m?js)$/.test(entry.name)) out.push(full); } return out; }
const files = (await Promise.all(['src', 'scripts', 'tests'].map(p => walk(resolve(root, p))))).flat();
for (const file of files) { const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' }); if (result.status !== 0) process.exit(result.status || 1); }
console.log(`${files.length}개 JavaScript 파일 구문 검사 통과`);
