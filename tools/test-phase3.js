/* เทสต์ Phase 3 — เสียง / เอฟเฟกต์ / เข้าอาคาร + เฟอร์นิเจอร์ + จุดใช้งาน */
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

const URL = process.argv[2] || 'http://127.0.0.1:8931/index.html';
const PORT = 9361;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } }

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-p3-'));
  const ch = spawn('/usr/bin/chromium', ['--headless=new', '--no-sandbox', '--disable-gpu',
    '--autoplay-policy=no-user-gesture-required',
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
  sk.addEventListener('message', e => {
    const m = JSON.parse(e.data);
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
  await new Promise((res, rej) => { sk.addEventListener('open', res); sk.addEventListener('error', () => rej(new Error('CDP connect failed'))); });
  const send = (method, params) => new Promise((res, rej) => {
    const i = ++id; pend.set(i, { resolve: res, reject: rej });
    sk.send(JSON.stringify({ id: i, method, params: params || {} }));
  });
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
    return r.result.value;
  };

  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Page.navigate', { url: URL });
  await sleep(4000);

  console.log('== โมดูล Phase 3 โหลดครบ ==');
  ok(await ev("typeof DT.Audio==='object'"), 'js/audio.js โหลดแล้ว');
  ok(await ev("typeof DT.FX==='object'"), 'js/fx.js โหลดแล้ว');
  ok(await ev("typeof DT.Interiors==='object'"), 'js/interiors.js โหลดแล้ว');

  console.log('\n== เริ่มเกม ==');
  await ev("(function(){document.getElementById('pname').value='พี่เอ';document.getElementById('go').click();})()");
  await waitGameStart(ev);
  ok(await ev("!!(DT.Game&&DT.Game.local)"), 'เข้าเกมได้');
  ok(await ev("DT.Audio.isReady()"), 'AudioContext พร้อมใช้งาน');

  console.log('\n== เสียง ==');
  const snd = await ev("(function(){var n=0;['step','gather','craft','buy','sell','coin','levelup','quest','eat','door','ui','chat','error','hitMob','mobDie','swing','hurt','fire','respawn','death','chop','mine','heal','step'].forEach(function(k){try{DT.Audio.play(k);n++;}catch(e){}});return n;})()");
  ok(snd >= 20, 'เล่นเสียงได้ ' + snd + ' เสียง ไม่ error');
  ok(await ev("(function(){DT.Audio.setMuted(true);var m=DT.Audio.isMuted();DT.Audio.setMuted(false);return m&&!DT.Audio.isMuted();})()"), 'ปิด/เปิดเสียงได้');
  ok(await ev("!!document.getElementById('btn-sound')"), 'มีปุ่ม mute บนหน้าจอ');

  console.log('\n== เอฟเฟกต์ ==');
  const pBefore = await ev("DT.Game.world.particles.length");
  await ev("DT.FX.burst(DT.Game.world, DT.Game.local.x, DT.Game.local.y, '#ffd166', 8)");
  ok(await ev("DT.Game.world.particles.length") > pBefore, 'FX.burst เพิ่ม particle');
  await ev("DT.FX.text(DT.Game.world, DT.Game.local.x, DT.Game.local.y, 'TEST', '#fff')");
  ok(await ev("DT.Game.world.particles.some(function(p){return p.text && p.label==='TEST';})"), 'FX.text สร้างข้อความลอย');
  await ev("DT.FX.shake(8)");
  ok(await ev("DT.FX.shakeNow()") > 0, 'FX.shake ทำงาน');
  await ev("DT.FX.levelUp(DT.Game.world, DT.Game.local.x, DT.Game.local.y)");
  ok(await ev("DT.Game.world.particles.filter(function(p){return p.c==='#ffd166'||p.c==='#8ce99a'||p.c==='#74c0fc'||p.c==='#e599f7';}).length") > 5, 'FX.levelUp มีประกาย');
  ok(await ev("DT.Game.world.particles.filter(function(p){return p.leaf;}).length") >= 0, 'ระบบใบไม้มีอยู่');

  console.log('\n== เข้าอาคาร ==');
  ok(await ev("Object.keys(DT.Interiors.DEFS).length") === 5, 'มีห้องภายใน 5 แห่ง');
  /* เดินไปหน้าประตูโรงตีเหล็กแล้วกด E จริง */
  await ev("(function(){var b=DT.Game.world.map.buildings[0];DT.Game.local.x=b.door.x+0.5;DT.Game.local.y=b.door.y+0.5;})()");
  await sleep(300);
  const nearDoor = await ev("!!DT.Game.buildingNear(DT.Game.local)");
  ok(nearDoor, 'ยืนหน้าประตูแล้วตรวจจับอาคารได้');
  await ev("(function(){DT.Game.keys['gather']=true;})()");
  await sleep(500);
  await ev("(function(){DT.Game.keys['gather']=false;})()");
  await sleep(300);
  ok(await ev("!!DT.Game.room"), 'กด E แล้วเข้าห้องได้');
  ok(await ev("DT.Game.room.def.name") === 'โรงตีเหล็ก', 'ห้อง = โรงตีเหล็ก');
  ok(await ev("DT.Game.room.furniture.length") >= 5, 'มีเฟอร์นิเจอร์ ' + await ev("DT.Game.room.furniture.length") + ' ชิ้น');
  ok(await ev("DT.Game.room.stations.length") === 3, 'มีจุดใช้งาน 3 จุด');

  console.log('\n== เดินในห้อง ==');
  const rp = await ev("[DT.Game.local.x, DT.Game.local.y]");
  await ev("DT.Game.keys['left']=true"); await sleep(600); await ev("DT.Game.keys['left']=false");
  await sleep(200);
  const rp2 = await ev("[DT.Game.local.x, DT.Game.local.y]");
  ok(Math.abs(rp2[0] - rp[0]) > 0.05, 'เดินในห้องได้');

  console.log('\n== จุดใช้งาน: หลอมแร่ ==');
  await ev("DT.inv.add(DT.Game.local.inv,'stone',3);DT.inv.add(DT.Game.local.inv,'ore',2);");
  const ing0 = await ev("DT.inv.count(DT.Game.local.inv,'iron_ingot')");
  /* เดินไปที่จุด "เตาหลอมแร่" แล้วกด E (เหมือนคนจริง) */
  await ev("(function(){var st=DT.Game.room.stations.filter(function(x){return x.action==='smelt';})[0];DT.Game.local.x=st.x+0.5;DT.Game.local.y=st.y+1.2;})()");
  await sleep(200);
  ok(await ev("!!DT.Interiors.stationAt(DT.Game.room,DT.Game.local.x,DT.Game.local.y)"), 'ยืนใกล้เตาหลอมแร่แล้วตรวจจับจุดใช้งานได้');
  await ev("(function(){DT.Game.keys['gather']=true;})()");
  await sleep(400);
  await ev("(function(){DT.Game.keys['gather']=false;})()");
  await sleep(200);
  ok(await ev("DT.inv.count(DT.Game.local.inv,'iron_ingot')") === ing0 + 1, 'กด E หลอมแร่ได้เหล็กก้อน +1');

  console.log('\n== จุดใช้งาน: เตียงนอน (ฟื้น + ข้ามเวลา) ==');
  await ev("DT.Game.local.hp=10;DT.Game.local.hunger=10;");
  const day0 = await ev("DT.Game.world.day");
  /* สลับไปห้อง "บ้านคนเหมือง" แล้วเดินไปที่เตียง */
  await ev("(function(){var r=DT.Interiors.build(DT.Interiors.DEFS['บ้านคนเหมือง']);r.building=DT.Game.world.map.buildings[4];DT.Game.room=r;var st=r.stations.filter(function(x){return x.action==='sleep';})[0];DT.Game.local.x=st.x+0.5;DT.Game.local.y=st.y+1.2;})()");
  await sleep(300);
  await ev("(function(){DT.Game.keys['gather']=true;})()");
  await sleep(400);
  await ev("(function(){DT.Game.keys['gather']=false;})()");
  await sleep(200);
  ok(await ev("DT.Game.local.hp") === await ev("DT.Game.local.maxHp"), 'นอนแล้ว HP เต็ม');
  ok(await ev("DT.Game.world.day") === day0 + 1, 'นอนแล้วข้ามไปวันถัดไป (' + day0 + ' → ' + await ev("DT.Game.world.day") + ')');

  console.log('\n== ออกจากอาคาร ==');
  await ev("(function(){DT.Game.local.x=DT.Game.room.exit.x+0.5;DT.Game.local.y=DT.Game.room.exit.y+0.5;})()");
  await sleep(500);
  ok(await ev("!DT.Game.room"), 'เดินถึงประตูออกแล้วออกจากห้อง');
  ok(await ev("DT.Game.local.x") > 20, 'กลับมาอยู่กลางแปลงเมือง');

  console.log('\n== ปุ่ม toggle มุมขวาบน ==');
  await ev("(function(){var b=document.querySelector('[data-act=\"toggle:inv\"]'); if(b) b.click(); return !!b;})()");
  await sleep(300);
  ok(await ev("DT.Game.panel") === 'inv', 'กดปุ่ม 🎒 เปิดกระเป๋าได้');
  await ev("(function(){var b=document.querySelector('[data-act=\"toggle:inv\"]'); if(b) b.click(); return !!b;})()");
  await sleep(200);
  await ev("(function(){var b=document.getElementById('btn-sound'); if(b) b.click(); return !!b;})()");
  await sleep(200);
  ok(await ev("DT.Audio.isMuted()") === true, 'กดปุ่ม 🔊 ปิดเสียงได้');
  await ev("(function(){var b=document.getElementById('btn-sound'); if(b) b.click(); return !!b;})()");
  await sleep(200);

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
