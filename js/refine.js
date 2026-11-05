/* =========================================================
   DUNGEON TOWN — ระบบตีเหล็ก (refine) อุปกรณ์ +0 → +10
   ตรรกะล้วน ไม่ผูกกับ UI (UI จะเรียก DT.Refine.* เอง)

   ข้อมูลระดับ refine เก็บที่ player.refine = { [itemId]: level }
   (0 = ยังไม่ refine, 1..10 = +1..+10)

   RNG: ใช้ DT.Refine.rng() เสมอ (default = Math.random)
        เทสต์/โมคชันสามารถ override ได้: DT.Refine.rng = function(){ ... }
   ========================================================= */
(function (root) {
  'use strict';
  var DT = root.DT || (root.DT = {});
  var C = DT.CFG || {};

  /* ---------- ค่าคงที่จาก config (มีค่า default เผื่อ config ไม่ครบ) ---------- */
  function cfg(key, def) {
    var v = C[key];
    return (typeof v === 'number' && isFinite(v)) ? v : def;
  }

  var MAX = cfg('REFINE_MAX', 10);
  var BASE_CHANCE = cfg('REFINE_BASE_CHANCE', 0.6);
  var DECAY = cfg('REFINE_CHANCE_DECAY', 0.045);
  var COST_COINS = cfg('REFINE_COST_COINS', 50);
  var COST_STONE = cfg('REFINE_COST_STONE', 2);
  var PROTECT_CHANCE = cfg('REFINE_PROTECT_CHANCE', 0.9);
  var LUCKY_BONUS = cfg('REFINE_LUCKY_BONUS', 0.15);
  var DMG_PER_LEVEL = cfg('REFINE_DMG_PER_LEVEL', 0.10);
  var ARMOR_PER_LEVEL = cfg('REFINE_ARMOR_PER_LEVEL', 0.10);

  /* ---------- helper กระเป๋า (self-contained ไม่พึ่ง DT.inv) ---------- */
  function countItem(inv, id) {
    var t = 0;
    if (!inv) return 0;
    for (var i = 0; i < inv.length; i++) if (inv[i].id === id) t += (inv[i].n || 0);
    return t;
  }

  /* ลบของออกจาก inv (คืนจำนวนที่ลบได้จริง) */
  function removeItem(inv, id, n) {
    n = n || 1;
    if (!inv) return 0;
    var removed = 0;
    for (var i = inv.length - 1; i >= 0 && removed < n; i--) {
      if (inv[i].id !== id) continue;
      var take = Math.min(inv[i].n || 0, n - removed);
      inv[i].n = (inv[i].n || 0) - take;
      removed += take;
      if (inv[i].n <= 0) inv.splice(i, 1);
    }
    return removed;
  }

  /* ---------- ระดับ refine ---------- */
  function levelOf(player, itemId) {
    if (!player || !player.refine) return 0;
    var lv = player.refine[itemId];
    lv = parseInt(lv, 10);
    if (!lv || lv < 0) return 0;
    if (lv > MAX) lv = MAX;
    return lv;
  }

  function setLevel(player, itemId, lv) {
    if (!player) return;
    if (!player.refine) player.refine = {};
    if (lv <= 0) delete player.refine[itemId];
    else player.refine[itemId] = lv;
  }

  /* ---------- ตัวคูณโบนัสจากระดับ refine ---------- */
  function bonus(player, itemId) {
    var lv = levelOf(player, itemId);
    return {
      dmgMult: 1 + lv * DMG_PER_LEVEL,
      defMult: 1 + lv * ARMOR_PER_LEVEL,
      level: lv
    };
  }

  /* ---------- โอกาสสำเร็จ ----------
     level = ระดับปัจจุบัน (0 = กำลังจะ +0 → +1)
     opts = { protect: bool, lucky: bool }
       lucky   : +REFINE_LUCKY_BONUS โอกาสสำเร็จ (ใช้หินเสี่ยงโชค)
       protect : ไม่กระทบโอกาสสำเร็จ (มีผลตอนล้มเหลว — กันของแตก) */
  function chance(level, opts) {
    opts = opts || {};
    var lv = level > 0 ? level : 0;
    var c = BASE_CHANCE - DECAY * lv;
    if (opts.lucky) c += LUCKY_BONUS;
    if (c < 0) c = 0;
    if (c > 1) c = 1;
    return c;
  }

  /* ---------- ค่าใช้จ่ายของขั้นถัดไป (ตามระดับปัจจุบัน) ----------
     ขั้นที่ n (กำลังตี +n → +(n+1)) = base * (n + 1)
     เช่น ระดับ 0: 50 เหรียญ / 2 หิน · ระดับ 5: 300 เหรียญ / 12 หิน */
  function cost(level) {
    var lv = level > 0 ? level : 0;
    return {
      coins: COST_COINS * (lv + 1),
      stones: COST_STONE * (lv + 1)
    };
  }

  /* ---------- ตรวจว่า refine ได้ไหม ---------- */
  function canRefine(player, itemId) {
    if (!player || !itemId) return false;
    if (levelOf(player, itemId) >= MAX) return false;
    if (countItem(player.inv, itemId) < 1) return false;
    return true;
  }

  /* ---------- ถอดของที่สวมอยู่ (กรณีของแตก) ---------- */
  function unequipIfEquipped(player, itemId) {
    if (!player) return;
    var equipped = (player.weapon === itemId) || (player.armorId === itemId) || (player.accessoryId === itemId);
    if (!equipped) return;
    if (typeof player.unequipItem === 'function') {
      player.unequipItem(itemId);
    } else {
      if (player.weapon === itemId) player.weapon = null;
      if (player.armorId === itemId) player.armorId = null;
      if (player.accessoryId === itemId) player.accessoryId = null;
      if (typeof player.recalcGear === 'function') player.recalcGear();
    }
  }

  /* ---------- ลองตีเหล็ก ----------
     opts = { protect: bool, lucky: bool }
     คืน { ok: bool, broke: bool, level: number, msg: string } */
  function attempt(player, itemId, opts) {
    opts = opts || {};
    if (!player || !itemId) {
      return { ok: false, broke: false, level: 0, msg: 'ไม่มีของให้ตีเหล็ก' };
    }
    var lv = levelOf(player, itemId);
    if (lv >= MAX) {
      return { ok: false, broke: false, level: lv, msg: 'ถึงระดับสูงสุดแล้ว (+' + MAX + ')' };
    }
    if (countItem(player.inv, itemId) < 1) {
      return { ok: false, broke: false, level: lv, msg: 'ไม่มีของชิ้นนี้ในกระเป๋า' };
    }

    var c = cost(lv);
    if ((player.coins || 0) < c.coins) {
      return { ok: false, broke: false, level: lv, msg: 'เงินไม่พอ (ต้องการ ' + c.coins + ' เหรียญ)' };
    }
    if (countItem(player.inv, 'refine_stone') < c.stones) {
      return { ok: false, broke: false, level: lv, msg: 'หินตีบวกไม่พอ (ต้องการ ' + c.stones + ' หิน)' };
    }

    /* หักค่าใช้จ่าย */
    player.coins = (player.coins || 0) - c.coins;
    removeItem(player.inv, 'refine_stone', c.stones);

    /* ใช้หินเสี่ยงโชค / หินกันแตก (ถ้ามีในกระเป๋า) */
    var usedLucky = false, usedProtect = false;
    if (opts.lucky && countItem(player.inv, 'lucky_stone') > 0) {
      removeItem(player.inv, 'lucky_stone', 1);
      usedLucky = true;
    }
    if (opts.protect && countItem(player.inv, 'protect_stone') > 0) {
      removeItem(player.inv, 'protect_stone', 1);
      usedProtect = true;
    }

    /* สุ่มผล (เรียก rng 1 ครั้ง = โอกาสสำเร็จ, แล้วอีก 1 ครั้งถ้าล้มเหลวและมีหินกันแตก) */
    var ok = R() < chance(lv, { protect: usedProtect, lucky: usedLucky });
    if (ok) {
      var newLv = lv + 1;
      setLevel(player, itemId, newLv);
      if (typeof player.recalcGear === 'function') player.recalcGear();
      return {
        ok: true, broke: false, level: newLv,
        msg: 'ตีเหล็กสำเร็จ! +1 (ระดับ ' + newLv + ')'
      };
    }

    /* ล้มเหลว */
    if (usedProtect && R() < PROTECT_CHANCE) {
      return { ok: false, broke: false, level: lv, msg: 'มีหินกันแตก ของไม่แตก' };
    }

    /* ของแตก */
    removeItem(player.inv, itemId, 1);
    setLevel(player, itemId, 0);
    unequipIfEquipped(player, itemId);
    if (typeof player.recalcGear === 'function') player.recalcGear();
    return { ok: false, broke: true, level: 0, msg: 'ตีเหล็กล้มเหลว ของแตก!' };
  }

  /* ---------- RNG (override ได้) ---------- */
  function rng() {
    return Math.random();
  }
  /* ดึง RNG จาก DT.Refine.rng เสมอ (เทสต์/โมคชัน override ได้) */
  function R() {
    if (DT.Refine && typeof DT.Refine.rng === 'function') return DT.Refine.rng();
    return Math.random();
  }

  /* ---------- export ---------- */
  DT.Refine = {
    MAX: MAX,
    ITEM: { REFINE: 'refine_stone', PROTECT: 'protect_stone', LUCKY: 'lucky_stone' },
    rng: rng,
    chance: chance,
    cost: cost,
    canRefine: canRefine,
    attempt: attempt,
    levelOf: levelOf,
    bonus: bonus
  };
})(typeof window !== 'undefined' ? window : globalThis);
