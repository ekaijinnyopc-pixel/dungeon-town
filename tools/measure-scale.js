/* วัดขนาดจริงที่ render บน canvas (baseline ก่อน/หลังปรับสเกล)
   - ต้นไม้ทุก variant  : ความกว้าง/สูง + ขอบล่างเทียบจุดยึด
   - ตัวละคร OGA        : ความกว้าง/สูง + ขอบล่าง (ฐานเท้า)
   - เงาใต้เท้า/อาวุธ   : ตำแหน่ง anchor
   ใช้: node tools/measure-scale.js [url]
*/
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
const URL = process.argv[2] || ('file://' + path.join(ROOT, 'index.html'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const PORT = 9600 + Math.floor(Math.random() * 60);
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-scale-'));
  const ch = spawn('/usr/bin/chromium', ['--headless=new', '--no-sandbox', '--disable-gpu',
    '--disable-dev-shm-usage', '--window-size=1280,800', '--allow-file-access-from-files',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + ud, 'about:blank'], { stdio: 'ignore' });
  let wsUrl = null;
  for (let i = 0; i < 100 && !wsUrl; i++) {
    await sleep(250);
    try {
      const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = l.find(t => t.type === 'page');
      if (p) wsUrl = p.webSocketDebuggerUrl;
    } catch (e) { }
  }
  if (!wsUrl) { console.log('❌ CDP fail'); try { ch.kill('SIGKILL'); } catch (e) { } process.exit(1); }
  const sk = new WebSocket(wsUrl);
  let id = 0; const pend = new Map();
  sk.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) {
      const p = pend.get(m.id); pend.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    }
  });
  await new Promise(r => sk.addEventListener('open', r));
  const send = (method, params) => new Promise((resolve, reject) => {
    const i = ++id;
    const to = setTimeout(() => { if (pend.has(i)) { pend.delete(i); reject(new Error('TIMEOUT ' + method)); } }, 25000);
    pend.set(i, { resolve: v => { clearTimeout(to); resolve(v); }, reject: e => { clearTimeout(to); reject(e); } });
    sk.send(JSON.stringify({ id: i, method, params: params || {} }));
  });
  const ev = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return 'ERR ' + JSON.stringify(r.exceptionDetails).slice(0, 500);
    return r.result && r.result.value;
  };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: URL });
  await sleep(2500);

  /* preload สไปรต์ที่จะวัด */
  await ev(`(function(){
    var keys=[
      'objects/tree_green_large.png','objects/tree_green.png',
      'objects/tree_gold_round.png','objects/tree_autumn.png',
      'characters/hero_down_0.png','characters/hero_down_idle_0.png',
      'characters/hero_down_atk_0.png','characters/hero_left_0.png',
      'characters/hero_right_0.png','characters/hero_up_0.png'
    ];
    window.__k=keys; DT.Sprites.preload(keys); return keys.length;
  })()`);
  let n = 0;
  for (let i = 0; i < 60; i++) {
    const c = await ev(`(function(){var n=0;window.__k.forEach(function(k){if(DT.Sprites.get(k))n++;});return n;})()`);
    n = typeof c === 'number' ? c : 0;
    if (n >= 10) break;
    await sleep(250);
  }
  console.log('preload: ' + n + '/10');

  const out = JSON.parse(await ev(`(function(){
    function bb(key, anchorY){
      var c=document.createElement('canvas'); c.width=160; c.height=160;
      var x=c.getContext('2d');
      DT.Sprites.draw(x,key,80,anchorY,false,null,0);
      var d=x.getImageData(0,0,160,160).data;
      var minx=999,miny=999,maxx=-1,maxy=-1;
      for(var y=0;y<160;y++)for(var xx=0;xx<160;xx++){
        var a=d[(y*160+xx)*4+3];
        if(a>0){if(xx<minx)minx=xx;if(y<miny)miny=y;if(xx>maxx)maxx=xx;if(y>maxy)maxy=y;}
      }
      if(maxy<0) return null;
      return {minx:minx,miny:miny,maxx:maxx,maxy:maxy,w:maxx-minx+1,h:maxy-miny+1,anchorY:anchorY};
    }
    var res={trees:{},heroes:{},shadow:null};
    ['objects/tree_green_large.png','objects/tree_green.png','objects/tree_gold_round.png','objects/tree_autumn.png']
      .forEach(function(k){ res.trees[k]=bb(k,120); });
    ['characters/hero_down_0.png','characters/hero_down_idle_0.png','characters/hero_down_atk_0.png',
     'characters/hero_left_0.png','characters/hero_right_0.png','characters/hero_up_0.png']
      .forEach(function(k){ res.heroes[k]=bb(k,120); });
    /* ขนาดภาพจริงของไฟล์ */
    res.files={};
    Object.keys(res.trees).concat(Object.keys(res.heroes)).forEach(function(k){
      var im=DT.Sprites.get(k);
      res.files[k]= im ? [im.naturalWidth||im.width, im.naturalHeight||im.height] : null;
    });
    /* spec ปัจจุบัน */
    res.spec={};
    Object.keys(res.trees).concat(Object.keys(res.heroes)).forEach(function(k){
      var s=DT.Sprites.spec(k); res.spec[k]= s?{src:s.src,sc:s.sc,dy:s.dy}:null;
    });
    return JSON.stringify(res);
  })()`));

  const pad = (s, n) => String(s).padEnd(n);
  console.log('\n== ต้นไม้ (วาดที่ anchor y=120) ==');
  console.log(pad('key', 34) + pad('file', 10) + pad('sc/dy', 9) + pad('W', 6) + pad('H', 6) + 'bottom');
  Object.keys(out.trees).forEach(k => {
    const b = out.trees[k], s = out.spec[k], f = out.files[k];
    console.log(pad(k.replace('objects/', ''), 34) +
      pad(f ? f[0] + 'x' + f[1] : '?', 10) +
      pad((s ? s.sc : '?') + '/' + (s ? s.dy : '?'), 9) +
      pad(b ? b.w : '?', 6) + pad(b ? b.h : '?', 6) + (b ? b.maxy : '?'));
  });

  console.log('\n== ตัวละคร OGA (วาดที่ anchor y=120) ==');
  console.log(pad('key', 34) + pad('file', 10) + pad('sc/dy', 9) + pad('W', 6) + pad('H', 6) + 'bottom');
  Object.keys(out.heroes).forEach(k => {
    const b = out.heroes[k], s = out.spec[k], f = out.files[k];
    console.log(pad(k.replace('characters/', ''), 34) +
      pad(f ? f[0] + 'x' + f[1] : '?', 10) +
      pad((s ? s.sc : '?') + '/' + (s ? s.dy : '?'), 9) +
      pad(b ? b.w : '?', 6) + pad(b ? b.h : '?', 6) + (b ? b.maxy : '?'));
  });

  try { ch.kill('SIGKILL'); } catch (e) { }
  process.exit(0);
})();
