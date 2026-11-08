/* ทดสอบ fallback: บังคับให้โหลดภาพไม่ได้ -> เกมต้องยังวาดด้วยรูปทรงเดิม (ไม่จอดำ, ไม่ error) */
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');

/* cleanup: kill chromium process group (parent + children) */
function killChrome(ch) {
  try { process.kill(-ch.pid, 'SIGKILL'); } catch (e) {}
  try { ch.kill('SIGKILL'); } catch (e) {}
}

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
const PORT = 9379;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } }

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-spr3-'));
  const ch = spawn('/usr/bin/chromium', ['--headless=new', '--no-sandbox', '--disable-gpu',
    '--disable-dev-shm-usage', '--window-size=1280,800', '--allow-file-access-from-files',
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
  sk.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) {
      const { resolve, reject } = pend.get(m.id); pend.delete(m.id);
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result); return;
    }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  });
  await new Promise(r => sk.addEventListener('open', r));
  const send = (method, params) => new Promise((res, rej) => {
    const i = ++id;
    const to = setTimeout(() => { if (pend.has(i)) { pend.delete(i); rej(new Error('TIMEOUT ' + method)); } }, 20000);
    pend.set(i, { resolve: v => { clearTimeout(to); res(v); }, reject: e => { clearTimeout(to); rej(e); } });
    sk.send(JSON.stringify({ id: i, method, params: params || {} }));
  });
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
    return r.result.value;
  };

  await send('Runtime.enable'); await send('Page.enable');
  /* แทรกสคริปต์ก่อนหน้าเกม: ทำให้ทุก URL ภาพโหลดไม่ได้ */
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `Object.defineProperty(window,'__DT_SPRITE_DATA__',{value:null,writable:true,configurable:true});
      (function(){ var O=window.Image; window.Image=function(){ var i=new O(); Object.defineProperty(i,'src',{set:function(v){ this.__bad=true; },get:function(){return ''; }}); return i; }; })();`
  });
  await send('Page.navigate', { url: URL });
  await sleep(3000);
  await ev("(function(){var i=document.getElementById('pname'); if(i) i.value='fallback';})()");
  await ev("document.getElementById('go').click()");
  await waitGameStart(ev);

  console.log('== โหลดเกมแบบภาพพัง ==');
  ok(await ev("!!(DT.Game&&DT.Game.local)"), 'เข้าเกมได้ (ไม่ค้าง)');

  const stats = JSON.parse(await ev("JSON.stringify(DT.Sprites.stats)"));
  console.log('   stats:', JSON.stringify(stats));
  ok(stats.loaded === 0, 'ไม่มีภาพโหลดสำเร็จ (ตามที่บังคับ)');

  console.log('\n== canvas ไม่จอดำ ==');
  const px = JSON.parse(await ev(`(function(){
    var c=document.getElementById('game');
    var d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    var black=0, colored=0, n=0;
    for(var i=0;i<d.length;i+=4*37){ n++; var r=d[i],g=d[i+1],b=d[i+2];
      if(r<8&&g<8&&b<8) black++; else colored++; }
    return JSON.stringify({n:n, black:black, colored:colored});
  })()`));
  ok(px.colored > px.n * 0.5, 'มีสีบน canvas (' + px.colored + '/' + px.n + ' พิกเซล)');

  console.log('\n== ยังเดินได้ / ยังโจมตีได้ (fallback ไม่ทำให้ logic พัง) ==');
  const moved = JSON.parse(await ev(`(function(){
    var G=DT.Game, x0=G.local.x, y0=G.local.y;
    G.path=null; G.autoGather=null; G.keys={};
    return JSON.stringify({x0:x0,y0:y0});
  })()`));
  await ev("(function(){DT.Game.keys={};})()");
  await ev("window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight'}))");
  await sleep(1200);
  await ev("window.dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowRight'}))");
  const moved2 = JSON.parse(await ev("JSON.stringify([DT.Game.local.x,DT.Game.local.y])"));
  ok(Math.abs(moved2[0] - moved.x0) > 0.1 || Math.abs(moved2[1] - moved.y0) > 0.1,
    'เดินได้ (ยังควบคุมได้)');

  console.log('\n== error ==');
  ok(errors.length === 0, 'ไม่มี JS error (' + errors.length + ')' + (errors.length ? ' → ' + errors.slice(0, 2).join(' | ') : ''));
  console.log('\n———— ผล: ' + pass + ' ผ่าน / ' + fail + ' ล้มเหลว ————');
  sk.close(); killChrome(ch);
  try { fs.rmSync(ud, { recursive: true, force: true }); } catch (e) { }
  process.exit(fail ? 1 : 0);
})();
