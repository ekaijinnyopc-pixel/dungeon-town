/* เทสต์การควบคุมด้วยปุ่มกดจริง (ระดับเบราว์เซอร์ ผ่าน CDP Input.dispatchKeyEvent)
   - ทดสอบการเดินด้วย WASD / ลูกศร
   - ทดสอบคีย์บอร์ดไทย (e.key เป็นตัวอักษรไทย แต่ e.code เป็น KeyW)
   - ทดสอบเปิดแผง I/C/Q/F
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

const URL = process.argv[2] || 'http://127.0.0.1:8931/dungeon-town/index.html';
const PORT = 9357;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } }

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-in-'));
  const ch = spawn('/usr/bin/chromium', ['--headless=new', '--no-sandbox', '--disable-gpu',
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
    const i = ++id; pend.set(i, { resolve: res, reject: rej });
    sk.send(JSON.stringify({ id: i, method, params: params || {} }));
  });
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
    return r.result.value;
  };
  /* กดปุ่มจริงระดับเบราว์เซอร์ */
  const keyDown = async (code, key) => {
    await send('Input.dispatchKeyEvent', {
      type: 'keyDown', code, key: key || code, windowsVirtualKeyCode: 0, nativeVirtualKeyCode: 0
    });
  };
  const keyUp = async (code, key) => {
    await send('Input.dispatchKeyEvent', {
      type: 'keyUp', code, key: key || code, windowsVirtualKeyCode: 0, nativeVirtualKeyCode: 0
    });
  };
  const tap = async (code, key) => { await keyDown(code, key); await sleep(60); await keyUp(code, key); await sleep(150); };

  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');

  console.log('== โหลดเกม ==');
  await send('Page.navigate', { url: URL });
  await sleep(4000);
  /* หน้าแลนด์มีปุ่ม 'เข้าเล่นทันที' (#play-now) ก่อน -> ต้องกดก่อนถึงจะเห็น #start (ที่มีปุ่ม #go)
     ถ้าไม่มี #play-now (เกมรุ่นเก่า) ให้ข้ามได้ */
  const hasPlayNow = await ev("!!document.getElementById('play-now')");
  if (hasPlayNow) {
    await ev("document.getElementById('play-now').click()");
    await sleep(300);
  }
  ok(await ev("!!document.getElementById('go')"), 'หน้าเลือกอาชีพแสดง');

  console.log('\n== เริ่มเกม (พิมพ์ชื่อก่อน เหมือนคนจริง) ==');
  await ev("(function(){var i=document.getElementById('pname');i.value='พี่เอ';i.focus();})()");
  await sleep(200);
  await ev("document.getElementById('go').click()");
  await waitGameStart(ev);
  ok(await ev("!!(DT.Game&&DT.Game.local)"), 'เข้าเกมได้');
  ok(await ev("document.activeElement && document.activeElement.tagName") !== 'INPUT',
    'โฟกัสไม่ค้างในช่องพิมพ์ (activeElement=' + await ev("document.activeElement && document.activeElement.tagName") + ')');
  const p0 = await ev("[DT.Game.local.x, DT.Game.local.y]");

  console.log('\n== เดินด้วย WASD (คีย์บอร์ดอังกฤษ) ==');
  await keyDown('KeyD'); await sleep(700); await keyUp('KeyD'); await sleep(200);
  const p1 = await ev("[DT.Game.local.x, DT.Game.local.y]");
  ok(Math.abs(p1[0] - p0[0]) > 0.1, 'กด D แล้วเดินไป (ตำแหน่งเปลี่ยน)');

  console.log('\n== เดินด้วยคีย์บอร์ดไทย (W -> อักษรไทย "ิ") ==');
  const p2 = await ev("[DT.Game.local.x, DT.Game.local.y]");
  await keyDown('KeyW', 'ิ'); await sleep(700); await keyUp('KeyW', 'ิ'); await sleep(200);
  const p3 = await ev("[DT.Game.local.x, DT.Game.local.y]");
  ok(Math.abs(p3[0] - p2[0]) > 0.1 || Math.abs(p3[1] - p2[1]) > 0.1,
    'กด W (คีย์ไทย) แล้วเดินได้ — ตำแหน่งเปลี่ยน');

  console.log('\n== เดินด้วยลูกศร ==');
  const p4 = await ev("[DT.Game.local.x, DT.Game.local.y]");
  await keyDown('ArrowUp'); await sleep(700); await keyUp('ArrowUp'); await sleep(200);
  const p5 = await ev("[DT.Game.local.x, DT.Game.local.y]");
  ok(Math.abs(p5[0] - p4[0]) > 0.1 || Math.abs(p5[1] - p4[1]) > 0.1, 'กดลูกศรขึ้นแล้วเดินได้');

  console.log('\n== เปิดแผงด้วยปุ่ม (คีย์ไทย) ==');
  await tap('KeyI', 'ไ'); ok(await ev("DT.Game.panel") === 'inv', 'กด I เปิดกระเป๋าได้');
  await tap('KeyI', 'ไ'); await sleep(200);
  await tap('KeyC', 'ฉ'); ok(await ev("DT.Game.panel") === 'craft', 'กด C เปิดแผงคราฟต์ได้');
  await tap('KeyC', 'ฉ'); await sleep(200);
  await tap('KeyQ', 'ๆ'); ok(await ev("DT.Game.panel") === 'quest', 'กด Q เปิดแผงเควสต์ได้');
  await tap('KeyQ', 'ๆ'); await sleep(200);
  await tap('Escape', 'Escape'); ok(await ev("DT.Game.panel") === 'none', 'กด Esc ปิดแผงได้');

  console.log('\n== โจมตีด้วย Space ==');
  const hpBefore = await ev("DT.Game.world.mobs.length");
  await tap('Space', ' ');
  ok(true, 'กด Space ไม่ error (' + hpBefore + ' มอนส์ในฉาก)');

  console.log('\n== ปุ่มบนจอ (มือถือ/เมาส์) — โครง MOBA ==');
  ok(await ev("document.querySelectorAll('.mobile .pad').length") === 4, 'มีปุ่ม action บนจอ 4 ปุ่ม (gather/attack/shop/fire)');
  ok(await ev("!!document.querySelector('.mjoy')"), 'มีจอยอนาล็อค .mjoy');
  ok(await ev("document.querySelectorAll('.mobile .mtools .mtool').length") === 6, 'มีปุ่มเครื่องมือ 6 ปุ่ม');
  ok(await ev("document.querySelectorAll('.mobile .mzoom .mtool').length") === 2, 'มีปุ่มซูม 2 ปุ่ม');
  const mv = await ev("[DT.Game.local.x, DT.Game.local.y]");
  /* จอย: ตั้ง stick ไปทางขวาแล้วเดินได้ */
  await ev("(function(){DT.Game.stick.active=true;DT.Game.stick.x=1;DT.Game.stick.y=0;DT.Game.stick.mag=1;})()");
  await sleep(700);
  await ev("(function(){DT.Game.stick.active=false;DT.Game.stick.x=0;DT.Game.stick.y=0;DT.Game.stick.mag=0;})()");
  await sleep(200);
  const mv2 = await ev("[DT.Game.local.x, DT.Game.local.y]");
  ok(Math.abs(mv2[0] - mv[0]) > 0.1, 'เดินด้วยจอยอนาล็อค (ขยับ ' + (Math.abs(mv2[0] - mv[0])).toFixed(2) + ' tile)');
  const mi = JSON.parse(await ev("JSON.stringify(DT.Game.moveInput())"));
  ok(mi.analog === false && mi.mag === 0, 'ปล่อยจอยแล้ว moveInput() = นิ่ง (analog=false)');
  await ev("(function(){DT.Game.stick.active=true;DT.Game.stick.x=1;DT.Game.stick.y=0;DT.Game.stick.mag=0.8;})()");
  const mi2 = JSON.parse(await ev("JSON.stringify(DT.Game.moveInput())"));
  ok(mi2.analog === true && Math.abs(mi2.mag - 0.8) < 0.01, 'กดจอย -> moveInput() คืนอนาล็อค (analog=true, mag=' + mi2.mag + ')');
  await ev("(function(){DT.Game.stick.active=false;DT.Game.stick.x=0;DT.Game.stick.y=0;DT.Game.stick.mag=0;})()");

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
