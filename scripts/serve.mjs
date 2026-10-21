import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg', '.md': 'text/plain; charset=utf-8' };
const port = Number(process.env.PORT || 3000);
const server = createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end('Method not allowed'); return; }
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    const rel = relative(root, file);
    if (rel.startsWith(`..${sep}`) || rel === '..' || rel.split(sep).some(part => part.startsWith('.')) || rel === 'AGENTS.md') { res.writeHead(403); res.end('Forbidden'); return; }
    if (!(await stat(file)).isFile()) throw new Error('Not a file');
    const content = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Content-Length': content.length, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('파일을 찾을 수 없습니다.'); }
});
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `${port}번 포트를 사용 중입니다. 기존 실행 창을 닫거나 PORT 환경변수를 바꿔 주세요.` : error.message); process.exitCode = 1; });
server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`사국쟁패 Studio v0.12.0 실행 중\n브라우저 주소: http://localhost:${port}\n종료: Ctrl+C`));
