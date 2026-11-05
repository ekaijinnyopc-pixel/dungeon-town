/* ตรวจเมนูมุมขวาบนซ้ำ — วัด geometry ของ .topright / .mtools / .panel / .popup
   ทั้งมือถือ (390x844) และเดสก์ท็อป (1280x800)
   ใช้: node tools/dbg-topright.js [url]
*/
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
const URL = process.argv[2] || ('file://' + path.join(ROOT, 'index.html'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function probe(W, H, mobile) {
  const PORT = 9400 + (mobile ? 1 : 0);
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-tr-'));
  const args = ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--window-size=' + W + ',' + H, '--allow-file-access-from-files',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + ud, 'about:blank'];
  if (mobile) args.unshift('--touch-events=enabled');
  const ch = spawn('/usr/bin/chromium', args, { stdio: 'ignore' });
  let wsUrl = null;
  for (let i = 0; i < 80 && !wsUrl; i++) {
    await sleep(250);
    try {
      const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = l.find(t => t.type === 'page');
      if (p) wsUrl = p.webSocketDebuggerUrl;
    } catch (e) { }
  }
  if (!wsUrl) { console.log('❌ CDP fail'); ch.kill(); return null; }
  const sk = new WebSocket(wsUrl);
  let id = 0; const pend = new Map();
  sk.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
  });
  await new Promise(r => sk.addEventListener('open', r));
  const send = (method, params) => new Promise((resolve, reject) => { const i = ++id; pend.set(i, { resolve, reject }); sk.send(JSON.stringify({ id: i, method, params })); });
  const evalJs = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result && r.result.value;
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: URL });
  await sleep(2500);
  // เริ่มเล่น (เลือกอาชีพ) เพื่อให้ .app ไม่ hidden
  await evalJs(`(function(){
    var b=document.querySelector('[data-act="start"],#btn-start,.start-btn,button[data-class]');
    if(b){b.click();return 'clicked-start';}
    var bs=Array.prototype.slice.call(document.querySelectorAll('button'));
    for(var i=0;i<bs.length;i++){ if(/เริ่มเล่น|เริ่ม|Start|เล่น/.test(bs[i].textContent)){ bs[i].click(); return 'clicked-'+bs[i].textContent.trim().slice(0,20);} }
    return 'no-start';
  })()`);
  await sleep(1200);
  const out = await evalJs(`(function(){
    function box(sel){
      var els=document.querySelectorAll(sel), r=[];
      for(var i=0;i<els.length;i++){
        var e=els[i], s=getComputedStyle(e), b=e.getBoundingClientRect();
        if(s.display==='none'||s.visibility==='hidden'||b.width===0||b.height===0) continue;
        r.push({sel:sel, x:Math.round(b.x), y:Math.round(b.y), w:Math.round(b.width), h:Math.round(b.height),
                txt:(e.textContent||'').trim().slice(0,24)});
      }
      return r;
    }
    var all=box('.topright').concat(box('.mtools')).concat(box('.panel')).concat(box('.popup'));
    // ปุ่มย่อยใน .topright / .mtools
    var btns=[];
    var g=document.querySelectorAll('.topright button, .mtools button');
    for(var i=0;i<g.length;i++){var b=g[i].getBoundingClientRect();btns.push({p:g[i].parentNode.className, txt:(g[i].textContent||'').trim().slice(0,10), x:Math.round(b.x),y:Math.round(b.y)});}
    return JSON.stringify({boxes:all, btns:btns});
  })()`);
  sk.close(); ch.kill('SIGKILL');
  return JSON.parse(out || '{}');
}

(async () => {
  for (const [label, W, H, mob] of [['มือถือ 390x844', 390, 844, true], ['เดสก์ท็อป 1280x800', 1280, 800, false]]) {
    console.log('\n===== ' + label + ' =====');
    const r = await probe(W, H, mob);
    if (!r) continue;
    console.log('-- กล่อง --');
    (r.boxes || []).forEach(b => console.log(`  ${b.sel.padEnd(10)} x=${b.x} y=${b.y} ${b.w}x${b.h} "${b.txt}"`));
    console.log('-- ปุ่ม --');
    (r.btns || []).forEach(b => console.log(`  ${String(b.p).padEnd(16)} ${b.txt.padEnd(12)} x=${b.x} y=${b.y}`));
    // จับกลุ่มปุ่มที่ทับกัน (ซ้ำ)
    const bs = r.btns || [];
    const dups = [];
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      if (bs[i].x === bs[j].x && bs[i].y === bs[j].y) dups.push(bs[i].txt + ' ≡ ' + bs[j].txt);
    }
    console.log('-- ซ้ำตำแหน่งเดียวกัน: ' + (dups.length ? dups.join(', ') : 'ไม่มี'));
  }
})();
