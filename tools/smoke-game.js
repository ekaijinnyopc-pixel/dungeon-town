/* Smoke test เกม Dungeon Town ผ่าน headless Chromium + CDP
   ใช้: node tools/smoke-game.js
   - เปิด file://index.html
   - กดปุ่ม "เข้าเมือง"
   - เดิน 2 วินาที, เก็บของ, กดคราฟต์, เปิดกระเป๋า
   - ยืนยันว่าไม่มี JS error เลย + เก็บ screenshot
*/
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

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


/* wait until game booted - race guard for slow machines */
async function waitGameStart(evaluate, timeoutMs = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { if (await evaluate("!!(DT.Game && DT.Game.local)")) return true; } catch (e) {}
    await sleep(200);
  }
  return false;
}


const ROOT = path.join(__dirname, '..');
const PORT = 9333;
const URL_FILE = 'file://' + path.join(ROOT, 'index.html');
const OUT = path.join(ROOT, 'dist');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async function main() {
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-cdp-'));
  const chrome = spawn('/usr/bin/chromium', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--window-size=1100,780', '--allow-file-access-from-files',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + userDir,
    'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'], detached: true });

  let chromeErr = '';
  chrome.stderr.on('data', d => { chromeErr += d.toString(); });

  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    await sleep(300);
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + '/json/list');
      const list = await r.json();
      const page = list.find(t => t.type === 'page');
      if (page) wsUrl = page.webSocketDebuggerUrl;
    } catch (e) { /* ยังไม่พร้อม */ }
  }
    __child = chrome;

