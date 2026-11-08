/* เทสต์มือถือด้วยการ "แตะ" จริงระดับเบราว์เซอร์ (CDP Input.dispatchTouchEvent)
   - อุปกรณ์ 390x844 (mobile=true) + touch emulation
   - ปุ่ม .mobile .pad (กดค้าง = เดินต่อเนื่อง)
   - touch บน canvas (สั้น = เมนู/เก็บ · ยาว = เดิน/โจมตี)
   - ปุ่มเครื่องมือ 🎒 ⚒️ 📜 ❌
   - viewport meta / safe area / กัน zoom / ขนาดปุ่ม / DPR
   ใช้: node tools/test-touch.js [url]
*/
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

const ROOT = path.join(__dirname, '..');
const URL = process.argv[2] || ('file://' + path.join(ROOT, 'index.html'));
const PORT = 9361;
const W = 390, H = 844;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } }

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-touch-'));
  const ch = spawn('/usr/bin/chromium', ['--headless=new', '--no-sandbox', '--disable-gpu',
    '--disable-dev-shm-usage', '--window-size=' + W + ',' + H, '--allow-file-access-from-files',
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
  let id = 0; const pend = new Map(); const errors = []; const m = { started: false };
  sk.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) {
      const { resolve, reject } = pend.get(m.id); pend.delete(m.id);
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
      return;
    }
    if (m.method === 'Inspector.targetCrashed' || m.method === 'Page.frameCrashed') {
      errors.push('CRASH: ' + m.method);
    }
    if (m.started && m.method === 'Page.frameRequestedNavigation') {
      errors.push('NAVREQ: ' + (m.params.reason || '?') + ' ' + (m.params.url || ''));
    }
    if (m.started && m.method === 'Page.frameStartedNavigating' && m.params.navigationType === 'differentDocument') {
      errors.push('NAV: ' + (m.params.url || ''));
    }
    if (m.method === 'Runtime.exceptionThrown') {
      errors.push('EXC: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    }
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error'
      && !/dungeon_town_players|favicon/.test(m.params.entry.url || '')) {
      errors.push('LOG: ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
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
    const to = setTimeout(() => {
      if (pend.has(i)) { pend.delete(i); rej(new Error('TIMEOUT: ' + method + ' (' + i + ')')); }
    }, 20000);
    pend.set(i, {
      resolve: v => { clearTimeout(to); res(v); },
      reject: e => { clearTimeout(to); rej(e); }
    });
    sk.send(JSON.stringify({ id: i, method, params: params || {} }));
  });
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
    return r.result.value;
  };

  /* ---- touch จริง ---- */
  const tp = (x, y) => [{ x: Math.round(x), y: Math.round(y), radiusX: 12, radiusY: 12, force: 1, id: 1 }];
  const tStart = async (x, y) => send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(x, y) });
  const tMove = async (x, y) => send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(x, y) });
  const tEnd = async (x, y) => send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: tp(x, y) });
  const tap = async (x, y) => { await tStart(x, y); await sleep(90); await tEnd(x, y); await sleep(260); };

  /* จุดกึ่งกลางของ element (selector) ในพิกัด viewport */
  const centerOf = async (sel, nth) => {
    const r = await ev(`(function(){
      var els = document.querySelectorAll(${JSON.stringify(sel)});
      var e = els[${nth || 0}];
      if (!e) return '';
      var r = e.getBoundingClientRect();
      if (!r.width || !r.height) return '';
      return JSON.stringify({ x: r.left + r.width/2, y: r.top + r.height/2, w: r.width, h: r.height,
                              l: r.left, t: r.top, rt: r.right, bt: r.bottom });
    })()`);
    return r ? JSON.parse(r) : null;
  };

  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');

  console.log('== เปิดเป็นอุปกรณ์มือถือ 390x844 ==');
  await send('Emulation.setDeviceMetricsOverride', {
    width: W, height: H, deviceScaleFactor: 3, mobile: true,
    screenWidth: W, screenHeight: H
  });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Page.navigate', { url: URL });
  await sleep(4200);

  console.log('\n== viewport / meta / กัน zoom ==');
  const meta = await ev("(document.querySelector('meta[name=viewport]')||{}).content || ''");
  ok(/width=device-width/.test(meta), 'viewport meta: width=device-width');
  ok(/initial-scale=1\.0/.test(meta), 'viewport meta: initial-scale=1.0');
  ok(/maximum-scale=1\.0/.test(meta), 'viewport meta: maximum-scale=1.0');
  ok(/user-scalable=no/.test(meta), 'viewport meta: user-scalable=no (กัน pinch zoom)');
  ok(/viewport-fit=cover/.test(meta), 'viewport meta: viewport-fit=cover (safe area)');
  const dpr = await ev("window.devicePixelRatio");
  ok(dpr >= 2, 'devicePixelRatio = ' + dpr);
  ok(await ev("getComputedStyle(document.documentElement).overscrollBehavior") === 'none',
    'overscroll-behavior:none (กันเลื่อน/ดึงหน้า)');
  ok(await ev("getComputedStyle(document.getElementById('game')).touchAction") === 'none',
    'canvas touch-action:none (กัน zoom ตอนแตะ canvas)');

  console.log('\n== เข้าเกม ==');
  await ev("(function(){var i=document.getElementById('pname'); if(i) i.value='มือถือ';})()");
  await ev("document.getElementById('go').click()");
  await waitGameStart(ev);
  ok(await ev("!!(DT.Game&&DT.Game.local)"), 'เข้าเกมได้');
  m.started = true;
  ok(await ev("!!document.getElementById('game')"), 'มี canvas');

  console.log('\n== ปุ่มมือถือแสดงผล ==');
  ok(await ev("getComputedStyle(document.querySelector('.mobile')).display") !== 'none',
    '.mobile แสดงผลบนจอมือถือ');
  /* P4-D: แนว MOBA — จอยอนาล็อค (ซ้ายล่าง) + ปุ่ม action 4 ปุ่ม (ขวาล่าง) + ปุ่มซูม */
  ok(await ev("!!document.querySelector('.mjoy')"), 'มีจอยอนาล็อค .mjoy');
  ok(await ev("!!document.querySelector('.mjoy-knob')"), 'มีหัวจอย .mjoy-knob');
  ok(await ev("getComputedStyle(document.querySelector('.mjoy')).display") !== 'none',
    '.mjoy แสดงผลบนจอมือถือ');
  ok(await ev("document.querySelectorAll('.mobile .pad').length") === 4,
    'มีปุ่ม action .mobile .pad ครบ 4 ปุ่ม (gather/attack/shop/fire)');
  const keys = await ev("JSON.stringify([].map.call(document.querySelectorAll('.mobile .pad'),function(b){return b.getAttribute('data-key');}))");
  const KEYSET = ['gather', 'attack', 'shop', 'fire'];
  ok(KEYSET.every(k => JSON.parse(keys).indexOf(k) >= 0), 'data-key ครบ: ' + keys);
  ok(await ev("document.querySelectorAll('.mobile .mzoom .mtool').length") === 2,
    'มีปุ่มซูม .mzoom 2 ปุ่ม (ซูมเข้า/ซูมออก)');

  console.log('\n== ขนาดปุ่ม >= 44px (แตะง่าย) ==');
  const sizes = JSON.parse(await ev("JSON.stringify([].map.call(document.querySelectorAll('.mobile .pad, .mobile .mtool'),function(b){var st=getComputedStyle(b);if(st.display==='none'||st.visibility==='hidden')return null;var r=b.getBoundingClientRect();if(!r.width||!r.height)return null;return [b.getAttribute('data-key')||b.getAttribute('data-act'),Math.round(r.width),Math.round(r.height)];}).filter(Boolean))"));
  const small = sizes.filter(s => s[1] < 44 || s[2] < 44);
  ok(small.length === 0, 'ทุกปุ่ม >= 44px (' + sizes.map(s => s[0] + ':' + s[1] + 'x' + s[2]).join(', ') + ')');

  console.log('\n== ปุ่มเครื่องมือ 🎒 ⚒️ 📜 👥 🔊 ❌ + แถบบน ☰ ⛶ 👤 ==');
  ok(await ev("document.querySelectorAll('.mobile .mtools .mtool').length") === 6, 'มีปุ่มเครื่องมือ 6 ปุ่ม (เพิ่มปุ่ม 🔊 เสียง)');
  ok(await ev("document.querySelectorAll('.mobile .mtop .mtool').length") === 3, 'มีแถบบน 3 ปุ่ม (☰ เมนู / ⛶ เต็มจอ / 👤 ย่อสถานะ)');
  ok(await ev("document.querySelectorAll('.mobile .mtool').length") === 11, 'รวม .mtool ทั้งหมด 11 ปุ่ม (6 เมนู + 2 ซูม + 3 แถบบน)');
  ok(await ev("!!document.querySelector('.mobile .mtop .mtool[data-act=\\'toggle:menu\\']')"), 'มีปุ่ม ☰ เปิด/ปิดเมนู');
  ok(await ev("!!document.querySelector('.mobile .mtop .mtool[data-act=\\'toggle:fullscreen\\']')"), 'มีปุ่ม ⛶ เปิด/ปิดเต็มจอ');
  ok(await ev("!!document.querySelector('.mobile .mtop .mtool[data-act=\\'toggle:hud\\']')"), 'มีปุ่ม 👤 ย่อ/ขยายสถานะฮีโร่');
  ok(await ev("!!document.querySelector('.mobile .mtool[data-act=\\'toggle:inv\\']')"), 'มีปุ่ม 🎒 (toggle:inv)');
  ok(await ev("!!document.querySelector('.mobile .mtool[data-act=\\'toggle:craft\\']')"), 'มีปุ่ม ⚒️ (toggle:craft)');
  ok(await ev("!!document.querySelector('.mobile .mtool[data-act=\\'toggle:quest\\']')"), 'มีปุ่ม 📜 (toggle:quest)');
  ok(await ev("!!document.querySelector('.mobile .mtool[data-act=\\'toggle:party\\']')"), 'มีปุ่ม 👥 (toggle:party)');
  ok(await ev("!!document.querySelector('.mobile .mtool[data-act=\\'toggle:sound\\']')"), 'มีปุ่ม 🔊 เสียง (toggle:sound)');
  ok(await ev("!!document.querySelector('.mobile .mtool.close')"), 'มีปุ่ม ❌ ปิดเมนู');

  console.log('\n== P4-E: เมนูย่อได้ / ย่อสถานะฮีโร่ / เต็มจอ ==');
  ok(await ev("(function(){var m=document.querySelector('.mtools');return !!m && getComputedStyle(m).display==='none';})()"),
    'เมนูเครื่องมือซ่อนไว้ก่อน (กด ☰ ค่อยกาง)');
  const menuBtn = await centerOf('.mobile .mtop .mtool[data-act="toggle:menu"]');
  if (menuBtn) {
    await tap(menuBtn.x, menuBtn.y);
    ok(await ev("document.querySelector('.mtools').classList.contains('open')"), 'กด ☰ แล้วเมนูกาง');
    ok(await ev("getComputedStyle(document.querySelector('.mtools')).display") !== 'none', 'เมนูแสดงผลจริง');
  }
  const hudBtn = await centerOf('.mobile .mtop .mtool[data-act="toggle:hud"]');
  if (hudBtn) {
    const h0 = await ev("document.querySelector('#hud').getBoundingClientRect().height");
    await tap(hudBtn.x, hudBtn.y);
    const h1 = await ev("document.querySelector('#hud').getBoundingClientRect().height");
    ok(await ev("document.querySelector('#hud').classList.contains('hud-mini')"), 'กด 👤 แล้ว HUD เข้าโหมดย่อ');
    ok(h1 < h0, 'HUD ย่อแล้วสูงลดลง (' + Math.round(h0) + ' -> ' + Math.round(h1) + 'px)');
    await tap(hudBtn.x, hudBtn.y);
    ok(await ev("!document.querySelector('#hud').classList.contains('hud-mini')"), 'กด 👤 อีกครั้ง HUD ขยายกลับ');
  }
  ok(await ev("typeof DT.Game.toggleFullscreen === 'function'"), 'มีฟังก์ชัน toggleFullscreen');
  ok(await ev("typeof DT.Game.toggleHudMini === 'function'"), 'มีฟังก์ชัน toggleHudMini');
  ok(await ev("typeof DT.Game.toggleMobileMenu === 'function'"), 'มีฟังก์ชัน toggleMobileMenu');

  console.log('\n== ไม่มีปุ่ม action ซ้ำ 2 ชุด (แก้เมนูมุมขวาบนซ้ำ) ==');
  ok(await ev("(function(){var g=document.querySelectorAll('.topright button, .mtools button, .mtop button');var m={};for(var i=0;i<g.length;i++){var s=getComputedStyle(g[i]);if(s.display==='none'||s.visibility==='hidden')continue;var r=g[i].getBoundingClientRect();if(!r.width||!r.height)continue;var a=g[i].getAttribute('data-act')||'?';m[a]=(m[a]||0)+1;}var d=[];for(var k in m){if(m[k]>1)d.push(k+'x'+m[k]);}return d.join(',');})()") === '', 'ไม่มี data-act ใดโผล่ 2 ชุดพร้อมกัน');
  ok(await ev("(function(){var t=document.querySelector('.topright');return t?getComputedStyle(t).display==='none':true;})()"), '.topright ถูกซ่อนบนมือถือ (ใช้ .mtools ชุดเดียว)');
  ok(await ev("(function(){var m=document.querySelector('.mtools'),h=document.querySelector('.hud');if(!m||!h)return true;if(getComputedStyle(m).display==='none')return true;var a=m.getBoundingClientRect(),b=h.getBoundingClientRect();return !(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top);})()"), '.mtools ไม่ทับ HUD');

  console.log('\n== จอยอนาล็อค : ลากนิ้วไปทางขวา -> เดินและได้ความเร็วตามระยะ ==');
  const joy = await centerOf('.mjoy');
  ok(!!joy, 'หาจอย .mjoy เจอ');
  if (joy) {
    const jr = JSON.parse(await ev("JSON.stringify(document.querySelector('.mjoy').getBoundingClientRect())"));
    const jcx = jr.left + jr.width / 2, jcy = jr.top + jr.height / 2;
    /* แตะกลางจอยก่อน -> stick.active = true, mag = 0 (deadzone) */
    await tStart(jcx, jcy);
    await sleep(150);
    ok(await ev("DT.Game.stick.active === true"), 'touchstart บนจอย -> stick.active = true');
    ok(await ev("document.querySelector('.mjoy').classList.contains('on')"), 'จอยมีสถานะ .on ระหว่างกด');
    ok(await ev("DT.Game.stick.mag === 0"), 'แตะกลางจอย = ไม่ขยับ (mag = 0)');

    /* ลากไปทางขวา ~70% ของรัศมี -> mag > 0.4, x > 0 */
    await tMove(jcx + jr.width * 0.34, jcy);
    await sleep(200);
    const st = JSON.parse(await ev("JSON.stringify({x:DT.Game.stick.x,y:DT.Game.stick.y,mag:DT.Game.stick.mag,active:DT.Game.stick.active})"));
    ok(st.active === true && st.x > 0.5, 'ลากจอยไปขวา -> stick.x = ' + st.x.toFixed(2));
    ok(st.mag > 0.4 && st.mag <= 1, 'ความเร็วอนาล็อคตามระยะ (mag = ' + st.mag.toFixed(2) + ')');
    const mv0 = await ev("JSON.stringify(DT.Game.moveInput())");
    const mvIn = JSON.parse(mv0);
    ok(mvIn.analog === true && mvIn.mag > 0.4, 'moveInput() คืนอนาล็อค (analog=true, mag=' + (mvIn.mag || 0).toFixed(2) + ')');

    const p0 = await ev("[DT.Game.local.x, DT.Game.local.y]");
    await sleep(900);
    const p1 = await ev("[DT.Game.local.x, DT.Game.local.y]");
    ok(Math.abs(p1[0] - p0[0]) > 0.1 || Math.abs(p1[1] - p0[1]) > 0.1,
      'ลากจอยค้างแล้วเดินต่อเนื่อง (ขยับ ' + (Math.abs(p1[0] - p0[0]) + Math.abs(p1[1] - p0[1])).toFixed(2) + ' tile)');

    await tEnd(jcx + jr.width * 0.34, jcy);
    await sleep(200);
    const stEnd = JSON.parse(await ev("JSON.stringify({x:DT.Game.stick.x,mag:DT.Game.stick.mag,active:DT.Game.stick.active})"));
    ok(stEnd.active === false && stEnd.mag === 0, 'ปล่อยจอย -> stick reset (active=false, mag=0)');
    ok(await ev("!document.querySelector('.mjoy').classList.contains('on')"), 'จอยเอาคลาส .on ออก');
  }

  console.log('\n== ลากจอยไปทางขึ้น -> เดินขึ้น (ทิศ up) ==');
  if (joy) {
    const jr = JSON.parse(await ev("JSON.stringify(document.querySelector('.mjoy').getBoundingClientRect())"));
    const jcx = jr.left + jr.width / 2, jcy = jr.top + jr.height / 2;
    await tStart(jcx, jcy);
    await sleep(100);
    await tMove(jcx, jcy - jr.height * 0.34);
    await sleep(200);
    ok(await ev("DT.Game.stick.y < -0.5"), 'ลากจอยขึ้น -> stick.y = ' + (await ev("DT.Game.stick.y")).toFixed(2));
    ok(await ev("DT.Game.local.dir === 'up'"), 'ทิศที่หัน = up');
    await tEnd(jcx, jcy - jr.height * 0.34);
    await sleep(150);
    ok(await ev("DT.Game.stick.active === false"), 'ปล่อยจอย -> หยุดเดิน');
  }

  /* รีเซ็ตตำแหน่งผู้เล่นกลับจุดเริ่มต้น (กล้องจะตามตาม) เพื่อให้เป้าหมายบนจอแน่นอน
     — เป็นการเตรียมสภาพ ไม่ใช่การจำลองอินพุต (อินพุตยังใช้ touch จริงทั้งหมด) */
  const resetPos = async () => {
    await ev("(function(){var G=DT.Game;G.path=null;G.autoGather=null;G.autoAttack=null;G.keys={};if(G.local){G.local.x=24.5;G.local.y=24.5;}})()");
    await sleep(500);
  };
  await resetPos();

  console.log('\n== touch บน canvas : แตะสั้นที่อาคาร = เปิด popup ==');
  const bpos = await ev(`(function(){
    var bs = DT.Game.world.map.buildings, np = DT.Game.world.npcs;
    for (var i = bs.length - 1; i >= 0; i--) {
      var b = bs[i], hasNpc = false;
      for (var j = 0; j < np.length; j++) {
        if (np[j].x > b.x - 1 && np[j].x < b.x + b.w + 1 && np[j].y > b.y - 1 && np[j].y < b.y + b.h + 1) hasNpc = true;
      }
      if (hasNpc) continue;
      /* กลาง footprint ของอาคาร (กลาง diamond) = จุดที่แตะแล้วต้องโดนอาคารแน่ ๆ */
      var A = DT.Render.toScreen(b.x, b.y);
      var C = DT.Render.toScreen(b.x + b.w, b.y + b.h);
      var sx = (A.sx + C.sx) / 2, sy = (A.sy + C.sy) / 2;
      if (sx < 30 || sx > DT.Render.vw - 30 || sy < 40 || sy > DT.Render.vh - 100) continue;
      return JSON.stringify({ sx: sx, sy: sy, name: b.name });
    }
    return '';
  })()`);
  ok(!!bpos, 'หาอาคารบนจอได้');
  if (bpos) {
    const B = JSON.parse(bpos);
    const rect = JSON.parse(await ev("JSON.stringify(document.getElementById('game').getBoundingClientRect())"));
    await tap(rect.left + B.sx, rect.top + B.sy);
    const popupOpen = await ev("!!DT.Popup.open");
    ok(popupOpen, 'แตะอาคารแล้วเปิด popup (' + B.name + ')');
    if (popupOpen) {
      const pb = JSON.parse(await ev("(function(){var b=document.querySelector('#popup .popup-box'); if(!b) return '{}'; var r=b.getBoundingClientRect(); return JSON.stringify({left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height});})()"));
      if (!pb.width) { ok(false, 'หา popup-box ไม่เจอ'); }
      else {
      /* วัดกับ viewport จริงของหน้าจอ ไม่ใช่ค่าคงที่ — กัน false fail/false pass */
      const vw = await ev("window.innerWidth");
      const vh = await ev("window.innerHeight");
      ok(pb.left >= -1 && pb.top >= -1 && pb.right <= vw + 1 && pb.bottom <= vh + 1,
        'popup ไม่ล้นจอมือถือ (' + Math.round(pb.width) + 'x' + Math.round(pb.height) + ' บนจอ ' + vw + 'x' + vh + ')');
      }
      ok(await ev("getComputedStyle(document.querySelector('#popup .popup-body')).overflowY") === 'auto',
        'เนื้อหา popup เลื่อนได้');
      await ev("(function(){var b=document.querySelector('#popup .popup-x'); if(b) b.click();})()");
      await sleep(200);
      ok(!(await ev("DT.Popup.open")), 'ปิด popup ได้');
    }
  }

  await resetPos();
  console.log('\n== touch บน canvas : แตะสั้นที่ทรัพยากร = เก็บ/เดินไปเก็บ ==');
  const npos = await ev(`(function(){
    var ns = DT.Game.world.nodes || [];
    for (var i = 0; i < ns.length; i++) {
      var n = ns[i];
      if (n.amount <= 0) continue;
      var p = DT.Render.toScreen(n.x + 0.5, n.y + 0.5);
      /* ต้องอยู่ใน "พื้นที่ปลอดภัย" = ไม่ทับปุ่มมือถือมุมล่าง (dpad/act ~140px) */
      if (p.sx < 30 || p.sx > DT.Render.vw - 30 || p.sy < 40 || p.sy > DT.Render.vh - 150) continue;
      if (DT.Game.nodeAt(p.sx, p.sy) !== n) continue;          /* แตะแล้วต้องโดน node จริง */
      if (DT.Game.buildingAt(p.sx, p.sy)) continue;             /* ไม่ให้ถูกอาคารบัง */
      if (DT.Game.npcAt(p.sx, p.sy)) continue;                  /* ไม่ให้ถูก NPC บัง */
      return JSON.stringify({ sx: p.sx, sy: p.sy });
    }
    return '';
  })()`);
  if (npos) {
    const rect2 = JSON.parse(await ev("JSON.stringify(document.getElementById('game').getBoundingClientRect())"));
    /* คำนวณตำแหน่งทรัพยากรใหม่ทันทีก่อนแตะ (กล้องอาจเลื่อน) */
    const N = JSON.parse(await ev(`(function(){
      var ns = DT.Game.world.nodes || [];
      for (var i = 0; i < ns.length; i++) {
        var n = ns[i];
        if (n.amount <= 0) continue;
        var p = DT.Render.toScreen(n.x + 0.5, n.y + 0.5);
        if (p.sx < 30 || p.sx > DT.Render.vw - 30 || p.sy < 40 || p.sy > DT.Render.vh - 150) continue;
        if (DT.Game.nodeAt(p.sx, p.sy) !== n) continue;
        if (DT.Game.buildingAt(p.sx, p.sy)) continue;
        if (DT.Game.npcAt(p.sx, p.sy)) continue;
        return JSON.stringify({ sx: p.sx, sy: p.sy });
      }
      return '';
    })()`));
    await tap(rect2.left + N.sx, rect2.top + N.sy);
    ok(await ev("!!DT.Game.autoGather"), 'แตะทรัพยากรแล้วตั้ง autoGather (เดินไปเก็บ)');
    ok(await ev("!!DT.Game.path"), 'แตะทรัพยากรแล้วมีเส้นทางเดินไปเก็บ');
  } else ok(true, 'ไม่มีทรัพยากรบนจอ (ข้าม)');

  console.log('\n== touch บน canvas : กดค้าง = เดินไป (เหมือนคลิกขวา) ==');
  await ev("DT.Game.path = null; DT.Game.autoGather = null;");
  const wpos = await ev(`(function(){
    var L = DT.Game.local, map = DT.Game.world.map;
    for (var r = 1; r <= 6; r++) {
      for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
        if (dx*dx + dy*dy < 4 || dx < 1) continue;
        var tx = Math.floor(L.x) + dx, ty = Math.floor(L.y) + dy;
        if (!DT.Path.walkable(map, tx, ty)) continue;
        var p = DT.Render.toScreen(tx + 0.5, ty + 0.5);
        if (p.sx < 40 || p.sx > DT.Render.vw - 40 || p.sy < 60 || p.sy > DT.Render.vh - 120) continue;
        return JSON.stringify({ tx: tx, ty: ty, sx: p.sx, sy: p.sy });
      }
    }
    return '';
  })()`);
  if (wpos) {
    const T = JSON.parse(wpos);
    const rect3 = JSON.parse(await ev("JSON.stringify(document.getElementById('game').getBoundingClientRect())"));
    await tStart(rect3.left + T.sx, rect3.top + T.sy);
    await sleep(520);
    await tEnd(rect3.left + T.sx, rect3.top + T.sy);
    await sleep(200);
    ok(await ev("!!DT.Game.path"), 'กดค้างบน canvas แล้วเดินไป (มีเส้นทาง BFS)');
  } else ok(true, 'หา tile เดินไม่ได้ (ข้าม)');

  console.log('\n== ปุ่มเครื่องมือ: 🎒 เปิดกระเป๋า / ❌ ปิด ==');
  const inv = await centerOf('.mobile .mtool[data-act="toggle:inv"]');
  if (inv) {
    await tap(inv.x, inv.y);
    ok(await ev("DT.Game.panel") === 'inv', 'แตะ 🎒 เปิดแผงกระเป๋า');
  }
  const close = await centerOf('.mobile .mtool.close');
  if (close) {
    await tap(close.x, close.y);
    ok(await ev("DT.Game.panel") === 'none', 'แตะ ❌ ปิดแผง');
  }
  const craft = await centerOf('.mobile .mtool[data-act="toggle:craft"]');
  if (craft) {
    await tap(craft.x, craft.y);
    ok(await ev("DT.Game.panel") === 'craft', 'แตะ ⚒️ เปิดแผงคราฟต์');
  }
  const quest = await centerOf('.mobile .mtool[data-act="toggle:quest"]');
  if (quest) {
    await tap(quest.x, quest.y);
    ok(await ev("DT.Game.panel") === 'quest', 'แตะ 📜 เปิดแผงเควสต์');
  }

  console.log('\n== canvas + DPR scaling ==');
  const cv = JSON.parse(await ev("JSON.stringify((function(){var c=document.getElementById('game');return {w:c.width,h:c.height,cw:c.clientWidth,ch:c.clientHeight};})())"));
  /* retro pixel-art: backing store = CSS px x DPR / PIXEL (วาดความละเอียดต่ำแล้วขยาย pixelated) */
  const PIXEL = await ev("(DT.CFG && DT.CFG.PIXEL) || 1");
  const expect = Math.min(2, dpr) / PIXEL;
  ok(cv.w === Math.floor(cv.cw * expect) && cv.h === Math.floor(cv.ch * expect),
    'canvas.width=' + cv.w + ' = clientWidth(' + cv.cw + ') x DPR(' + Math.min(2, dpr) + ') / PIXEL(' + PIXEL + ') [retro pixel-art]');
  ok(cv.cw > 100 && cv.ch > 100, 'canvas มีขนาดจริงบนมือถือ (' + cv.cw + 'x' + cv.ch + ')');

  console.log('\n== ไม่มีการเลื่อนหน้า / ไม่ซูม ==');
  ok(await ev("(document.scrollingElement && document.scrollingElement.scrollTop) || 0") === 0, 'ไม่มีการเลื่อนหน้า');
  ok(await ev("getComputedStyle(document.body).overflow") === 'hidden', 'body overflow:hidden');
  const scaleBefore = await ev("(window.visualViewport && window.visualViewport.scale) || 1");
  const pad = await centerOf('.mobile .pad[data-key="right"]');
  if (pad) { await tap(pad.x, pad.y); await tap(pad.x, pad.y); }
  await sleep(300);
  const scaleAfter = await ev("(window.visualViewport && window.visualViewport.scale) || 1");
  ok(scaleAfter === scaleBefore, 'double-tap ไม่ทำให้ซูม (scale ' + scaleBefore + ' -> ' + scaleAfter + ')');

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
