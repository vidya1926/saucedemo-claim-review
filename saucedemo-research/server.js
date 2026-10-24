const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, 'public');
const port = Number(process.env.PORT || 4173);
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method not allowed');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    response.writeHead(400);
    response.end('Bad request path');
    return;
  }

  const fixturePath = '/fixtures/saucedemo-login-pair.json';
  const checkoutFixturePath = '/fixtures/backpack-checkout-pair.json';
  const analyzerPath = '/analyzer.js';
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const servesSpecialFile = requestedPath === fixturePath ||
    requestedPath === checkoutFixturePath ||
    requestedPath === analyzerPath;
  const filePath = requestedPath === fixturePath
    ? path.join(__dirname, 'fixtures', 'saucedemo-login-pair.json')
    : requestedPath === checkoutFixturePath
      ? path.join(__dirname, 'fixtures', 'backpack-checkout-pair.json')
    : requestedPath === analyzerPath
      ? path.join(__dirname, 'src', 'analyzer.js')
    : path.resolve(root, `.${requestedPath}`);
  if (!servesSpecialFile && !filePath.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500);
      response.end(error.code === 'ENOENT' ? 'Not found' : 'Unable to read requested file');
      return;
    }

    response.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : contents);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`SauceDemo claim-review visualizer: http://127.0.0.1:${port}`);
});
