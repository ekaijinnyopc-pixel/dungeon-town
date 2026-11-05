/* =========================================================
   เทสต์ระบบตีเหล็ก (refine) — Phase 5
   ใช้: node tools/test-refine.js
   โหลด js/config.js + js/refine.js + stub ของ DT ในโหนด
   ========================================================= */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ✅ ' + msg); }
  else { fail++; console.log('  ❌ ' + msg); }
}
function eq(a, b, msg) {
  ok(a === b, msg + ' (ได้ ' + JSON.stringify(a) + ', คาดว่า ' + JSON.stringify(b) + ')');
}
function near(a, b, eps, msg) {
  ok(Math.abs(a - b) < (eps || 1e-9), msg + ' (ได้ ' + a + ', คาดว่า ~' + b + ')');
}

/* ---------- โหลด js/config.js + js/refine.js ใน sandbox ---------- */
const sandbox = { console, Math, Date, JSON, isFinite, parseInt, parseFloat };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

function load(rel) {
  const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  vm.runInContext(code, sandbox, { filename: rel });
}

load('js/config.js');
load('js/refine.js');

const DT = sandbox.DT;
const C = DT.CFG;
const R = DT.Refine;

/* ---------- helper สร้างผู้เล่นจำลอง ---------- */
function makePlayer(opts) {
  opts = opts || {};
  const inv = (opts.inv || []).map(s => (typeof s === 'string' ? { id: s, n: 1 } : { id: s.id, n: s.n || 1 }));
  return {
    inv,
    coins: opts.coins !== undefined ? opts.coins : 10000,
    refine: opts.refine ? Object.assign({}, opts.refine) : {},
    weapon: null, armorId: null, accessoryId: null,
    weaponDmg: 2, accDmg: 0, armor: 0,
    recalcGear() {
      const w = this.weapon ? DT.ITEMS[this.weapon] : null;
      const a = this.armorId ? DT.ITEMS[this.armorId] : null;
      const acc = this.accessoryId ? DT.ITEMS[this.accessoryId] : null;
      this.weaponDmg = (w && w.weapon) ? w.weapon : 2;
      this.accDmg = (acc && acc.acc) ? acc.acc : 0;
      const accDef = (acc && acc.accDef) ? acc.accDef : 0;
      this.armor = ((a && a.armor) ? a.armor : 0) + accDef;
    }
  };
}
function count(p, id) {
  let t = 0;
  for (const s of p.inv) if (s.id === id) t += s.n;
  return t;
}

/* ---------- RNG ที่ควบคุมได้ (ลำดับค่าที่จะปั่นตามลำดับ) ---------- */
function seqRng(values) {
  let i = 0;
  return function () {
    if (i >= values.length) return values[values.length - 1];
    return values[i++];
  };
}
function setRng(fn) { R.rng = fn; }

console.log('\n=== ระบบตีเหล็ก (refine) — Phase 5 ===\n');

/* ---------- 1) config: ของใหม่ + ค่า CFG ---------- */
console.log('[1] config.js — ของใหม่และค่าตั้ง');
ok(!!DT.ITEMS.refine_stone, 'มี refine_stone');
ok(DT.ITEMS.refine_stone.name === 'หินตีบวก', 'ชื่อ refine_stone = หินตีบวก');
eq(DT.ITEMS.refine_stone.icon, '🔷', 'ไอคอน refine_stone');
eq(DT.ITEMS.refine_stone.stack, 20, 'stack refine_stone = 20');
ok(!!DT.ITEMS.protect_stone, 'มี protect_stone');
eq(DT.ITEMS.protect_stone.name, 'หินกันแตก', 'ชื่อ protect_stone');
eq(DT.ITEMS.protect_stone.icon, '🔶', 'ไอคอน protect_stone');
eq(DT.ITEMS.protect_stone.stack, 20, 'stack protect_stone = 20');
ok(!!DT.ITEMS.lucky_stone, 'มี lucky_stone');
eq(DT.ITEMS.lucky_stone.name, 'หินเสี่ยงโชค', 'ชื่อ lucky_stone');
eq(DT.ITEMS.lucky_stone.icon, '🎲', 'ไอคอน lucky_stone');
eq(DT.ITEMS.lucky_stone.stack, 20, 'stack lucky_stone = 20');

