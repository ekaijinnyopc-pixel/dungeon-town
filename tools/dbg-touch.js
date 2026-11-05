const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
const URL = process.argv[2] || ('file://' + path.join(ROOT, 'index.html'));
const PORT = 9363;
const W = 390, H = 844;
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-dbg-'));
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
    if (/Page.frameNavigated|Page.loadEventFired|Runtime.executionContextDestroyed|Runtime.executionContextsCleared|Inspector.targetCrashed|Page.frameCrashed/.test(m.method)) {
      console.log('EVENT', m.method, JSON.stringify(m.params).slice(0, 300));
    }
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
  await sleep(2600);
  console.log('before:', await ev("[typeof DT, location.href, document.title, (window.DT?1:0)].join('|')"));
  const up = JSON.parse(await ev("(function(){var b=document.querySelector('.mobile .pad[data-key=\\'up\\']');var r=b.getBoundingClientRect();return JSON.stringify({x:r.left+r.width/2,y:r.top+r.height/2});})()"));
  console.log('up btn', up);
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(up.x, up.y) });
  await sleep(120);
  console.log('during:', await ev("[typeof DT, DT&&DT.Game&&DT.Game.keys.up].join('|')"));
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: tp(up.x, up.y) });
  await sleep(300);
  console.log('after:', await ev("[typeof DT, location.href, document.title].join('|')"));
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  console.log('targets:', list.map(t => t.type + ':' + t.url).join(' , '));
  sk.close(); ch.kill();
  try { fs.rmSync(ud, { recursive: true, force: true }); } catch (e) { }
  process.exit(0);
})();
