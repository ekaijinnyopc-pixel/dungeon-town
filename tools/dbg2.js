const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
const URL = process.argv[2] || ('file://' + path.join(ROOT, 'index.html'));
const PORT = 9365;
const W = 390, H = 844;
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-dbg2-'));
  const ch = spawn('/usr/bin/chromium', ['--headless=new', '--no-sandbox', '--disable-gpu',
    '--window-size=' + W + ',' + H, '--allow-file-access-from-files',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + ud, 'about:blank'], { stdio: 'ignore' });
  let wsUrl = null;
  for (let i = 0; i < 80 && !wsUrl; i++) {
    await sleep(250);
    try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); const p = l.find(t => t.type === 'page'); if (p) wsUrl = p.webSocketDebuggerUrl; } catch (e) { }
  }
  const sk = new WebSocket(wsUrl);
  let id = 0; const pend = new Map();
  sk.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { const { resolve, reject } = pend.get(m.id); pend.delete(m.id); m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result); return; }
    if (m.method && m.method !== 'Runtime.consoleAPICalled') {
      console.log('EVENT', m.method, JSON.stringify(m.params || {}).slice(0, 200));
    }
    if (m.method === 'Runtime.exceptionThrown') console.log('EXC', JSON.stringify(m.params).slice(0, 400));
  });
  await new Promise(r => sk.addEventListener('open', r));
  const send = (method, params) => new Promise((res, rej) => { const i = ++id; pend.set(i, { resolve: res, reject: rej }); sk.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return 'EXC:' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const tp = (x, y) => [{ x: Math.round(x), y: Math.round(y), radiusX: 12, radiusY: 12, force: 1, id: 1 }];
  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 3, mobile: true, screenWidth: W, screenHeight: H });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Page.navigate', { url: URL });
  await sleep(4200);
  await ev("document.getElementById('go').click()");
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const s = await ev("[typeof DT, document.readyState, location.href, (window.DT&&DT.Game&&DT.Game.local)?'game':'-'].join('|')");
    if (!String(s).startsWith('object')) { console.log('>>> LOST at', i * 0.5, 's:', s); break; }
    if (i % 4 === 0) console.log('t=' + (i * 0.5), s);
  }
  sk.close(); ch.kill();
  try { fs.rmSync(ud, { recursive: true, force: true }); } catch (e) { }
  process.exit(0);
})();