eq(C.REFINE_MAX, 10, 'CFG.REFINE_MAX = 10');
eq(C.REFINE_BASE_CHANCE, 0.6, 'CFG.REFINE_BASE_CHANCE = 0.6');
eq(C.REFINE_CHANCE_DECAY, 0.045, 'CFG.REFINE_CHANCE_DECAY = 0.045');
eq(C.REFINE_COST_COINS, 50, 'CFG.REFINE_COST_COINS = 50');
eq(C.REFINE_COST_STONE, 2, 'CFG.REFINE_COST_STONE = 2');
eq(C.REFINE_PROTECT_CHANCE, 0.9, 'CFG.REFINE_PROTECT_CHANCE = 0.9');
eq(C.REFINE_LUCKY_BONUS, 0.15, 'CFG.REFINE_LUCKY_BONUS = 0.15');
eq(C.REFINE_DMG_PER_LEVEL, 0.10, 'CFG.REFINE_DMG_PER_LEVEL = 0.10');
eq(C.REFINE_ARMOR_PER_LEVEL, 0.10, 'CFG.REFINE_ARMOR_PER_LEVEL = 0.10');

/* ---------- 2) API shape ---------- */
console.log('\n[2] API ของ DT.Refine');
eq(R.MAX, 10, 'DT.Refine.MAX = 10');
for (const fn of ['chance', 'cost', 'canRefine', 'attempt', 'levelOf', 'bonus']) {
  ok(typeof R[fn] === 'function', 'DT.Refine.' + fn + ' เป็นฟังก์ชัน');
}

/* ---------- 3) chance ---------- */
console.log('\n[3] chance(level, opts)');
near(R.chance(0), 0.6, 1e-9, 'chance(0) = 0.6');
near(R.chance(1), 0.555, 1e-9, 'chance(1) = 0.555');
near(R.chance(9), 0.195, 1e-9, 'chance(9) = 0.195');
ok(R.chance(5) < R.chance(4), 'โอกาสลดลงตามระดับ');
ok(R.chance(9) < R.chance(0), 'โอกาสระดับ 9 < ระดับ 0');
near(R.chance(0, { lucky: true }), 0.75, 1e-9, 'chance + lucky = +0.15');
near(R.chance(3, { lucky: true }), 0.465 + 0.15, 1e-9, 'chance(3,lucky) = 0.465+0.15');
near(R.chance(3, { protect: true }), 0.465, 1e-9, 'protect ไม่กระทบโอกาสสำเร็จ');
for (let l = 0; l <= 9; l++) {
  const c = R.chance(l);
  ok(c >= 0 && c <= 1, 'chance(' + l + ') = ' + c.toFixed(3) + ' อยู่ในช่วง 0..1');
}
ok(R.chance(99) >= 0 && R.chance(99) <= 1, 'chance(99) ยังอยู่ในช่วง 0..1 (clamp)');

/* ---------- 4) cost ---------- */
console.log('\n[4] cost(level)');
const c0 = R.cost(0);
eq(c0.coins, 50, 'cost(0).coins = 50');
eq(c0.stones, 2, 'cost(0).stones = 2');
const c3 = R.cost(3);
eq(c3.coins, 200, 'cost(3).coins = 50*4');
eq(c3.stones, 8, 'cost(3).stones = 2*4');
const c9 = R.cost(9);
eq(c9.coins, 500, 'cost(9).coins = 50*10');
eq(c9.stones, 20, 'cost(9).stones = 2*10');

