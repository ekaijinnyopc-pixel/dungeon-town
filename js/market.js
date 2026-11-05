/* =========================================================
   DUNGEON TOWN — ตลาดผู้เล่น (player market)
   ผู้เล่นตั้งขายของให้กันเองได้ (escrow 2 ขั้น)

   กติกาเงิน/ของ (escrow):
     1) listItem  -> ผู้ขายถูกหักของออกจาก inv ทันที (เก็บเป็น escrow)
     2) buy       -> ผู้ซื้อถูกหักเงิน (ราคารวม + ค่าธรรมเนียม) และได้ของทันที
     3) sellTo    -> ผู้ขายได้เงินสุทธิ (ราคารวม - ค่าธรรมเนียม) เมื่อมีคนซื้อแล้วยืนยันรับเงิน
     4) cancel    -> ผู้ขายยกเลิกของตัวเอง -> คืนของเข้า inv

   ราคา: listing.price = ราคาต่อ 1 ชิ้น, ราคารวม = price * qty
   ค่าธรรมเนียม: FEE_RATE 5% ของราคารวม (ปัดเป็นจำนวนเต็ม)

   2 โหมด (API เหมือนกันทุกข้อ):
     - ออนไลน์: ตาราง public.dungeon_town_market (Supabase) + broadcast ผ่าน DT.Net
     - ออฟไลน์: localStorage key 'dt:market' + broadcast ผ่าน DT.Net (เล่นคนละแท็บได้)
   ========================================================= */
