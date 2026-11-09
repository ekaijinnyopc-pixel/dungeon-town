/* ถ่ายภาพหน้าเกมจริงจาก URL ที่ deploy แล้ว (เดสก์ท็อป + มือถือ)
   ใช้: node tools/shot-live.js [url]
*/
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
const URL = process.argv[2] || 'https://ekaijinnyopc-pixel.github.io/dungeon-town/index.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let __child = null, __cleaned = false;
function killChrome(ch) {
  try { process.kill(-ch.pid, 'SIGKILL'); } catch (e) {}
  try { ch.kill('SIGKILL'); } catch (e) {}
}
function __cleanup() { if (__cleaned) return; __cleaned = true; if (__child) { try { killChrome(__child); } catch (e) {} } }
process.on('exit', __cleanup);
process.on('uncaughtException', e => { console.error('UNCAUGHT: ' + (e && e.stack || e)); __cleanup(); process.exit(1); });
process.on('unhandledRejection', e => { console.error('UNHANDLED: ' + (e && e.stack || e)); __cleanup(); process.exit(1); });

async function shot(W, H, mobile, out, seedMove) {
  const PORT = 9500 + (mobile ? 1 : 0);
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-live-'));
  const ch = spawn('/usr/bin/chromium', ['--headless=new', '--no-sandbox', '--disable-gpu',
    '--disable-dev-shm-usage', '--window-size=' + W + ',' + H, '--hide-scrollbars',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + ud, 'about:blank'],
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
  if (!wsUrl) { console.log('❌ CDP fail'); return; }
  const sk = new WebSocket(wsUrl);
  let id = 0; const pend = new Map();
  sk.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
  });
  await new Promise(r => sk.addEventListener('open', r));
  const send = (method, params) => new Promise((resolve, reject) => { const i = ++id; pend.set(i, { resolve, reject }); sk.send(JSON.stringify({ id: i, method, params })); });
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
    return r.result.value;
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: mobile });
  await send('Page.navigate', { url: URL });
  await sleep(3500);
  for (let i = 0; i < 40; i++) { try { if (await ev("typeof DT !== 'undefined'")) break; } catch (e) {} await sleep(250); }
  if (await ev("!!document.getElementById('play-now')").catch(() => false)) {
    await ev("document.getElementById('play-now').click()"); await sleep(500);
  }
  await ev("(function(){var i=document.getElementById('pname');if(i)i.value='พี่เอ';var g=document.getElementById('go');if(g)g.click();})()");
  for (let i = 0; i < 60; i++) { try { if (await ev("!!(DT.Game && DT.Game.local)")) break; } catch (e) {} await sleep(250); }
  /* รอสไปรต์พื้น + ต้นไม้โหลดครบ */
  for (let i = 0; i < 60; i++) {
    const n = await ev("(function(){var c=0;for(var k in DT.Sprites.SPEC){if(k.indexOf('tiles/')===0&&DT.Sprites.get(k))c++;}return c;})()").catch(() => 0);
    if (n >= 9) break;
    await sleep(250);
  }
  /* เดินไปหน่อยให้เห็นฉาก (เรียก move ผ่าน Game) */
  if (seedMove) {
    await ev("(function(){try{for(var i=0;i<40;i++){DT.Game.onKey&&DT.Game.onKey({key:'ArrowRight',preventDefault:function(){}});}}catch(e){}})()");
    await sleep(1200);
  }
  await sleep(1200);
  const cap = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(out, Buffer.from(cap.data, 'base64'));
  console.log('saved', out, fs.statSync(out).size, 'bytes');
  sk.close();
  try { killChrome(ch); } catch (e) {}
  __child = null;
}

(async () => {
  await shot(1280, 800, false, path.join(ROOT, 'dist', 'preview-town-desktop.png'), true);
  await shot(390, 844, true, path.join(ROOT, 'dist', 'preview-town-mobile.png'), false);
  __cleanup();
  process.exit(0);
})();
