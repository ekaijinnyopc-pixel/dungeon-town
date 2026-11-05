/* วัดตำแหน่งปุ่มมือถือจริง (⛶ / ☰ / 👤) ที่หลาย viewport + ทดสอบแตะจริง
   ใช้: node tools/measure-mobile-buttons.js [url] */
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const URL = process.argv[2] || 'http://127.0.0.1:8931/dungeon-town/index.html';
const PORT = 9369;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const VIEWS = [
  { name: 'iPhone SE เล็ก', w: 320, h: 568 },
  { name: 'Android ทั่วไป', w: 360, h: 640 },
  { name: 'iPhone 14', w: 390, h: 844 },
  { name: 'iPhone 14 Pro Max', w: 430, h: 932 },
  { name: 'มือถือแนวนอน', w: 844, h: 390 },
];

const KEYS = [
  { act: 'toggle:menu', icon: '☰', label: 'เมนู' },
  { act: 'toggle:fullscreen', icon: '⛶', label: 'เต็มจอ' },
  { act: 'toggle:hud', icon: '👤', label: 'ย่อ/ขยายฮีโร่' },
];

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-mb-'));
  const ch = spawn('/usr/bin/chromium', ['--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + ud, 'about:blank'], { stdio: 'ignore' });
  let wsUrl = null;
  for (let i = 0; i < 80 && !wsUrl; i++) {
    await sleep(250);
    try {
      const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = l.find(t => t.type === 'page');
      if (p) wsUrl = p.webSocketDebuggerUrl;
    } catch (e) { }
  }
  if (!wsUrl) { console.log('❌ เชื่อม CDP ไม่ได้'); process.exit(1); }

  const sk = new WebSocket(wsUrl);
  let id = 0; const pend = new Map();
  sk.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) {
      const { resolve, reject } = pend.get(m.id); pend.delete(m.id);
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
    }
  });
  await new Promise(r => sk.addEventListener('open', r));
  const send = (method, params) => new Promise((res, rej) => {
    const i = ++id; pend.set(i, { resolve: res, reject: rej });
    sk.send(JSON.stringify({ id: i, method, params: params || {} }));
  });
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return null;
    return r.result.value;
  };

  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  for (const v of VIEWS) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: v.w, height: v.h, deviceScaleFactor: 3, mobile: true, screenWidth: v.w, screenHeight: v.h,
    });
    await send('Page.navigate', { url: URL });
    await sleep(3600);
    await ev("document.getElementById('go') && document.getElementById('go').click()");
    await sleep(1800);

    console.log('\n=== ' + v.name + ' (' + v.w + 'x' + v.h + ') ===');
    const data = await ev(`(function(){
      var out=[];
      var btns=document.querySelectorAll('.mobile .mtop button');
      for (var i=0;i<btns.length;i++){
        var b=btns[i], r=b.getBoundingClientRect();
        var cs=getComputedStyle(b);
        if (cs.display==='none'||cs.visibility==='hidden'||r.width===0) continue;
        out.push({act:b.getAttribute('data-act'),icon:(b.textContent||'').trim(),
          x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),
          cx:Math.round(r.left+r.width/2),cy:Math.round(r.top+r.height/2)});
      }
      return JSON.stringify(out);
    })()`);
    const list = JSON.parse(data || '[]');
    if (!list.length) { console.log('  (ไม่พบปุ่มมือถือ)'); continue; }
    for (const b of list) {
      const k = KEYS.find(x => x.act === b.act);
      console.log(`  ${b.icon}  ${k ? k.label : b.act}  (${b.act})`);
      console.log(`      ขอบบนซ้าย ${b.x},${b.y} · ขนาด ${b.w}x${b.h}px · กดที่ ${b.cx},${b.cy}`);
    }
    // ทดสอบแตะจริง: กด ⛶ แล้วดูว่ามี state เปลี่ยน
    const fsBtn = list.find(b => b.act === 'toggle:fullscreen');
    if (fsBtn) {
      const before = await ev("(document.fullscreenElement?'in':'out')");
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: fsBtn.cx, y: fsBtn.cy, radiusX: 12, radiusY: 12, force: 1, id: 1 }] });
      await sleep(100);
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await sleep(700);
      const after = await ev("(document.fullscreenElement?'in':'out')");
      console.log(`      แตะ ⛶: fullscreen ${before} -> ${after} ${before !== after ? '✅ ทำงาน' : '⚠️ ไม่เปลี่ยน (headless อาจไม่รองรับ)'}`);
    }
  }

  sk.close(); ch.kill();
  try { fs.rmSync(ud, { recursive: true, force: true }); } catch (e) { }
  process.exit(0);
})();
