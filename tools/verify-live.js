/* Live verification — ยืนยันฟีเจอร์หลักของเกมบน URL จริง (source / dist / live)
   ใช้: node tools/verify-live.js [url]
   ตัวอย่าง: node tools/verify-live.js http://127.0.0.1:8931/dungeon-town/index.html
*/
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');

/* cleanup: kill chromium process group (parent + children) */
function killChrome(ch) {
  try { process.kill(-ch.pid, 'SIGKILL'); } catch (e) {}
  try { ch.kill('SIGKILL'); } catch (e) {}
}

/* ---- global cleanup net (module scope) ----
   ถ้าสคริปต์ crash กลางทาง ให้ฆ่า chromium ด้วยเสมอ ไม่งั้นจะเหลือ orphan process */
let __child = null;
let __cleaned = false;
function __cleanup() {
  if (__cleaned) return; __cleaned = true;
  if (__child) { try { killChrome(__child); } catch (e) {} }
}
process.on('exit', __cleanup);
process.on('uncaughtException', (e) => { console.error('UNCAUGHT: ' + (e && e.stack || e)); __cleanup(); process.exit(1); });
process.on('unhandledRejection', (e) => { console.error('UNHANDLED REJECTION: ' + (e && e.stack || e)); __cleanup(); process.exit(1); });

