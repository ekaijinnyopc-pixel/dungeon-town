/* ตรวจว่าสไปรต์ PNG โหลดจริงและเกมยังเล่นได้
   ใช้: node tools/test-sprites.js [url] */
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');

/* cleanup: kill chromium process group (parent + children) */
function killChrome(ch) {
  try { process.kill(-ch.pid, 'SIGKILL'); } catch (e) {}
  try { ch.kill('SIGKILL'); } catch (e) {}
}

/* ---- global cleanup net (module scope: visible to .catch + process handlers) ----
   ถ้าสคริปต์ crash กลางทาง (uncaught / unhandled rejection) ให้ฆ่า chromium ด้วยเสมอ
   ไม่งั้นจะเหลือ orphan chromium process ค้างในเครื่อง */
let __child = null;
let __cleaned = false;
function __cleanup() {
  if (__cleaned) return; __cleaned = true;
  if (__child) { try { killChrome(__child); } catch (e) {} }
  if (__srv) { try { __srv.close(); } catch (e) {} }
}
process.on('exit', __cleanup);
process.on('uncaughtException', (e) => { console.error('UNCAUGHT: ' + (e && e.stack || e)); __cleanup(); process.exit(1); });
process.on('unhandledRejection', (e) => { console.error('UNHANDLED REJECTION: ' + (e && e.stack || e)); __cleanup(); process.exit(1); });


/* wait until game booted (DT.Game.local ready) — กัน race ตอนเครื่องช้า */
async function waitGameStart(ev, timeoutMs = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { if (await ev("!!(DT.Game && DT.Game.local)")) return true; } catch (e) {}
    await sleep(200);
  }
  return false;
}

const http = require('http');
const ROOT = path.join(__dirname, '..');
const PORT = 9377;
const HTTP_PORT = 8932;

/* ---------- static server เล็กๆ ----------
   ต้องใช้ http:// ไม่ใช่ file:// เพราะ canvas จะถูก taint เมื่อโหลดภาพจาก file://
   (getImageData -> SecurityError) ทำให้เทสต์วาดสไปรต์พังโดยไม่เกี่ยวกับตัวเกม */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.woff2': 'font/woff2'
};
function startServer() {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404); return res.end('not found'); }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
        res.end(buf);
      });
    });
    srv.on('error', reject);
    srv.listen(HTTP_PORT, '127.0.0.1', () => resolve(srv));
  });
}
let __srv = null;
const URL = process.argv[2] || ('http://127.0.0.1:' + HTTP_PORT + '/index.html');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } }

