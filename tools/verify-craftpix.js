/* ตรวจงานที่ 5 (ธีม CraftPix) — ยืนยันว่าสไปรต์ CraftPix โหลดจริงและถูก wire เข้ากับเกม
   ใช้: node tools/verify-craftpix.js [url]
   ตัวอย่าง: node tools/verify-craftpix.js http://127.0.0.1:8931/dungeon-town/index.html
*/
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');

function killChrome(ch) {
  try { process.kill(-ch.pid, 'SIGKILL'); } catch (e) {}
  try { ch.kill('SIGKILL'); } catch (e) {}
}

let __child = null;
function __cleanup() {
  if (__child) { try { killChrome(__child); } catch (e) {} }
}
process.on('exit', __cleanup);
process.on('uncaughtException', (e) => { console.error('UNCAUGHT: ' + (e && e.stack || e)); __cleanup(); process.exit(1); });
process.on('unhandledRejection', (e) => { console.error('UNHANDLED: ' + (e && e.stack || e)); __cleanup(); process.exit(1); });

const URL = process.argv[2] || 'http://127.0.0.1:8931/dungeon-town/index.html';
const PORT = 9373;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } }

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-cpx-'));
  const ch = spawn('/usr/bin/chromium', ['--headless=new', '--no-sandbox', '--disable-gpu',
    '--autoplay-policy=no-user-gesture-required', '--window-size=1280,800',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + ud, 'about:blank'],
    { stdio: 'ignore', detached: true });
  __child = ch;

  let wsUrl = null;
  for (let i = 0; i < 80 && !wsUrl; i++) {
    await sleep(250);
    try {
      const l = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
      const p = l.find(t => t.type === 'page');
      if (p) wsUrl = p.webSocketDebuggerUrl;
    } catch (e) { }
  }
  if (!wsUrl) { console.log('❌ เชื่อม CDP ไม่ได้'); __cleanup(); process.exit(1); }

  const sk = new WebSocket(wsUrl);
  let id = 0; const pend = new Map();
  const jsErrors = [];
  sk.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params && m.params.exceptionDetails;
      jsErrors.push((d && (d.exception && d.exception.description || d.text)) || 'unknown');
    }
    if (m.id && pend.has(m.id)) {
      const p = pend.get(m.id); pend.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    }
  });
  await new Promise(r => sk.addEventListener('open', r));
  const send = (method, params) => new Promise((resolve, reject) => {
    const i = ++id; pend.set(i, { resolve, reject });
    sk.send(JSON.stringify({ id: i, method, params }));
  });
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
    return r.result.value;
  };

  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Page.navigate', { url: URL });
  await sleep(3000);
  for (let i = 0; i < 40; i++) {
    try { if (await ev("typeof DT !== 'undefined'")) break; } catch (e) {}
    await sleep(250);
  }
  /* เข้าเกม */
  if (await ev("!!document.getElementById('play-now')").catch(() => false)) {
    await ev("document.getElementById('play-now').click()");
    await sleep(400);
  }
  await ev("(function(){var i=document.getElementById('pname');if(i)i.value='พี่เอ';var g=document.getElementById('go');if(g)g.click();})()");
  for (let i = 0; i < 60; i++) {
    try { if (await ev("!!(DT.Game && DT.Game.local)")) break; } catch (e) {}
    await sleep(250);
  }
  await sleep(1200);

  console.log('=== URL: ' + URL + ' ===\n');

  /* ---------- 1) อาคาร CraftPix ---------- */
  console.log('== อาคาร CraftPix (Free Fantasy Medieval Village Buildings) ==');
  const bInfo = await ev(`(function(){
    var w=DT.World.create();
    var b=(w.map && w.map.buildings)||[];
    return b.map(function(x){return x.name+'|'+x.sprite;});
  })()`);
  ok(Array.isArray(bInfo) && bInfo.length >= 5, 'มีอาคารในแผนที่ ' + (bInfo ? bInfo.length : 0) + ' หลัง');
  ok(Array.isArray(bInfo) && bInfo.every(s => /objects\/mv_/.test(s)), 'ทุกอาคารใช้สไปรต์ CraftPix (objects/mv_*)');
  const bLoaded = await ev(`(function(){
    var w=DT.World.create();
    var b=(w.map && w.map.buildings)||[];
    var n=0;
    for(var i=0;i<b.length;i++){ if(DT.Sprites.get(b[i].sprite)) n++; }
    return n+'/'+b.length;
  })()`);
  ok(/^\d+\/\d+$/.test(bLoaded) && bLoaded.split('/')[0] === bLoaded.split('/')[1],
     'สไปรต์อาคารโหลดได้ครบ ' + bLoaded);

  /* ---------- 2) Boss CraftPix ---------- */
  console.log('\n== Boss CraftPix (Free Fantasy RPG Pirate Boss) ==');
  const bossTypes = await ev(`(function(){
    var t=[];
    if(DT.World.create().BOSS_SPOTS) t=DT.World.create().BOSS_SPOTS.map(function(s){return s.type;});
    return t;
  })()`);
  ok(Array.isArray(bossTypes) && bossTypes.length === 3, 'มี Boss spot 3 จุด: ' + bossTypes.join(', '));
  const bossOk = await ev(`(function(){
    var t=${JSON.stringify(bossTypes || [])};
    var out=[];
    for(var i=0;i<t.length;i++) out.push(t[i]+':'+(DT.Sprites.get('mobs/'+t[i]+'.png')?'ok':'MISSING'));
    return out.join(' ');
  })()`);
  ok(typeof bossOk === 'string' && bossOk.split(' ').every(s => /:ok$/.test(s)), 'สไปรต์ Boss โหลดได้ครบ (' + bossOk + ')');
  ok(await ev("!!(DT.MOBS && DT.MOBS.pirate_leader && DT.MOBS.squidman && DT.MOBS.pirate_zombie)"),
     'DT.MOBS มี def ของ Boss ทั้ง 3 ตัว');

  /* ---------- 3) ตัวเล่นหญิง CraftPix 4 ทิศ ---------- */
  console.log('\n== ตัวเล่นหญิง CraftPix (Free Base 4-Direction Female) ==');
  const heroLoaded = await ev(`(function(){
    var dirs=['down','up','left','right'], miss=[], n=0;
    for(var i=0;i<dirs.length;i++)
      for(var f=0;f<6;f++){
        var k='characters/hero_'+dirs[i]+'_'+f+'.png';
        if(DT.Sprites.get(k)) n++; else miss.push(k);
      }
    return n+'/24'+(miss.length?(' ขาด:'+miss.join(',')):'');
  })()`);
  ok(/^24\/24/.test(heroLoaded), 'สไปรต์ฮีโร่ 4 ทิศ × 6 เฟรม โหลดได้ครบ (' + heroLoaded + ')');

  /* วาดจริง: Art.player ด้วย female=true ต้องไม่ใช่ shape art fallback */
  const drawn = await ev(`(function(){
    var c=document.createElement('canvas'); c.width=200; c.height=200;
    var x=c.getContext('2d');
    var dirs=['down','up','left','right'], bad=[];
    for(var i=0;i<dirs.length;i++){
      for(var f=0;f<6;f++){
        var before=DT.Sprites.get('characters/hero_'+dirs[i]+'_'+f+'.png');
        if(!before){bad.push('no-img');continue;}
        x.clearRect(0,0,200,200);
        try{ DT.Art.player(x,100,150,1,{prof:'knight',dir:dirs[i],female:true,moving:true,t:f/6,seed:1,weapon:null}); }
        catch(e){ bad.push(dirs[i]+'_'+f+':err'); continue; }
        var d=x.getImageData(0,0,200,200).data, hit=0;
        for(var p=3;p<d.length;p+=4) if(d[p]>8) hit++;
        if(hit<40) bad.push(dirs[i]+'_'+f+':blank('+hit+')');
      }
    }
    return bad.join(' ');
  })()`);
  ok(typeof drawn === 'string' && drawn.trim() === '', 'Art.player (female=true) วาดได้ครบ 24 เฟรม' + (drawn && drawn.trim() ? ' — ผิด: ' + drawn : ''));

  /* ---------- 3b) ตัวเล่นชาย CraftPix 4 ทิศ ---------- */
  console.log('\n== ตัวเล่นชาย CraftPix (Free Base 4-Direction Male) ==');
  const maleLoaded = await ev(`(function(){
    var dirs=['down','up','left','right'], miss=[], n=0;
    for(var i=0;i<dirs.length;i++)
      for(var f=0;f<6;f++){
        var k='characters/hero_m_'+dirs[i]+'_'+f+'.png';
        if(DT.Sprites.get(k)) n++; else miss.push(k);
      }
    return n+'/24'+(miss.length?(' ขาด:'+miss.join(',')):'');
  })()`);
  ok(/^24\/24/.test(maleLoaded), 'สไปรต์ฮีโร่ชาย 4 ทิศ × 6 เฟรม โหลดได้ครบ (' + maleLoaded + ')');

  const drawnM = await ev(`(function(){
    var c=document.createElement('canvas'); c.width=200; c.height=200;
    var x=c.getContext('2d');
    var dirs=['down','up','left','right'], bad=[];
    for(var i=0;i<dirs.length;i++){
      for(var f=0;f<6;f++){
        if(!DT.Sprites.get('characters/hero_m_'+dirs[i]+'_'+f+'.png')){bad.push('no-img');continue;}
        x.clearRect(0,0,200,200);
        try{ DT.Art.player(x,100,150,1,{prof:'knight',dir:dirs[i],male:true,moving:true,t:f/6,seed:1,weapon:null}); }
        catch(e){ bad.push(dirs[i]+'_'+f+':err'); continue; }
        var d=x.getImageData(0,0,200,200).data, hit=0;
        for(var p=3;p<d.length;p+=4) if(d[p]>8) hit++;
        if(hit<40) bad.push(dirs[i]+'_'+f+':blank('+hit+')');
      }
    }
    return bad.join(' ');
  })()`);
  ok(typeof drawnM === 'string' && drawnM.trim() === '', 'Art.player (male=true) วาดได้ครบ 24 เฟรม' + (drawnM && drawnM.trim() ? ' — ผิด: ' + drawnM : ''));

  /* เดาทิศจากสไปรต์ได้ด้วย (เผื่อข้อมูลเน็ตไม่ได้ส่ง flag) */
  const maleGuess = await ev(`(function(){
    var c=document.createElement('canvas'); c.width=120; c.height=120;
    var x=c.getContext('2d');
    x.clearRect(0,0,120,120);
    DT.Art.player(x,60,90,1,{prof:'knight',dir:'down',sprite:'characters/hero_m_down_0.png',moving:false,t:0,seed:1,weapon:null});
    var d=x.getImageData(0,0,120,120).data, hit=0;
    for(var p=3;p<d.length;p+=4) if(d[p]>8) hit++;
    return hit;
  })()`);
  ok(Number(maleGuess) > 40, 'Art.player เดาชุดชายจาก sprite ได้ (' + maleGuess + ' px)');

  /* ---------- 4) fallback ยังทำงาน ---------- */
  console.log('\n== fallback (สไปรต์โหลดไม่ได้ -> ยังวาดได้ ไม่จอดำ) ==');
  ok(await ev("!!(typeof DT.Art.tree === 'function' && typeof DT.Art.building === 'function')"),
     'Art.tree / Art.building มีอยู่');
  const fb = await ev(`(function(){
    var c=document.createElement('canvas'); c.width=160;c.height=160;
    var x=c.getContext('2d');
    x.clearRect(0,0,160,160);
    DT.Art.building(x,{x:20,y:60,w:3,h:3,name:'ทดสอบ',icon:''},{x:20,y:60,w:3,h:3},1);
    var d=x.getImageData(0,0,160,160).data, hit=0;
    for(var p=3;p<d.length;p+=4) if(d[p]>8) hit++;
    return hit;
  })()`);
  ok(fb > 100, 'อาคารที่ไม่มีสไปรต์ยังถูกวาดด้วย shape art (' + fb + ' px)');

  console.log('\n== error ==');
  ok(jsErrors.length === 0, 'ไม่มี JS error (' + jsErrors.length + ')');

  console.log('\n———— ผล: ' + pass + ' ผ่าน / ' + fail + ' ล้มเหลว ————');
  __cleanup();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR: ' + (e && e.stack || e)); __cleanup(); process.exit(1); });
