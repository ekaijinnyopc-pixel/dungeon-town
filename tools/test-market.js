/* =========================================================
   เทสต์ตลาดผู้เล่น — js/market.js (โหลดแบบ node + vm, ไม่ต้องเปิดเบราว์เซอร์)
   รัน: node tools/test-market.js
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
function ok(c, m) {
  if (c) { pass++; console.log('  ✅ ' + m); }
  else { fail++; console.log('  ❌ ' + m); }
}
function eq(a, b, m) { ok(a === b, m + ' (ได้ ' + JSON.stringify(a) + ', คาด ' + JSON.stringify(b) + ')'); }

/* ---------- sandbox: localStorage + DT.Net stub ---------- */
const store = {};
const localStorageStub = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
  clear: () => { for (const k in store) delete store[k]; }
};

const sent = [];
const netStub = {
  mode: 'offline',
  client: null,               // ไม่มี supabase -> บังคับโหมด fallback
  channel: null,
  peers: {},
  onPeer: null,
  clientId: 'c-test-local',
  handleMsg: function (m) { /* noop */ },
  send: function (m) { sent.push(m); }
};

const sandbox = {
  console, localStorage: localStorageStub, sessionStorage: localStorageStub,
  setTimeout, clearTimeout, Date, Math, JSON
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.DT = { Net: netStub };
vm.createContext(sandbox);

function load(file) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  vm.runInContext(code, sandbox, { filename: file });
}

load('js/config.js');
load('js/market.js');

const DT = sandbox.DT;
const Market = DT.Market;

/* helper: เรียก callback API ให้เป็น promise */
function call(fn) {
  const args = Array.prototype.slice.call(arguments, 1);
  return new Promise((resolve, reject) => {
    let done = false;
    fn.apply(null, args.concat([function (err, res) {
      if (done) return;
      done = true;
      if (err) reject(err); else resolve(res);
    }]));
  });
}
function count(inv, id) {
  let t = 0;
  for (const s of inv) if (s.id === id) t += s.n;
  return t;
}
function mkPlayer(id, name, coins, inv) {
  return { id: id, name: name, coins: coins, inv: inv.slice(), weapon: null, armorId: null, accessoryId: null };
}

