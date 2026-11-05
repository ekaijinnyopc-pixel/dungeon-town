/* Smoke test logic ของ Dungeon Town (ไม่ต้องมี DOM/canvas) */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dir = path.join(__dirname, '..', 'js');
const sandbox = { window: {}, console, performance: { now: () => Date.now() }, setTimeout, setInterval, clearTimeout, requestAnimationFrame: () => {} };
sandbox.window = sandbox;
vm.createContext(sandbox);

['config.js', 'iso.js', 'world.js', 'player.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), sandbox, { filename: f });
});
const DT = sandbox.DT;

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ✅ ' + msg); }
  else { fail++; console.log('  ❌ ' + msg); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

/* --- แผนที่ --- */
section('แผนที่');
const world = DT.World.create();
ok(world.map.grid.length === DT.CFG.MAP_W * DT.CFG.MAP_H, 'ขนาดแผนที่ ' + world.map.w + 'x' + world.map.h);
ok(world.map.buildings.length === 5, 'มีอาคาร ' + world.map.buildings.length + ' หลัง');
ok(world.nodes.length > 100, 'node ทรัพยากร ' + world.nodes.length + ' จุด');
ok(!DT.World.walkable(world.map, 0, 0), 'ขอบแผนที่เป็นน้ำ = เดินไม่ได้');
ok(DT.World.walkable(world.map, 24.5, 24.5), 'ลานกลางเมืองเดินได้');
ok(DT.World.buildingAt(world.map, 20.5, 20.5) !== null, 'ตรวจพบอาคาร (โรงตีเหล็ก)');

/* --- อาชีพ --- */
section('อาชีพ');
['miner', 'hunter', 'farmer'].forEach(pf => {
  const p = DT.Player('x1', 'ทดสอบ', pf, true);
  ok(DT.PROFESSIONS[pf].recipes.length >= 8, pf + ' มีสูตรคราฟต์ ' + DT.PROFESSIONS[pf].recipes.length + ' สูตร');
  ok(p.inv.length > 0, pf + ' ได้ของเริ่มต้น ' + p.inv.length + ' ชนิด');
});
ok(DT.Player('x', 'n', 'miner').profInfo().gather.ore === 2.2, 'คนเหมืองขุดแร่เร็วกว่า');
ok(DT.Player('x', 'n', 'farmer').profInfo().gather.bush === 2.2, 'ช่างปลูกเก็บพุ่มเร็วกว่า');

/* --- กระเป๋า --- */
section('กระเป๋า');
const inv = [];
DT.inv.add(inv, 'wood', 25);
ok(DT.inv.count(inv, 'wood') === 25, 'เพิ่มข้ามสแต็กได้ (25 ไม้)');
ok(inv.length === 2, 'แยกเป็น 2 สแต็ก (20 + 5)');
ok(DT.inv.remove(inv, 'wood', 25) === true, 'ลบไม้ได้ครบ');
ok(inv.length === 0, 'กระเป๋าว่างเปล่า');
ok(DT.inv.remove(inv, 'wood', 1) === false, 'ลบของที่ไม่มี = false');

/* --- คราฟต์ --- */
section('คราฟต์');
const miner = DT.Player('x2', 'ก', 'miner', true);
DT.inv.add(miner.inv, 'wood', 10);
DT.inv.add(miner.inv, 'ore', 10);
ok(miner.canCraft('pickaxe') === true, 'คนเหมืองคราฟต์คีมได้ (มีไม้+แร่)');
ok(miner.craft('pickaxe') === true, 'คราฟต์สำเร็จ');
ok(DT.inv.count(miner.inv, 'pickaxe') === 1, 'ได้คีม 1 ชิ้น');
ok(miner.weaponDmg === 3, 'คีมเพิ่มดาเมจเป็น ' + miner.weaponDmg);
ok(miner.canCraft('bread') === false, 'คนเหมืองคราฟต์ขนมปังไม่ได้ (อาชีพไม่ตรง)');
const farmer = DT.Player('x3', 'ข', 'farmer', true);
DT.inv.add(farmer.inv, 'berry', 5);
ok(farmer.canCraft('bread') === true, 'ช่างปลูกคราฟต์ขนมปังได้');
ok(farmer.craft('bread') === true, 'คราฟต์ขนมปังสำเร็จ');

/* --- เก็บของ --- */
section('เก็บทรัพยากร');
const tree = world.nodes.find(n => n.type === 'tree');
const before = DT.inv.count(miner.inv, 'wood');
tree.amount = 3;
miner.gather(world, tree, 99);
ok(tree.amount === 2, 'เก็บแล้ว node ลด 1 (เหลือ ' + tree.amount + ')');
ok(DT.inv.count(miner.inv, 'wood') === before + 1, 'ได้ไม้เพิ่ม 1');
ok(miner.stamina < 100, 'ล้าลง ' + Math.round(miner.stamina));

/* --- ต่อสู้ --- */
section('ต่อสู้');
world.mobs.length = 0;
world.mobs.push({ id: 'm1', type: 'slime', x: miner.x + 0.5, y: miner.y, hp: 20, maxHp: 20, dmg: 4, speed: 1.5, cd: 0, hitFlash: 0, target: null });
miner.attackCd = 0;
const hit = miner.attack(world);
ok(hit !== null, 'โจมตีโดนมอนส์');
ok(hit.hp === 17, 'เหลือ HP ' + hit.hp + ' (ดาเมจ 3)');

/* --- วงจะกลางคืน / เวลา --- */
section('เวลาและกลางคืน');
DT.seedRand(1);
let spawned = 0;
world.mobs.length = 0;
world.time = 0.80; // 19:20 = กลางคืน
for (let i = 0; i < 40; i++) { world.spawnNight(); }
ok(world.mobs.length > 0, 'กลางคืนมีมอนส์เกิด ' + world.mobs.length + ' ตัว');
world.time = 0.40; // 09:36 = กลางวัน
world.mobs.length = 0;
for (let i = 0; i < 40; i++) { world.spawnNight(); }
ok(world.mobs.length === 0, 'กลางวันไม่เกิดมอนส์ใหม่');
ok(DT.isNight(0.85) === true && DT.isNight(0.30) === false, 'ตรวจช่วงเวลากลางคืน/กลางวันถูก');

/* --- มอนส์ตีผู้เล่น --- */
section('มอนส์โจมตี');
const victim = DT.Player('v', 'เปราะบาง', 'farmer', true);
victim.hp = 100;
world.mobs.length = 0;
world.mobs.push({ id: 'm2', type: 'goblin', x: victim.x + 0.3, y: victim.y, hp: 34, maxHp: 34, dmg: 8, speed: 2, cd: 0, hitFlash: 0, target: null });
world.time = 0.85;
DT.World.update(world, 0.1, [victim]);
ok(victim.hp < 100, 'มอนส์ตีผู้เล่น (HP ' + Math.round(victim.hp) + ')');

/* --- ความหิว/ตาย --- */
section('สถานะชีวิต');
const hungry = DT.Player('h', 'หิว', 'miner', true);
hungry.hunger = 0.5;
/* Phase 4: HUNGER_DRAIN เดิม 0.55 → ใหม่ 0.22 (หิวหมดใน ~7.5 นาที แทน ~3 นาที)
   เดิมทดสอบ 20 ครั้ง (2 วิ) แล้วหิวหมดทันที → ต้องรอให้หิวเป็น 0 ก่อน จึงเพิ่มเป็น 40 ครั้ง (4 วิ) */
for (let i = 0; i < 40; i++) hungry.update(world, 0.1, false);
ok(hungry.hp < 100, 'หิวหมด = เสีย HP ช้า ๆ (ไม่ตายทันที) (' + Math.round(hungry.hp) + ')');
const dead = DT.Player('d', 'ตาย', 'miner', true);
dead.hp = 1;
dead.update(world, 1, false);
ok(dead.alive === true, 'ยังไม่ตายทันที (HP=' + Math.round(dead.hp) + ')');

/* --- กินของ --- */
section('กินของ');
const eater = DT.Player('e', 'กิน', 'farmer', true);
eater.hunger = 50;
DT.inv.add(eater.inv, 'bread', 1);
const bi = eater.inv.findIndex(s => s.id === 'bread');
ok(eater.useItem(bi) === true, 'กินขนมปังได้');
ok(eater.hunger > 50, 'หิวเพิ่มเป็น ' + Math.round(eater.hunger));
ok(eater.useItem(0) === false, 'กินของที่กินไม่ได้ = false');

/* --- เวลาเล่น --- */
section('จำลองเวลาเล่น 60 วินาที');
const sim = DT.World.create();
const pl = DT.Player('sim', 'ซิม', 'miner', true);
let steps = 0;
for (let i = 0; i < 600; i++) { pl.update(sim, 0.1, true); DT.World.update(sim, 0.1, [pl]); steps++; }
ok(steps === 600, 'จำลอง ' + steps + ' step สำเร็จ ไม่ crash');
ok(pl.hp >= 0 && pl.hp <= pl.maxHp, 'HP อยู่ในช่วงปกติ (' + Math.round(pl.hp) + ')');
ok(isFinite(pl.x) && isFinite(pl.y), 'ตำแหน่งไม่เป็น NaN');

/* ================= Phase 2 ================= */
section('Phase 2: เลเวล / XP');
const lv = DT.Player('lv', 'เลเวล', 'miner', true);
ok(lv.level === 1 && lv.xp === 0, 'เริ่มที่ Lv.1 XP 0');
lv.addXp(30);
ok(lv.level === 1, 'XP 30 ยังไม่เลเวล (ต้อง 60)');
const up = lv.addXp(35);
ok(lv.level === 2 && up === 1, 'XP ครบ 60 -> เลเวล 2');
ok(lv.maxHp === 115, 'เลเวลแล้ว HP เพิ่มเป็น ' + lv.maxHp);

section('Phase 2: เศรษฐกิจ');
const buyer = DT.Player('b', 'พ่อค้า', 'miner', true);
buyer.coins = 100;
const beforeCoin = buyer.coins;
ok(buyer.buy('bread', 1) === true, 'ซื้อขนมปังได้');
ok(buyer.coins < beforeCoin, 'เหรียญลดลง (' + beforeCoin + ' -> ' + buyer.coins + ')');
ok(DT.inv.count(buyer.inv, 'bread') === 1, 'ได้ขนมปัง 1');
buyer.coins = 0;
ok(buyer.buy('bread', 1) === false, 'เหรียญไม่พอซื้อไม่ได้');
const beforeSell = buyer.coins;
DT.inv.add(buyer.inv, 'wood', 3);
const woodBefore = DT.inv.count(buyer.inv, 'wood');
ok(buyer.sell('wood', 2) === true, 'ขายไม้ 2 ไม้ได้');
ok(buyer.coins > beforeSell, 'ได้เหรียญจากการขาย (' + buyer.coins + ')');
ok(DT.inv.count(buyer.inv, 'wood') === woodBefore - 2, 'ไม้ลดลง 2 (เหลือ ' + DT.inv.count(buyer.inv, 'wood') + ')');
ok(buyer.sell('pickaxe', 1) === false, 'ขายของที่ไม่มี = ไม่ได้');

section('Phase 2: เควสต์');
const qp = DT.Player('q', 'เควสต์', 'hunter', true);
const qlist = DT.QUESTS;
ok(qlist.length >= 4, 'มีเควสต์ ' + qlist.length + ' เควสต์');
qp.addQuestProgress('q_slime', 3);
ok(qp.questProgress('q_slime') === 3, 'เควสต์ฆ่าสลิม 3/5');
ok(qp.questReady('q_slime') === false, 'ยังไม่ครบ 5 ยังรับรางวัลไม่ได้');
qp.addQuestProgress('q_slime', 5);
ok(qp.questProgress('q_slime') === 5, 'ครบ 5/5');
ok(qp.questReady('q_slime') === true, 'รับรางวัลได้');
const cBefore = qp.coins;
ok(qp.completeQuest('q_slime') === true, 'รับรางวัลสำเร็จ');
ok(qp.coins === cBefore + 75, 'ได้เหรียญรางวัล +75 (เดิม +40)');   // Phase 4: เดิม 40 → ใหม่ 75 (สมดุลกับราคาไอเทม)
ok(qp.completeQuest('q_slime') === false, 'รับซ้ำไม่ได้');

section('Phase 2: NPC + กองไฟ + เมืองปลอดภัย');
const w2 = DT.World.create();
ok(w2.npcs.length === 3, 'มี NPC ' + w2.npcs.length + ' คนในเมือง');
ok(w2.npcs.every(n => typeof n.x === 'number'), 'NPC มีพิกัด');
const camper = DT.Player('c', 'ค่าย', 'hunter', true);
DT.inv.add(camper.inv, 'campfire_kit', 1);
ok(camper.placeCampfire(w2) === true, 'วางกองไฟได้');
ok(w2.campfires.length === 1, 'กองไฟอยู่ในโลก 1 จุด');
ok(DT.inv.count(camper.inv, 'campfire_kit') === 0, 'ใช้ชุดกองไฟหมด');
ok(camper.placeCampfire(w2) === false, 'ไม่มีชุดแล้ววางไม่ได้');
ok(DT.World.walkable(w2.map, 24.5, 24.5), 'ลานเมืองเดินได้');

section('Phase 2: มอนส์ใหม่ + loot');
ok(Object.keys(DT.MOBS).length >= 5, 'มีมอนส์ ' + Object.keys(DT.MOBS).length + ' ชนิด');
ok(DT.MOBS.boar && DT.MOBS.wraith, 'มีหมูป่าเผือก + วิญญาต');
const w3 = DT.World.create();
const hunter = DT.Player('h2', 'นักล่า', 'hunter', true);
hunter.weaponDmg = 30;            /* ดาบแข็ง 30 dmg */
w3.mobs.length = 0;
w3.mobs.push({ id: 'tm', type: 'boar', x: hunter.x + 0.4, y: hunter.y, hp: 42, maxHp: 42, dmg: 10, speed: 2, cd: 0, hitFlash: 0, target: null, swing: 0 });
hunter.attackCd = 0;
hunter.attack(w3);
ok(w3.mobs.length === 1, 'ตีแรกมอนส์ยังไม่ตาย (HP เหลือ ' + w3.mobs[0].hp + ')');
hunter.attackCd = 0;
hunter.attack(w3);
ok(w3.mobs.length === 0, 'ตีสองครั้งมอนส์ตาย');
ok(hunter.kills === 1, 'นับ kill ได้ (' + hunter.kills + ')');
ok(hunter.xp > 0, 'ได้ XP (คง ' + hunter.xp + ')');
ok(hunter.swing >= 0, 'มีแอนิเมชันโจมตี');

/* drop ถูกสุ่ม — ทดสอบด้วยการยิงซ้ำให้แน่ */
let sawDrop = false;
for (let i = 0; i < 30 && !sawDrop; i++) {
  const wtmp = DT.World.create();
  const h2 = DT.Player('h3', 'ทดสอบ', 'hunter', true);
  h2.weaponDmg = 999;
  wtmp.mobs.length = 0;
  wtmp.mobs.push({ id: 'tm' + i, type: 'boar', x: h2.x + 0.3, y: h2.y, hp: 42, maxHp: 42, dmg: 10, speed: 2, cd: 0, hitFlash: 0, target: null, swing: 0 });
  h2.attackCd = 0;
  h2.attack(wtmp);
  if (wtmp.drops.length > 0) sawDrop = true;
}
ok(sawDrop, 'มอนส์ตายแล้วมีโอกาสดรอป loot');

section('Phase 2: กลางคืนเป็นพิเศษ');
const w4 = DT.World.create();
w4.time = 0.85;
let sawWraith = false, sawAny = false;
for (let i = 0; i < 200 && !sawWraith; i++) {
  w4.mobs.length = 0;
  w4.spawnNight();
  if (w4.mobs.length) {
    sawAny = true;
    if (w4.mobs[0].type === 'wraith') sawWraith = true;
  }
}
ok(sawAny, 'กลางคืนมีมอนส์เกิด');
ok(sawWraith, 'กลางคืนมีวิญญาต (มอนส์เฉพาะกลางคืน)เกิดได้');
w4.time = 0.35; w4.mobs.length = 0;
for (let i = 0; i < 60; i++) w4.spawnNight();
ok(w4.mobs.every(m => m.type !== 'wraith'), 'กลางวันไม่มีวิญญาต');

console.log('\n———— ผล: ' + pass + ' ผ่าน / ' + fail + ' ล้มเหลว ————');
process.exit(fail ? 1 : 0);
