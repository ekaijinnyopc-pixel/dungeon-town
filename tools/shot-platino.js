/* จับภาพ Platino ตรงตำแหน่งจริง (ย้ายผู้เล่นไปทับ node แล้ว screenshot)
   ใช้: node tools/shot-platino.js [url] [outfile]
*/
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');

function killChrome(ch) {
  try { process.kill(-ch.pid, 'SIGKILL'); } catch (e) {}
  try { ch.kill('SIGKILL'); } catch (e) {}
}
let __child = null, __cleaned = false;
function __cleanup() { if (__cleaned) return; __cleaned = true; if (__child) { try { killChrome(__child); } catch (e) {} } }
process.on('exit', __cleanup);
process.on('uncaughtException', e => { console.error('UNCAUGHT: ' + (e && e.stack || e)); __cleanup(); process.exit(1); });
process.on('unhandledRejection', e => { console.error('UNHANDLED: ' + (e && e.stack || e)); __cleanup(); process.exit(1); });

const URL = process.argv[2] || 'http://127.0.0.1:8931/dungeon-town/index.html';
const OUT = process.argv[3] || path.join(__dirname, '..', 'dist', 'preview-platino.png');
const PORT = 9397;
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-platshot-'));
  const ch = spawn('/usr/bin/chromium', ['--headless=new', '--no-sandbox', '--disable-gpu',
    '--window-size=1280,800', '--remote-debugging-port=' + PORT, '--user-data-dir=' + ud, 'about:blank'],
    { stdio: 'ignore', detached: true });
  __child = ch;
  let wsUrl = null;
  for (let i = 0; i < 80 && !wsUrl; i++) {
    await sleep(250);
    try {
      const l = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
      const p = l.find(t => t.type === 'page');
      if (p) wsUrl = p.webSocketDebuggerUrl;
    } catch (e) { }
  }
  if (!wsUrl) { console.log('❌ เชื่อม CDP ไม่ได้'); __cleanup(); process.exit(1); }

  const sk = new WebSocket(wsUrl);
  let id = 0; const pend = new Map();
  sk.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) {
      const p = pend.get(m.id); pend.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    }
  });
  await new Promise(r => sk.addEventListener('open', r));
  const send = (method, params) => new Promise((resolve, reject) => {
    const i = ++id; pend.set(i, { resolve, reject });
    sk.send(JSON.stringify({ id: i, method, params }));
  });
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
    return r.result.value;
  };

  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: URL });
  await sleep(3500);
  for (let i = 0; i < 40; i++) {
    try { if (await ev("typeof DT !== 'undefined'")) break; } catch (e) {}
    await sleep(250);
  }
  if (await ev("!!document.getElementById('play-now')").catch(() => false)) {
    await ev("document.getElementById('play-now').click()"); await sleep(400);
  }
  await ev("(function(){var i=document.getElementById('pname');if(i)i.value='พี่เอ';document.getElementById('go').click();})()");
  for (let i = 0; i < 60; i++) {
    try { if (await ev("!!(DT.Game && DT.Game.local)")) break; } catch (e) {}
    await sleep(250);
  }
  /* รอ sprite โหลดครบ */
  for (let i = 0; i < 40; i++) {
    const n = await ev("Object.keys(window.__DT_SPRITE_DATA__||{}).length");
    if (n === 0) { await sleep(250); continue; }
    const loaded = await ev("!!DT.Sprites.get('mobs/platino.png')");
    if (loaded) break;
    await sleep(250);
  }

  /* ย้ายผู้เล่นไปใกล้ node platino (อยู่ข้างบน-ขวา ให้เห็นชัด) */
  const info = await ev(`(function(){
    var w = DT.Game.world, p = DT.Game.local;
    var n = null;
    for (var i = 0; i < w.nodes.length; i++) if (w.nodes[i].type === 'platino') { n = w.nodes[i]; break; }
    if (!n) return null;
    p.x = n.x + 0.6; p.y = n.y + 1.6;
    /* อัปเดตกล้องให้เห็น */
    if (DT.Render && DT.Render.follow) { DT.Render.follow.x = p.x; DT.Render.follow.y = p.y; }
    if (DT.Game.camera) { DT.Game.camera.x = p.x; DT.Game.camera.y = p.y; }
    return { x: n.x, y: n.y };
  })()`);
  console.log('platino node:', JSON.stringify(info));
  await sleep(1200);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
  console.log('saved', OUT, fs.statSync(OUT).size, 'bytes');
  __cleanup();
  process.exit(0);
})();
