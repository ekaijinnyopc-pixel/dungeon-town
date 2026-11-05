/* จับภาพหน้าเกมจริงที่มุมขวาบน — มือถือ + เดสก์ท็อป
   ใช้: node tools/dbg-shot.js [url]
*/
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
const URL = process.argv[2] || ('file://' + path.join(ROOT, 'index.html'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function shot(W, H, mobile, out) {
  const PORT = 9410 + (mobile ? 1 : 0);
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-shot-'));
  const args = ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--window-size=' + W + ',' + H, '--allow-file-access-from-files',
    '--hide-scrollbars', '--remote-debugging-port=' + PORT, '--user-data-dir=' + ud, 'about:blank'];
  if (mobile) args.unshift('--touch-events=enabled');
  const ch = spawn('/usr/bin/chromium', args, { stdio: 'ignore' });
  let wsUrl = null;
  for (let i = 0; i < 80 && !wsUrl; i++) {
    await sleep(250);
    try {
      const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = l.find(t => t.type === 'page');
      if (p) wsUrl = p.webSocketDebuggerUrl;
    } catch (e) { }
  }
  if (!wsUrl) { console.log('❌ CDP fail'); ch.kill(); return; }
  const sk = new WebSocket(wsUrl);
  let id = 0; const pend = new Map();
  sk.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
  });
  await new Promise(r => sk.addEventListener('open', r));
  const send = (method, params) => new Promise((resolve, reject) => { const i = ++id; pend.set(i, { resolve, reject }); sk.send(JSON.stringify({ id: i, method, params })); });
  const evalJs = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result && r.result.value;
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: mobile });
  await send('Page.navigate', { url: URL });
  await sleep(2500);
  // เปิดหน้าเกม (บังคับแสดง .app) + วัด geometry จริง
  const info = await evalJs(`(function(){
    var app=document.getElementById('app'); if(app) app.classList.remove('hidden');
    var start=document.getElementById('start'); if(start) start.style.display='none';
    var all=document.querySelectorAll('.topright button, .mtools button, .panel, .popup, .hud');
    var out=[];
    for(var i=0;i<all.length;i++){
      var e=all[i], s=getComputedStyle(e), b=e.getBoundingClientRect();
      out.push({cls:e.className||e.id, disp:s.display, vis:s.visibility,
        x:Math.round(b.x), y:Math.round(b.y), w:Math.round(b.width), h:Math.round(b.height),
        t:(e.textContent||'').trim().replace(/\\s+/g,' ').slice(0,16)});
    }
    return JSON.stringify(out);
  })()`);
  await sleep(600);
  const cap = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(out, Buffer.from(cap.data, 'base64'));
  console.log('\n===== ' + out + ' =====');
  JSON.parse(info || '[]').forEach(o => console.log(`  ${String(o.cls).padEnd(22)} ${o.disp.padEnd(6)} x=${o.x} y=${o.y} ${o.w}x${o.h} "${o.t}"`));
  sk.close(); ch.kill('SIGKILL');
}

(async () => {
  await shot(390, 844, true, '/tmp/dt-mobile.png');
  await shot(1280, 800, false, '/tmp/dt-desktop.png');
  console.log('\n✅ shots saved');
})();