/* ---------- 5) canRefine ---------- */
console.log('\n[5] canRefine(player, itemId)');
{
  const p = makePlayer({ inv: [{ id: 'iron_sword', n: 1 }] });
  ok(R.canRefine(p, 'iron_sword') === true, 'มีของและยัง refine ได้ -> true');
  ok(R.canRefine(p, 'steel_sword') === false, 'ไม่มีของ -> false');
  const pMax = makePlayer({ inv: [{ id: 'iron_sword', n: 1 }], refine: { iron_sword: 10 } });
  ok(R.canRefine(pMax, 'iron_sword') === false, 'ถึง REFINE_MAX แล้ว -> false');
  const p9 = makePlayer({ inv: [{ id: 'iron_sword', n: 1 }], refine: { iron_sword: 9 } });
  ok(R.canRefine(p9, 'iron_sword') === true, 'ระดับ 9 ยัง refine ได้ (ไป +10)');
}

/* ---------- 6) attempt: หักเงิน + หิน ---------- */
console.log('\n[6] attempt() — หักค่าใช้จ่าย');
{
  const p = makePlayer({ inv: [{ id: 'iron_sword', n: 1 }, { id: 'refine_stone', n: 10 }], coins: 1000 });
  setRng(seqRng([0.0]));
  const res = R.attempt(p, 'iron_sword', {});
  ok(res.ok === true, 'สำเร็จ');
  eq(res.level, 1, 'ระดับเพิ่มเป็น 1');
  eq(p.coins, 950, 'เงินลด 50');
  eq(count(p, 'refine_stone'), 8, 'หินตีบวกลด 2');
  eq(count(p, 'iron_sword'), 1, 'ของยังอยู่');
  ok(typeof res.msg === 'string' && res.msg.length > 0, 'มี msg: ' + JSON.stringify(res.msg));
  ok(res.msg.indexOf('สำเร็จ') !== -1, 'msg บอกว่าสำเร็จ');
}

/* ---------- 7) attempt: เงิน/หินไม่พอ → ไม่หัก ---------- */
console.log('\n[7] attempt() — เงิน/หินไม่พอ');
{
  const p = makePlayer({ inv: [{ id: 'iron_sword', n: 1 }], coins: 10 });
  setRng(seqRng([0.0]));
  const res = R.attempt(p, 'iron_sword', {});
  ok(res.ok === false, 'ไม่สำเร็จ');
  eq(p.coins, 10, 'เงินไม่ถูกหัก');
  eq(res.level, 0, 'ระดับยัง 0');
  ok(res.broke === false, 'ของไม่แตก');

  const p2 = makePlayer({ inv: [{ id: 'iron_sword', n: 1 }, { id: 'refine_stone', n: 1 }], coins: 1000 });
  const res2 = R.attempt(p2, 'iron_sword', {});
  ok(res2.ok === false, 'หินไม่พอ -> ไม่สำเร็จ');
  eq(p2.coins, 1000, 'เงินไม่ถูกหักเมื่อหินไม่พอ');
  eq(count(p2, 'iron_sword'), 1, 'ของไม่หาย');
}

/* ---------- 8) attempt: ถึง MAX แล้ว refuse ---------- */
console.log('\n[8] attempt() — ถึง REFINE_MAX แล้ว refuse');
{
  const p = makePlayer({ inv: [{ id: 'iron_sword', n: 1 }, { id: 'refine_stone', n: 50 }], coins: 10000, refine: { iron_sword: 10 } });
  setRng(seqRng([0.0]));
  const res = R.attempt(p, 'iron_sword', {});
  ok(res.ok === false, 'refuse');
  eq(p.coins, 10000, 'เงินไม่ถูกหัก');
  eq(count(p, 'refine_stone'), 50, 'หินไม่ถูกหัก');
  eq(count(p, 'iron_sword'), 1, 'ของไม่หาย');
}

