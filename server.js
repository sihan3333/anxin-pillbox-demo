// No dependencies. Node.js 18+. 仅在本机提供静态页面。
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const port = Number(process.env.PORT || 8776);
const files = { '/': 'index.html', '/index.html': 'index.html', '/demo.js': 'demo.js', '/demo.css': 'demo.css', '/product.html': 'product.html', '/review.html': 'review.html', '/style.css': 'style.css' };
const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  if (req.method !== 'GET' || !files[urlPath]) { res.writeHead(404); return res.end('Not found'); }
  const file = files[urlPath];
  const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html';
  res.writeHead(200, { 'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'no-store' });
  fs.createReadStream(path.join(__dirname, file)).pipe(res);
});
if (require.main === module) server.listen(port, '127.0.0.1', () => console.log(`安心药箱 Demo: http://127.0.0.1:${port} (仅本机)`));
module.exports = server;