if (!wsUrl) {
    console.log('❌ เปิด Chromium/CDP ไม่ได้\n' + chromeErr.slice(-800));
    killChrome(chrome); process.exit(1);
  }

  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const errors = [];
  const logs = [];
  let tableWarnings = 0;

  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      errors.push('EXCEPTION: ' + (d.exception && d.exception.description || d.text));
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const t = msg.params.type;
      const text = msg.params.args.map(a => a.value !== undefined ? a.value : (a.description || a.type)).join(' ');
      logs.push('[' + t + '] ' + text);
      if (t === 'error') errors.push('CONSOLE ERROR: ' + text);
    }
    if (msg.method === 'Log.entryAdded') {
      const e = msg.params.entry;
      logs.push('[' + e.level + '] ' + e.text);
      /* 404 ของ dungeon_town_players = ตารางยังไม่ถูก apply (ไม่ใช่บั๊กเกม)
         -> นับแยก ไม่ fail เกม */
      if (e.level === 'error') {
        if (/dungeon_town_players/.test(e.url || '')) {
          tableWarnings++;
        } else {
          errors.push('LOG ERROR: ' + e.text + ' ' + (e.url || ''));
        }
      }
    }
  });

  /* CDP socket died -> reject every pending promise so the script fails fast
     instead of waiting forever for a reply that will never arrive */
  const __die = (why) => {
    for (const [, __p] of pending) { try { __p.reject(new Error(why)); } catch (e) {} }
    pending.clear();
  };
  ws.addEventListener('close', () => __die('CDP socket closed unexpectedly'));
  ws.addEventListener('error', () => __die('CDP socket error'));
  /* timeout ด้วย: ถ้า socket ค้าง (ไม่ยิงทั้ง open และ error) ให้ fail เร็ว
     แทนการรอ forever (เคยทำให้สคริปต์ 'ดันไม่จบ') */
  await new Promise((res, rej) => {
    const __t = setTimeout(() => rej(new Error('CDP connect timeout (15s)')), 15000);
    ws.addEventListener('open', () => { clearTimeout(__t); res(); });
    ws.addEventListener('error', () => { clearTimeout(__t); rej(new Error('CDP connect failed')); });
  });

  function send(method, params) {
    return new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
    });
  }
  async function evaluate(expr) {
    const r = await send('Runtime.evaluate', {
      expression: expr, returnByValue: true, awaitPromise: true
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
    return r.result.value;
  }

  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Network.enable');

  let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } };

  console.log('\n== โหลดหน้า ==');
  await send('Page.navigate', { url: URL_FILE });
  await sleep(2200);

  ok(await evaluate("!!document.getElementById('start')"), 'หน้าเลือกอาชีพแสดง');
  ok(await evaluate("document.querySelectorAll('.prof').length") === 3, 'มีตัวเลือกอาชีพ 3 อาชีพ');

  /* เลือกช่างปลูก + ตั้งชื่อ */
  await evaluate("(function(){document.getElementById('pname').value='พี่เอ';var b=document.querySelector('.prof[data-prof=farmer]');b.click();document.getElementById('go').click();})()");
  await waitGameStart(evaluate);
  ok(await evaluate("!document.getElementById('app').classList.contains('hidden')"), 'เข้าเมืองแล้ว (หน้าเกมแสดง)');
  ok(await evaluate("!!window.DT && !!DT.Game && !!DT.Game.local"), 'DT.Game ทำงาน');
  ok(await evaluate("DT.Game.local.prof") === 'farmer', 'เลือกอาชีพช่างปลูกสำเร็จ');
  ok(await evaluate("DT.Game.world.map.buildings.length") === 5, 'โหลดแผนที่ + อาคาร 5 หลัง');
  ok(await evaluate("DT.Game.world.nodes.length") > 100, 'มี node ทรัพยากรในโลก');

  /* HUD */
  ok(await evaluate("document.getElementById('hud').innerHTML.indexOf('พี่เอ') >= 0"), 'HUD แสดงชื่อผู้เล่น');

  console.log('\n== เดิน + เก็บของ ==');
  const before = await evaluate("JSON.stringify(DT.Game.local.inv)");
  /* เดินไปหาต้นไม้ใกล้สุด แล้วกด E ค้าง */
  await evaluate("(function(){var W=DT.Game.world,L=DT.Game.local,b=null,bd=1e9;for(var i=0;i<W.nodes.length;i++){var n=W.nodes[i];if(n.type!=='tree'||n.amount<=0)continue;var d=Math.abs(n.x-L.x)+Math.abs(n.y-L.y);if(d<bd){bd=d;b=n;}}L.x=b.x+0.3;L.y=b.y+0.3;DT.Render.cam.x=L.x;DT.Render.cam.y=L.y;})()");
  await evaluate("DT.Game.keys['gather']=true");
  await sleep(2600);
  await evaluate("DT.Game.keys['gather']=false");
  const after = await evaluate("JSON.stringify(DT.Game.local.inv)");
  ok(before !== after, 'กด E แล้วของเพิ่มในกระเป๋า');
  ok(await evaluate("DT.Game.progress") >= 0, 'แถบความคืบหน้าการเก็บทำงาน');

  console.log('\n== เดินด้วย WASD ==');
  const p0 = await evaluate("DT.Game.local.x + ',' + DT.Game.local.y");
  await evaluate("DT.Game.keys['up']=true");
  await sleep(900);
  await evaluate("DT.Game.keys['up']=false");
  const p1 = await evaluate("DT.Game.local.x + ',' + DT.Game.local.y");
  ok(p0 !== p1, 'กด W แล้วตำแหน่งเปลี่ยน (' + p0 + ' -> ' + p1 + ')');

  console.log('\n== คราฟต์ ==');
  await evaluate("(function(){var L=DT.Game.local;DT.inv.add(L.inv,'wood',10);DT.inv.add(L.inv,'herb',6);DT.inv.add(L.inv,'berry',6);})()");
  await evaluate("DT.Game.togglePanel('craft')");
  await sleep(400);
  ok(await evaluate("document.getElementById('panel').classList.contains('open')"), 'เปิดแผงคราฟต์ได้');
  const craftRows = await evaluate("document.querySelectorAll('.craft-row').length");
  ok(craftRows >= 8, 'แสดงสูตรคราฟต์ ' + craftRows + ' สูตรของอาชีพ');
  const rowsOk = await evaluate("document.querySelectorAll('.craft-row.ok').length");
  ok(rowsOk > 0, 'มีสูตรที่ของพอ (' + rowsOk + ' สูตร)');
  await evaluate("(function(){var b=[...document.querySelectorAll('.craft-row button')].find(x=>!x.disabled);if(b)b.click();})()");
  await sleep(400);
  ok(await evaluate("DT.inv.count(DT.Game.local.inv,'bread') + DT.inv.count(DT.Game.local.inv,'salad') + DT.inv.count(DT.Game.local.inv,'herbal_tonic') + DT.inv.count(DT.Game.local.inv,'torch') + DT.inv.count(DT.Game.local.inv,'campfire_kit')") > 0, 'คราฟต์สำเร็จและได้ของเข้ากระเป๋า');

  console.log('\n== กระเป๋า ==');
  await evaluate("DT.Game.togglePanel('inv')");
  await sleep(400);
  ok(await evaluate("document.querySelectorAll('.inv-grid .slot').length") > 0, 'แสดงไอเทมในกระเป๋า');

  console.log('\n== โจมตี + มอนส์ ==');
  const mobTest = await evaluate("(function(){var W=DT.Game.world,L=DT.Game.local;W.mobs.length=0;W.mobs.push({id:'tm',type:'slime',x:L.x+0.4,y:L.y,hp:20,maxHp:20,dmg:4,speed:1,cd:0,hitFlash:0,target:null});L.attackCd=0;var h=L.attack(W);return h?h.hp:-1;})()");
  ok(mobTest >= 0 && mobTest < 20, 'โจมตีมอนส์ได้ (เหลือ HP ' + mobTest + ')');

  console.log('\n== กลางคืน + มอนส์เกิด ==');
  const night = await evaluate("(function(){var W=DT.Game.world;W.time=0.83;W.mobs.length=0;for(var i=0;i<40;i++)W.spawnNight();return W.mobs.length;})()");
  ok(night > 0, 'กลางคืนมีมอนส์เกิด ' + night + ' ตัว');

  console.log('\n== แชท ==');
  await evaluate("(function(){var ci=document.getElementById('chat-input');ci.classList.add('open');ci.value='สวัสดี';})()");
  ok(await evaluate("document.getElementById('chat-input').classList.contains('open')"), 'ช่องแชทเปิดได้');

  console.log('\n== screenshot ==');
  await evaluate("DT.Game.togglePanel('none')");
  await sleep(300);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, 'preview-game.png'), Buffer.from(shot.data, 'base64'));
  ok(fs.statSync(path.join(OUT, 'preview-game.png')).size > 5000, 'บันทึก screenshot ได้ (' + path.join(OUT, 'preview-game.png') + ')');

  console.log('\n== Phase 2: ร้าน/เควสต์/เลเวล ==');
  await evaluate("DT.Game.togglePanel('quest')");
  await sleep(300);
  ok(await evaluate("document.querySelectorAll('.quest-row').length") === 4, 'แผงเควสต์แสดง 4 เควสต์');
  await evaluate("DT.Game.togglePanel('shop')");
  await sleep(300);
  ok(await evaluate("document.querySelectorAll('.shop-row').length") > 5, 'แผงร้านค้าแสดงสินค้า');
  ok(await evaluate("DT.Game.local.coins") > 0, 'มีเหรียญเริ่มต้น (' + await evaluate("DT.Game.local.coins") + ')');
  /* ซื้อของผ่านปุ่มในแผง */
  const coinsBefore = await evaluate("DT.Game.local.coins");
  await evaluate("(function(){var b=[...document.querySelectorAll('.shop-row button')].find(x=>!x.disabled);if(b)b.click();})()");
  await sleep(300);
  ok(await evaluate("DT.Game.local.coins") < coinsBefore, 'กดซื้อแล้วเหรียญลดลง');
  /* เควสต์ */
  await evaluate("DT.Game.togglePanel('quest')");
  await sleep(200);
  await evaluate("(function(){DT.Game.local.addQuestProgress('q_slime',5);DT.Game.refreshPanel();})()");
  await sleep(300);
  ok(await evaluate("!!document.querySelector('.quest-row.ready button')"), 'เควสต์ครบแล้วขึ้นปุ่มรับรางวัล');
  const c2 = await evaluate("DT.Game.local.coins");
  await evaluate("(function(){var b=document.querySelector('.quest-row.ready button');if(b)b.click();})()");
  await sleep(300);
  ok(await evaluate("DT.Game.local.coins") > c2, 'รับรางวัลแล้วเหรียญเพิ่ม');

  console.log('\n== Phase 2: NPC + กองไฟ ==');
  ok(await evaluate("DT.Game.world.npcs.length") === 3, 'มี NPC 3 คน');
  const npcPos = await evaluate("JSON.stringify(DT.Game.world.npcs[0])");
  await evaluate("(function(){var n=DT.Game.world.npcs[0];DT.Game.local.x=n.x;DT.Game.local.y=n.y+0.5;})()");
  await evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{key:'f',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keyup',{key:'f',bubbles:true}));");
  await sleep(300);
  ok(await evaluate("DT.Game.panel") === 'shop', 'กด F ใกล้ NPC เปิดร้าน');
  await evaluate("(function(){DT.inv.add(DT.Game.local.inv,'campfire_kit',1);DT.Game.local.placeCampfire(DT.Game.world);})()");
  ok(await evaluate("DT.Game.world.campfires.length") > 0, 'วางกองไฟได้');

  console.log('\n== Phase 2: เลเวล/XP ==');
  await evaluate("DT.Game.local.addXp(70)");
  ok(await evaluate("DT.Game.local.level") === 2, 'เลเวลขึ้นเป็น 2');
  ok(await evaluate("DT.Game.local.maxHp") === 115, 'HP สูงสุดเพิ่มเป็น 115');

  console.log('\n== console errors ==');
  if (errors.length) {
    errors.slice(0, 12).forEach(e => console.log('  ⚠️ ' + e));
  }
  ok(errors.length === 0, 'ไม่มี JS error (' + errors.length + ' รายการ)');
  if (tableWarnings) console.log('  ℹ️  404 ตาราง dungeon_town_players x' + tableWarnings + ' (รอพี่เอรัน SQL — ไม่กระทบเกม)');

  console.log('\n———— ผล: ' + pass + ' ผ่าน / ' + fail + ' ล้มเหลว ————');
  ws.close();
  killChrome(chrome);
  try { fs.rmSync(userDir, { recursive: true, force: true }); } catch (e) {}
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.log('❌ ระหว่างรัน: ' + (e && e.message || e));
  __cleanup();
  process.exit(1);
});