/* ---------- 9) attempt: ล้มเหลว → ของแตก ---------- */
console.log('\n[9] attempt() — ล้มเหลว ของแตก');
{
  const p = makePlayer({ inv: [{ id: 'iron_sword', n: 1 }, { id: 'refine_stone', n: 10 }], coins: 1000 });
  setRng(seqRng([0.999]));   // โอกาสสำเร็จต่ำมาก -> ล้มเหลว
  const res = R.attempt(p, 'iron_sword', {});
  ok(res.ok === false, 'ล้มเหลว');
  eq(res.broke, true, 'broke = true');
  eq(count(p, 'iron_sword'), 0, 'ของหายไปจาก inv');
  eq(res.level, 0, 'ระดับกลับเป็น 0');
  eq(p.refine.iron_sword, undefined, 'ไม่มีระดับค้างใน player.refine');
  ok(res.msg.indexOf('แตก') !== -1, 'msg บอกว่าของแตก: ' + JSON.stringify(res.msg));
}

/* ---------- 10) attempt: ล้มเหลว + หินกันแตก → ของไม่แตก ---------- */
console.log('\n[10] attempt() — หินกันแตกกันของแตก');
{
  const p = makePlayer({ inv: [{ id: 'iron_sword', n: 1 }, { id: 'refine_stone', n: 10 }, { id: 'protect_stone', n: 2 }], coins: 1000 });
  // rng: ครั้งแรกล้มเหลว (0.999), ครั้งที่สองผ่านเกณฑ์ protect (0.5 < 0.9)
  setRng(seqRng([0.999, 0.5]));
  const res = R.attempt(p, 'iron_sword', { protect: true });
  ok(res.ok === false, 'ล้มเหลว');
  eq(res.broke, false, 'broke = false (ของไม่แตก)');
  eq(count(p, 'iron_sword'), 1, 'ของยังอยู่');
  eq(R.levelOf(p, 'iron_sword'), 0, 'ระดับไม่ขึ้น');
  eq(count(p, 'protect_stone'), 1, 'หินกันแตกถูกใช้ไป 1');
  ok(res.msg.indexOf('ไม่แตก') !== -1, 'msg บอกว่ามีหินกันแตก: ' + JSON.stringify(res.msg));
}
{
  // หินกันแตกสุ่มไม่ผ่าน -> ของต้องแตก
  const p = makePlayer({ inv: [{ id: 'iron_sword', n: 1 }, { id: 'refine_stone', n: 10 }, { id: 'protect_stone', n: 1 }], coins: 1000 });
  setRng(seqRng([0.999, 0.95]));  // 0.95 > 0.9 -> กันไม่สำเร็จ
  const res = R.attempt(p, 'iron_sword', { protect: true });
  eq(res.broke, true, 'กันไม่สำเร็จ -> ของแตก');
  eq(count(p, 'iron_sword'), 0, 'ของหาย');
}

/* ---------- 11) attempt: ไม่มีหินกันแตกแต่สั่ง protect → ของแตกได้ ---------- */
console.log('\n[11] attempt() — สั่ง protect แต่ไม่มีหิน');
{
  const p = makePlayer({ inv: [{ id: 'iron_sword', n: 1 }, { id: 'refine_stone', n: 10 }], coins: 1000 });
  setRng(seqRng([0.999]));
  const res = R.attempt(p, 'iron_sword', { protect: true });
  eq(res.broke, true, 'ไม่มีหินกันแตก -> ของแตก');
}