/* ---------- เริ่ม ---------- */
(async function main() {
  console.log('== โมดูลตลาด ==');
  ok(typeof Market === 'object', 'js/market.js โหลดแล้ว -> DT.Market');
  ok(Market.FEE_RATE === 0.05, 'ค่าธรรมเนียม 5%');
  ok(Array.isArray(Market.listings), 'มี DT.Market.listings');
  ['boot', 'load', 'listItem', 'cancel', 'buy', 'sellTo', 'remove', 'mine', 'canList']
    .forEach(fn => ok(typeof Market[fn] === 'function', 'มีเมธอด ' + fn));

  console.log('\n== boot (ไม่มีตาราง -> fallback localStorage) ==');
  const ready = await new Promise(r => Market.boot(r));
  eq(ready, false, 'boot คืน false (ไม่มีตาราง DB)');
  eq(Market.READY, false, 'DT.Market.READY = false');

  console.log('\n== canList ==');
  const seller = mkPlayer('c1', 'พี่เอ', 100, [{ id: 'wood', n: 5 }, { id: 'stone', n: 3 }]);
  const buyer = mkPlayer('c2', 'พี่บี', 100, []);
  eq(Market.canList(seller, 'wood', 6).ok, false, 'ของไม่พอ -> ไม่ผ่าน');
  eq(Market.canList(seller, 'wood', 0).ok, false, 'qty <= 0 -> ไม่ผ่าน');
  eq(Market.canList(seller, 'wood', -2).ok, false, 'qty ติดลบ -> ไม่ผ่าน');
  eq(Market.canList(seller, 'wood', 1, 0).ok, false, 'ราคา <= 0 -> ไม่ผ่าน');
  eq(Market.canList(seller, 'wood', 1, -5).ok, false, 'ราคาติดลบ -> ไม่ผ่าน');
  eq(Market.canList(seller, 'no_such_item', 1).ok, false, 'ไอเทมไม่มีจริง -> ไม่ผ่าน');
  eq(Market.canList(seller, 'wood', 5, 10).ok, true, 'ของพอ + ราคาถูก -> ผ่าน');
  ok(!!Market.canList(seller, 'wood', 6).reason, 'มี reason อธิบาย (' + Market.canList(seller, 'wood', 6).reason + ')');

  console.log('\n== listItem ==');
  let err = null;
  try { await call(Market.listItem, seller, 'wood', 1, 0); } catch (e) { err = e; }
  ok(!!err, 'ตั้งขายราคา 0 -> error');
  err = null;
  try { await call(Market.listItem, seller, 'wood', 0, 10); } catch (e) { err = e; }
  ok(!!err, 'ตั้งขาย qty 0 -> error');

  const changes = [];
  Market.onChange = () => { changes.push(Market.listings.length); };
  const listing = await call(Market.listItem, seller, 'wood', 2, 10);
  eq(count(seller.inv, 'wood'), 3, 'หักของออกจาก inv (5 -> 3)');
  eq(Market.listings.length, 1, 'เพิ่ม listing 1 รายการ');
  eq(listing.itemId, 'wood', 'listing.itemId = wood');
  eq(listing.qty, 2, 'listing.qty = 2');
  eq(listing.price, 10, 'listing.price = 10 (ราคาต่อชิ้น)');
  eq(listing.sellerId, 'c1', 'listing.sellerId = ผู้ขาย');
  ok(!!listing.id, 'listing มี id');
  ok(changes.length > 0, 'onChange ถูกเรียกเมื่อ listing เปลี่ยน (' + changes.length + ' ครั้ง)');

  console.log('\n== buy ==');
  const coinsBefore = buyer.coins;
  const res = await call(Market.buy, buyer, listing.id);
  const total = 10 * 2;              // 20
  const fee = Math.round(total * 0.05); // 1
  eq(buyer.coins, coinsBefore - (total + fee), 'ผู้ซื้อเหรียญลด = ราคารวม + ค่าธรรมเนียม');
  eq(count(buyer.inv, 'wood'), 2, 'ผู้ซื้อได้ของเข้า inv');
  eq(Market.listings.length, 0, 'listing หายจากตลาดหลังซื้อ');
  eq(res.fee, fee, 'ผลลัพธ์คืนค่าธรรมเนียม');
  eq(res.paid, total + fee, 'ผลลัพธ์คืนยอดที่จ่าย');
  ok(Market.pending.length === 1, 'เก็บรายการรอผู้ขายรับเงิน (pending) 1 รายการ');

  /* ซื้อของตัวเองไม่ได้ */
  const selfBuy = await call(Market.listItem, seller, 'stone', 1, 5).catch(e => e);
  ok(selfBuy && selfBuy.id, 'ตั้งขายของชิ้นที่ 2 ได้');
  let selfErr = null;
  try { await call(Market.buy, seller, selfBuy.id); } catch (e) { selfErr = e; }
  ok(!!selfErr, 'ซื้อของตัวเอง -> error');

  /* เงินไม่พอ */
  const poor = mkPlayer('c3', 'พี่ซี', 1, []);
  let poorErr = null;
  try { await call(Market.buy, poor, selfBuy.id); } catch (e) { poorErr = e; }
  ok(!!poorErr, 'เงินไม่พอ -> error');

  console.log('\n== sellTo (ผู้ขายรับเงิน) ==');
  const sellerCoins = seller.coins;
  const pay = await call(Market.sellTo, seller, listing.id);
  eq(seller.coins, sellerCoins + (total - fee), 'ผู้ขายได้เงิน = ราคารวม - ค่าธรรมเนียม');
  eq(pay.amount, total - fee, 'ผลลัพธ์ amount = รายได้สุทธิ');
  eq(Market.pending.length, 0, 'pending หมดแล้ว');

  console.log('\n== cancel (คืนของ) ==');
  const beforeCancel = count(seller.inv, 'stone');
  await call(Market.cancel, seller, selfBuy.id);
  eq(count(seller.inv, 'stone'), beforeCancel + 1, 'คืนของเข้า inv');
  eq(Market.listings.length, 0, 'listing หายหลังยกเลิก');

  /* ยกเลิกของคนอื่นไม่ได้ */
  const l3 = await call(Market.listItem, seller, 'stone', 1, 5);
  let otherErr = null;
  try { await call(Market.cancel, buyer, l3.id); } catch (e) { otherErr = e; }
  ok(!!otherErr, 'ยกเลิกของคนอื่น -> error');
  eq(Market.listings.length, 1, 'listing ยังอยู่');

  console.log('\n== mine / remove / load ==');
  eq(Market.mine('c1').length, 1, 'mine() คืน listing ของผู้ขาย');
  eq(Market.mine('c2').length, 0, 'mine() ของคนอื่นว่าง');
  Market.remove(l3.id);
  eq(Market.listings.length, 0, 'remove() ลบ listing ได้');
  await call(Market.load);
  eq(Market.listings.length, 0, 'load() จาก localStorage ทำงานได้');

  console.log('\n== localStorage / broadcast ==');
  const raw = JSON.parse(localStorageStub.getItem('dt:market') || '{}');
  ok(!!raw && Array.isArray(raw.listings), 'เก็บ listing ใน localStorage key dt:market');
  ok(sent.some(m => m.t === 'market' && m.op === 'list'), 'broadcast op=list ถูกส่งผ่าน DT.Net.send');
  ok(sent.some(m => m.t === 'market' && m.op === 'buy'), 'broadcast op=buy ถูกส่ง');
  ok(sent.some(m => m.t === 'market' && m.op === 'cancel'), 'broadcast op=cancel ถูกส่ง');

  console.log('\n== ข้อความจากเครื่องอื่น ==');
  const before = Market.listings.length;
  netStub.handleMsg({ t: 'market', op: 'list', id: 'c-other', listing: { id: 'x1', sellerId: 'c9', sellerName: 'อื่น', itemId: 'ore', qty: 1, price: 8, createdAt: '' } });
  eq(Market.listings.length, before + 1, 'รับ listing จากเครื่องอื่นได้');
  netStub.handleMsg({ t: 'market', op: 'cancel', id: 'c-other', listingId: 'x1' });
  eq(Market.listings.length, before, 'รับ cancel จากเครื่องอื่นได้');

  console.log('\n———— ผล: ' + pass + ' ผ่าน / ' + fail + ' ล้มเหลว ————');
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error('❌ เทสต์พัง:', e);
  console.log('\n———— ผล: ' + pass + ' ผ่าน / ' + (fail + 1) + ' ล้มเหลว ————');
  process.exit(1);
});
