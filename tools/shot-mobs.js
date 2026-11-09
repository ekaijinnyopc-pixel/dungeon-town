/* จับภาพมอนส์ทุกชนิด (12 ตัว) มาเรียงเป็นแถว เพื่อตรวจด้วยตาว่า
   สไปรต์ถูกตัว (ไม่มีเศษภาพจากเซลล์ข้างเคียงปน) และไม่ซ้ำกัน

   ใช้: node tools/shot-mobs.js [url] [outfile]
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
const OUT = process.argv[3] || path.join(__dirname, '..', 'dist', 'preview-mobs.png');
const PORT = 9398;
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-mobshot-'));
  const ch = spawn('/usr/bin/chromium', ['--headless=new', '--no-sandbox', '--disable-gpu',
    '--window-size=1400,900', '--remote-debugging-port=' + PORT, '--user-data-dir=' + ud, 'about:blank'],
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
  /* รอสไปรต์มอนส์โหลดครบทุกตัว */
  const TYPES = ['slime','wolf','goblin','boar','wraith','bat','imp','ghoul','skeleton','mage','knight','dragon'];
  for (let i = 0; i < 60; i++) {
    const n = await ev("(function(){var l=" + JSON.stringify(TYPES) +
      ";var c=0;for(var i=0;i<l.length;i++){if(DT.Sprites.get('mobs/'+l[i]+'.png'))c++;}return c;})()");
    if (n === TYPES.length) break;
    await sleep(250);
  }
  const loaded = await ev("(function(){var l=" + JSON.stringify(TYPES) +
    ";var c=0;for(var i=0;i<l.length;i++){if(DT.Sprites.get('mobs/'+l[i]+'.png'))c++;}return c;})()");
  console.log('sprites loaded:', loaded + '/' + TYPES.length);
  if (loaded !== TYPES.length) { console.log('❌ สไปรต์โหลดไม่ครบ'); __cleanup(); process.exit(1); }

  /* วาดมอนส์ทุกตัวลง canvas ใหม่ เรียง 6 คอลัมน์ x 2 แถว พร้อมชื่อ */
  const result = await ev(`(function(){
    var T = ${JSON.stringify(TYPES)};
    var cv = document.createElement('canvas');
    cv.width = 6 * 140; cv.height = 2 * 170;
    cv.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#20242c;';
    document.body.appendChild(cv);
    var x = cv.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.fillStyle = '#20242c'; x.fillRect(0,0,cv.width,cv.height);
    for (var i=0;i<T.length;i++){
      var col = i % 6, row = Math.floor(i/6);
      var ox = col*140 + 70, oy = row*170 + 130;
      /* พื้นอ้างอิง */
      x.fillStyle = '#2b3038'; x.fillRect(col*140+8, oy-4, 124, 8);
      var drew = DT.Art.mob(x, ox, oy, 2, T[i], { t: 0.6, seed: i });
      /* กรอบช่องช่วยดูเศษภาพ */
      x.strokeStyle = '#4a5260'; x.strokeRect(col*140+4, row*170+4, 132, 158);
      x.font = '13px sans-serif'; x.textAlign='center';
      x.fillStyle = '#d8dde6';
      x.fillText(T[i], ox, row*170+158);
    }
    return { w: cv.width, h: cv.height, drew: true };
  })()`);
  await sleep(600);
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: result.w, height: result.h, scale: 1 } });
  fs.writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
  console.log('saved', OUT, fs.statSync(OUT).size, 'bytes');
  __cleanup();
  process.exit(0);
})();