/* ---------- 12) attempt: หินเสี่ยงโชคเพิ่มโอกาส ---------- */
console.log('\n[12] attempt() — หินเสี่ยงโชค');
{
  // ระดับ 9: โอกาสปกติ 0.195 -> สุ่ม 0.5 ล้มเหลว; มี lucky: 0.345 -> สุ่ม 0.5 ยังล้มเหลว
  // เลือกค่า 0.30: ปกติ 0.195 -> ล้มเหลว, lucky 0.345 -> สำเร็จ
  const p = makePlayer({ inv: [{ id: 'iron_sword', n: 1 }, { id: 'refine_stone', n: 40 }, { id: 'lucky_stone', n: 1 }], coins: 10000, refine: { iron_sword: 9 } });
  setRng(seqRng([0.30]));
  const res = R.attempt(p, 'iron_sword', { lucky: true });
  ok(res.ok === true, 'ด้วย lucky ที่ระดับ 9 แล้วสำเร็จ (0.30 < 0.345)');
  eq(res.level, 10, 'ระดับขึ้นเป็น 10');
  eq(count(p, 'lucky_stone'), 0, 'หินเสี่ยงโชคถูกใช้ไป');
}
{
  // ไม่มี lucky -> โอกาสเดิม 0.195 -> 0.30 ล้มเหลว
  const p = makePlayer({ inv: [{ id: 'iron_sword', n: 1 }, { id: 'refine_stone', n: 40 }], coins: 10000, refine: { iron_sword: 9 } });
  setRng(seqRng([0.30]));
  const res = R.attempt(p, 'iron_sword', {});
  ok(res.ok === false, 'ไม่มี lucky -> 0.30 > 0.195 ล้มเหลว');
}

/* ---------- 13) levelOf ---------- */
console.log('\n[13] levelOf(player, itemId)');
{
  const p = makePlayer({ refine: { iron_sword: 7 } });
  eq(R.levelOf(p, 'iron_sword'), 7, 'ระดับของ iron_sword = 7');
  eq(R.levelOf(p, 'axe'), 0, 'ไม่ refine -> 0');
  eq(R.levelOf(makePlayer({}), 'axe'), 0, 'ไม่มี refine field -> 0');
}

/* ---------- 14) bonus ---------- */
console.log('\n[14] bonus(player, itemId)');
{
  const p = makePlayer({ refine: {} });
  let b = R.bonus(p, 'iron_sword');
  near(b.dmgMult, 1, 1e-9, 'ระดับ 0: dmgMult = 1');
  near(b.defMult, 1, 1e-9, 'ระดับ 0: defMult = 1');
  p.refine.iron_sword = 1;
  b = R.bonus(p, 'iron_sword');
  near(b.dmgMult, 1.1, 1e-9, 'ระดับ 1: dmgMult = 1.1');
  near(b.defMult, 1.1, 1e-9, 'ระดับ 1: defMult = 1.1');
  p.refine.iron_sword = 5;
  b = R.bonus(p, 'iron_sword');
  near(b.dmgMult, 1.5, 1e-9, 'ระดับ 5: dmgMult = 1.5');
  near(b.defMult, 1.5, 1e-9, 'ระดับ 5: defMult = 1.5');
  p.refine.iron_sword = 10;
  b = R.bonus(p, 'iron_sword');
  near(b.dmgMult, 2, 1e-9, 'ระดับ 10: dmgMult = 2.0');
  near(b.defMult, 2, 1e-9, 'ระดับ 10: defMult = 2.0');
  // เพิ่มขึ้นตามระดับ
  let prev = 0;
  let mono = true;
  for (let l = 0; l <= 10; l++) {
    p.refine.iron_sword = l;
    const bb = R.bonus(p, 'iron_sword');
    if (bb.dmgMult < prev) mono = false;
    prev = bb.dmgMult;
  }
  ok(mono, 'dmgMult เพิ่มขึ้น (ไม่ลด) ตามระดับ');
}

