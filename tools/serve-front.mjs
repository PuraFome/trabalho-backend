#!/usr/bin/env node
// Pure Node static server for docs/ — zero dependencies
// Listens on port 4200, serves index.html for /, 404 for missing files

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const PROJECT_ROOT = __dirname.endsWith('/tools') ? resolve(__dirname, '..') : __dirname;
const DOCS_DIR = resolve(PROJECT_ROOT, 'docs');
const PORT = 4200;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
};

function getMimeType(filePath) {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

async function serveFile(res, filePath, statusCode = 200) {
  try {
    const content = await readFile(filePath);
    res.writeHead(statusCode, { 'Content-Type': getMimeType(filePath) });
    res.end(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
    } else {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('500 Internal Server Error');
    }
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = url.pathname;

  // Normalize: / -> /index.html, /dir/ -> /dir/index.html
  if (pathname.endsWith('/')) {
    pathname += 'index.html';
  }

  // Prevent directory traversal
  const requestedPath = resolve(DOCS_DIR, pathname.slice(1));
  if (!requestedPath.startsWith(DOCS_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('403 Forbidden');
  }

  await serveFile(res, requestedPath);
});

server.listen(PORT, () => {
  console.log(`Static server running at http://localhost:${PORT} (serving ${DOCS_DIR})`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} already in use`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});