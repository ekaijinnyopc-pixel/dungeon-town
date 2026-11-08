/* เทสต์ mouse-first ด้วยการคลิกจริงระดับเบราว์เซอร์ (CDP Input.dispatchMouseEvent)
   - คลิกขวา = เดินไป / โจมตี
   - คลิกซ้าย = เปิด popup (อาคาร / NPC) + แท็บภายใน
   - popup ไม่ทะลุลง canvas
   ใช้: node tools/test-mouse.js [url]
*/
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');

/* cleanup: kill chromium process group (parent + children) */
function killChrome(ch) {
  try { process.kill(-ch.pid, 'SIGKILL'); } catch (e) {}
  try { ch.kill('SIGKILL'); } catch (e) {}
}

const ROOT = path.join(__dirname, '..');
const URL = process.argv[2] || ('file://' + path.join(ROOT, 'index.html'));
const PORT = 9359;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } }

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-mouse-'));
  const ch = spawn('/usr/bin/chromium', ['--headless=new', '--no-sandbox', '--disable-gpu',
    '--window-size=1100,780', '--allow-file-access-from-files',
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
  await new Promise(r => sk.addEventListener('open', r));
  const send = (method, params) => new Promise((res, rej) => {
    const i = ++id; pend.set(i, { resolve: res, reject: rej });
    sk.send(JSON.stringify({ id: i, method, params: params || {} }));
  });
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
    return r.result.value;
  };
  const mouse = async (type, x, y, button, buttons) => {
    await send('Input.dispatchMouseEvent', {
      type, x: Math.round(x), y: Math.round(y),
      button: button || 'none', buttons: buttons || 0,
      clickCount: type === 'mousePressed' ? 1 : 0
    });
  };
  const rightClick = async (x, y) => {
    await mouse('mouseMoved', x, y);
    await mouse('mousePressed', x, y, 'right', 2);
    await sleep(60);
    await mouse('mouseReleased', x, y, 'right', 0);
    await sleep(150);
  };
  const leftClick = async (x, y) => {
    await mouse('mouseMoved', x, y);
    await mouse('mousePressed', x, y, 'left', 1);
    await sleep(60);
    await mouse('mouseReleased', x, y, 'left', 0);
    await sleep(200);
  };

  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');

  console.log('== โหลดเกม ==');
  await send('Page.navigate', { url: URL });
  await sleep(4000);
  await ev("document.getElementById('go').click()");
  await sleep(2500);
  ok(await ev("!!(DT.Game&&DT.Game.local)"), 'เข้าเกมได้');
  /* เก็บ rect ของ canvas (viewport coords = canvas CSS px + rect) */
  const rect = await ev("JSON.stringify(document.getElementById('game').getBoundingClientRect())");
  const R = JSON.parse(rect);
  const cx = v => R.left + v, cy = v => R.top + v;
  ok(R.width > 100 && R.height > 100, 'canvas มีขนาดจริง (' + Math.round(R.width) + 'x' + Math.round(R.height) + ')');

  console.log('\n== คลิกขวา = เดินไป ==');
  const p0 = await ev("[DT.Game.local.x, DT.Game.local.y]");
  /* เลือก tile ที่เดินได้ 3 ช่องไปทางขวาในโลก */
  const target = await ev(`(function(){
    var L = DT.Game.local, map = DT.Game.world.map;
    for (var r = 1; r <= 6; r++) {
      for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
        var tx = Math.floor(L.x) + dx, ty = Math.floor(L.y) + dy;
        if (dx*dx + dy*dy < 4 || dx < 1) continue;
        if (!DT.Path.walkable(map, tx, ty)) continue;
        var p = DT.Render.toScreen(tx + 0.5, ty + 0.5);
        if (p.sx < 40 || p.sx > DT.Render.vw - 40 || p.sy < 40 || p.sy > DT.Render.vh - 40) continue;
        return JSON.stringify({ tx: tx, ty: ty, sx: p.sx, sy: p.sy });
      }
    }
    return '';
  })()`);
  ok(!!target, 'หา tile เป้าหมายได้');
  const T = JSON.parse(target);
  await rightClick(cx(T.sx), cy(T.sy));
  ok(await ev("!!DT.Game.path"), 'คลิกขวาแล้วมีเส้นทาง (BFS)');
  await sleep(2600);
  const p1 = await ev("[DT.Game.local.x, DT.Game.local.y]");
  const dist = Math.abs(p1[0] - p0[0]) + Math.abs(p1[1] - p0[1]);
  ok(dist > 0.5, 'เดินไปถึงเป้าหมาย (ขยับ ' + dist.toFixed(2) + ' tile)');
  ok(await ev("Math.abs(DT.Game.local.x - " + (T.tx + 0.5) + ") < 1.6 && Math.abs(DT.Game.local.y - " + (T.ty + 0.5) + ") < 1.6"),
    'ตำแหน่งใกล้ tile เป้าหมาย');

  console.log('\n== คลิกซ้ายที่อาคาร = เปิด popup ==');
  /* เลือกอาคารที่ไม่มี NPC ยืนทับ (ไม่งั้นจะโดน NPC ก่อน) */
  const bpos = await ev(`(function(){
    var bs = DT.Game.world.map.buildings;
    var vw = DT.Render.vw, vh = DT.Render.vh;
    for (var i = 0; i < bs.length; i++) {
      var b = bs[i];
      /* top-down: อาคารเป็นสี่เหลี่ยมบนจอ — เลือกจุดในส่วนที่ "เห็นจริง" (rect ∩ จอ)
         และต้อง hit-test ได้ตรงอาคารนั้น และไม่ทับ NPC */
      var r = DT.Render.buildingRect(b);
      var x0 = Math.max(r.x + 6, 12), x1 = Math.min(r.x + r.w - 6, vw - 12);
      var y0 = Math.max(r.y + 6, 12), y1 = Math.min(r.y + r.h - 6, vh - 12);
      if (x1 <= x0 || y1 <= y0) continue;
      var px = (x0 + x1) / 2, py = (y0 + y1) / 2;
      var hit = DT.Game.buildingAt(px, py);
      if (!hit || hit.name !== b.name) continue;
      if (DT.Game.npcAt(px, py)) continue;
      return JSON.stringify({ sx: px, sy: py, name: b.name });
    }
    return '';
  })()`);
  ok(!!bpos, 'เลือกอาคารที่ทดสอบได้');
  const B = JSON.parse(bpos);
  await leftClick(cx(B.sx), cy(B.sy));
  ok(await ev("DT.Popup.open"), 'เปิด popup แล้ว');
  ok((await ev("DT.Popup.title") || '').indexOf(B.name) >= 0, 'ชื่อ popup ตรงกับอาคาร (' + (await ev("DT.Popup.title")) + ')');
  ok((await ev("DT.Popup.tabs.length")) > 1, 'มีแท็บใน popup (' + (await ev("DT.Popup.tabs.join(',')")) + ')');
  ok(await ev("document.getElementById('popup').classList.contains('open')"), 'popup แสดงบนหน้าจอ');

  console.log('\n== แท็บใน popup สลับได้ ==');
  const tabId = await ev("DT.Popup.tabs[1]");
  await ev("(function(){var bs=document.querySelectorAll('#popup .ptab');for(var i=0;i<bs.length;i++){if(bs[i].getAttribute('data-act').indexOf('popup:tab:'+DT.Popup.tabs[1])>=0){bs[i].click();return true;}}return false;})()");
  await sleep(300);
  ok((await ev("DT.Popup.active")) === tabId, 'เปลี่ยนแท็บเป็น ' + tabId);

  console.log('\n== popup ไม่ทะลุลง canvas ==');
  const posBefore = await ev("[DT.Game.local.x, DT.Game.local.y]");
  /* คลิกที่กลาง popup (บน popup-box) — ต้องไม่ทำให้ตัวละครขยับ */
  const popRect = JSON.parse(await ev("JSON.stringify(document.querySelector('#popup .popup-box').getBoundingClientRect())"));
  await leftClick(popRect.left + popRect.width / 2, popRect.top + 8);
  await sleep(400);
  const posAfter = await ev("[DT.Game.local.x, DT.Game.local.y]");
  ok(Math.abs(posAfter[0] - posBefore[0]) < 0.01 && Math.abs(posAfter[1] - posBefore[1]) < 0.01,
    'คลิกใน popup แล้วตัวละครไม่ขยับ');

  console.log('\n== ปิด popup ==');
  await ev("(function(){var bs=document.querySelectorAll('#popup .popup-x');if(bs[0])bs[0].click();})()");
  await sleep(300);
  ok(!(await ev("DT.Popup.open")), 'ปิด popup ได้');

  console.log('\n== คลิกซ้ายที่ NPC = เปิด popup ==');
  const np = JSON.parse(await ev(`(function(){
    var n = DT.Game.world.npcs[0];
    var p = DT.Render.toScreen(n.x, n.y);
    return JSON.stringify({ sx: p.sx, sy: p.sy - 16, name: n.name });
  })()`));
  await leftClick(cx(np.sx), cy(np.sy));
  ok(await ev("DT.Popup.open"), 'เปิด popup ของ NPC ได้');
  ok((await ev("DT.Popup.source")) === 'npc', 'source = npc');
  ok((await ev("DT.Popup.title") || '').indexOf(np.name) >= 0, 'ชื่อ popup = ' + (await ev("DT.Popup.title")));

  console.log('\n== คลิกขวาที่มอนส์ = โจมตี ==');
  const mobRaw = await ev(`(function(){
    var m = DT.Game.world.mobs[0];
    if (!m) return '';
    var p = DT.Render.toScreen(m.x, m.y);
    return JSON.stringify({ sx: p.sx, sy: p.sy - 10, hp: m.hp });
  })()`);
  const mob = mobRaw ? JSON.parse(mobRaw) : null;
  if (mob) {
    /* ย้ายผู้เล่นไปใกล้มอนส์ก่อน แล้วคลิกขวาที่มอนส์ */
    await ev(`(function(){
      var m = DT.Game.world.mobs[0];
      DT.Game.local.x = m.x - 1.2; DT.Game.local.y = m.y - 0.6;
    })()`);
    await sleep(400);
    const hpBefore = await ev("DT.Game.world.mobs[0] ? DT.Game.world.mobs[0].hp : -1");
    await rightClick(cx(mob.sx), cy(mob.sy));
    await sleep(400);
    const hpAfter = await ev("DT.Game.world.mobs[0] ? DT.Game.world.mobs[0].hp : -1");
    ok(hpAfter < hpBefore || hpAfter === -1, 'มอนส์เสีย HP (' + hpBefore + ' → ' + hpAfter + ')');
  } else ok(true, 'ไม่มีมอนส์ในฉากตอนทดสอบ (ข้าม)');

  console.log('\n== error ==');
  ok(errors.length === 0, 'ไม่มี JS error (' + errors.length + ')' + (errors.length ? ' → ' + errors.slice(0, 3).join(' | ') : ''));

  console.log('\n———— ผล: ' + pass + ' ผ่าน / ' + fail + ' ล้มเหลว ————');
  sk.close(); killChrome(ch);
  try { fs.rmSync(ud, { recursive: true, force: true }); } catch (e) { }
  process.exit(fail ? 1 : 0);
})();