(async () => {
  if (!process.argv[2]) {
    try { __srv = await startServer(); } catch (e) {
      console.log('❌ เปิด static server ไม่ได้: ' + (e && e.message || e));
      process.exit(1);
    }
  }
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-spr-'));
  const ch = spawn('/usr/bin/chromium', ['--headless=new', '--no-sandbox', '--disable-gpu',
    '--disable-dev-shm-usage', '--window-size=1280,800',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + ud, 'about:blank'], { stdio: 'ignore', detached: true });
  let wsUrl = null;
  for (let i = 0; i < 80 && !wsUrl; i++) {
    await sleep(250);
    try {
      const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = l.find(t => t.type === 'page');
      if (p) wsUrl = p.webSocketDebuggerUrl;
    } catch (e) { }
  }
    __child = ch;

if (!wsUrl) { console.log('❌ เชื่อม CDP ไม่ได้'); process.exit(1); }
  const sk = new WebSocket(wsUrl);
  let id = 0; const pend = new Map(); const errors = [];
  sk.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) {
      const { resolve, reject } = pend.get(m.id); pend.delete(m.id);
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
      return;
    }
    if (m.method === 'Runtime.exceptionThrown') {
      errors.push('EXC: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    }
  });
  /* CDP socket died -> reject every pending promise so the script fails fast
     instead of waiting forever for a reply that will never arrive */
  const __die = (why) => {
    for (const [, __p] of pend) { try { __p.reject(new Error(why)); } catch (e) {} }
    pend.clear();
  };
  sk.addEventListener('close', () => __die('CDP socket closed unexpectedly'));
  sk.addEventListener('error', () => __die('CDP socket error'));
  /* timeout ด้วย: ถ้า socket ค้าง (ไม่ยิงทั้ง open และ error) ให้ fail เร็ว
     แทนการรอ forever (เคยทำให้สคริปต์ 'ดันไม่จบ') */
  await new Promise((res, rej) => {
    const __t = setTimeout(() => rej(new Error('CDP connect timeout (15s)')), 15000);
    sk.addEventListener('open', () => { clearTimeout(__t); res(); });
    sk.addEventListener('error', () => { clearTimeout(__t); rej(new Error('CDP connect failed')); });
  });
  const send = (method, params) => new Promise((res, rej) => {
    const i = ++id;
    const to = setTimeout(() => { if (pend.has(i)) { pend.delete(i); rej(new Error('TIMEOUT ' + method)); } }, 20000);
    pend.set(i, { resolve: v => { clearTimeout(to); res(v); }, reject: e => { clearTimeout(to); rej(e); } });
    sk.send(JSON.stringify({ id: i, method, params: params || {} }));
  });
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
    return r.result.value;
  };

  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: URL });
  await sleep(3000);

  console.log('== โหลดเกม ==');
  await ev("(function(){var i=document.getElementById('pname'); if(i) i.value='สไปรต์';})()");
  await ev("document.getElementById('go').click()");
  await waitGameStart(ev);
  ok(await ev("!!(DT.Game&&DT.Game.local)"), 'เข้าเกมได้');

  console.log('\n== โมดูลสไปรต์ ==');
  ok(await ev("typeof DT.Sprites === 'object'"), 'มี DT.Sprites');
  const stats = JSON.parse(await ev("JSON.stringify(DT.Sprites.stats)"));
  console.log('   stats:', JSON.stringify(stats));
  ok(stats.loaded > 0, 'โหลดสไปรต์สำเร็จ ' + stats.loaded + ' ไฟล์');

  console.log('\n== ภาพแต่ละตัวโหลดได้จริง ==');
  const keys = JSON.parse(await ev("JSON.stringify(DT.Sprites.keys())"));
  for (const k of keys) {
    const okk = await ev(`(function(){var im=DT.Sprites.get(${JSON.stringify(k)});return !!(im&&im.naturalWidth>0);})()`);
    if (!okk) ok(false, 'โหลดไม่ได้: ' + k);
  }
  ok(true, 'ตรวจ ' + keys.length + ' คีย์');

  console.log('\n== วาดสไปรต์ลง canvas ได้จริง ==');
  const drew = await ev(`(function(){
    var c = document.getElementById('game');
    var x = c.getContext('2d');
    var before = x.getImageData(0,0,c.width,c.height).data.slice(0);
    var n = DT.Sprites.draw(x, ${JSON.stringify(keys[0])}, 20, 20, false, null, 0);
    return JSON.stringify({drew:n});
  })()`);
  ok(JSON.parse(drew).drew === true, 'draw() คืน true (วาดลง canvas ได้)');

  console.log('\n== เดิน 4 ทิศ -> sprite เปลี่ยนตามทิศ ==');
  for (const d of ['up', 'down', 'left', 'right']) {
    const r = await ev(`(function(){
      var G=DT.Game; G.local.dir=${JSON.stringify(d)};
      var key = ${JSON.stringify(d)}==='up' ? 'characters/player_up.png'
        : (${JSON.stringify(d)}==='left'||${JSON.stringify(d)}==='right') ? 'characters/player_side.png'
        : 'characters/player_down.png';
      var im=DT.Sprites.get(key); return !!(im&&im.naturalWidth>0);
    })()`);
    ok(r === true, 'ทิศ ' + d + ' -> ' + (d === 'up' ? 'player_up' : (d === 'down' ? 'player_down' : 'player_side')) + ' พร้อม');
  }

  console.log('\n== fallback: ภาพโหลดไม่ได้ -> ยังวาดรูปทรงเดิม (ไม่จอดำ) ==');
  const fb = await ev(`(function(){
    var c = document.getElementById('game');
    var x = c.getContext('2d');
    var before = x.getImageData(0,0,c.width,c.height).data;
    var sum=0; for(var i=0;i<before.length;i+=997) sum+=before[i];
    DT.Art.tree(x, 40, 40, 1, 0, 7);
    var after = x.getImageData(0,0,c.width,c.height).data;
    var sum2=0; for(var i=0;i<after.length;i+=997) sum2+=after[i];
    return sum2 !== sum;
  })()`);
  ok(fb === true, 'Art.tree ยังวาดได้ (มีทั้งสไปรต์และ fallback)');

  console.log('\n== error ==');
  ok(errors.length === 0, 'ไม่มี JS error (' + errors.length + ')' + (errors.length ? ' → ' + errors.slice(0, 3).join(' | ') : ''));

  console.log('\n———— ผล: ' + pass + ' ผ่าน / ' + fail + ' ล้มเหลว ————');
  sk.close(); killChrome(ch);
  try { fs.rmSync(ud, { recursive: true, force: true }); } catch (e) { }
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.log('❌ ระหว่างรัน: ' + (e && e.message || e));
  __cleanup();
  process.exit(1);
});
