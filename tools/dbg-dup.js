/* ตรวจเมนูมุมขวาบนซ้ำ — เริ่มเกมจริง แล้วกดปุ่มมุมขวาบนทีละปุ่ม
   แล้วนับว่ามีกี่ชุดเมนูในโซนมุมขวาบน (ซ้อนกัน/ซ้ำกัน)
   ใช้: node tools/dbg-dup.js [url]
*/
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
const URL = process.argv[2] || ('file://' + path.join(ROOT, 'index.html'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run(W, H, mobile, tag) {
  const PORT = 9420 + (mobile ? 1 : 0);
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-dup-'));
  const args = ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--window-size=' + W + ',' + H, '--allow-file-access-from-files', '--hide-scrollbars',
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
  if (!wsUrl) { console.log('❌ CDP fail'); ch.kill(); return; }
  const sk = new WebSocket(wsUrl);
  let id = 0; const pend = new Map();
  sk.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
  });
  await new Promise(r => sk.addEventListener('open', r));
  const send = (method, params) => new Promise((resolve, reject) => { const i = ++id; pend.set(i, { resolve, reject }); sk.send(JSON.stringify({ id: i, method, params })); });
  const ev = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result && r.result.value;
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: mobile });
  await send('Page.navigate', { url: URL });
  await sleep(2500);
  // เริ่มเกมจริง
  await ev(`document.getElementById('go').click()`);
  await sleep(1800);

  console.log('\n########## ' + tag + ' ##########');
  const base = await ev(`(function(){
    function vis(e){var s=getComputedStyle(e);return s.display!=='none'&&s.visibility!=='hidden'&&e.getBoundingClientRect().width>0;}
    var out=[];
    ['.topright','.mtools','.panel','.popup','.hud'].forEach(function(sel){
      var es=document.querySelectorAll(sel);
      for(var i=0;i<es.length;i++){ if(!vis(es[i]))continue; var b=es[i].getBoundingClientRect();
        out.push({sel:sel,x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)});}
    });
    // ปุ่มในมุมขวาบน
    var bs=[];
    var g=document.querySelectorAll('.topright button, .mtools button');
    for(var i=0;i<g.length;i++){if(!vis(g[i]))continue;var b=g[i].getBoundingClientRect();
      bs.push({p:g[i].parentNode.className,t:(g[i].textContent||'').trim().replace(/\\s+/g,' ').slice(0,8),x:Math.round(b.x),y:Math.round(b.y)});}
    return JSON.stringify({boxes:out,btns:bs});
  })()`);
  const b = JSON.parse(base);
  console.log('-- ชุดเมนูในมุมขวาบน --');
  b.boxes.forEach(o => console.log(`   ${o.sel.padEnd(9)} x=${o.x} y=${o.y} ${o.w}x${o.h}`));
  console.log('-- ปุ่มที่มองเห็น --');
  b.btns.forEach(o => console.log(`   ${String(o.p).padEnd(14)} ${o.t.padEnd(9)} x=${o.x} y=${o.y}`));
  // จัดกลุ่มตาม data-act ซ้ำ
  const acts = await ev(`(function(){
    var g=document.querySelectorAll('.topright button, .mtools button'), m={};
    for(var i=0;i<g.length;i++){var s=getComputedStyle(g[i]);if(s.display==='none'||s.visibility==='hidden')continue;
      var r=g[i].getBoundingClientRect();if(!r.width||!r.height)continue;
      var a=g[i].getAttribute('data-act')||'(none)'; m[a]=(m[a]||0)+1;}
    return JSON.stringify(m);
  })()`);
  const m = JSON.parse(acts);
  const dups = Object.keys(m).filter(k => m[k] > 1);
  console.log('-- ปุ่ม action เดิมที่มีหลายชุด: ' + (dups.length ? dups.map(k => k + '×' + m[k]).join(', ') : 'ไม่มี'));

  // กดปุ่มมุมขวาบนทีละปุ่ม → ดูว่าเปิดเมนูกี่ชุด
  const acts2 = ['toggle:quest', 'toggle:shop', 'toggle:inv', 'toggle:craft', 'toggle:party'];
  for (const a of acts2) {
    await ev(`(function(){var el=document.querySelector('.topright [data-act="${a}"]');if(el)el.click();})()`);
    await sleep(700);
    const st = await ev(`(function(){
      function vis(e){var s=getComputedStyle(e);var r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;}
      var out=[];
      ['.panel','.popup'].forEach(function(sel){var es=document.querySelectorAll(sel);
        for(var i=0;i<es.length;i++){if(!vis(es[i]))continue;var b=es[i].getBoundingClientRect();
          out.push(sel+'@'+Math.round(b.x)+','+Math.round(b.y)+' '+Math.round(b.width)+'x'+Math.round(b.height));}});
      var heads=[];
      var hs=document.querySelectorAll('.panel h3, .popup-title');
      for(var i=0;i<hs.length;i++){if(!vis(hs[i]))continue;heads.push((hs[i].textContent||'').trim().slice(0,18));}
      return JSON.stringify({menus:out, heads:heads});
    })()`);
    const s = JSON.parse(st);
    console.log(`   ${a.padEnd(13)} เมนูที่เปิด=${s.menus.length} [${s.menus.join(' | ')}] หัวข้อ=[${s.heads.join(' | ')}]`);
    await ev(`(function(){var el=document.querySelector('.topright [data-act="${a}"]');if(el)el.click();})()`);
    await sleep(400);
  }
  sk.close(); ch.kill('SIGKILL');
}

(async () => {
  await run(390, 844, true, 'มือถือ 390x844');
  await run(1280, 800, false, 'เดสก์ท็อป 1280x800');
})();