/* ---------- 15) ทดสอบซ้ำหลายรอบด้วย RNG ควบคุมได้ ---------- */
console.log('\n[15] ทดสอบซ้ำหลายรอบ (RNG ควบคุมได้)');
{
  // เก็บ RNG แบบ LCG เพื่อให้ผลทำซ้ำได้
  let seed = 12345;
  setRng(function () {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  });
  const p = makePlayer({ inv: [{ id: 'steel_sword', n: 1 }, { id: 'refine_stone', n: 999 }], coins: 999999 });
  let broke = 0, succeed = 0, guarded = 0, iter = 0;
  for (let i = 0; i < 200; i++) {
    // ใช้ผู้เล่นชุดใหม่ทุกครั้ง (ของแตกครั้งก่อนหน้าไม่กระทบรอบถัดไป)
    const lv = R.levelOf(p, 'steel_sword');
    if (lv >= R.MAX) break;
    const res = R.attempt(p, 'steel_sword', { protect: i % 3 === 0, lucky: i % 5 === 0 });
    iter++;
    if (res.ok) succeed++;
    else if (res.broke) broke++;
    else guarded++;
    if (res.broke) {
      // ของแตก -> เติมของใหม่เพื่อทดสอบต่อ
      p.inv.push({ id: 'steel_sword', n: 1 });
    }
  }
  ok(iter >= 100, 'วนลองครบ ' + iter + ' ครั้ง (>= 100)');
  ok(succeed > 0, 'มีการสำเร็จอย่างน้อย 1 ครั้ง (' + succeed + ')');
  ok(broke + guarded > 0, 'มีการล้มเหลวอย่างน้อย 1 ครั้ง (' + (broke + guarded) + ')');
  ok(succeed + broke + guarded === iter, 'ผลลัพธ์ครบทุกครั้ง (สำเร็จ ' + succeed + ' / แตก ' + broke + ' / กันไว้ ' + guarded + ')');
  ok(R.levelOf(p, 'steel_sword') <= R.MAX, 'ระดับไม่เกิน MAX');
  ok(p.coins >= 0, 'เงินไม่ติดลบ');
  ok(count(p, 'refine_stone') >= 0, 'จำนวนหินไม่ติดลบ');

  // ทำซ้ำแบบเดิม -> ผลต้องเหมือนเดิม (deterministic)
  function runSim() {
    let s = 999;
    const pp = makePlayer({ inv: [{ id: 'steel_sword', n: 1 }, { id: 'refine_stone', n: 999 }], coins: 999999 });
    R.rng = function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    const res = [];
    for (let i = 0; i < 50; i++) {
      if (R.levelOf(pp, 'steel_sword') >= R.MAX) break;
      const r = R.attempt(pp, 'steel_sword', { protect: i % 2 === 0 });
      res.push((r.ok ? 'S' : (r.broke ? 'X' : 'G')) + r.level);
    }
    return res.join(',');
  }
  const run1 = runSim(), run2 = runSim();
  eq(run1, run2, 'ผลการจำลองซ้ำ = เดิม (deterministic)');
}

/* ---------- 16) เก็บระดับไว้ที่ player.refine ---------- */
console.log('\n[16] ระดับถูกเก็บที่ player.refine[itemId]');
{
  const p = makePlayer({ inv: [{ id: 'axe', n: 1 }, { id: 'refine_stone', n: 10 }], coins: 1000 });
  setRng(seqRng([0.0, 0.0]));
  R.attempt(p, 'axe', {});
  eq(p.refine.axe, 1, 'หลังสำเร็จ 1 ครั้ง -> refine.axe = 1');
  R.attempt(p, 'axe', {});
  eq(p.refine.axe, 2, 'หลังสำเร็จ 2 ครั้ง -> refine.axe = 2');
  eq(R.levelOf(p, 'axe'), 2, 'levelOf ตรงกับ player.refine');
}

