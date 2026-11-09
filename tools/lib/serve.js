/* static server เล็กๆ สำหรับเทสต์ที่ต้องโหลดเกมผ่าน http://
   เหตุผล: ถ้าเปิดด้วย file:// แล้ว canvas จะถูก taint
   (getImageData -> SecurityError) ทำให้เทสต์ที่วาดสไปรต์พังทั้งที่ตัวเกมปกติดี

   ใช้: const srv = await require('./lib/serve').start(ROOT, 8933);
*/
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg'
};

function start(root, port) {
  return new Promise((resolve, reject) => {
    const base = path.resolve(root);
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p === '/' || p === '') p = '/index.html';
      const file = path.join(base, p);
      if (!file.startsWith(base)) { res.writeHead(403); return res.end('forbidden'); }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404); return res.end('not found'); }
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-store'
        });
        res.end(buf);
      });
    });
    srv.on('error', reject);
    srv.listen(port, '127.0.0.1', () => resolve(srv));
  });
}

module.exports = { start };
