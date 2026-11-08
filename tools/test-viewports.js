/* เทสต์ sweep หลายขนาดจอ — ยืนยันว่าปุ่มมุมขวาบนไม่ซ้ำ และไม่ทับ HUD ในทุกโหมด
   ใช้: node tools/test-viewports.js [url]
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


/* wait until game booted - race guard for slow machines */
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
const PORT = 9363;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } }

const CASES = [
  { name: 'มือถือเล็ก 320x568', w: 320, h: 568, mobile: true, coarse: true },
  { name: 'มือถือ 360x640', w: 360, h: 640, mobile: true, coarse: true },
  { name: 'มือถือ 390x844 (iPhone 14)', w: 390, h: 844, mobile: true, coarse: true },
  { name: 'มือถือใหญ่ 430x932', w: 430, h: 932, mobile: true, coarse: true },
  { name: 'มือถือแนวนอน 844x390', w: 844, h: 390, mobile: true, coarse: true },
  { name: 'แท็บเล็ต 768x1024', w: 768, h: 1024, mobile: true, coarse: true },
  { name: 'เดสก์ท็อป 1280x800', w: 1280, h: 800, mobile: false, coarse: false },
  { name: 'เดสก์ท็อปกว้าง 1920x1080', w: 1920, h: 1080, mobile: false, coarse: false }
];

/* โค้ดฝั่งเบราว์เซอร์ (ES5) — วัดชุดปุ่มที่มองเห็นจริง */
const PROBE = `(function(){
  function vis(e){ if(!e) return false; var s=getComputedStyle(e);
    if(s.display==='none'||s.visibility==='hidden') return false;
    var r=e.getBoundingClientRect(); return !!(r.width&&r.height); }
  var g=document.querySelectorAll('.topright button, .mtools button, .mtop button');
  var seen={}, dup=[], visible=[];
  for(var i=0;i<g.length;i++){ if(!vis(g[i])) continue;
    var a=g[i].getAttribute('data-act')||'?'; seen[a]=(seen[a]||0)+1; visible.push(a); }
  for(var k in seen){ if(seen[k]>1) dup.push(k+'x'+seen[k]); }
  var mt=document.querySelector('.mtools'), tr=document.querySelector('.topright'), hud=document.querySelector('.hud');
  var tp=document.querySelector('.mtop');
  function rect(e){ if(!e) return null; var r=e.getBoundingClientRect();
    return {l:Math.round(r.left),t:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)}; }
  var mr=rect(mt), hr=rect(hud); var overlap=false;
  if(mr&&hr&&vis(mt)){ overlap = mr.l < hr.l+hr.w && mr.l+mr.w > hr.l && mr.t < hr.t+hr.h && mr.t+mr.h > hr.t; }
  var small=[];
  var bs=document.querySelectorAll('.mobile .pad, .mobile .mtool');
  for(var j=0;j<bs.length;j++){ if(!vis(bs[j])) continue; var br=bs[j].getBoundingClientRect();
    if(br.width<44||br.height<44) small.push((bs[j].getAttribute('data-key')||bs[j].getAttribute('data-act'))+':'+Math.round(br.width)+'x'+Math.round(br.height)); }
  return JSON.stringify({ dup:dup, visible:visible, mtoolsVisible:vis(mt), toprightVisible:vis(tr),
    mtopVisible:vis(tp), overlap:overlap, small:small, mtoolsRect:mr, hudRect:hr, mtopRect:rect(tp) });
})()`;

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-vp-'));
  const ch = spawn('/usr/bin/chromium', ['--headless=new', '--no-sandbox', '--disable-gpu',
    '--disable-dev-shm-usage', '--allow-file-access-from-files', '--hide-scrollbars',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + ud, 'about:blank'], { stdio: 'ignore', detached: true });

  let wsUrl = null;
  for (let i = 0; i < 80 && !wsUrl; i++) {
    await sleep(250);
    try {
      const l = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
      const p = l.find(t => t.type === 'page');
      if (p) wsUrl = p.webSocketDebuggerUrl;
    } catch (e) { }
  }
    __child = ch;

if (!wsUrl) { console.log('❌ เชื่อม CDP ไม่ได้'); process.exit(1); }

  const sk = new WebSocket(wsUrl);
  let id = 0; const pend = new Map();
  sk.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) {
      const p = pend.get(m.id); pend.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
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
    sk.send(JSON.stringify({ id: i, method: method, params: params || {} }));
  });
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
    return r.result.value;
  };

  await send('Runtime.enable'); await send('Page.enable');

  for (const c of CASES) {
    console.log('\n== ' + c.name + ' ==');
    await send('Emulation.setDeviceMetricsOverride', {
      width: c.w, height: c.h, deviceScaleFactor: 2, mobile: c.mobile,
      screenWidth: c.w, screenHeight: c.h
    });
    await send('Emulation.setTouchEmulationEnabled', { enabled: !!c.coarse, maxTouchPoints: c.coarse ? 5 : 1 });
    await send('Emulation.setEmitTouchEventsForMouse', { enabled: !!c.coarse, configuration: 'mobile' });
    await send('Page.navigate', { url: URL + '?vp=' + c.w + 'x' + c.h });
    await sleep(2600);
    await ev("(function(){var i=document.getElementById('pname');if(i)i.value='sweep';if(document.getElementById('go'))document.getElementById('go').click();})()");
    await waitGameStart(ev);

    const info = JSON.parse(await ev(PROBE));

    ok(info.dup.length === 0, 'ไม่มี data-act ซ้ำ 2 ชุดพร้อมกัน' + (info.dup.length ? ' (' + info.dup.join(',') + ')' : ''));
    /* P4-E: มือถือใช้ .mtop (แถบบน) · เดสก์ท็อปใช้ .topright — ต้องเห็นแค่ชุดเดียว */
    ok(info.toprightVisible !== info.mtopVisible,
      'มีชุดปุ่มมุมขวาบนแค่ชุดเดียว (topright=' + info.toprightVisible + ', mtop=' + info.mtopVisible + ')');
    ok(!info.overlap, 'ชุดปุ่มมุมขวาบนไม่ทับ HUD');
    ok(info.small.length === 0, 'ปุ่มแตะ >= 44px ทุกตัว' + (info.small.length ? ' (' + info.small.join(',') + ')' : ''));
    console.log('     ปุ่มที่มองเห็น: ' + info.visible.join(', '));
  }

  console.log('\n———— ผล: ' + pass + ' ผ่าน / ' + fail + ' ล้มเหลว ————');
  killChrome(ch);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.log('❌ ระหว่างรัน: ' + (e && e.message || e));
  __cleanup();
  process.exit(1);
});