/* ---------- 17) js/player.js — refine มีผลจริงกับสถิติ ---------- */
console.log('\n[17] js/player.js — ระดับ refine มีผลกับสถิติ');
load('js/player.js');
{
  const P = DT.Player;
  ok(typeof P === 'function', 'DT.Player โหลดได้');

  // recalcGear: อาวุธ refine +5 -> ดาเมจ × 1.5
  const p = new P('u1', 'ทดสอบ', 'miner', true);
  p.inv = [{ id: 'iron_sword', n: 1 }];
  p.weapon = 'iron_sword';
  p.recalcGear();
  const baseDmg = p.weaponDmg;
  p.refine.iron_sword = 5;
  p.recalcGear();
  near(p.weaponDmg, baseDmg * 1.5, 1e-9, 'อาวุธ refine +5 -> ดาเมจ × 1.5 (' + baseDmg + ' → ' + p.weaponDmg + ')');

  // recalcGear: เสื้อ refine +3 -> กันดาเมจ × 1.3
  p.armorId = 'iron_armor';
  p.recalcGear();
  const baseArmor = p.armor;
  p.refine.iron_armor = 3;
  p.recalcGear();
  near(p.armor, baseArmor * 1.3, 1e-9, 'เสื้อ refine +3 -> กันดาเมจ × 1.3 (' + baseArmor + ' → ' + p.armor + ')');

  // recalcGear: เครื่องประดับ refine +2 -> ทั้งดาเมจเพิ่มและกันดาเมจเพิ่ม × 1.2
  p.accessoryId = 'goblin_amulet';
  p.recalcGear();
  const baseAcc = p.accDmg;
  const baseArmor2 = p.armor;
  p.refine.goblin_amulet = 2;
  p.recalcGear();
  near(p.accDmg, baseAcc * 1.2, 1e-9, 'เครื่องประดับ refine +2 -> accDmg × 1.2 (' + baseAcc + ' → ' + p.accDmg + ')');
  // กันดาเมจ = เสื้อ(9 × defMult ของเสื้อ 1.3) + accDef(1 × defMult ของเครื่องประดับ 1.2)
  near(p.armor, 9 * 1.3 + 1 * 1.2, 1e-9, 'เครื่องประดับ refine +2 -> accDef กันดาเมจ × 1.2 (รวมกับเสื้อ ' + p.armor + ')');

  // ระดับ 0 = ไม่เปลี่ยนแปลง
  const p0 = new P('u2', 'ทดสอบ', 'miner', true);
  p0.weapon = 'iron_sword';
  p0.recalcGear();
  near(p0.weaponDmg, DT.ITEMS.iron_sword.weapon, 1e-9, 'ระดับ 0 ดาเมจไม่เปลี่ยน');

  // equipBest: เลือกของที่ refine สูงสุดเมื่อค่าฐานเท่ากัน
  const p2 = new P('u3', 'ทดสอบ', 'miner', true);
  p2.inv = [{ id: 'iron_sword', n: 1 }, { id: 'wood_sword', n: 1 }];
  p2.refine.wood_sword = 10;   // ดาบไม้ refine +10 -> ดาเมจ 6*2 = 12 > 11
  p2.equipBest();
  eq(p2.weapon, 'wood_sword', 'equipBest เลือกของที่ refine สูงสุด (ดาบไม้ +10)');
  near(p2.weaponDmg, 12, 1e-9, 'ดาเมจของดาบไม้ +10 = 12');

  // ไม่มี DT.Refine -> ต้องไม่พัง
  const savedRefine = DT.Refine;
  delete DT.Refine;
  const p3 = new P('u4', 'ทดสอบ', 'miner', true);
  p3.inv = [{ id: 'iron_sword', n: 1 }];
  p3.weapon = 'iron_sword';
  let noCrash = true;
  try {
    p3.recalcGear();
    p3.equipBest();
  } catch (e) {
    noCrash = false;
    console.log('    error: ' + e.message);
  }
  ok(noCrash, 'recalcGear/equipBest ไม่พังเมื่อ DT.Refine ไม่มี');
  near(p3.weaponDmg, DT.ITEMS.iron_sword.weapon, 1e-9, 'ค่ายังถูกต้องเมื่อไม่มี DT.Refine');
  DT.Refine = savedRefine;

  // player.refine ถูกสร้างพร้อมผู้เล่นใหม่
  const p4 = new P('u5', 'ทดสอบ', 'miner', true);
  ok(p4.refine && typeof p4.refine === 'object', 'ผู้เล่นใหม่มี field refine = {}');
}

/* ---------- สรุป ---------- */
console.log('\n———— ผล: ' + pass + ' ผ่าน / ' + fail + ' ล้มเหลว ————\n');
process.exit(fail > 0 ? 1 : 0);
