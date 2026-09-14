import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createAccountApi } from './api';

if (!process.env.ONE_DAY_ORIGIN)
  throw new Error(
    '请设置 ONE_DAY_ORIGIN 为访问应用的完整来源，例如 https://todo.example.com',
  );
const origin = new URL(process.env.ONE_DAY_ORIGIN);
if (origin.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(origin.hostname))
  throw new Error('非本机部署必须使用 HTTPS');
const api = createAccountApi({ secureCookies: origin.protocol === 'https:' });
const root = resolve('dist');
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};
const server = createServer((req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    api.handle(req, res);
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end();
    return;
  }
  void (async () => {
    let path: string;
    try {
      path = resolve(root, `.${decodeURIComponent(pathname)}`);
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (path !== root && !path.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    let content: Buffer;
    try {
      content = await readFile(path);
    } catch {
      if (extname(path)) {
        res.writeHead(404).end();
        return;
      }
      path = resolve(root, 'index.html');
      content = await readFile(path);
    }
    res.setHeader('Content-Type', types[extname(path)] ?? 'application/octet-stream');
    res.setHeader(
      'Cache-Control',
      pathname.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.end(req.method === 'HEAD' ? undefined : content);
  })().catch(() => {
    res.writeHead(500).end('服务暂时不可用');
  });
});
server.listen(Number(process.env.PORT ?? 53028), process.env.HOST ?? '127.0.0.1', () =>
  console.log(`One Day listening on ${process.env.PORT ?? 53028}`),
);
const close = () => {
  server.close(() => {
    api.close();
    process.exit(0);
  });
};
process.once('SIGTERM', close);
process.once('SIGINT', close);
