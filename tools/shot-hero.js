/* ถ่ายภาพตัวละครในเกมจริง (เข้าเกมแล้ว) — เดสก์ท็อป + มือถือ */
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function shot(W, H, out, actions) {
  const PORT = 9450 + Math.floor(Math.random() * 40);
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-hero-'));
  const args = ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--window-size=' + W + ',' + H, '--allow-file-access-from-files', '--hide-scrollbars',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + ud, 'about:blank'];
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
  if (!wsUrl) { console.log('CDP fail'); ch.kill(); return; }
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
    if (r.exceptionDetails) return 'ERR ' + JSON.stringify(r.exceptionDetails).slice(0, 300);
    return r.result && r.result.value;
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: 'file://' + path.join(ROOT, 'index.html') });
  await sleep(2200);
  await evalJs(`(function(){ var b=document.getElementById('play-now'); if(b) b.click(); })()`);
  await sleep(1200);
  // start screen -> choose character/profession -> enter game
  await evalJs(`(function(){
    var nm=document.getElementById('pname'); if(nm) nm.value='JIN';
    var go=document.getElementById('go');
    if(go) go.click();
    return go? 'clicked' : 'nogo';
  })()`).then(v=>console.log('goBtn', v));
  await sleep(2500);
  const info = await evalJs(`(function(){
    var g=window.DT&&DT.game;
    var L=g&&g.local;
    return JSON.stringify({ sprite: L&&L.sprite, female: L&&L.female, male: L&&L.male, x: L&&L.x, y: L&&L.y, loaded: DT&&DT.Sprites&&DT.Sprites.stats });
  })()`);
  console.log(out, info);
  if (actions) await evalJs(actions);
  await sleep(900);
  const cap = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(out, Buffer.from(cap.data, 'base64'));
  // ครอปบริเวณตัวผู้เล่นเพื่อดูรายละเอียด
  const box = await evalJs(`(function(){
    var g=window.DT&&DT.game, L=g&&g.local;
    if(!L) return null;
    var cam=g.cam||{x:0,y:0};
    return JSON.stringify({ lx:L.x, ly:L.y, camx:cam.x, camy:cam.y, tpx:DT.TILE_PX, keys:Object.keys(g).slice(0,40).join(',') });
  })()`);
  if (box) {
    console.log('box', box);
    try {
      const b=JSON.parse(box);
      const scr = await evalJs(`(function(){
        var g=window.DT&&DT.game, R=DT&&DT.Render;
        var inst=(g&&g.render)||(R&&R.instance)||(R&&R.current);
        if(inst&&inst.toScreen){ var p=inst.toScreen(${b.lx},${b.ly}); return JSON.stringify(p); }
        return 'null';
      })()`);
      console.log('scr', scr);
      const p=JSON.parse(scr||'null');
      if(p&&typeof p.sx==='number'){
        const clip={ x: Math.max(0,p.sx-55), y: Math.max(0,p.sy-70), width: 110, height: 110, scale: 5 };
        const cap2=await send('Page.captureScreenshot', { format:'png', clip: clip });
        fs.writeFileSync(out.replace(/\.png$/,'-zoom.png'), Buffer.from(cap2.data,'base64'));
        console.log('clip', JSON.stringify(clip));
      }
    } catch(e){ console.log('clipErr', String(e).slice(0,140)); }
  }
  sk.close(); ch.kill('SIGKILL');
}

(async () => {
  await shot(1280, 800, '/data/.openclaw/workspace/tmp/charwork/hero-game-desktop.png', null);
  await shot(390, 844, '/data/.openclaw/workspace/tmp/charwork/hero-game-mobile.png', null);
  console.log('done');
})();
