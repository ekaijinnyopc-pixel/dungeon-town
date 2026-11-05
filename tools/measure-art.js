/* เทียบขนาด/ตำแหน่งของสไปรต์ กับ รูปทรงเดิม (shape-based)
   ใช้: node tools/measure-art.js [url] */
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
const URL = process.argv[2] || ('file://' + path.join(ROOT, 'index.html'));
const PORT = 9380;
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-meas-'));
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
  let id = 0; const pend = new Map();
  sk.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) {
      const { resolve, reject } = pend.get(m.id); pend.delete(m.id);
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
    }
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
  await ev("(function(){var i=document.getElementById('pname'); if(i) i.value='m';})()");
  await ev("document.getElementById('go').click()");
  await sleep(2000);

  const out = await ev(`(function(){
    var S = DT.Sprites;
    function bboxOf(fn){
      var c=document.createElement('canvas'); c.width=200; c.height=200;
      var x=c.getContext('2d'); x.clearRect(0,0,200,200);
      fn(x);
      var d=x.getImageData(0,0,200,200).data;
      var x0=1e9,y0=1e9,x1=-1,y1=-1;
      for(var yy=0;yy<200;yy++)for(var xx=0;xx<200;xx++){
        if(d[(yy*200+xx)*4+3]>16){ if(xx<x0)x0=xx; if(xx>x1)x1=xx; if(yy<y0)y0=yy; if(yy>y1)y1=yy; }
      }
      if(x1<0) return null;
      return {x0:x0,y0:y0,x1:x1,y1:y1,w:x1-x0+1,h:y1-y0+1};
    }
    var res={};
    function both(name, fn){
      S.enabled=false; var shape=bboxOf(fn);
      S.enabled=true;  var spr=bboxOf(fn);
      res[name]={shape:shape, sprite:spr};
    }
    both('player', function(x){ DT.Art.player(x,100,140,1,{prof:'miner',t:0,moving:false,dir:'down',weapon:null}); });
    both('playerUp', function(x){ DT.Art.player(x,100,140,1,{prof:'miner',t:0,moving:false,dir:'up',weapon:null}); });
    both('tree', function(x){ DT.Art.tree(x,100,140,1,0,0); });
    both('treeLarge', function(x){ DT.Art.tree(x,100,140,1,0,1); });
    both('rock', function(x){ DT.Art.rock(x,100,140,1,false,0); });
    both('ore', function(x){ DT.Art.rock(x,100,140,1,true,0); });
    both('bush', function(x){ DT.Art.bush(x,100,140,1,0,0); });
    return JSON.stringify(res);
  })()`);
  const r = JSON.parse(out);
  for (const k of Object.keys(r)) {
    const s = r[k].shape, p = r[k].sprite;
    console.log(k.padEnd(11),
      'shape', s ? `w${s.w} h${s.h} y[${s.y0}..${s.y1}]` : 'none',
      '| sprite', p ? `w${p.w} h${p.h} y[${p.y0}..${p.y1}]` : 'none');
  }
  sk.close(); ch.kill();
  try { fs.rmSync(ud, { recursive: true, force: true }); } catch (e) { }
})();
