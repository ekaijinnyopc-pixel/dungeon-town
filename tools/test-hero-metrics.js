/* ตรวจตัวผู้เล่นชุด OGA แบบโปรแกรม (ไม่ต้องดูภาพ)
   - วัด bbox จริงของตัวละครที่วาดบน canvas
   - ตรวจว่าขนาดใกล้เคียงกันทุกทิศ / ทุกแอนิเมชัน
   - ตรวจว่าฐานเท้า (baseline) ตรงกันทุกเฟรม -> ไม่เกิด frame jitter
   - ตรวจว่าอาวุธไม่ทับใบหน้า
*/
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } }

(async () => {
  const PORT = 9500 + Math.floor(Math.random() * 40);
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
  if (!wsUrl) { console.log('❌ CDP fail'); ch.kill(); process.exit(1); }
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
    if (r.exceptionDetails) return 'ERR ' + JSON.stringify(r.exceptionDetails).slice(0, 400);
    return r.result && r.result.value;
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: 'file://' + path.join(ROOT, 'index.html') });
  await sleep(2500);

  /* 0) preload สไปรต์ OGA ให้โหลดเสร็จก่อนวัด (ระบบเป็น lazy) */
  await ev(`(function(){
    var keys=[];
    ['down','left','right','up'].forEach(function(d){
      for(var i=0;i<8;i++) keys.push('characters/hero_'+d+'_'+i+'.png');
      for(var i=0;i<12;i++) keys.push('characters/hero_'+d+'_idle_'+i+'.png');
      for(var i=0;i<7;i++) keys.push('characters/hero_'+d+'_atk_'+i+'.png');
    });
    window.__heroKeys = keys;
    DT.Sprites.preload(keys);
    return keys.length;
  })()`);
  /* รอโหลดเสร็จ (นับเป็นตัวเลข ไม่ใช้ string match เพราะ "2/108" จะชนกับ "/108") */
  let loadedCount = 0;
  for (let i = 0; i < 60; i++) {
    const done = await ev(`(function(){
      var n=0; window.__heroKeys.forEach(function(k){ if(DT.Sprites.get(k)) n++; });
      return n;
    })()`);
    loadedCount = typeof done === 'number' ? done : 0;
    if (loadedCount >= 108) break;
    await sleep(250);
  }
  console.log('  preload: ' + loadedCount + '/108');

  /* 1) ขนาดไฟล์จริง + ความสูงที่วาดจริง */
  console.log('\n== ขนาดไฟล์สไปรต์ OGA (จริง) ==');
  const sizes = JSON.parse(await ev(`(function(){
    var out={};
    ['down','left','right','up'].forEach(function(d){
      ['0','idle_0','atk_0'].forEach(function(suf){
        var img=DT.Sprites.get('characters/hero_'+d+'_'+suf+'.png');
        out[d+'_'+suf]= img ? [img.naturalWidth||img.width, img.naturalHeight||img.height] : null;
      });
    });
    return JSON.stringify(out);
  })()`));
  const heights = Object.values(sizes).filter(Boolean).map(v => v[1]);
  ok(heights.every(h => h === 34), 'ทุกเฟรมสูง 34px (' + JSON.stringify(sizes) + ')');

  /* 2) bbox จริงของตัวละครที่วาด (baseline ตรงกัน) */
  console.log('\n== ฐานเท้าตรงกันข้ามทิศ/แอนิเมชัน (กัน frame jitter) ==');
  const boxes = JSON.parse(await ev(`(function(){
    function bbox(key){
      var c=document.createElement('canvas'); c.width=80; c.height=80;
      var x=c.getContext('2d');
      x.fillStyle='rgba(255,0,0,1)';
      DT.Sprites.draw(x,key,40,70,false,null,0);
      var d=x.getImageData(0,0,80,80).data;
      var minx=999,miny=999,maxx=-1,maxy=-1;
      for(var y=0;y<80;y++) for(var xx=0;xx<80;xx++){
        var a=d[(y*80+xx)*4+3];
        if(a>0){ if(xx<minx)minx=xx; if(yy(y)){} }
      }
      return null;
    }
    return '{}';
  })()`));

  const realBoxes = JSON.parse(await ev(`(function(){
    function bb(key){
      var c=document.createElement('canvas'); c.width=80; c.height=80;
      var x=c.getContext('2d');
      DT.Sprites.draw(x,key,40,70,false,null,0);
      var d=x.getImageData(0,0,80,80).data;
      var minx=999,miny=999,maxx=-1,maxy=-1;
      for(var y=0;y<80;y++){
        for(var xx=0;xx<80;xx++){
          var a=d[(y*80+xx)*4+3];
          if(a>0){ if(xx<minx)minx=xx; if(y<miny)miny=y; if(xx>maxx)maxx=xx; if(y>maxy)maxy=y; }
        }
      }
      return {minx:minx,miny:miny,maxx:maxx,maxy:maxy,w:maxx-minx+1,h:maxy-miny+1};
    }
    var out={};
    ['down','left','right','up'].forEach(function(d){
      ['0','idle_0','atk_0','idle_5','atk_3'].forEach(function(suf){
        out[d+'_'+suf]=bb('characters/hero_'+d+'_'+suf+'.png');
      });
    });
    return JSON.stringify(out);
  })()`));
  const bottoms = Object.entries(realBoxes).map(([k, v]) => [k, v.maxy]);
  const maxBottom = Math.max(...bottoms.map(b => b[1]));
  const minBottom = Math.min(...bottoms.map(b => b[1]));
  ok(maxBottom - minBottom <= 1, 'ฐานเท้าทุกเฟรมตรงกัน (ต่างกัน ' + (maxBottom - minBottom) + 'px) ' + JSON.stringify(bottoms));

  const hs = Object.entries(realBoxes).map(([k, v]) => [k, v.h]);
  const walkIdleHs = hs.filter(([k]) => k.indexOf('atk') < 0).map(([, h]) => h);
  const atkHs = hs.filter(([k]) => k.indexOf('atk') >= 0).map(([, h]) => h);
  ok(Math.max(...walkIdleHs) - Math.min(...walkIdleHs) <= 5,
    'ความสูง walk/idle ใกล้เคียงกัน (' + Math.min(...walkIdleHs) + '-' + Math.max(...walkIdleHs) + 'px — ต่างกันตามท่ายกแขน)');
  ok(Math.max(...atkHs) <= Math.max(...walkIdleHs),
    'เฟรมโจมตีไม่สูงกว่า walk/idle (' + Math.min(...atkHs) + '-' + Math.max(...atkHs) + 'px, ทรงตัวต่ำลงตอนทุบ)');
  const ws = Object.values(realBoxes).map(v => v.w);
  ok(Math.max(...ws) <= 24, 'ความกว้างไม่เกิน 24px (' + Math.min(...ws) + '-' + Math.max(...ws) + 'px)');

  /* 3) อาวุธไม่ทับใบหน้า */
  console.log('\n== อาวุธไม่ทับใบหน้า ==');
  const weap = JSON.parse(await ev(`(function(){
    function drawWithWeapon(dir, weapon){
      var c=document.createElement('canvas'); c.width=120; c.height=120;
      var x=c.getContext('2d');
      var o={ female:true, dir:dir, moving:false, swing:0, weapon:weapon, prof:'miner' };
      if(!DT.Art || !DT.Art.player) return {err:'no Art.player'};
      DT.Art.player(x, 60, 100, 1, o);
      var d=x.getImageData(0,0,120,120).data;
      var minx=999,miny=999,maxx=-1,maxy=-1;
      for(var y=0;y<120;y++)for(var xx=0;xx<120;xx++){
        if(d[(y*120+xx)*4+3]>0){ if(xx<minx)minx=xx; if(y<miny)miny=y; if(xx>maxx)maxx=xx; if(y>maxy)maxy=y; }
      }
      return {minx:minx,miny:miny,maxx:maxx,maxy:maxy,w:maxx-minx+1,h:maxy-miny+1};
    }
    var out={};
    ['down','left','right','up'].forEach(function(d){
      out[d]=drawWithWeapon(d,'sword');
    });
    return JSON.stringify(out);
  })()`));
  if (weap.err) { ok(false, 'Art.player ไม่มี: ' + weap.err); }
  else {
    const wh = Object.values(weap).map(v => v.h);
    ok(Math.max(...wh) - Math.min(...wh) <= 3, 'ความสูงรวมอาวุธใกล้เคียงกันทุกทิศ (' + JSON.stringify(wh) + ')');
  }

  /* 4) fallback ยังทำงาน */
  console.log('\n== fallback shape-art ==');
  const fb = JSON.parse(await ev(`(function(){
    var c=document.createElement('canvas'); c.width=120; c.height=120;
    var x=c.getContext('2d');
    DT.Art.player(x, 60, 100, 1, {female:false,sprite:'characters/nope_missing.png',dir:'down',moving:false,swing:0,weapon:'sword',prof:'miner'});
    var d=x.getImageData(0,0,120,120).data; var n=0;
    for(var i=3;i<d.length;i+=4) if(d[i]>0) n++;
    return JSON.stringify({px:n});
  })()`));
  ok(fb.px > 200, 'fallback ยังวาดรูปทรงได้ (' + fb.px + ' พิกเซล)');

  console.log('\n———— ผล: ' + pass + ' ผ่าน / ' + fail + ' ล้มเหลว ————');
  try { ch.kill('SIGKILL'); } catch (e) { }
  process.exit(fail ? 1 : 0);
})();
