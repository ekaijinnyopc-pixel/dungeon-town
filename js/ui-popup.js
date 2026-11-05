/* =========================================================
   DUNGEON TOWN — popup เมนู (mouse-first)
   คลิกซ้ายที่อาคาร/NPC -> เด้งหน้าต่างเมนู (ไม่ต้องเดินเข้าไป)
   แท็บ: ซื้อ/ขาย · อาวุธ · ชุดเกราะ · เครื่องประดับ · ของใช้ · คราฟต์ · เควสต์ · พักผ่อน
   ========================================================= */
(function (root) {
  'use strict';
  var DT = root.DT || (root.DT = {});

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- รายชื่อแท็บ ---------- */
  var TAB_LABEL = {
    trade: 'ซื้อ/ขาย', weapon: 'อาวุธ', armor: 'ชุดเกราะ',
    accessory: 'เครื่องประดับ', items: 'ของใช้',
    craft: 'คราฟต์', quest: 'เควสต์', rest: 'พักผ่อน',
    smelt: 'หลอมแร่', cook: 'ปรุงอาหาร', chest: 'ตู้เก็บของ',
    party: 'ปาร์ตี้', refine: 'ตีเหล็ก', market: 'ตลาด'
  };

  /* ---------- แท็บของแต่ละอาคาร ---------- */
  var BUILDING_TABS = {
    'โรงตีเหล็ก': ['craft', 'smelt', 'refine', 'weapon', 'armor', 'accessory', 'items'],
    'ตลาด': ['trade', 'market', 'weapon', 'armor', 'accessory', 'items'],
    'บ้านนักล่า': ['rest', 'craft', 'weapon', 'armor', 'accessory', 'items'],
    'บ้านช่างปลูก': ['rest', 'cook', 'craft', 'weapon', 'armor', 'accessory', 'items'],
    'บ้านคนเหมือง': ['rest', 'craft', 'weapon', 'armor', 'accessory', 'items']
  };

  var NPC_TABS = {
    merchant: ['trade', 'weapon', 'armor', 'accessory', 'items'],
    blacksmith: ['craft', 'weapon', 'armor', 'accessory', 'items'],
    guide: ['quest', 'weapon', 'armor', 'accessory', 'items']
  };

  var DT_POPUP = {
    open: false,
    title: '',
    tabs: [],
    active: '',
    source: null,      /* 'building' | 'npc' | 'menu' */
    ref: null,         /* อาคาร/NPC ที่เปิด */

    /* ---------- เปิด/ปิด ---------- */
    show: function (title, tabs, active, source, ref) {
      this.title = title || '';
      this.tabs = tabs || [];
      this.active = active || (this.tabs[0] || '');
      this.source = source || 'menu';
      this.ref = ref || null;
      this.open = true;
      this.render();
      if (root.DT.Audio) DT.Audio.play('ui');
    },

    hide: function () {
      this.open = false;
      var p = el('popup');
      if (p) p.classList.remove('open');
      if (root.DT.Audio) DT.Audio.play('ui');
    },

    toggle: function (title, tabs, active, source, ref) {
      if (this.open && this.source === source &&
          ((ref && this.ref === ref) || (!ref && !this.ref))) {
        this.hide();
      } else this.show(title, tabs, active, source, ref);
    },

    setTab: function (id) {
      this.active = id;
      this.render();
      if (root.DT.Audio) DT.Audio.play('ui');
    },

    /* ---------- เรนเดอร์ ---------- */
    render: function () {
      var p = el('popup');
      if (!p) return;
      if (!this.open) { p.classList.remove('open'); p.innerHTML = ''; return; }
      p.classList.add('open');

      var h = '<div class="popup-box">';
      h += '<div class="popup-head"><span class="popup-title">' + esc(this.title) + '</span>' +
           '<button class="popup-x" data-act="popup:close">✕</button></div>';

      /* แท็บ */
      h += '<div class="popup-tabs">';
      for (var i = 0; i < this.tabs.length; i++) {
        var id = this.tabs[i];
        h += '<button class="ptab' + (id === this.active ? ' on' : '') +
             '" data-act="popup:tab:' + id + '">' + (TAB_LABEL[id] || id) + '</button>';
      }
      h += '</div>';

      /* เนื้อหา */
      h += '<div class="popup-body">' + this.body() + '</div>';
      h += '</div>';
      p.innerHTML = h;
    },

    body: function () {
      switch (this.active) {
        case 'trade': return this.tradeHtml();
        case 'weapon': return this.gearHtml('weapon');
        case 'armor': return this.gearHtml('armor');
        case 'accessory': return this.gearHtml('accessory');
        case 'items': return this.itemsHtml();
        case 'craft': return this.craftHtml();
        case 'quest': return this.questHtml();
        case 'rest': return this.restHtml();
        case 'smelt': return this.actionHtml('🔥', 'เตาหลอมแร่', 'หิน 2 + แร่ 1 → เหล็กก้อน 1', 'popup:smelt');
        case 'cook': return this.actionHtml('🍲', 'เตาหุง', 'เนื้อดิบ / ปลาดิบ / ผลไม้ 3 → อาหาร 1', 'popup:cook');
        case 'chest': return this.itemsHtml();
        case 'party': return this.partyHtml();
        case 'refine': return this.refineHtml();
        case 'market': return this.marketHtml();
        default: return '<div class="empty">ไม่มีข้อมูล</div>';
      }
    },

    /* ---------- ร้านค้า: ซื้อ/ขาย ---------- */
    tradeHtml: function () {
      var L = DT.Game.local;
      if (!L) return '';
      var h = '<div class="coins">เหรียญของคุณ: <b>' + L.coins + '</b> 🪙</div>';
      h += '<h3>🛒 ซื้อ</h3><div class="shop-list">';
      var stock = DT.Game.SHOP_STOCK || [];
      for (var i = 0; i < stock.length; i++) {
        var id = stock[i], def = DT.ITEMS[id];
        if (!def) continue;
        var price = L.buyPrice(id);
        h += '<div class="shop-row"><span class="ico">' + def.icon + '</span>' +
             '<span class="nm">' + esc(def.name) + '</span>' +
             '<span class="price">' + price + '🪙</span>' +
             '<button data-act="popup:buy:' + id + '"' + (L.coins >= price ? '' : ' disabled') + '>ซื้อ</button></div>';
      }
      h += '</div><h3 class="mt">💰 ขาย</h3><div class="shop-list">';
      if (!L.inv.length) h += '<div class="empty">ยังไม่มีของขาย</div>';
      for (var k = 0; k < L.inv.length; k++) {
        var s = L.inv[k], d2 = DT.ITEMS[s.id];
        if (!d2 || s.id === 'coin') continue;
        var equipped = (L.weapon === s.id || L.armorId === s.id || L.accessoryId === s.id);
        h += '<div class="shop-row"><span class="ico">' + d2.icon + '</span>' +
             '<span class="nm">' + esc(d2.name) + ' ×' + s.n + (equipped ? ' <span class="eq">ใส่อยู่</span>' : '') + '</span>' +
             '<span class="price">' + L.sellPrice(s.id) + '🪙</span>' +
             '<button data-act="popup:sell:' + s.id + '"' + (equipped ? ' disabled' : '') + '>ขาย</button></div>';
      }
      h += '</div>';
      return h;
    },

    /* ---------- อุปกรณ์: อาวุธ / ชุดเกราะ / เครื่องประดับ ---------- */
    gearHtml: function (slot) {
      var L = DT.Game.local;
      if (!L) return '';
      var title = slot === 'weapon' ? '⚔️ อาวุธ' : (slot === 'armor' ? '🛡️ ชุดเกราะ' : '💍 เครื่องประดับ');
      var cur = L.equippedIn(slot);
      var curDef = cur ? DT.ITEMS[cur] : null;

      var h = '<h3>' + title + '</h3>';
      h += '<div class="coins">' + (curDef
        ? 'กำลังสวม: <b>' + curDef.icon + ' ' + esc(curDef.name) + '</b>'
        : 'ยังไม่ได้สวมอะไร') + '</div>';
      h += '<div class="shop-list">';

      var any = false;
      for (var i = 0; i < L.inv.length; i++) {
        var s = L.inv[i], d = DT.ITEMS[s.id];
        if (!d) continue;
        var isWeapon = !!d.weapon, isArmor = !!d.armor, isAcc = !!(d.acc || d.accDef);
        var ok = (slot === 'weapon' && isWeapon) ||
                 (slot === 'armor' && isArmor) ||
                 (slot === 'accessory' && isAcc);
        if (!ok) continue;
        any = true;
        var stat = isWeapon ? ('ดาเมจ ' + d.weapon)
                 : isArmor ? ('กันดาเมจ ' + d.armor)
                 : ('ดาเมจ +' + (d.acc || 0) + ' / กันดาเมจ +' + (d.accDef || 0));
        var on = (cur === s.id);
        h += '<div class="shop-row"><span class="ico">' + d.icon + '</span>' +
             '<span class="nm">' + esc(d.name) + ' ×' + s.n + '<br><span class="stat">' + stat + '</span></span>' +
             (on
               ? '<button data-act="popup:unequip:' + s.id + '">ถอด</button>'
               : '<button data-act="popup:equip:' + s.id + '">สวมใส่</button>') +
             '</div>';
      }
      if (!any) h += '<div class="empty">ยังไม่มีของชนิดนี้ในกระเป๋า</div>';
      h += '</div>';
      return h;
    },

    /* ---------- ของใช้ ---------- */
    itemsHtml: function () {
      var L = DT.Game.local;
      if (!L) return '';
      var h = '<h3>🎒 ของใช้</h3><div class="inv-grid">';
      for (var i = 0; i < L.inv.length; i++) {
        var s = L.inv[i], d = DT.ITEMS[s.id];
        if (!d) continue;
        var usable = d.food || d.heal;
        h += '<div class="slot"><span class="ico">' + d.icon + '</span>' +
             '<span class="nm">' + esc(d.name) + '</span><span class="ct">' + s.n + '</span>' +
             (usable ? '<button class="use" data-act="popup:use:' + i + '">ใช้</button>' : '') +
             '</div>';
      }
      if (!L.inv.length) h += '<div class="empty">ยังไม่มีของ</div>';
      h += '</div>';
      return h;
    },

    /* ---------- คราฟต์ ---------- */
    craftHtml: function () {
      var L = DT.Game.local;
      if (!L) return '';
      var info = L.profInfo();
      var h = '<h3>' + info.icon + ' คราฟต์ — ' + esc(info.name) + '</h3>';
      h += '<div class="hint">' + esc(info.desc) + '</div><div class="craft-list">';
      var list = info.recipes || [];
      for (var i = 0; i < list.length; i++) {
        var rid = list[i], r = DT.RECIPES[rid];
        if (!r) continue;
        var out = DT.ITEMS[r.out];
        if (!out) continue;
        var have = DT.inv.hasAll(L.inv, r.need);
        var need = '';
        for (var k in r.need) if (r.need.hasOwnProperty(k)) {
          var nd = DT.ITEMS[k];
          if (!nd) continue;
          need += '<span class="chip">' + nd.icon + ' ' + esc(nd.name) + ' ×' + r.need[k] + '</span>';
        }
        h += '<div class="craft-row' + (have ? ' ok' : '') + '">' +
             '<span class="ico">' + out.icon + '</span>' +
             '<span class="nm">' + esc(out.name) + '</span>' +
             '<span class="need">' + need + '</span>' +
             '<button data-act="popup:make:' + rid + '"' + (have ? '' : ' disabled') + '>คราฟต์</button></div>';
      }
      h += '</div>';
      return h;
    },

    /* ---------- เควสต์ ---------- */
    questHtml: function () {
      var L = DT.Game.local;
      if (!L) return '';
      var h = '<h3>📜 เควสต์</h3><div class="coins">🪙 <b>' + L.coins + '</b> · ✨ Lv.' + L.level + '</div>';
      h += '<div class="quest-list">';
      var list = DT.QUESTS || [];
      for (var i = 0; i < list.length; i++) {
        var q = list[i];
        var prog = L.questProgress(q.id);
        var done = L.questDone[q.id];
        var ready = L.questReady(q.id);
        var cls = done ? 'done' : (ready ? 'ready' : '');
        h += '<div class="quest-row ' + cls + '">' +
             '<div class="qn">' + esc(q.name) + (done ? ' ✅' : '') + '</div>' +
             '<div class="qd">' + esc(q.desc) + '</div>' +
             '<div class="qp">ความคืบหน้า ' + prog + '/' + q.goal +
             ' · รางวัล ' + q.reward + '🪙 +' + q.xp + 'XP</div>' +
             (ready ? '<button data-act="popup:quest:' + q.id + '">รับรางวัล</button>' : '') +
             '</div>';
      }
      h += '</div>';
      return h;
    },

    /* ---------- พักผ่อน ---------- */
    restHtml: function () {
      return '<h3>🛏️ เตียงนอน</h3>' +
        '<div class="hint">นอนฟื้น HP/ความหิว/ความล้า เต็ม และข้ามเวลาไปเป็นเช้าวันใหม่</div>' +
        '<div class="shop-list"><div class="shop-row">' +
        '<span class="ico">🛏️</span><span class="nm">นอนพักผ่อน</span>' +
        '<button data-act="popup:rest">นอน</button></div></div>';
    },

    /* ---------- ปาร์ตี้ (Phase 5) ---------- */
    partyHtml: function () {
      var L = DT.Game.local;
      var P = root.DT.Party;
      var h = '<h3>👥 ปาร์ตี้</h3>';
      if (!P) return h + '<div class="empty">ระบบปาร์ตี้ยังไม่พร้อม</div>';

      var members = P.members || [];
      h += '<div class="coins">สมาชิก <b>' + members.length + '</b>/' + (P.MAX || 4) + '</div>';
      h += '<div class="shop-list">';
      for (var i = 0; i < members.length; i++) {
        var m = members[i];
        var lead = (P.leaderId && P.leaderId() === m.id) ? ' 👑' : '';
        h += '<div class="shop-row"><span class="ico">🧑</span>' +
             '<span class="nm">' + esc(m.name) + lead + '<br><span class="stat">Lv.' + (m.level || 1) +
             ' · HP ' + Math.round(m.hp || 0) + '</span></span></div>';
      }
      if (!members.length) h += '<div class="empty">ยังไม่มีสมาชิก</div>';
      h += '</div>';

      /* คำเชิญที่รอเรา */
      var inv = P.invites || [];
      if (inv.length) {
        h += '<h3 class="mt">✉️ คำเชิญ</h3><div class="shop-list">';
        for (var k = 0; k < inv.length; k++) {
          h += '<div class="shop-row"><span class="ico">📨</span>' +
               '<span class="nm">' + esc(inv[k].name || 'ผู้เล่น') + ' ชวนเข้าปาร์ตี้</span>' +
               '<button data-act="popup:party:accept:' + esc(inv[k].id) + '">ตกลง</button>' +
               '<button data-act="popup:party:decline:' + esc(inv[k].id) + '">ปฏิเสธ</button></div>';
        }
        h += '</div>';
      }

      /* ผู้เล่นใกล้ ๆ ที่ยังไม่อยู่ในปาร์ตี้ -> ปุ่มชวน */
      var peers = DT.Game.players || [];
      var cand = [];
      for (var p = 0; p < peers.length; p++) {
        var pl = peers[p];
        if (!pl || pl.isLocal) continue;
        if (P.isMember && P.isMember(pl.id)) continue;
        if (P.isInParty && P.isInParty(pl.id)) continue;
        cand.push(pl);
      }
      h += '<h3 class="mt">🚪 ผู้เล่นใกล้ ๆ</h3><div class="shop-list">';
      if (!cand.length) h += '<div class="empty">ไม่มีผู้เล่นคนอื่นใกล้ ๆ</div>';
      for (var c = 0; c < cand.length; c++) {
        var cp = cand[c];
        h += '<div class="shop-row"><span class="ico">🧑</span>' +
             '<span class="nm">' + esc(cp.name) + '<br><span class="stat">Lv.' + (cp.level || 1) + '</span></span>' +
             '<button data-act="popup:party:invite:' + esc(cp.id) + '">ชวน</button></div>';
      }
      h += '</div>';

      if (members.length > 1) {
        h += '<div class="shop-list"><div class="shop-row">' +
             '<span class="ico">🚪</span><span class="nm">ออกจากปาร์ตี้</span>' +
             '<button data-act="popup:party:leave">ออก</button></div></div>';
      }
      return h;
    },

    /* ---------- ตีเหล็ก refine (Phase 5) ---------- */
    refineHtml: function () {
      var L = DT.Game.local;
      var R = root.DT.Refine;
      if (!L || !R) return '<div class="empty">ระบบตีเหล็กยังไม่พร้อม</div>';
      var h = '<h3>🔨 ตีเหล็ก (+0 → +' + (R.MAX || 10) + ')</h3>';
      h += '<div class="hint">ใช้หินตีบวก + เหรียญ · ยิ่งระดับสูงยิ่งพังง่าย · หินกันแตกช่วยได้</div>';
      var stones = 0, lucky = 0;
      try {
        stones = DT.inv.count(L.inv, 'refine_stone');
        lucky = DT.inv.count(L.inv, 'lucky_stone');
      } catch (e) {}
      h += '<div class="coins">🪙 <b>' + L.coins + '</b> · 🔷 หินตีบวก <b>' + stones + '</b> · 🎲 หินเสี่ยงโชค <b>' + lucky + '</b></div>';
      h += '<div class="shop-list">';
      var any = false;
      for (var i = 0; i < L.inv.length; i++) {
        var s = L.inv[i], d = DT.ITEMS[s.id];
        if (!d) continue;
        var gear = d.weapon || d.armor || d.acc || d.accDef;
        if (!gear) continue;
        any = true;
        var lv = R.levelOf ? R.levelOf(L, s.id) : 0;
        var cost = R.cost ? R.cost(lv) : { coins: 0, stones: 0 };
        var chance = R.chance ? Math.round(R.chance(lv) * 100) : 0;
        var stat = d.weapon ? ('ดาเมจ ' + d.weapon) : (d.armor ? ('กันดาเมจ ' + d.armor) : ('ดาเมจ +' + (d.acc || 0) + ' / กันดาเมจ +' + (d.accDef || 0)));
        h += '<div class="shop-row"><span class="ico">' + d.icon + '</span>' +
             '<span class="nm">' + esc(d.name) + ' +' + lv + '<br><span class="stat">' + stat +
             ' · โอกาสสำเร็จ ' + chance + '% · ใช้ ' + cost.coins + '🪙 + หิน ' + cost.stones + '</span></span>' +
             '<button data-act="popup:refine:' + esc(s.id) + '">ตีเหล็ก</button></div>';
      }
      if (!any) h += '<div class="empty">ยังไม่มีอุปกรณ์ให้ตีเหล็ก</div>';
      h += '</div>';
      return h;
    },

    /* ---------- ตลาดผู้เล่น (Phase 5) ---------- */
    marketHtml: function () {
      var L = DT.Game.local;
      var M = root.DT.Market;
      if (!L || !M) return '<div class="empty">ระบบตลาดยังไม่พร้อม</div>';
      var h = '<h3>🏪 ตลาดผู้เล่น</h3>';
      h += '<div class="coins">🪙 <b>' + L.coins + '</b> · ค่าธรรมเนียม ' + Math.round((M.FEE_RATE || 0) * 100) + '%</div>';
      var list = M.listings || [];
      var myId = (L && L.id) || DT.Net.clientId;
      h += '<h3 class="mt">🛍️ ของที่วางขาย</h3><div class="shop-list">';
      if (!list.length) h += '<div class="empty">ยังไม่มีใครวางของขาย</div>';
      for (var i = 0; i < list.length; i++) {
        var it = list[i], d = DT.ITEMS[it.itemId] || {};
        var mine = (it.sellerId === myId);
        var total = (it.price || 0) * (it.qty || 1);
        h += '<div class="shop-row"><span class="ico">' + (d.icon || '❔') + '</span>' +
             '<span class="nm">' + esc(d.name || it.itemId) + ' ×' + (it.qty || 1) +
             '<br><span class="stat">ผู้ขาย: ' + esc(it.sellerName || '?') + '</span></span>' +
             '<span class="price">' + total + '🪙</span>' +
             (mine
               ? '<button data-act="popup:market:cancel:' + esc(it.id) + '">ยกเลิก</button>'
               : '<button data-act="popup:market:buy:' + esc(it.id) + '"' + (L.coins >= total + M.feeFor ? '' : ' disabled') + '>ซื้อ</button>') +
             '</div>';
      }
      h += '</div>';

      /* รายการที่ขายแล้ว รอผู้ขายกดรับเงิน */
      var pend = M.pendingPayouts ? M.pendingPayouts(myId) : [];
      if (pend.length) {
        h += '<h3 class="mt">💰 รอรับเงิน</h3><div class="shop-list">';
        for (var q = 0; q < pend.length; q++) {
          var pl2 = pend[q], dp = DT.ITEMS[pl2.itemId] || {};
          var amt = M.totalPrice(pl2), fee = M.feeFor(pl2);
          h += '<div class="shop-row"><span class="ico">' + (dp.icon || '❔') + '</span>' +
               '<span class="nm">' + esc(dp.name || pl2.itemId) + ' ×' + (pl2.qty || 1) +
               '<br><span class="stat">รับสุทธิ ' + Math.max(0, amt - fee) + '🪙 (ค่าธรรมเนียม ' + fee + ')</span></span>' +
               '<button data-act="popup:market:payout:' + esc(pl2.id) + '">รับเงิน</button></div>';
        }
        h += '</div>';
      }

      /* วางขายของของเรา */
      h += '<h3 class="mt">📤 วางขายของของคุณ</h3><div class="shop-list">';
      var any = false;
      for (var k = 0; k < L.inv.length; k++) {
        var s = L.inv[k], d2 = DT.ITEMS[s.id];
        if (!d2 || s.id === 'coin') continue;
        var equipped = (L.weapon === s.id || L.armorId === s.id || L.accessoryId === s.id);
        any = true;
        h += '<div class="shop-row"><span class="ico">' + d2.icon + '</span>' +
             '<span class="nm">' + esc(d2.name) + ' ×' + s.n + (equipped ? ' <span class="eq">ใส่อยู่</span>' : '') + '</span>' +
             '<button data-act="popup:market:list:' + esc(s.id) + '"' + (equipped ? ' disabled' : '') + '>ตั้งขาย</button></div>';
      }
      if (!any) h += '<div class="empty">ไม่มีของให้ขาย</div>';
      h += '</div>';
      return h;
    },

    actionHtml: function (icon, name, desc, act) {
      return '<h3>' + icon + ' ' + esc(name) + '</h3>' +
        '<div class="hint">' + esc(desc) + '</div>' +
        '<div class="shop-list"><div class="shop-row">' +
        '<span class="ico">' + icon + '</span><span class="nm">ลงมือ</span>' +
        '<button data-act="' + act + '">ทำเลย</button></div></div>';
    },

    /* ---------- เปิดจากอาคาร / NPC ---------- */
    openBuilding: function (b) {
      var tabs = BUILDING_TABS[b.name] || ['items'];
      var title = (b.icon || '🏠') + ' ' + b.name;
      this.toggle(title, tabs, tabs[0], 'building', b);
    },

    openNpc: function (n) {
      var tabs = NPC_TABS[n.prof] || ['items'];
      var title = (n.icon || '🧑') + ' ' + n.name;
      if (n.bubble !== undefined) n.bubble = 4;
      this.toggle(title, tabs, tabs[0], 'npc', n);
    }
  };

  DT.Popup = DT_POPUP;

  /* ---------- ผูก event ---------- */
  function init() {
    var p = el('popup');
    if (!p) return;
    p.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!t) return;
      var act = t.getAttribute('data-act');
      if (!act) return;
      e.preventDefault();
      e.stopPropagation();
      handle(act, t);
    });
    /* คลิกพื้นหลัง -> ปิด */
    p.addEventListener('mousedown', function (e) {
      if (e.target === p) DT.Popup.hide();
    });
  }

  function handle(act, el2) {
    var L = DT.Game.local;
    var G = DT.Game;
    if (!L) return;

    if (act === 'popup:close') { DT.Popup.hide(); return; }
    if (act.indexOf('popup:tab:') === 0) { DT.Popup.setTab(act.slice(10)); return; }

    if (act === 'popup:equip:') return;
    if (act.indexOf('popup:equip:') === 0) {
      var eid = act.slice(11);
      if (L.equipItem(eid)) {
        if (root.DT.Audio) DT.Audio.play('craft');
        G.toast('สวม ' + ((DT.ITEMS[eid] || {}).name || eid));
        DT.Net.saveLocal(L);
      } else G.toast('สวมไม่ได้');
      DT.Popup.render();
      return;
    }
    if (act.indexOf('popup:unequip:') === 0) {
      var uid = act.slice(13);
      if (L.unequipItem(uid)) {
        if (root.DT.Audio) DT.Audio.play('ui');
        G.toast('ถอด ' + ((DT.ITEMS[uid] || {}).name || uid));
        DT.Net.saveLocal(L);
      }
      DT.Popup.render();
      return;
    }
    if (act.indexOf('popup:buy:') === 0) {
      var bid = act.slice(10);
      if (L.buy(bid, 1)) {
        if (root.DT.Audio) DT.Audio.play('buy');
        if (root.DT.FX) DT.FX.sparkle(G.world, L.x, L.y, '#ffd166');
        G.toast('ซื้อ ' + ((DT.ITEMS[bid] || {}).name || bid) + ' แล้ว');
        DT.Net.saveLocal(L);
      } else { if (root.DT.Audio) DT.Audio.play('error'); G.toast('เหรียญไม่พอ'); }
      DT.Popup.render();
      return;
    }
    if (act.indexOf('popup:sell:') === 0) {
      var sid = act.slice(11);
      if (L.sell(sid, 1)) {
        if (root.DT.Audio) DT.Audio.play('sell');
        if (root.DT.FX) DT.FX.sparkle(G.world, L.x, L.y, '#ffe08a');
        G.toast('ขายได้ ' + L.sellPrice(sid) + '🪙');
        DT.Net.saveLocal(L);
      } else { if (root.DT.Audio) DT.Audio.play('error'); G.toast('ขายไม่ได้'); }
      DT.Popup.render();
      return;
    }
    if (act.indexOf('popup:use:') === 0) {
      var idx = parseInt(act.slice(10), 10);
      var slot = L.inv[idx];
      if (!slot) return;
      if (L.useItem(idx)) {
        if (root.DT.Audio) DT.Audio.play('eat');
        G.toast('ใช้ ' + ((DT.ITEMS[slot.id] || {}).name || slot.id));
        DT.Net.saveLocal(L);
      } else { if (root.DT.Audio) DT.Audio.play('error'); G.toast('ใช้ไม่ได้'); }
      DT.Popup.render();
      return;
    }
    if (act.indexOf('popup:make:') === 0) {
      var rid = act.slice(11);
      if (L.craft(rid)) {
        if (root.DT.Audio) DT.Audio.play('craft');
        if (root.DT.FX) DT.FX.sparkle(G.world, L.x, L.y, '#ffd166');
        G.toast('คราฟต์' + ((DT.ITEMS[DT.RECIPES[rid].out] || {}).name || '') + 'สำเร็จ!');
        DT.Net.saveLocal(L);
      } else { if (root.DT.Audio) DT.Audio.play('error'); G.toast('ของไม่พอ'); }
      DT.Popup.render();
      return;
    }
    if (act.indexOf('popup:quest:') === 0) {
      var qid = act.slice(12);
      if (L.completeQuest(qid)) {
        if (root.DT.Audio) DT.Audio.play('quest');
        if (root.DT.FX) DT.FX.text(G.world, L.x, L.y - 0.4, 'รับรางวัล!', '#8ce99a');
        G.toast('รับรางวัลแล้ว!');
        DT.Net.saveLocal(L);
      } else G.toast('ยังไม่เสร็จเควสต์');
      DT.Popup.render();
      return;
    }
    if (act === 'popup:rest') { G.doRest(); DT.Popup.render(); return; }
    if (act === 'popup:smelt') { G.doSmelt(); DT.Popup.render(); return; }
    if (act === 'popup:cook') { G.doCook(); DT.Popup.render(); return; }

    /* ---------- Phase 5: ปาร์ตี้ ---------- */
    if (act.indexOf('popup:party:invite:') === 0) {
      var pid = act.slice('popup:party:invite:'.length);
      var P = root.DT.Party;
      var peer = null;
      var pls = G.players || [];
      for (var pi = 0; pi < pls.length; pi++) if (pls[pi] && pls[pi].id === pid) peer = pls[pi];
      if (P && peer) {
        if (P.invite(pid, peer.name)) {
          G.toast('ส่งคำเชิญให้ ' + peer.name + ' แล้ว');
        } else G.toast('ชวนไม่ได้ (ปาร์ตี้เต็มหรืออยู่ปาร์ตี้อื่นแล้ว)');
      }
      DT.Popup.render();
      return;
    }
    if (act.indexOf('popup:party:accept:') === 0) {
      var aid = act.slice('popup:party:accept:'.length);
      if (root.DT.Party) root.DT.Party.accept(aid);
      DT.Popup.render();
      return;
    }
    if (act.indexOf('popup:party:decline:') === 0) {
      var did = act.slice('popup:party:decline:'.length);
      if (root.DT.Party) root.DT.Party.decline(did);
      DT.Popup.render();
      return;
    }
    if (act === 'popup:party:leave') {
      if (root.DT.Party) root.DT.Party.leave();
      G.toast('ออกจากปาร์ตี้แล้ว');
      DT.Popup.render();
      return;
    }

    /* ---------- Phase 5: ตีเหล็ก ---------- */
    if (act.indexOf('popup:refine:') === 0) {
      var rid2 = act.slice('popup:refine:'.length);
      var R = root.DT.Refine;
      if (!R) { G.toast('ระบบตีเหล็กยังไม่พร้อม'); return; }
      var useProtect = DT.inv.count(L.inv, 'protect_stone') > 0;
      var useLucky = DT.inv.count(L.inv, 'lucky_stone') > 0;
      var res = R.attempt(L, rid2, { protect: useProtect, lucky: useLucky });
      if (res && res.msg) {
        if (res.broke) { if (root.DT.Audio) DT.Audio.play('error'); }
        else if (res.ok) { if (root.DT.Audio) DT.Audio.play('craft'); }
        else if (root.DT.Audio) DT.Audio.play('error');
        G.toast(res.msg);
        if (root.DT.FX) DT.FX.text(G.world, L.x, L.y - 0.4, res.msg, res.ok ? '#8ce99a' : '#ff8787');
      }
      DT.Net.saveLocal(L);
      DT.Popup.render();
      return;
    }

    /* ---------- Phase 5: ตลาดผู้เล่น ---------- */
    if (act.indexOf('popup:market:buy:') === 0) {
      var lid = act.slice('popup:market:buy:'.length);
      var M = root.DT.Market;
      if (!M) return;
      M.buy(L, lid, function (err, out) {
        if (err) { G.toast('ซื้อไม่ได้: ' + (err.message || err)); if (root.DT.Audio) DT.Audio.play('error'); }
        else {
          G.toast('ซื้อสำเร็จ!');
          if (root.DT.Audio) DT.Audio.play('buy');
          if (root.DT.FX) DT.FX.sparkle(G.world, L.x, L.y, '#ffd166');
        }
        DT.Net.saveLocal(L);
        DT.Popup.render();
      });
      return;
    }
    if (act.indexOf('popup:market:cancel:') === 0) {
      var cid = act.slice('popup:market:cancel:'.length);
      var M2 = root.DT.Market;
      if (!M2) return;
      M2.cancel(L, cid, function (err) {
        if (err) G.toast('ยกเลิกไม่ได้: ' + (err.message || err));
        else G.toast('ยกเลิกแล้ว ของกลับเข้ากระเป๋า');
        DT.Net.saveLocal(L);
        DT.Popup.render();
      });
      return;
    }
    if (act.indexOf('popup:market:payout:') === 0) {
      var pid2 = act.slice('popup:market:payout:'.length);
      var M4 = root.DT.Market;
      if (!M4) return;
      M4.sellTo(L, pid2, function (err, out) {
        if (err) { G.toast('รับเงินไม่ได้: ' + (err.message || err)); if (root.DT.Audio) DT.Audio.play('error'); }
        else {
          G.toast('รับเงินแล้ว +' + ((out && out.amount) || 0) + '🪙');
          if (root.DT.Audio) DT.Audio.play('coin');
        }
        DT.Net.saveLocal(L);
        DT.Popup.render();
      });
      return;
    }
    if (act.indexOf('popup:market:list:') === 0) {
      var mid = act.slice('popup:market:list:'.length);
      var M3 = root.DT.Market;
      if (!M3) return;
      var chk = M3.canList ? M3.canList(L, mid, 1) : { ok: false, reason: 'ไม่พร้อม' };
      if (!chk.ok) { G.toast(chk.reason || 'ตั้งขายไม่ได้'); return; }
      var def = DT.ITEMS[mid] || {};
      var price = L.sellPrice ? L.sellPrice(mid) : 5;
      M3.listItem(L, mid, 1, price, function (err, listing) {
        if (err) { G.toast('ตั้งขายไม่สำเร็จ: ' + (err.message || err)); if (root.DT.Audio) DT.Audio.play('error'); }
        else {
          G.toast('ตั้งขาย ' + (def.name || mid) + ' ' + price + '🪙 แล้ว');
          if (root.DT.Audio) DT.Audio.play('coin');
        }
        DT.Net.saveLocal(L);
        DT.Popup.render();
      });
      return;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
