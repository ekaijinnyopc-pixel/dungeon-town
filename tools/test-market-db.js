// ทดสอบตลาดผ่าน Supabase จริงในเบราว์เซอร์ (Chromium headless ผ่าน CDP)
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const URL_ = process.argv[2];
const PORT = 9377;
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-mk-'));
  const ch = spawn('/usr/bin/chromium', ['--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + ud, 'about:blank'], { stdio: 'ignore' });
  let wsUrl = null;
  for (let i = 0; i < 80 && !wsUrl; i++) {
    await sleep(250);
    try { const l = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json(); const p = l.find(t => t.type === 'page'); if (p) wsUrl = p.webSocketDebuggerUrl; } catch (e) { }
  }
  if (!wsUrl) { console.log('❌ เปิด chromium ไม่ได้'); ch.kill(); process.exit(1); }
  const sk = new WebSocket(wsUrl);
  let id = 0; const pend = new Map(); const errors = [];
  sk.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push('EXC ' + JSON.stringify(m.params.exceptionDetails || {}).slice(0, 300));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errors.push('CONSOLE ' + (m.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 250));
    }
  });
  await new Promise(r => sk.addEventListener('open', r));
  const send = (method, params) => new Promise((res, rej) => { const i = ++id; pend.set(i, { resolve: res, reject: rej }); sk.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return 'EXC:' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text);
    return r.result.value;
  };
  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
  await send('Page.navigate', { url: URL_ });
  await sleep(4500);

  // กด "เริ่มเล่น" ก่อน ไม่งั้น DT.Net.boot() ยังไม่ถูกเรียก (client = null)
  console.log('== เริ่มเกม ==');
  const started = await ev(`(function(){
    try {
      var pn = document.getElementById('pname');
      if (pn) pn.value = 'ทดสอบตลาด';
      var b = document.querySelector('.prof[data-prof=miner]');
      if (b) b.click();
      var g = document.getElementById('go');
      if (g) g.click();
      return 'clicked';
    } catch (e) { return 'ERR:' + e.message; }
  })()`);
  console.log('start =', started);
  await sleep(4000);

  console.log('== โหมดตลาด ==');
  console.log('MARKET_USE_DB =', await ev('window.DT && DT.CFG ? DT.CFG.MARKET_USE_DB : "no DT"'));
  console.log('Market.READY (ตาราง DB ใช้ได้) =', await ev('window.DT && DT.Market ? DT.Market.READY : "no market"'));
  console.log('Market.booted =', await ev('window.DT && DT.Market ? DT.Market.booted : "-"'));
  console.log('Net.client =', await ev('window.DT && DT.Net && DT.Net.client ? "มี" : "ไม่มี"'));
  console.log('Net.clientId =', await ev('window.DT && DT.Net ? String(DT.Net.clientId).slice(0,8) : "-"'));

  console.log('\n== ทดสอบตั้งขายจริง (insert) ==');
  const ins = await ev(`(async function(){
    var r = await DT.Net.client.from('dungeon_town_market').insert({
      seller_id: DT.Net.clientId, seller_name: 'browser_test',
      item_id: 'wood', qty: 2, price: 7, status: 'active'
    }).select().single();
    return JSON.stringify({err: r.error ? r.error.message : null, id: r.data ? r.data.id : null});
  })()`);
  console.log('insert =', ins);

  console.log('\n== อ่านรายการจริง ==');
  const sel = await ev(`(async function(){
    var r = await DT.Net.client.from('dungeon_town_market').select('*').eq('seller_id', DT.Net.clientId);
    return JSON.stringify({err: r.error ? r.error.message : null, n: r.data ? r.data.length : -1, row: r.data && r.data[0] ? r.data[0] : null});
  })()`);
  console.log('select =', sel);

  console.log('\n== ยกเลิก/ลบรายการ (cleanup) ==');
  const del = await ev(`(async function(){
    var r = await DT.Net.client.from('dungeon_town_market').delete().eq('seller_id', DT.Net.clientId);
    return JSON.stringify({err: r.error ? r.error.message : null});
  })()`);
  console.log('delete =', del);

  console.log('\n== console errors ==');
  console.log(errors.length ? errors.join('\n') : '(ไม่มี error)');
  ch.kill();
  process.exit(0);
})();
