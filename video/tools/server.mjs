// Minimal static server for the film page, KaTeX assets and app footage.
import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.wav': 'audio/wav',
};

export function serve(videoDir, port = 0) {
  const katex = path.resolve(videoDir, '../node_modules/katex/dist');
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file;
    if (url.startsWith('/katex/')) file = path.join(katex, url.slice(7));
    else file = path.join(videoDir, url);
    const base = url.startsWith('/katex/') ? katex : videoDir;
    if (!path.resolve(file).startsWith(base)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const st = statSync(file);
      if (!st.isFile()) throw new Error('not a file');
      res.writeHead(200, {
        'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
        'content-length': st.size,
        'cache-control': 'max-age=3600',
      });
      createReadStream(file).pipe(res);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      resolve({ port: server.address().port, close: () => server.close() });
    });
  });
}