const URL = process.argv[2] || 'http://127.0.0.1:8931/dungeon-town/index.html';
const PORT = 9371;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } }

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-verify-'));
  const ch = spawn('/usr/bin/chromium', ['--headless=new', '--no-sandbox', '--disable-gpu',
    '--autoplay-policy=no-user-gesture-required', '--window-size=1280,800',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + ud, 'about:blank'],
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
  const jsErrors = [];
  sk.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params && m.params.exceptionDetails;
      jsErrors.push((d && (d.exception && d.exception.description || d.text)) || 'unknown');
    }
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

  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Page.navigate', { url: URL });
  await sleep(3000);

  /* รอให้สคริปต์โหลดครบ แล้วกด #play-now (หน้าแลนด์ใหม่) */
  for (let i = 0; i < 40; i++) {
    try { if (await ev("typeof DT !== 'undefined'")) break; } catch (e) {}
    await sleep(250);
  }
  if (await ev("!!document.getElementById('play-now')").catch(() => false)) {
    await ev("document.getElementById('play-now').click()");
    await sleep(400);
  }

  console.log('=== URL: ' + URL + ' ===');
  console.log('\n== หน้าแลนด์ + เลือกอาชีพ ==');
  ok(await ev("!!document.getElementById('pname')"), 'มีช่องกรอกชื่อตัวละคร');
  ok(await ev("!!document.getElementById('go')"), 'มีปุ่ม #go เข้าเกม');

  /* เข้าเกม */
  await ev("(function(){var i=document.getElementById('pname');if(i)i.value='พี่เอ';document.getElementById('go').click();})()");
  for (let i = 0; i < 60; i++) {
    try { if (await ev("!!(DT.Game && DT.Game.local)")) break; } catch (e) {}
    await sleep(250);
  }

  console.log('\n== บูตเกม + โมดูล ==');
  ok(await ev("!!(DT.Game && DT.Game.local)"), 'เข้าเกมได้');
  ok(await ev("typeof DT.Render==='object'"), 'js/render.js โหลดแล้ว');
  ok(await ev("typeof DT.Sprites==='object'"), 'js/sprites.js โหลดแล้ว');
  ok(await ev("typeof DT.Audio==='object'"), 'js/audio.js โหลดแล้ว');
  ok(await ev("typeof DT.FX==='object'"), 'js/fx.js โหลดแล้ว');
  ok(await ev("typeof DT.Interiors==='object'"), 'js/interiors.js โหลดแล้ว');
  ok(await ev("!!DT.Game.world && !!DT.Game.world.map"), 'มีแผนที่โลก');

  console.log('\n== พื้นหน้า texture จริง (retro tiles) ==');
  ok(await ev("!!DT.Sprites.SPEC['tiles/ground/grass.png']"), 'มี spec tile grass');
  ok(await ev("!!DT.Sprites.SPEC['tiles/ground/path.png']"), 'มี spec tile path');
  ok(await ev("!!DT.Sprites.SPEC['tiles/ground/stone.png']"), 'มี spec tile stone');
  ok(await ev("!!DT.Sprites.SPEC['tiles/ground/water.png']"), 'มี spec tile water');
  const gTiles = await ev("(function(){var n=0;for(var k in DT.Sprites.SPEC){if(k.indexOf('tiles/ground/')===0)n++;}return n;})()");
  ok(gTiles >= 8, 'มี tile พื้นครบ ' + gTiles + ' แบบ');
  const gLoaded = await ev("(function(){var n=0;for(var k in DT.Sprites.SPEC){if(k.indexOf('tiles/ground/')===0&&DT.Sprites.get(k))n++;}return n;})()");
  ok(gLoaded >= 8, 'โหลด tile พื้นสำเร็จ ' + gLoaded + ' แบบ');
  const gFailed = await ev("(function(){var n=0;for(var k in DT.Sprites.SPEC){if(k.indexOf('tiles/ground/')===0&&DT.Sprites.failed[k])n++;}return n;})()");
  ok(gFailed === 0, 'ไม่มี tile พื้นที่โหลดไม่สำเร็จ (' + gFailed + ')');

  console.log('\n== สไปรต์มอนส์ ==');
  const mobTypes = await ev("Object.keys(DT.MOBS).join(',')");
  ok(/slime/.test(mobTypes), 'มีมอนส์ slime');
  const mobLoaded = await ev("(function(){var n=0;['slime','goblin','wolf','boar','wraith'].forEach(function(t){if(DT.Sprites.get('mobs/'+t+'.png'))n++;});return n;})()");
  ok(mobLoaded >= 5, 'โหลดสไปรต์มอนส์สำเร็จ ' + mobLoaded + '/5');

  console.log('\n== easter egg: Platino (เงื่อนไข license Dawnlike) ==');
  ok(await ev("!!DT.Sprites.SPEC['mobs/platino.png']"), 'มี spec platino');
  ok(await ev("!!DT.Sprites.get('mobs/platino.png')"), 'โหลดสไปรต์ platino สำเร็จ');
  const pNode = await ev("(function(){var w=DT.Game.world;for(var i=0;i<w.nodes.length;i++){if(w.nodes[i].type==='platino')return {x:w.nodes[i].x,y:w.nodes[i].y};}return null;})()");
  ok(!!pNode, 'มี node platino ซ่อนในโลก' + (pNode ? ' (x=' + pNode.x + ', y=' + pNode.y + ')' : ''));
  ok(await ev("!!DT.NODES.platino"), 'มีนิยาม node platino ใน config');
  const platDraw = await ev("(function(){try{DT.Render.drawNode(DT.Render.ctx, {type:'platino',x:5,y:5,amount:1,max:1});return true;}catch(e){return false;}})()");
  ok(platDraw, 'วาด platino ได้ไม่ error');

  console.log('\n== ตลาด + ป้ายร้าน ==');
  ok(await ev("DT.Game.world.map.buildings.some(function(b){return b.name==='ตลาด';})"), 'มีอาคารตลาด');
  ok(await ev("(function(){var b=DT.Game.world.map.buildings.filter(function(b){return b.name==='ตลาด';})[0];return !!(b&&b.sign&&b.awning);})()"), 'ตลาดมีป้าย + หลังคาแนน');

  console.log('\n== NPC + ผู้เล่น ==');
  const npcCount = await ev("DT.Game.world.npcs.length");
  ok(npcCount >= 3, 'มี NPC ' + npcCount + ' ตัว');
  const npcSprite = await ev("(function(){var n=DT.Game.world.npcs[0];return !!(n&&DT.Sprites.get(n.sprite));})()");
  ok(npcSprite, 'NPC คนแรกผูกสไปรต์แล้ว');
  ok(await ev("!!DT.Game.local.inv"), 'มีกระเป๋าผู้เล่น');

  console.log('\n== save / reset position ==');
  ok(await ev("typeof DT.Game.savePos==='function' || typeof DT.Game.savePosition==='function' || !!document.querySelector('[data-act=\"save:pos\"]')"), 'มีปุ่มบันทึกตำแหน่ง');

  console.log('\n== error ==');
  ok(jsErrors.length === 0, 'ไม่มี JS error (' + jsErrors.length + ')');
  if (jsErrors.length) jsErrors.slice(0, 3).forEach(e => console.log('     ' + String(e).split('\n')[0]));

  console.log('\n———— ผล: ' + pass + ' ผ่าน / ' + fail + ' ล้มเหลว ————');
  __cleanup();
  process.exit(fail === 0 ? 0 : 1);
})();
