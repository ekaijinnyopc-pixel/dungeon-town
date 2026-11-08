/* ปรับเทียบสไปรต์กับรูปทรงเดิม (shape art)
   - หา shape bbox ของ "ทุก variant" ของ tree / rock / bush / player
   - หา bbox จริงของ "ทุกคีย์สไปรต์" (วาดผ่าน DT.Sprites.draw ตรง ๆ)
   - ออกคำแนะนำค่า sc / dy ให้ตรงกับ shape เป้าหมาย
   ใช้: node tools/calibrate.js [url] */
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
const URL = process.argv[2] || ('file://' + path.join(ROOT, 'index.html'));
const PORT = 9381;
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-cal-'));
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
    const to = setTimeout(() => { if (pend.has(i)) { pend.delete(i); rej(new Error('TIMEOUT ' + method)); } }, 30000);
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

  /* รอให้สไปรต์โหลดครบ (lazy load) */
  const okLoad = await ev(`(async function(){
    var S=DT.Sprites; S.preloadAll();
    var keys=S.keys();
    for(var i=0;i<300;i++){
      var all=true;
      for(var k=0;k<keys.length;k++){ if(!S.cache[keys[k]] || !S.cache[keys[k]].ok){ all=false; break; } }
      if(all) return JSON.stringify({loaded:S.stats.loaded, failed:S.stats.failed});
      await new Promise(function(r){ setTimeout(r,100); });
    }
    return JSON.stringify({loaded:S.stats.loaded, failed:S.stats.failed, timeout:true});
  })()`);
  console.log('โหลดสไปรต์: ' + okLoad);
  await sleep(500);

  const out = await ev(`(function(){
    var S = DT.Sprites, A = DT.Art;
    var CX=100, CY=140;
    function bboxOf(fn){
      var c=document.createElement('canvas'); c.width=260; c.height=260;
      var x=c.getContext('2d'); x.clearRect(0,0,260,260);
      fn(x);
      var d=x.getImageData(0,0,260,260).data;
      var x0=1e9,y0=1e9,x1=-1,y1=-1;
      for(var yy=0;yy<260;yy++)for(var xx=0;xx<260;xx++){
        if(d[(yy*260+xx)*4+3]>16){ if(xx<x0)x0=xx; if(xx>x1)x1=xx; if(yy<y0)y0=yy; if(yy>y1)y1=yy; }
      }
      if(x1<0) return null;
      return {x0:x0,y0:y0,x1:x1,y1:y1,w:x1-x0+1,h:y1-y0+1,
              relTop:y0-CY, relBot:y1-CY};
    }
    var res={shape:{},sprite:{},variant:{}};

    /* ---- shape art ของทุก variant ---- */
    S.enabled=false;
    var seen={};
    for(var s=0;s<200;s++){
      var v=A.variant(s,4); if(!(v in seen)){ seen[v]=s; }
    }
    for(var v in seen){
      res.variant['tree'+v]=seen[v];
      res.shape['tree'+v]=bboxOf(function(x){ A.tree(x,CX,CY,1,0,+seen[v]); });
      res.shape['treeLarge'+v]=bboxOf(function(x){ A.tree(x,CX,CY,1,0,+seen[v]); });
    }
    var seenR={};
    for(var s=0;s<200;s++){ var v2=A.variant(s*1.7,3); if(!(v2 in seenR)) seenR[v2]=s; }
    for(var v2 in seenR){
      res.variant['rock'+v2]=seenR[v2];
      res.shape['rock'+v2]=bboxOf(function(x){ A.rock(x,CX,CY,1,false,+seenR[v2]); });
    }
    var seenO={};
    for(var s=0;s<200;s++){ var v3=A.variant(s*2.3,3); if(!(v3 in seenO)) seenO[v3]=s; }
    for(var v3 in seenO){
      res.variant['bush'+v3]=seenO[v3];
      res.shape['bush'+v3]=bboxOf(function(x){ A.bush(x,CX,CY,1,0,+seenO[v3]); });
    }
    res.shape['playerDown']=bboxOf(function(x){ A.player(x,CX,CY,1,{prof:'miner',t:0,moving:false,dir:'down',weapon:null}); });
    res.shape['playerUp']=bboxOf(function(x){ A.player(x,CX,CY,1,{prof:'miner',t:0,moving:false,dir:'up',weapon:null}); });
    res.shape['playerSide']=bboxOf(function(x){ A.player(x,CX,CY,1,{prof:'miner',t:0,moving:false,dir:'right',weapon:null}); });
    S.enabled=true;

    /* ---- bbox ของแต่ละคีย์สไปรต์ (วาดตรง ไม่มีของทับ) ---- */
    var keys=S.keys();
    for(var i=0;i<keys.length;i++){
      (function(k){
        res.sprite[k]=bboxOf(function(x){
          x.save(); x.translate(CX,CY); x.scale(1,1);
          S.draw(x,k,0,0,false,null,0);
          x.restore();
        });
      })(keys[i]);
    }
    return JSON.stringify(res);
  })()`);
  const r = JSON.parse(out);

  const fmt = b => b ? `w${b.w} h${b.h} relTop${b.relTop} relBot${b.relBot}` : 'none';
  console.log('=== SHAPE (เป้าหมาย) ===');
  for (const k of Object.keys(r.shape)) console.log('  ' + k.padEnd(16), fmt(r.shape[k]), ' seed=' + r.variant[k]);
  console.log('=== SPRITE (ปัจจุบัน) ===');
  for (const k of Object.keys(r.sprite)) console.log('  ' + k.padEnd(34), fmt(r.sprite[k]));
  sk.close(); ch.kill();
  try { fs.rmSync(ud, { recursive: true, force: true }); } catch (e) { }
})();