(function (root) {
  'use strict';
  var DT = root.DT || (root.DT = {});

  var LS_KEY = 'dt:market';
  var TABLE = 'dungeon_town_market';

  /* ---------- helper: inventory (ทำงานได้แม้ไม่ได้โหลด js/player.js) ---------- */
  function stackCap(id) {
    var d = DT.ITEMS && DT.ITEMS[id];
    if (d && d.stack) return d.stack;
    if (root.DT && root.DT.CFG && root.DT.CFG.STACK_MAX) return root.DT.CFG.STACK_MAX;
    return 20;
  }
  function mCount(inv, id) {
    var t = 0;
    if (!inv) return 0;
    for (var i = 0; i < inv.length; i++) if (inv[i].id === id) t += inv[i].n;
    return t;
  }
  function mAdd(inv, id, n) {
    n = n || 1;
    if (!inv) return 0;
    if (DT.inv && DT.inv.add) return DT.inv.add(inv, id, n);
    var added = 0, i, cap, room, take;
    for (i = 0; i < inv.length && added < n; i++) {
      if (inv[i].id !== id) continue;
      cap = stackCap(id);
      room = cap - inv[i].n;
      if (room > 0) { take = Math.min(room, n - added); inv[i].n += take; added += take; }
    }
    while (added < n) {
      cap = stackCap(id);
      take = Math.min(cap, n - added);
      inv.push({ id: id, n: take });
      added += take;
    }
    return added;
  }
  function mRemove(inv, id, n) {
    n = n || 1;
    if (!inv || mCount(inv, id) < n) return false;
    var need = n;
    for (var i = inv.length - 1; i >= 0 && need > 0; i--) {
      if (inv[i].id !== id) continue;
      var take = Math.min(inv[i].n, need);
      inv[i].n -= take; need -= take;
      if (inv[i].n <= 0) inv.splice(i, 1);
    }
    return true;
  }

  /* ---------- helper: id ---------- */
  function uid() {
    try {
      if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID();
    } catch (e) {}
    return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function nowIso() {
    try { return new Date().toISOString(); } catch (e) { return ''; }
  }

  /* ---------- state ---------- */
  var M = {
    READY: false,          // true = มีตาราง DB, false = ใช้ localStorage fallback
    FEE_RATE: 0.05,       // ค่าธรรมเนียม 5% ตัดจากราคาที่ขาย
    listings: [],          // [{ id, sellerId, sellerName, itemId, qty, price, createdAt }]
    pending: [],           // listing ที่ถูกซื้อแล้ว รอผู้ขายกดรับเงิน
    onChange: null,        // callback(listings) เมื่อ listings เปลี่ยน
    booted: false,
    _netWrapped: false
  };

  /* ---------- internal: ค่าธรรมเนียม ---------- */
  function feeOf(total) {
    return Math.round((total || 0) * M.FEE_RATE);
  }
  function totalOf(l) {
    if (!l) return 0;
    return (l.price || 0) * (l.qty || 1);
  }

  /* ---------- internal: แจ้งการเปลี่ยน ---------- */
  function notify() {
    if (typeof M.onChange === 'function') {
      try { M.onChange(M.listings, M.pending); } catch (e) {}
    }
  }

  /* ---------- internal: localStorage ---------- */
  function saveLocal() {
    try {
      root.localStorage.setItem(LS_KEY, JSON.stringify({ listings: M.listings, pending: M.pending }));
    } catch (e) {}
  }
  function loadLocal() {
    try {
      var raw = root.localStorage.getItem(LS_KEY);
      if (!raw) return false;
      var d = JSON.parse(raw);
      if (!d) return false;
      M.listings = (d.listings || []).slice();
      M.pending = (d.pending || []).slice();
      return true;
    } catch (e) { return false; }
  }

  /* ---------- internal: Supabase ---------- */
  function netClient() {
    return (DT.Net && DT.Net.client) ? DT.Net.client : null;
  }
  function dbReady() {
    return !!(M.READY && netClient());
  }
  function dbCall(promise, cb) {
    try {
      promise.then(function (res) {
        if (res && res.error) cb(res.error);
        else cb(null, res && res.data);
      }).catch(function (e) { cb(e || new Error('db error')); });
    } catch (e) { cb(e); }
  }

  /* ---------- internal: broadcast ---------- */
  function broadcast(op, extra) {
    var net = DT.Net;
    if (!net || typeof net.send !== 'function') return;
    var msg = { t: 'market', op: op };
    if (extra) for (var k in extra) if (extra.hasOwnProperty(k)) msg[k] = extra[k];
    try { net.send(msg); } catch (e) {}
    /* net.js ส่งผ่าน channel ด้วย event = msg.t -> 'market' ไม่ได้ subscribe
       -> ส่งซ้ำผ่าน event 'state' (ที่ net.js subscribe ไว้) เพื่อให้ต่างเครื่องได้รับ */
    try {
      if (net.channel && typeof net.channel.send === 'function') {
        net.channel.send({ type: 'broadcast', event: 'state', payload: msg });
      }
    } catch (e) {}
  }

  /* ---------- internal: ค้นหา listing ---------- */
  function findListing(id) {
    for (var i = 0; i < M.listings.length; i++) if (M.listings[i].id === id) return M.listings[i];
    return null;
  }
  function findPending(id) {
    for (var i = 0; i < M.pending.length; i++) if (M.pending[i].id === id) return M.pending[i];
    return null;
  }
  function removeFrom(arr, id) {
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === id) { arr.splice(i, 1); return true; }
    }
    return false;
  }

  /* ---------- public API ---------- */

  /* ตรวจว่าตั้งขายได้ไหม -> { ok: bool, reason: string }
     price เป็นพารามิเตอร์ไม่บังคับ (ถ้าส่งมาจะเช็คด้วย) */
  M.canList = function (player, itemId, qty, price) {
    if (!player) return { ok: false, reason: 'ไม่พบผู้เล่น' };
    if (!itemId || !DT.ITEMS || !DT.ITEMS[itemId]) return { ok: false, reason: 'ไม่พบไอเทมนี้' };
    qty = Math.floor(Number(qty) || 0);
    if (qty <= 0) return { ok: false, reason: 'จำนวนต้องมากกว่า 0' };
    if (price !== undefined && price !== null) {
      var pr = Math.floor(Number(price) || 0);
      if (pr <= 0) return { ok: false, reason: 'ราคาต้องมากกว่า 0' };
    }
    if (itemId === player.weapon || itemId === player.armorId || itemId === player.accessoryId) {
      return { ok: false, reason: 'ถอดของที่สวมอยู่ก่อน' };
    }
    if (mCount(player.inv, itemId) < qty) {
      return { ok: false, reason: 'ของไม่พอ' };
    }
    return { ok: true, reason: '' };
  };

  /* ตั้งขายของ: หักของออกจาก inv ทันที (escrow) */
  M.listItem = function (player, itemId, qty, price, cb) {
    cb = cb || function () {};
    var chk = M.canList(player, itemId, qty, price);
    if (!chk.ok) { cb(new Error(chk.reason)); return; }
    qty = Math.floor(Number(qty) || 0);
    price = Math.floor(Number(price) || 0);
    if (!mRemove(player.inv, itemId, qty)) {
      cb(new Error('ของไม่พอ'));
      return;
    }
    var listing = {
      id: uid(),
      sellerId: player.id,
      sellerName: player.name || 'ผู้เล่น',
      itemId: itemId,
      qty: qty,
      price: price,          // ราคาต่อ 1 ชิ้น
      total: price * qty,
      fee: feeOf(price * qty),
      status: 'active',
      createdAt: nowIso()
    };
    M.listings.push(listing);
    notify();

    function done(err) {
      if (err) { /* เขียน DB ไม่ได้ -> ยังเก็บไว้ในเครื่อง ไม่ทำอะไรกับ inv */
        cb(err, listing);
        return;
      }
      cb(null, listing);
    }

    broadcast('list', { listing: listing });
    if (dbReady()) {
      dbCall(
        netClient().from(TABLE).insert({
          id: listing.id,
          seller_id: listing.sellerId,
          seller_name: listing.sellerName,
          item_id: listing.itemId,
          qty: listing.qty,
          price: listing.price,
          status: 'active',
          created_at: listing.createdAt
        }).select(),
        function (err) { done(err); }
      );
    } else {
      saveLocal();
      done(null);
    }
  };

  /* ยกเลิกของตัวเอง -> คืนของเข้า inv */
  M.cancel = function (player, listingId, cb) {
    cb = cb || function () {};
    var l = findListing(listingId);
    if (!l) { cb(new Error('ไม่พบรายการตั้งขาย')); return; }
    if (player && l.sellerId !== player.id) { cb(new Error('ยกเลิกได้เฉพาะของตัวเองเท่านั้น')); return; }
    removeFrom(M.listings, listingId);
    mAdd(player.inv, l.itemId, l.qty);
    notify();

    function done(err) {
      if (err) { cb(err); return; }
      cb(null, { listing: l, returned: l.qty });
    }

    broadcast('cancel', { listingId: listingId });
    if (dbReady()) {
      dbCall(
        netClient().from(TABLE).update({
          status: 'canceled', updated_at: nowIso()
        }).eq('id', listingId).select(),
        function (err) { done(err); }
      );
    } else {
      saveLocal();
      done(null);
    }
  };

  /* ผู้ซื้อ: หักเงิน (ราคารวม + ค่าธรรมเนียม) -> ได้ของทันที -> listing หายจากตลาด */
  M.buy = function (player, listingId, cb) {
    cb = cb || function () {};
    var l = findListing(listingId);
    if (!l) { cb(new Error('ไม่พบรายการตั้งขาย')); return; }
    if (player && l.sellerId === player.id) { cb(new Error('ของของตัวเอง ซื้อไม่ได้')); return; }
    var total = totalOf(l);
    var fee = feeOf(total);
    var paid = total + fee;
    var coins = Number(player.coins) || 0;
    if (coins < paid) { cb(new Error('เหรียญไม่พอ (ต้องการ ' + paid + ') ')); return; }

    player.coins = coins - paid;
    mAdd(player.inv, l.itemId, l.qty);

    var sold = {
      id: l.id, sellerId: l.sellerId, sellerName: l.sellerName,
      itemId: l.itemId, qty: l.qty, price: l.price,
      total: total, fee: fee, paid: paid,
      buyerId: player.id, buyerName: player.name || 'ผู้เล่น',
      status: 'sold', createdAt: l.createdAt, soldAt: nowIso()
    };
    removeFrom(M.listings, listingId);
    M.pending.push(sold);
    notify();

    function done(err) {
      if (err) { cb(err); return; }
      cb(null, { listing: sold, itemId: l.itemId, qty: l.qty, total: total, fee: fee, paid: paid });
    }

    broadcast('buy', { listingId: listingId, buyerId: player.id, listing: sold });
    if (dbReady()) {
      dbCall(
        netClient().from(TABLE).update({
          status: 'sold', buyer_id: player.id, updated_at: nowIso()
        }).eq('id', listingId).eq('status', 'active').select(),
        function (err) { done(err); }
      );
    } else {
      saveLocal();
      done(null);
    }
  };

  /* ผู้ขายกดรับเงิน: ได้เงินสุทธิ = ราคารวม - ค่าธรรมเนียม */
  M.sellTo = function (player, listingId, cb) {
    cb = cb || function () {};
    var l = findPending(listingId) || findListing(listingId);
    if (!l) { cb(new Error('ไม่พบรายการที่ขายแล้ว')); return; }
    if (player && l.sellerId !== player.id) { cb(new Error('รับเงินได้เฉพาะผู้ขายเท่านั้น')); return; }
    var total = (l.total !== undefined && l.total !== null) ? l.total : totalOf(l);
    var fee = (l.fee !== undefined && l.fee !== null) ? l.fee : feeOf(total);
    var net = Math.max(0, total - fee);
    player.coins = (Number(player.coins) || 0) + net;
    removeFrom(M.pending, listingId);
    removeFrom(M.listings, listingId);
    notify();

    function done(err) {
      if (err) { cb(err); return; }
      cb(null, { listing: l, amount: net, fee: fee, total: total });
    }

    broadcast('payout', { listingId: listingId });
    if (dbReady()) {
      dbCall(
        netClient().from(TABLE).update({ status: 'sold', updated_at: nowIso() }).eq('id', listingId).select(),
        function (err) { done(err); }
      );
    } else {
      saveLocal();
      done(null);
    }
  };

  /* ลบ listing ออก (ไม่คืนของ) */
  M.remove = function (listingId) {
    removeFrom(M.listings, listingId);
    notify();
    if (dbReady()) {
      try {
        netClient().from(TABLE).update({ status: 'canceled', updated_at: nowIso() })
          .eq('id', listingId).select();
      } catch (e) {}
    } else {
      saveLocal();
    }
  };

  /* listing ของผู้เล่นคนนี้ (รวมรายการที่ขายแล้วรอรับเงิน) */
  M.mine = function (playerId) {
    var out = [];
    for (var i = 0; i < M.listings.length; i++) if (M.listings[i].sellerId === playerId) out.push(M.listings[i]);
    for (var j = 0; j < M.pending.length; j++) if (M.pending[j].sellerId === playerId) out.push(M.pending[j]);
    return out;
  };

  /* ราคารวมของ listing */
  M.totalPrice = function (listing) { return totalOf(listing); };
  /* ค่าธรรมเนียมของ listing */
  M.feeFor = function (listing) { return feeOf(totalOf(listing)); };
  /* รายการที่ขายแล้วรอผู้ขายกดรับเงิน */
  M.pendingPayouts = function (playerId) {
    var out = [];
    for (var i = 0; i < M.pending.length; i++) {
      if (!playerId || M.pending[i].sellerId === playerId) out.push(M.pending[i]);
    }
    return out;
  };

  /* โหลดรายการตั้งขายทั้งหมด */
  M.load = function (cb) {
    cb = cb || function () {};
    if (dbReady()) {
      dbCall(
        netClient().from(TABLE).select('*').eq('status', 'active').order('created_at', { ascending: false }),
        function (err, rows) {
          if (err || !rows) { cb(err || new Error('โหลดตลาดไม่สำเร็จ')); return; }
          M.listings = (rows || []).map(function (r) {
            return {
              id: r.id,
              sellerId: r.seller_id,
              sellerName: r.seller_name || 'ผู้เล่น',
              itemId: r.item_id,
              qty: r.qty,
              price: r.price,
              total: r.price * r.qty,
              fee: feeOf(r.price * r.qty),
              status: r.status || 'active',
              createdAt: r.created_at
            };
          });
          notify();
          cb(null, M.listings);
        }
      );
    } else {
      loadLocal();
      notify();
      cb(null, M.listings);
    }
  };

  /* ตั้งค่าเริ่มต้น: เช็คว่าตารางมีไหม -> cb(ready) */
  M.boot = function (cb) {
    cb = cb || function () {};
    wrapNet();
    var net = DT.Net;
    /* ถ้ายังไม่ได้รัน SQL ตาราง dungeon_town_market -> ใช้โหมด fallback
       (localStorage + broadcast) ดีกว่ายิง query แล้วได้ 404 ทุกครั้งที่เปิดเกม */
    var useDb = !(root.DT && root.DT.CFG && root.DT.CFG.MARKET_USE_DB === false);
    if (!useDb || !net || !net.client || typeof net.client.from !== 'function') {
      M.READY = false;
      M.booted = true;
      loadLocal();
      notify();
      cb(false);
      return;
    }
    try {
      net.client.from(TABLE).select('id').limit(1).then(function (res) {
        var ok = !res.error && (res.status === 200 || res.status === 204);
        M.READY = ok;
        M.booted = true;
        if (ok) {
          M.load(function () { cb(true); });
        } else {
          loadLocal();
          cb(false);
        }
      }).catch(function () {
        M.READY = false;
        M.booted = true;
        loadLocal();
        cb(false);
      });
    } catch (e) {
      M.READY = false;
      M.booted = true;
      loadLocal();
      cb(false);
    }
  };

  /* รับข้อความ market จากเครื่องอื่น */
  M.handleNetMsg = function (m) {
    if (!m || m.t !== 'market') return;
    var net = DT.Net;
    if (net && net.clientId && m.id === net.clientId) return;
    switch (m.op) {
      case 'list':
        if (m.listing && !findListing(m.listing.id)) {
          M.listings.push(m.listing);
          notify();
        }
        break;
      case 'buy':
        if (m.listingId) {
          removeFrom(M.listings, m.listingId);
          if (m.listing && !findPending(m.listingId)) M.pending.push(m.listing);
          notify();
        }
        break;
      case 'cancel':
        if (m.listingId) {
          removeFrom(M.listings, m.listingId);
          removeFrom(M.pending, m.listingId);
          notify();
        }
        break;
      case 'payout':
        if (m.listingId) {
          removeFrom(M.pending, m.listingId);
          removeFrom(M.listings, m.listingId);
          notify();
        }
        break;
      default: break;
    }
    if (!M.READY) saveLocal();
    else M.load(function () {});
  };

  /* ครอบ DT.Net.handleMsg เพื่อดักข้อความตลาด (ไม่แก้ไฟล์ js/net.js) */
  function wrapNet() {
    var net = DT.Net;
    if (!net || net.__marketWrapped) return;
    var orig = net.handleMsg;
    if (typeof orig !== 'function') return;
    net.handleMsg = function (m) {
      if (m && m.t === 'market') {
        try { M.handleNetMsg(m); } catch (e) {}
        return;
      }
      return orig.call(net, m);
    };
    net.__marketWrapped = true;
  }

  M._wrapNet = wrapNet;
  M._feeOf = feeOf;
  M._totalOf = totalOf;

  DT.Market = M;
})(typeof window !== 'undefined' ? window : this);
