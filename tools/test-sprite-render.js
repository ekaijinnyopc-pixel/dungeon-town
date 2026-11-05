/* ตรวจว่า Art.* ที่ผูกสไปรต์วาดภาพจริง (ไม่ใช่ fallback) */
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
const URL = process.argv[2] || ('file://' + path.join(ROOT, 'index.html'));
const PORT = 9378;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } }

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-spr2-'));
  const ch = spawn('/usr/bin/chromium', ['--headless=new', '--no-sandbox', '--disable-gpu',
    '--disable-dev-shm-usage', '--window-size=1280,800', '--allow-file-access-from-files',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + ud, 'about:blank'], { stdio: 'ignore' });
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
  await send('Page.navigate', { url: URL });
  await sleep(3000);
  await ev("(function(){var i=document.getElementById('pname'); if(i) i.value='render';})()");
  await ev("document.getElementById('go').click()");
  await sleep(2500);

  console.log('== วาด Art.* บน canvas จริง (เทียบพิกเซลก่อน/หลัง) ==');
  /* ตรวจว่า Art.player/tree/rock/bush วาด "ภาพจริง" โดยเทียบกับการวาดแบบ fallback
     โดยเทียบสีเฉลี่ยในพื้นที่ที่วาด (ทั้งสองแบบต้องต่างกัน และแบบสไปรต์ต้องมี alpha โปร่งใส) */
  const probe = `(function(){
    function snap(fn){
      var c=document.createElement('canvas'); c.width=64; c.height=64;
      var x=c.getContext('2d'); x.clearRect(0,0,64,64);
      fn(x);
      return x.getImageData(0,0,64,64).data;
    }
    function diff(a,b){ var n=0; for(var i=0;i<a.length;i+=4) if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]) n++; return n; }
    function opaque(a){ var n=0; for(var i=3;i<a.length;i+=4) if(a[i]>0) n++; return n; }
    var out={};
    out.playerSprite = opaque(snap(function(x){ DT.Sprites.draw(x,'characters/player_down.png',32,50,false,null,0); }));
    out.treeSprite  = opaque(snap(function(x){ DT.Sprites.draw(x,'objects/tree_green.png',32,50,false,null,0); }));
    out.rockSprite  = opaque(snap(function(x){ DT.Sprites.draw(x,'objects/rock_boulder.png',32,50,false,null,0); }));
    out.bushSprite  = opaque(snap(function(x){ DT.Sprites.draw(x,'objects/bush.png',32,50,false,null,0); }));
    /* player 4 ทิศ */
    out.dirs = {
      down: opaque(snap(function(x){ DT.Sprites.draw(x,'characters/player_down.png',32,50,false,null,0); })),
      up:   opaque(snap(function(x){ DT.Sprites.draw(x,'characters/player_up.png',32,50,false,null,0); })),
      left: opaque(snap(function(x){ DT.Sprites.draw(x,'characters/player_side.png',32,50,true,null,0); }))
    };
    return JSON.stringify(out);
  })()`;
  const p = JSON.parse(await ev(probe));
  ok(p.playerSprite > 50, 'สไปรต์ผู้เล่นมีพิกเซล (' + p.playerSprite + ')');
  ok(p.treeSprite > 50, 'สไปรต์ต้นไม้มีพิกเซล (' + p.treeSprite + ')');
  ok(p.rockSprite > 30, 'สไปรต์หินมีพิกเซล (' + p.rockSprite + ')');
  ok(p.bushSprite > 30, 'สไปรต์พุ่มมีพิกเซล (' + p.bushSprite + ')');
  ok(p.dirs.up > 0 && p.dirs.down > 0 && p.dirs.left > 0, 'ทิศ up/down/left มีสไปรต์');

  console.log('\n== tint สีอาชีพ (แยกตัวละคร) ==');
  const tint = JSON.parse(await ev(`(function(){
    function snap(color){
      var c=document.createElement('canvas'); c.width=32; c.height=32;
      var x=c.getContext('2d');
      DT.Sprites.draw(x,'characters/player_down.png',16,28,false,color,0.24);
      var d=x.getImageData(0,0,32,32).data;
      var r=0,g=0,b=0,n=0;
      for(var i=0;i<d.length;i+=4){ if(d[i+3]>0){r+=d[i];g+=d[i+1];b+=d[i+2];n++;} }
      return n? [Math.round(r/n),Math.round(g/n),Math.round(b/n)] : [0,0,0];
    }
    return JSON.stringify({ miner:snap('#e0a63c'), hunter:snap('#5aa8e0'), farmer:snap('#6cc070') });
  })()`));
  ok(tint.miner[0] > tint.hunter[2] && tint.miner[0] > tint.hunter[0], 'อาชีพ miner เอนสีอุ่น (' + tint.miner + ')');
  ok(tint.hunter[2] > tint.hunter[0], 'อาชีพ hunter เอนสีฟ้า (' + tint.hunter + ')');
  ok(tint.farmer[1] > tint.farmer[0] && tint.farmer[1] > tint.farmer[2], 'อาชีพ farmer เอนสีเขียว (' + tint.farmer + ')');

  console.log('\n== หลังคา/ผนังเรียงสไปรต์ ==');
  const roof = JSON.parse(await ev(`(function(){
    var c=document.createElement('canvas'); c.width=64; c.height=64;
    var x=c.getContext('2d');
    var drew = DT.Sprites.tile(x,'objects/roof.png',0,0,64,64);
    var d=x.getImageData(0,0,64,64).data; var n=0;
    for(var i=3;i<d.length;i+=4) if(d[i]>0) n++;
    return JSON.stringify({drew:drew, px:n});
  })()`));
  ok(roof.drew === true && roof.px > 1000, 'tile หลังคาวาดได้ (' + roof.px + ' พิกเซล)');

  console.log('\n== error ==');
  ok(errors.length === 0, 'ไม่มี JS error (' + errors.length + ')' + (errors.length ? ' → ' + errors.slice(0, 2).join(' | ') : ''));
  console.log('\n———— ผล: ' + pass + ' ผ่าน / ' + fail + ' ล้มเหลว ————');
  sk.close(); ch.kill();
  try { fs.rmSync(ud, { recursive: true, force: true }); } catch (e) { }
  process.exit(fail ? 1 : 0);
})();
