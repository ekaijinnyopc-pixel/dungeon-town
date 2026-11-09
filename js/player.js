/* =========================================================
   DUNGEON TOWN — ผู้เล่น, กระเป๋า, คราฟต์, อาชีพ
   ========================================================= */
(function (root) {
  'use strict';
  var DT = root.DT || (root.DT = {});
  var C = DT.CFG;

  /* ---------- ตรวจ inventory ---------- */
  function addItem(inv, id, n) {
    n = n || 1;
    var def = DT.ITEMS[id];
    if (!def) return 0;
    var added = 0;
    // เติมสแต็กที่มีอยู่ก่อน
    for (var i = 0; i < inv.length && added < n; i++) {
      if (inv[i].id !== id) continue;
      var cap = def.stack || C.STACK_MAX;
      var room = cap - inv[i].n;
      if (room > 0) { var take = Math.min(room, n - added); inv[i].n += take; added += take; }
    }
    // สแต็กใหม่
    while (added < n) {
      var cap2 = def.stack || C.STACK_MAX;
      var take2 = Math.min(cap2, n - added);
      inv.push({ id: id, n: take2 });
      added += take2;
    }
    return added;
  }

  function countItem(inv, id) {
    var t = 0;
    for (var i = 0; i < inv.length; i++) if (inv[i].id === id) t += inv[i].n;
    return t;
  }

  function removeItem(inv, id, n) {
    n = n || 1;
    if (countItem(inv, id) < n) return false;
    var need = n;
    for (var i = inv.length - 1; i >= 0 && need > 0; i--) {
      if (inv[i].id !== id) continue;
      var take = Math.min(inv[i].n, need);
      inv[i].n -= take; need -= take;
      if (inv[i].n <= 0) inv.splice(i, 1);
    }
    return true;
  }

  function hasAll(inv, need) {
    for (var k in need) if (!need.hasOwnProperty(k)) continue;
    if (countItem(inv, k) < need[k]) return false;
    return true;
  }

  /* ---------- ผู้เล่น ---------- */
  DT.Player = function (id, name, prof, isLocal) {
    var p = {
      id: id,
      name: name || 'ผู้เล่น',
      prof: prof || 'miner',
      isLocal: !!isLocal,
      x: DT.SPAWNS.player.x,
      y: DT.SPAWNS.player.y,
      hp: 100, maxHp: 100,
      hunger: 100, thirst: 100, stamina: 100,
      inv: [],
      weapon: null, weaponDmg: 2,
      armor: 0,            /* ค่ากันดาเมจรวม (เสื้อ + เครื่องประดับ) */
      armorId: null,       /* id เสื้อที่สวมอยู่ */
      accessoryId: null,   /* id เครื่องประดับที่สวมอยู่ */
      accDmg: 0,           /* ดาเมจเพิ่มจากเครื่องประดับ */
      alive: true, respawnT: 0,
      gatherT: 0, gatherTarget: null,
      attackCd: 0, hurtFlash: 0, swing: 0,
      dir: 'down',         /* ทิศหัน (top-down 4 ทิศ): up/down/left/right */
      lastAct: 0,
      chat: null, chatT: 0,
      /* --- Phase 2 --- */
      level: 1, xp: 0,
      coins: 30,
      quests: {},          /* id -> progress */
      questDone: {},       /* id -> true (ส่งแล้ว) */
      refine: {},          /* itemId -> ระดับตีเหล็ก (0..10) */
      kills: 0,
      swing: 0
    };
    // ของเริ่มต้น
    addItem(p.inv, 'wood', 4);
    addItem(p.inv, 'stone', 2);
    if (p.prof === 'hunter') addItem(p.inv, 'raw_meat', 3);
    if (p.prof === 'farmer') addItem(p.inv, 'herb', 3);
    if (p.prof === 'miner') addItem(p.inv, 'ore', 3);
    /* คืน object ใหม่ -> ต้องผูก prototype กลับ ไม่งั้นเมธอดจะหาย */
    Object.setPrototypeOf(p, DT.Player.prototype);
    return p;
  };

  DT.Player.prototype.profInfo = function () { return DT.PROFESSIONS[this.prof] || DT.PROFESSIONS.miner; };

  /* ---------- ดาเมจที่ผู้เล่นตี ----------
     สูตร (Phase 4): (อาวุธ + เครื่องประดับ) × (1 + 8% ต่อเลเวล) + 3 ต่อเลเวล
     - เดิม: weaponDmg + (level-1)*2 + accDmg  → ของระดับเดียวกันไม่ต่างกันเมื่อเลเวลสูง
     - ใหม่: เลเวลช่วยยกอาวุธทุกชนิดพร้อมกัน ของดี (ดาบเหล็กก้อน 18) จึงแรงกว่าของธรรมดา (ธนู 9) ทุกเลเวล
     - เกราะ (armor) ไม่เกี่ยวกับดาเมจที่ "ตี" แต่ใช้ลดดาเมจที่ "รับ" (ดู damageAfterArmor / js/world.js) */
  DT.Player.prototype.attackDamage = function () {
    var base = (this.weaponDmg || 2) + (this.accDmg || 0);
    var lv = Math.max(0, (this.level || 1) - 1);
    var raw = base * (1 + C.LEVEL_DMG_SCALE * lv) + C.LEVEL_DMG_BONUS * lv;
    if (this.hunger <= 0) raw *= C.STARVE_DMG_MULT;            // อดอาหาร = โจมตีอ่อน 30%
    else if (this.hunger < C.HUNGER_WEAK) raw *= C.WEAK_DMG_MULT; // หิวน้อย = โจมตีอ่อน 15%
    return Math.max(1, Math.round(raw));
  };

  /* ดาเมจที่ผู้เล่น "รับ" หลังหักเกราะ (ลดแบบคงที่ เหลือขั้นต่ำ 1)
     NOTE: js/world.js คิดสูตรเดียวกันตอนมอนส์ตี (mob.dmg - armor, ขั้นต่ำ 1)
     ฟังก์ชันนี้คือ "กติกากลาง" ของชุดเกราะ/เครื่องประดับ (armor + accDef) */
  DT.Player.prototype.damageAfterArmor = function (raw) {
    return Math.max(1, (raw || 0) - (this.armor || 0));
  };

  /* โจมตี */
  DT.Player.prototype.attack = function (world, target) {
    if (this.attackCd > 0) return null;
    if (!this.alive) return null;
    this.attackCd = C.ATTACK_COOLDOWN;
    this.swing = 1;
    var dmg = this.attackDamage();
    var hit = null;
    for (var i = 0; i < world.mobs.length; i++) {
      var m = world.mobs[i];
      if (target && m !== target) continue;
      if (DT.dist(m.x, m.y, this.x, this.y) <= C.ATTACK_RANGE) {
        m.hp -= dmg; m.hitFlash = 0.25;
        /* เอฟเฟกต์: ประกาย + ตัวเลขดาเมจลอย */
        if (root.DT.FX) {
          DT.FX.hitSpark(world, m.x, m.y, '#ff7a5a');
          DT.FX.text(world, m.x, m.y - 0.3, '-' + dmg, '#ffd7d7');
        }
        if (root.DT.Audio) DT.Audio.play('hitMob');
        hit = m;
        if (m.hp <= 0) {
          /* --- loot table --- */
          var def = DT.MOBS[m.type] || {};
          var loot = def.loot || [];
          for (var l = 0; l < loot.length; l++) {
            if (Math.random() < loot[l][1]) {
              world.drops.push({ x: m.x, y: m.y, item: loot[l][0], t: 0 });
            }
          }
          /* --- XP + เควสต์ --- */
          this.kills++;
          var lv = this.addXp(def.xp || 5);
          if (lv > 0) this.lastAct = 'เลเวล ' + this.level + '!';
          var qlist = DT.QUESTS || [];
          for (var q = 0; q < qlist.length; q++) {
            var qq = qlist[q];
            if (qq.type === 'kill' && qq.target === m.type) {
              this.addQuestProgress(qq.id, 1);
            }
          }
          if (root.DT.Audio) DT.Audio.play('mobDie');
          if (root.DT.FX) DT.FX.burst(world, m.x, m.y, '#c9a227', 10, { speed: 2.6, life: 0.6 });
          world.mobs.splice(i, 1);
        }
        break;
      }
    }
    return hit;
  };

  /* เก็บทรัพยากร */
  DT.Player.prototype.gather = function (world, node, dt) {
    if (!node || node.amount <= 0) { this.gatherT = 0; this.gatherTarget = null; return; }
    if (this.gatherTarget !== node.id) { this.gatherTarget = node.id; this.gatherT = 0; }
    var mult = this.profInfo().gather[node.type] || 1;
    var need = C.GATHER_TIME / mult;
    /* หิวน้อย/หิวหมด = เก็บช้าลง (แทนที่จะให้ตายทันที) */
    if (this.hunger <= 0) need *= C.WEAK_GATHER_MULT;
    else if (this.hunger < C.HUNGER_WEAK) need *= C.WEAK_GATHER_MULT_LOW;
    this.gatherT += dt;
    if (this.stamina < 5) { this.gatherT = 0; return; }
    if (this.gatherT >= need) {
      this.gatherT = 0;
      this.stamina -= 4;
      var def = DT.NODES[node.type];
      node.amount -= 1;
      if (node.amount <= 0) node.respawn = C.RESPAWN_BASE * (1 + Math.random() * 2);
      addItem(this.inv, def.yields, 1);
      /* เควสต์ชนิดเก็บ */
      var qlist = DT.QUESTS || [];
      for (var q = 0; q < qlist.length; q++) {
        var qq = qlist[q];
        if (qq.type === 'gather' && qq.target === def.yields) {
          this.addQuestProgress(qq.id, 1);
        }
      }
      world.particles.push({
        x: node.x, y: node.y, vx: 0, vy: -1.5, t: 0, life: 0.6,
        c: DT.ITEMS[def.yields].icon, r: 4, text: true
      });
      /* easter egg: เก็บจิ้าจอก Platino ได้ -> ข้อความพิเศษ */
      if (def.secret) {
        if (root.DT.Game && root.DT.Game.toast) {
          root.DT.Game.toast('🦎 เจอจิ้าจอกเงา! มันหนีหายไป...');
        }
      }
      /* เสียง + เอฟเฟกต์ตามชนิดทรัพยากร */
      if (root.DT.Audio) {
        DT.Audio.play(node.type === 'tree' ? 'chop' : (node.type === 'rock' || node.type === 'ore' ? 'mine' : 'gather'));
      }
      if (root.DT.FX) {
        if (node.type === 'tree') DT.FX.leaves(world, node.x, node.y);
        else DT.FX.burst(world, node.x, node.y, '#d9c07a', 5, { speed: 1.6, life: 0.4, r: 2.2 });
        DT.FX.text(world, node.x, node.y - 0.3, '+1 ' + DT.ITEMS[def.yields].name, '#d9f7a0');
      }
      this.lastAct = 'เก็บ' + def.label;
    }
  };

  /* คราฟต์ */
  /* เสียงคราฟต์สำเร็จ (เรียกจาก game.doAction) */
  DT.Player.prototype.craftSfx = function () {
    if (root.DT.Audio) DT.Audio.play('craft');
  };

  DT.Player.prototype.canCraft = function (recipeId) {
    var r = DT.RECIPES[recipeId];
    if (!r) return false;
    if (this.profInfo().recipes.indexOf(recipeId) === -1) return false;
    return hasAll(this.inv, r.need);
  };

  DT.Player.prototype.craft = function (recipeId) {
    var r = DT.RECIPES[recipeId];
    if (!r) return false;
    if (!this.canCraft(recipeId)) return false;
    for (var k in r.need) if (r.need.hasOwnProperty(k)) removeItem(this.inv, k, r.need[k]);
    addItem(this.inv, r.out, r.n);
    if (DT.ITEMS[r.out].weapon || DT.ITEMS[r.out].armor || DT.ITEMS[r.out].acc || DT.ITEMS[r.out].accDef) this.equipBest();
    return true;
  };

  /* ---------- ระบบอุปกรณ์: อาวุธ / ชุดเกราะ / เครื่องประดับ ---------- */

  /* ตัวคูณจากระดับตีเหล็กของไอเทม (ปลอดภัยถ้า DT.Refine ยังไม่โหลด)
     คืน { dmgMult, defMult } (ค่า default 1 = ไม่เปลี่ยน) */
  DT.Player.prototype.refineBonus = function (itemId) {
    var none = { dmgMult: 1, defMult: 1 };
    if (!itemId) return none;
    if (typeof DT.Refine === 'undefined' || !DT.Refine || typeof DT.Refine.bonus !== 'function') return none;
    var b = DT.Refine.bonus(this, itemId);
    if (!b) return none;
    return {
      dmgMult: (typeof b.dmgMult === 'number') ? b.dmgMult : 1,
      defMult: (typeof b.defMult === 'number') ? b.defMult : 1
    };
  };

  /* ระดับตีเหล็กของไอเทม (0 ถ้าไม่มี/ไม่ได้ refine) */
  DT.Player.prototype.refineLevel = function (itemId) {
    if (!itemId) return 0;
    if (typeof DT.Refine === 'undefined' || !DT.Refine || typeof DT.Refine.levelOf !== 'function') return 0;
    return DT.Refine.levelOf(this, itemId) || 0;
  };

  /* คำนวณค่าสถิติจากของที่สวมอยู่ (รวมโบนัสจากระดับตีเหล็ก) */
  DT.Player.prototype.recalcGear = function () {
    var w = this.weapon ? DT.ITEMS[this.weapon] : null;
    this.weaponDmg = (w && w.weapon) ? w.weapon : 2;
    var a = this.armorId ? DT.ITEMS[this.armorId] : null;
    var acc = this.accessoryId ? DT.ITEMS[this.accessoryId] : null;
    this.accDmg = (acc && acc.acc) ? acc.acc : 0;
    var accDef = (acc && acc.accDef) ? acc.accDef : 0;
    this.armor = ((a && a.armor) ? a.armor : 0) + accDef;

    /* --- ระดับตีเหล็ก (+0 → +10) เพิ่มพลังให้ของที่สวมอยู่ ---
       - อาวุธ: ดาเมจ × dmgMult ของระดับ refine ของอาวุธ
       - เสื้อ: กันดาเมจ × defMult ของระดับ refine ของเสื้อ
       - เครื่องประดับ: คูณทั้ง dmgMult (ดาเมจเพิ่ม) และ defMult (กันดาเมจเพิ่ม) */
    var wb = this.refineBonus(this.weapon);
    var ab = this.refineBonus(this.armorId);
    var cb = this.refineBonus(this.accessoryId);
    this.weaponDmg = this.weaponDmg * wb.dmgMult;
    this.accDmg = this.accDmg * cb.dmgMult;
    this.armor = ((a && a.armor) ? a.armor : 0) * ab.defMult + accDef * cb.defMult;
  };

  /* ใส่ของดีที่สุดอัตโนมัติ (ทั้ง 3 ช่อง)
     ถ้าของชิ้นเดียวกัน refine ระดับต่างกัน ให้เลือกชิ้นที่ refine สูงสุด
     (คิดคะแนนรวม = ค่าฐาน × ตัวคูณจากระดับ refine) */
  DT.Player.prototype.equipBest = function () {
    var bestW = null, bestA = null, bestC = null;
    var bw = 2, ba = 0, bc = 0;
    for (var i = 0; i < this.inv.length; i++) {
      var id = this.inv[i].id;
      var d = DT.ITEMS[id];
      if (!d) continue;
      var rb = this.refineBonus(id);
      var wv = (d.weapon || 0) * rb.dmgMult;
      var av = (d.armor || 0) * rb.defMult;
      var cv = ((d.acc || 0) * rb.dmgMult + (d.accDef || 0) * rb.defMult) * 2;
      if (d.weapon && wv > bw) { bw = wv; bestW = id; }
      if (d.armor && av > ba) { ba = av; bestA = id; }
      if ((d.acc || d.accDef) && cv > bc) { bc = cv; bestC = id; }
    }
    this.weapon = bestW;
    this.armorId = bestA;
    this.accessoryId = bestC;
    this.recalcGear();
  };

  /* สวมใส่ของชิ้นเดียวตามช่องของมัน (คืน true ถ้าสวมได้) */
  DT.Player.prototype.equipItem = function (id) {
    var d = DT.ITEMS[id];
    if (!d) return false;
    if (d.weapon) this.weapon = id;
    else if (d.armor) this.armorId = id;
    else if (d.acc || d.accDef) this.accessoryId = id;
    else return false;
    this.recalcGear();
    return true;
  };

  /* ถอดของชิ้นที่ระบุ (คืน true ถ้าถอดได้) */
  DT.Player.prototype.unequipItem = function (id) {
    if (this.weapon === id) this.weapon = null;
    else if (this.armorId === id) this.armorId = null;
    else if (this.accessoryId === id) this.accessoryId = null;
    else return false;
    this.recalcGear();
    return true;
  };

  /* ของที่กำลังสวมอยู่ในช่องนั้น */
  DT.Player.prototype.equippedIn = function (slot) {
    if (slot === 'weapon') return this.weapon;
    if (slot === 'armor') return this.armorId;
    if (slot === 'accessory') return this.accessoryId;
    return null;
  };

  /* กินของ */
  DT.Player.prototype.useItem = function (invIndex) {
    var slot = this.inv[invIndex];
    if (!slot) return false;
    var d = DT.ITEMS[slot.id];
    if (!d) return false;
    if (d.food) {
      this.hunger = Math.min(100, this.hunger + d.food);
      removeItem(this.inv, slot.id, 1);
      this.lastAct = 'กิน' + d.name;
      return true;
    }
    if (d.heal) {
      this.hp = Math.min(this.maxHp, this.hp + d.heal);
      removeItem(this.inv, slot.id, 1);
      this.lastAct = 'ใช้' + d.name;
      return true;
    }
    return false;
  };

  /* ---------- XP / เลเวล ----------
     Phase 4: เลเวล 1→2 ใช้ 60 XP เท่าเดิม (ไม่น่าเบื่อ) แต่เลเวล 2 ขึ้นไปใช้เส้นโค้ง
     60 → 75 → 94 → 116 → 142 → 172 ... (ยากขึ้นเรื่อย ๆ) แทนการคงที่ 60 ทุกเลเวล */
  DT.Player.prototype.addXp = function (n) {
    this.xp += (n || 0);
    var leveled = 0;
    while (this.xp >= DT.xpToNext(this.level)) {
      this.xp -= DT.xpToNext(this.level);
      this.level += 1;
      leveled++;
      this.maxHp += C.LEVEL_HP_BONUS;
      this.hp = this.maxHp;
    }
    if (leveled > 0) {
      if (root.DT.Audio) DT.Audio.play('levelup');
      if (root.DT.FX && this._world) DT.FX.levelUp(this._world, this.x, this.y);
    }
    return leveled;
  };

  DT.Player.prototype.xpNeeded = function () { return DT.xpToNext(this.level); };

  /* ---------- เควสต์ ---------- */
  DT.Player.prototype.questProgress = function (qid) {
    return this.quests[qid] || 0;
  };

  DT.Player.prototype.addQuestProgress = function (qid, n) {
    var q = null;
    var list = DT.QUESTS || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === qid) q = list[i];
    if (!q) return 0;
    var before = this.quests[qid] || 0;
    this.quests[qid] = Math.min(q.goal, before + (n || 1));
    return this.quests[qid] - before;
  };

  DT.Player.prototype.questReady = function (qid) {
    var list = DT.QUESTS || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id !== qid) continue;
      if (this.questDone[qid]) return false;
      return (this.quests[qid] || 0) >= list[i].goal;
    }
    return false;
  };

  DT.Player.prototype.completeQuest = function (qid) {
    var list = DT.QUESTS || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id !== qid) continue;
      if (!this.questReady(qid)) return false;
      this.questDone[qid] = true;
      this.coins += list[i].reward;
      this.addXp(list[i].xp);
      return true;
    }
    return false;
  };

  /* ---------- เศรษฐกิจ: ซื้อ/ขาย ----------
     Phase 4: เดิมซื้อแพง 60% (markup 1.6) + ขายได้ 45% (sell 0.55) = ขาดทุนซ้ำซ้อน
     ใหม่: ซื้อแพง 35% (markup 1.35) + ขายได้ 65% (sell 0.65) + ราคาแตกต่างตามอาชีพ
     (DT.PRICE_ADJ: ของที่ตัวเองผลิตขายได้ถูกลง, ของที่ขาดเองซื้อได้ถูกลงเล็กน้อย) */
  DT.Player.prototype.priceAdj = function (kind, id) {
    var g = DT.PRICE_ADJ && DT.PRICE_ADJ[this.prof];
    if (!g) return 1;
    var t = g[kind];
    return (t && t.hasOwnProperty(id)) ? t[id] : 1;
  };
  DT.Player.prototype.buyPrice = function (id) {
    var base = (DT.PRICES && DT.PRICES[id]) || 5;
    return Math.max(1, Math.round(base * C.SHOP_BUY_MARKUP * this.priceAdj('buy', id)));
  };
  DT.Player.prototype.sellPrice = function (id) {
    var base = (DT.PRICES && DT.PRICES[id]) || 5;
    return Math.max(1, Math.round(base * C.SHOP_SELL_RATE * this.priceAdj('sell', id)));
  };
  DT.Player.prototype.buy = function (id, qty) {
    qty = qty || 1;
    if (!DT.ITEMS[id]) return false;
    var cost = this.buyPrice(id) * qty;
    if (this.coins < cost) return false;
    this.coins -= cost;
    DT.inv.add(this.inv, id, qty);
    return true;
  };
  DT.Player.prototype.sell = function (id, qty) {
    qty = qty || 1;
    if (DT.inv.count(this.inv, id) < qty) return false;
    /* ของที่ใส่อยู่ห้ามขาย (กันขายอาวุธ/เสื้อ/เครื่องประดับที่กำลังใช้) */
    if (id === this.weapon || id === this.armorId || id === this.accessoryId) return false;
    DT.inv.remove(this.inv, id, qty);
    this.coins += this.sellPrice(id) * qty;
    return true;
  };

  /* ---------- วางกองไฟ ---------- */
  DT.Player.prototype.placeCampfire = function (world) {
    if (DT.inv.count(this.inv, 'campfire_kit') < 1) return false;
    DT.inv.remove(this.inv, 'campfire_kit', 1);
    world.campfires.push({ x: this.x, y: this.y, life: 180, t: 0 });
    if (root.DT.Audio) DT.Audio.play('fire');
    if (root.DT.FX) DT.FX.burst(world, this.x, this.y, '#ff9f43', 12, { speed: 2.0, life: 0.8, up: 1.6 });
    return true;
  };

  /* ---------- มอนส์แข็งขึ้นตามวัน ----------
     Phase 4: ผู้เล่นเลเวล 5 ยังตีสลิม HP 20 ตายง่ายเกินไป
     มอนส์เลย scale ตามวัน (วัน 1 = 1.00 เท่า, +8%/วัน) โดยคำนวณจากค่าฐานใน DT.MOBS
     ทำในไฟล์นี้ (js/player.js) เพื่อไม่ต้องแก้ js/world.js — เรียกจาก Player.update ทุกเฟรม */
  DT.Player.syncMobScale = function (world) {
    if (!world || !world.mobs) return;
    var f = DT.mobDayScale(world.day);
    for (var i = 0; i < world.mobs.length; i++) {
      var m = world.mobs[i];
      var def = DT.MOBS[m.type];
      if (!def) continue;
      /* HP: ปรับตามตัวคูณวัน (คงสัดส่วน HP ที่เหลือไว้) */
      var targetHp = Math.max(1, Math.round(def.hp * f));
      if (m.maxHp !== targetHp) {
        var ratio = targetHp / (m.maxHp || targetHp);
        m.maxHp = targetHp;
        m.hp = Math.max(1, Math.min(targetHp, Math.round(m.hp * ratio)));
      }
      /* ดาเมจ: เติบโตตามวันเช่นกัน */
      var targetDmg = Math.max(1, Math.round(def.dmg * f));
      if (m.dmg !== targetDmg) m.dmg = targetDmg;
    }
  };

  /* ---------- อัปเดตสถานะผู้เล่นต่อวินาที ---------- */
  DT.Player.prototype.update = function (world, dt, moving) {
    /* มอนส์ในโลก scale ตามจำนวนวัน (ดู DT.Player.syncMobScale) */
    DT.Player.syncMobScale(world);
    if (this.attackCd > 0) this.attackCd -= dt;
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    if (this.swing > 0) this.swing = Math.max(0, this.swing - dt * 4);
    if (this.chatT > 0) this.chatT -= dt;

    if (!this.alive) {
      this.respawnT -= dt;
      if (this.respawnT <= 0) {
        this.alive = true;
        this.hp = this.maxHp;
        this.hunger = Math.max(50, this.hunger);
        this.x = DT.SPAWNS.player.x; this.y = DT.SPAWNS.player.y;
      }
      return;
    }

    /* หิว (Phase 4: ช้าลง + อาการอ่อนแรงแทนการตายทันที)
       - HUNGER_DRAIN 0.55 → 0.22 : หิวหมดใน ~7.5 นาที (เดิม ~3 นาทีเร็วเกิน)
       - หิว < 20 = อ่อนแรง (โจมตี/เก็บช้าลง, ฟื้นเหนื่อยช้าลง) ยังไม่ตาย
       - หิว = 0 = อดอาหาร เสีย HP ช้า ๆ (1.5/วิ แทน 2/วิ) เพื่อให้มีเวลาหาอาหาร */
    this.hunger = Math.max(0, this.hunger - C.HUNGER_DRAIN * dt);
    if (this.hunger <= 0) this.hp -= C.HUNGER_STARVE_HP * dt;

    /* ความล้า */
    var regen = C.STAMINA_REGEN;
    if (this.hunger <= 0) regen *= C.WEAK_STAMINA_REGEN;
    else if (this.hunger < C.HUNGER_WEAK) regen *= 0.8;
    if (moving) this.stamina = Math.max(0, this.stamina - C.STAMINA_DRAIN_MOVE * dt);
    else this.stamina = Math.min(100, this.stamina + regen * dt);

    /* โบนัสอาชีพ: คนเหมืองกินเนื้อได้น้อยกว่า ช่างปลูกฟื้นเร็วกว่า */
    if (this.prof === 'farmer') this.hp = Math.min(this.maxHp, this.hp + 0.6 * dt);
    if (this.prof === 'hunter') this.stamina = Math.min(100, this.stamina + 1.2 * dt);

    /* กองไฟช่วยฟื้น HP (นอนกลางไฟ) */
    if (world && world.campfires) {
      for (var cf = 0; cf < world.campfires.length; cf++) {
        var fire = world.campfires[cf];
        if (DT.dist(fire.x, fire.y, this.x, this.y) < 1.8) {
          this.hp = Math.min(this.maxHp, this.hp + 3 * dt);
          this.hunger = Math.min(100, this.hunger + 0.6 * dt);
        }
      }
    }

    this.hp = Math.max(0, Math.min(this.maxHp, this.hp));
  };

  DT.inv = {
    add: addItem, remove: removeItem, count: countItem, hasAll: hasAll
  };
})(window);
