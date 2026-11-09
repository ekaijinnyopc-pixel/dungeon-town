/* เช็คว่าเดินไปหา Platino (7,41) ได้จริงไหม — license DawnLike บังคับให้ "ซ่อนและพบได้"
   ใช้: node tools/check-platino-path.js [url]
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
const PORT = 9391;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } }

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-plat-'));
  const ch = spawn('/usr/bin/chromium', ['--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + ud, 'about:blank'], { stdio: 'ignore', detached: true });
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

  console.log('=== Platino path check @ ' + URL + ' ===');

  /* 1) node platino มีอยู่จริง */
  const node = await ev("(function(){var w=DT.Game.world;for(var i=0;i<w.nodes.length;i++){if(w.nodes[i].type==='platino')return {x:w.nodes[i].x,y:w.nodes[i].y,amount:w.nodes[i].amount};}return null;})()");
  ok(!!node, 'มี node platino' + (node ? ' (x=' + node.x + ', y=' + node.y + ')' : ''));

  /* 2) ช่องนั้นเดินได้ (ไม่ใช่น้ำ/กำแพง) */
  const walkable = await ev("DT.World.walkable(DT.Game.world.map, 7, 41)");
  ok(walkable === true, 'ช่อง (7,41) เดินได้');

  /* 3) ไม่มี node อื่นทับตำแหน่ง (ไม่ถูกอาคาร/ต้นไม้บัง) */
  const overlap = await ev("(function(){var w=DT.Game.world, m=w.map;var c=0;for(var i=0;i<w.nodes.length;i++){var n=w.nodes[i];if(n.x===7&&n.y===41&&n.type!=='platino')c++;}var b=m.buildings.filter(function(b){return 7>=b.x&&7<=b.x+b.w&&41>=b.y&&41<=b.y+b.h;}).length;return c+b;})()");
  ok(overlap === 0, 'ไม่มีสิ่งอื่นทับตำแหน่ง platino (' + overlap + ')');

  /* 4) เดินจากจุดเกิดของผู้เล่นไปถึง Platino ได้ (BFS บน grid) */
  const pathRes = await ev(`(function(){
    var w = DT.Game.world, m = w.map;
    var sx = Math.floor(DT.Game.local.x), sy = Math.floor(DT.Game.local.y);
    var tx = 7, ty = 41;
    if (!DT.World.walkable(m, tx, ty)) return { ok:false, reason:'target not walkable' };
    var seen = {}, q = [[sx, sy]], prev = {}, found = false;
    seen[sx + ',' + sy] = true;
    var dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    var steps = 0;
    while (q.length && steps < 200000) {
      steps++;
      var cur = q.shift(), cx = cur[0], cy = cur[1];
      if (cx === tx && cy === ty) { found = true; break; }
      for (var d = 0; d < 4; d++) {
        var nx = cx + dirs[d][0], ny = cy + dirs[d][1];
        var k = nx + ',' + ny;
        if (seen[k]) continue;
        if (!DT.World.walkable(m, nx, ny)) continue;
        /* ห้ามเดินผ่านต้นไม้/หิน/ก้อน (ของแข็ง) */
        var blocked = false;
        for (var i = 0; i < w.nodes.length; i++) {
          var n = w.nodes[i];
          if (n.x === nx && n.y === ny && (n.type === 'tree' || n.type === 'rock')) { blocked = true; break; }
        }
        if (blocked) continue;
        seen[k] = true; prev[k] = [cx, cy];
        q.push([nx, ny]);
      }
    }
    if (!found) return { ok:false, reason:'no path from (' + sx + ',' + sy + ')' };
    /* นับจำนวนก้าว */
    var cur2 = [tx, ty], dist = 0, k2 = tx + ',' + ty;
    while (prev[k2]) { var p = prev[k2]; cur2 = p; k2 = p[0] + ',' + p[1]; dist++; }
    return { ok:true, dist:dist, from:[sx,sy] };
  })()`);
  ok(pathRes && pathRes.ok === true, 'มีเส้นทางเดินจากจุดเกิดไปหา Platino' + (pathRes && pathRes.ok ? ' (' + pathRes.dist + ' ก้าว)' : ' — ' + (pathRes && pathRes.reason || '')));

  /* 5) เก็บได้จริง — ย้ายผู้เล่นไปทับ node แล้วกดเก็บ */
  const gather = await ev(`(function(){
    var w = DT.Game.world, p = DT.Game.local;
    var n = null;
    for (var i = 0; i < w.nodes.length; i++) if (w.nodes[i].type === 'platino') { n = w.nodes[i]; break; }
    if (!n) return { ok:false, reason:'no node' };
    if (typeof p.gather !== 'function') return { ok:false, reason:'local has no gather()' };
    /* ย้ายผู้เล่นไปทับ node + เตรียม stamina/ความหิว */
    p.x = n.x; p.y = n.y;
    p.stamina = 100; p.hunger = 100;
    var before = n.amount;
    var err = null;
    try { p.gather(w, n, 99); } catch (e) { err = (e && e.message || String(e)); }
    if (err) return { ok:false, reason:'gather error: ' + err };
    var left = null;
    for (var j = 0; j < w.nodes.length; j++) if (w.nodes[j].type === 'platino') left = w.nodes[j];
    var invHas = false;
    try { invHas = (p.inv || []).some(function(it){ return it && it.id === 'herb'; }); } catch (e) {}
    return { ok: (left === null || left.amount < before), before: before,
             remaining: left ? left.amount : 0, herb: invHas };
  })()`);
  ok(gather && gather.ok === true, 'เก็บ Platino ได้จริง (node หาย/ลดลงหลังเก็บ)' + (gather && gather.remaining !== undefined ? ' เหลือ ' + gather.remaining : ''));

  /* 6) ไม่มี JS error */
  ok(jsErrors.length === 0, 'ไม่มี JS error (' + jsErrors.length + ')');
  if (jsErrors.length) jsErrors.slice(0, 3).forEach(e => console.log('     ' + String(e).split('\n')[0]));

  console.log('\n———— ผล: ' + pass + ' ผ่าน / ' + fail + ' ล้มเหลว ————');
  __cleanup();
  process.exit(fail === 0 ? 0 : 1);
})();
