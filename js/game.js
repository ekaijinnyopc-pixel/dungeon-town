/* =========================================================
   DUNGEON TOWN — Game loop, input, UI
   ========================================================= */
(function (root) {
  'use strict';
  var DT = root.DT || (root.DT = {});
  var C = DT.CFG;

  function el(id) { return document.getElementById(id); }

  /* ---------- แมปปุ่ม ----------
     ใช้ e.code (ปุ่มกายภาพ) เป็นหลัก เพราะ e.key จะเป็นตัวอักษรไทยเมื่อใช้คีย์บอร์ดไทย
     (กด W -> 'ิ', กด I -> 'ไ') ทำให้เดิน/เปิดแผงไม่ได้ */
  var CODE_MAP = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    KeyE: 'gather', ShiftLeft: 'gather', ShiftRight: 'gather',
    Space: 'attack',
    KeyI: 'inv', KeyC: 'craft', KeyQ: 'quest', KeyF: 'shop', KeyG: 'fire',
    KeyP: 'party',
    Enter: 'enter', Escape: 'esc'
  };
  /* ทางสำรอง: ถ้า e.code ไม่มี (เช่น ปุ่มบนคีย์บอร์ดเสมิป) ใช้ e.key ตัวอักษรอังกฤษ */
  var KEY_MAP = {
    w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down',
    a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right',
    e: 'gather', shift: 'gather', ' ': 'attack',
    i: 'inv', c: 'craft', q: 'quest', f: 'shop', g: 'fire', p: 'party',
    enter: 'enter', escape: 'esc'
  };
  function actionOf(e) {
    if (e.code && CODE_MAP[e.code]) return CODE_MAP[e.code];
    var k = (e.key || '').toLowerCase();
    return KEY_MAP[k] || null;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  DT.Game = {
    world: null,
    players: [],
    local: null,
    keys: {},
    /* จอยอนาล็อค (แนว MOBA) — ทิศทางต่อเนื่องจากการลากนิ้ว */
    stick: { active: false, x: 0, y: 0, mag: 0 },
    canvas: null,
    progress: 0,
    last: 0,
    saveAcc: 0,
    uiAcc: 0,
    panel: 'none',   // none | inv | craft | shop | quest
    started: false,
    room: null,      // ห้องภายในอาคารที่กำลังอยู่ (null = อยู่กลางแปลง)
    roomReturn: null,// ตำแหน่งก่อนเข้าอาคาร (เพื่อกลับออกมา)
    stepAcc: 0,
    path: null,        // เส้นทางเดินอัตโนมัติ (คลิกขวา/ลากซ้าย)
    autoGather: null,  // node ที่กำลังเก็บอัตโนมัติ
    autoAttack: null,  // มอนส์ที่กำลังโจมตีอัตโนมัติ

    /* ---------- เริ่ม ---------- */
    start: function (opts) {
      opts = opts || {};
      this.world = DT.World.create();
      this.canvas = el('game');
      DT.Render.init(this.canvas, this.world);

      var name = opts.name || ('ผู้เล่น' + Math.floor(Math.random() * 900 + 100));
      var prof = opts.prof || 'miner';
      this.local = DT.Player(DT.Net.clientId, name, prof, true);
      this.players = [this.local];
      this.local.equipBest();

      DT.Net.boot();
      var self = this;

      /* ---------- Phase 5: ปาร์ตี้ + ตลาดผู้เล่น ---------- */
      if (root.DT.Party) {
        /* ผูกข้อมูลตัวเอง + ผูกช่อง net (party.js init() ทำส่วนผูก Net.onParty ให้) */
        if (typeof DT.Party.setSelf === 'function') {
          DT.Party.setSelf({
            id: self.local.id, name: self.local.name, prof: self.local.prof,
            level: self.local.level, hp: self.local.hp, maxHp: self.local.maxHp, alive: self.local.alive !== false
          });
        }
        if (typeof DT.Party.init === 'function') DT.Party.init();
        DT.Net.onParty = function (m) { DT.Party.handleMsg(m); };
        DT.Party.onChange = function () {
          /* อัปเดตสมาชิกตามผู้เล่นจริงในเกม */
          if (!DT.Party.members) return;
          for (var mi = 0; mi < DT.Party.members.length; mi++) {
            var mm = DT.Party.members[mi];
            var mp = self.findPeer(mm.id);
            if (mp) { mm.name = mp.name; mm.level = mp.level || 1; mm.hp = mp.hp; mm.maxHp = mp.maxHp; }
          }
          if (root.DT.Popup && DT.Popup.open && DT.Popup.active === 'party') DT.Popup.render();
        };
      }
      if (root.DT.Market && typeof DT.Market.boot === 'function') {
        DT.Market.onChange = function () {
          if (root.DT.Popup && DT.Popup.open && DT.Popup.active === 'market') DT.Popup.render();
        };
        DT.Market.boot(function (ready) {
          if (!ready) console.log('[market] โหมด fallback (localStorage + broadcast)');
        });
      }
      DT.Net.onPeer = function (m, isChat) {
        if (isChat) {
          var p = self.findPeer(m.id);
          if (p) { p.chat = m.msg; p.chatT = 4; }
          return;
        }
        var peer = self.findPeer(m.id);
        if (!peer) {
          peer = DT.Player(m.id, m.name || 'ผู้เล่น', m.prof || 'miner', false);
          self.players.push(peer);
        }
        peer.x = m.x; peer.y = m.y; peer.hp = m.hp;
        peer.prof = m.prof || peer.prof;
        peer.alive = m.alive !== false;
        peer.name = m.name || peer.name;
      };
      /* โหลดเซฟ (localStorage ก่อน, ถ้ามีตาราง Supabase ค่อยทับ) */
      DT.Net.load(function (row) {
        if (row && row.inv) {
          self.local.inv = row.inv;
          self.local.hp = row.hp || 100;
          self.local.hunger = row.hunger || 100;
          self.local.stamina = row.stamina || 100;
          /* คืนอุปกรณ์ที่สวมอยู่ (ถ้ามี) แล้วค่อย equipBest */
          var w = row.weapon || null;
          var a = row.armorId || row.armor_id || null;
          var c = row.accessoryId || row.accessory_id || null;
          if (w || a || c) {
            self.local.weapon = w;
            self.local.armorId = a;
            self.local.accessoryId = c;
            self.local.recalcGear();
          } else {
            self.local.equipBest();
          }
        }
      });

      /* ปลด focus ออกจากช่องพิมพ์ชื่อ และโฟกัส canvas
         (ถ้าโฟกัสค้างใน <input> ปุ่มลัดทั้งหมดจะถูกกลืน) */
      var nameInput = el('pname');
      if (nameInput) nameInput.blur();
      this.canvas.setAttribute('tabindex', '0');
      try { this.canvas.focus({ preventScroll: true }); } catch (e) { this.canvas.focus(); }

      /* เสียง: ต้องเรียกหลัง user gesture (คลิกปุ่มเริ่ม) */
      if (root.DT.Audio) { DT.Audio.init(); }
      /* ให้ player รู้จัก world ไว้ส่งเอฟเฟกต์ */
      this.local._world = this.world;

      this.bindInput();
      this.started = true;
      this.last = performance.now();
      requestAnimationFrame(this.frame.bind(this));
      this.tickUI();
      setInterval(this.tickUI.bind(this), 250);
      /* Phase 5: sync HP/เลเวลของตัวเองให้สมาชิกปาร์ตี้ทุก 1.5 วิ */
      setInterval(function () {
        if (root.DT.Party && typeof DT.Party.updateSelf === 'function' &&
            DT.Party.members && DT.Party.members.length > 1) {
          DT.Party.updateSelf();
        }
      }, 1500);
      setInterval(function () {
        DT.Net.saveLocal(self.local);
        DT.Net.save(self.local);
      }, 10000);
    },

    findPeer: function (id) {
      for (var i = 0; i < this.players.length; i++) if (this.players[i].id === id) return this.players[i];
      return null;
    },

    /* ---------- input ---------- */
    bindInput: function () {
      var self = this;
      /* keydown: ใช้ action จาก e.code */
      window.addEventListener('keydown', function (e) {
        /* ถ้าอยู่ในช่องพิมพ์ (แชท) ให้ผ่านไป ยกเว้น Escape/Enter */
        var typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
        var act = actionOf(e);
        if (!act) return;

        if (typing) {
          /* ส่งแชทด้วย Enter */
          if (act === 'enter' && e.target.id === 'chat-input') {
            var msg = e.target.value.trim();
            if (msg) {
              e.target.value = '';
              e.target.classList.remove('open');
              e.target.blur();
              self.local.chat = msg; self.local.chatT = 4;
              DT.Net.send({ t: 'chat', msg: msg });
            }
            e.preventDefault();
          } else if (act === 'esc') {
            e.target.value = ''; e.target.classList.remove('open'); e.target.blur();
            self.togglePanel('none');
          }
          return;
        }

        /* กันเลื่อนหน้าเมื่อกด Space */
        if (act === 'attack' || act === 'gather') e.preventDefault();

        self.keys[act] = true;

        /* P4-C: รวม logic ของแต่ละ action ไว้ที่เดียว
           (คีย์บอร์ด + ปุ่มมือถือเรียกฟังก์ชันเดียวกัน) */
        self.pressAction(act);
      });

      window.addEventListener('keyup', function (e) {
        var act = actionOf(e);
        if (act) self.keys[act] = false;
      });

      /* กันการเลื่อนหน้าเมื่อกด Space (ป้องกันเผลอปิดแท็บ) */
      window.addEventListener('keydown', function (e) {
        if (e.code === 'Space' && e.target === document.body) e.preventDefault();
      }, { passive: false });

      /* ---------- mouse-first ----------
         คลิกซ้าย = เลือก/เปิดเมนู (อาคาร · NPC · ทรัพยากร) · ลากซ้าย = เดิน
         คลิกขวา = เดินไป / โจมตี */
      this.canvas.addEventListener('mousedown', function (e) {
        e.preventDefault();
        var p = self.mousePos(e);
        if (e.button === 2) {           /* คลิกขวา */
          self.rightClick(p);
        } else if (e.button === 0) {    /* คลิกซ้าย (อาจเป็นการลาก) */
          self._drag = { start: p, moved: false, btn: 0 };
        }
      });
      this.canvas.addEventListener('mousemove', function (e) {
        if (!self._drag) return;
        var p = self.mousePos(e);
        if (!self._drag.moved) {
          var dx = p.px - self._drag.start.px, dy = p.py - self._drag.start.py;
          if (dx * dx + dy * dy > 36) self._drag.moved = true;
        }
        /* ลากซ้าย = เดินไปตามเมาส์แบบต่อเนื่อง */
        if (self._drag.moved) self.walkTo(p.tile.x, p.tile.y);
      });
      window.addEventListener('mouseup', function (e) {
        var d = self._drag;
        self._drag = null;
        if (!d || d.moved || e.button !== 0) return;
        var p = self.mousePos(e);
        self.leftClick(p);
      });
      /* ปิดเมนูคลิกขวาของเบราว์เซอร์ */
      this.canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      document.addEventListener('contextmenu', function (e) {
        if (e.target && e.target.id === 'game') e.preventDefault();
      });

      window.addEventListener('resize', function () {
        DT.Render.resize();
        self.syncToolbarLayout();
      });
      /* P4-C: มือถือ — หมุนจอ/คีย์บอร์ดเปิด-ปิด ต้อง resize canvas ตาม */
      window.addEventListener('orientationchange', function () {
        setTimeout(function () {
          DT.Render.resize();
          self.syncToolbarLayout();
        }, 250);
      });
      if (root.visualViewport) {
        root.visualViewport.addEventListener('resize', function () {
          DT.Render.resize();
          self.syncToolbarLayout();
        });
      }

      /* P4-C: กันเมนูมุมขวาบนซ้ำ — เรียกครั้งแรกตอนบูตเกม */
      this.syncToolbarLayout();

      /* P4-C: ปุ่มมือถือ (.mobile .pad) + touch บน canvas */
      this.bindMobilePads();
      this.bindTouch();
      /* P4-D: จอยอนาล็อคแนว MOBA (ซ้ายล่าง) */
      this.bindJoystick();

      /* ปุ่ม UI — ใช้ event delegation เพราะปุ่มในแผงกระเป๋า/คราฟต์
         ถูกสร้างใหม่ทุกครั้งที่รีเฟรชแผง (bind ตรง ๆ แล้วหาย) */
      document.addEventListener('click', function (e) {
        var t = e.target.closest ? e.target.closest('[data-act]') : null;
        if (!t) return;
        var act = t.getAttribute('data-act');
        if (!act) return;
        e.preventDefault();
        self.doAction(act);
      });
    },

    /* ---------- P4-C: กันเมนูมุมขวาบนซ้ำ ----------
       มือถือ = .mtools ชุดเดียว · เดสก์ท็อป = .topright ชุดเดียว
       ใช้ inline style เป็นชั้นสุดท้าย แม้ CSS เก่าค้างในแคชก็ไม่โผล่พร้อมกัน */
    syncToolbarLayout: function () {
      var top = document.querySelector('.topright');
      var mob = document.querySelector('.mobile');
      if (!top || !mob) return;
      var mobileOn = false;
      try {
        mobileOn = !!(root.matchMedia && root.matchMedia('(pointer: coarse), (max-width: 860px)').matches);
      } catch (e) { mobileOn = false; }
      top.style.display = mobileOn ? 'none' : '';
      mob.style.display = mobileOn ? '' : 'none';
    },

    /* ---------- P4-C: action กลาง (คีย์บอร์ด + มือถือ ใช้ร่วมกัน) ---------- */
    pressAction: function (act) {
      var self = this;
      if (!act) return;
      if (act === 'inv') self.togglePanel('inv');
      else if (act === 'craft') self.togglePanel('craft');
      else if (act === 'quest') self.togglePanel('quest');
      else if (act === 'shop') {
        /* คุย NPC ถ้าอยู่ใกล้ ไม่งั้นเปิดร้าน */
        var npc = self.nearestNpc();
        if (npc) {
          npc.bubble = 4;
          self.panel = 'shop';
          self.shopNpc = npc.id;
          self.refreshPanel();
          self.toast(npc.greeting);
        } else self.togglePanel('shop');
      }
      else if (act === 'fire') {
        if (!self.local) return;
        if (self.local.placeCampfire(self.world)) {
          self.toast('วางกองไฟแล้ว — มอนส์จะไม่เข้ามาใกล้');
          DT.Net.saveLocal(self.local);
        } else self.toast('ไม่มีชุดกองไฟ');
      }
      else if (act === 'party') {
        if (root.DT.Popup) DT.Popup.show('👥 ปาร์ตี้', ['party'], 'party', 'menu');
      }
      else if (act === 'esc') self.togglePanel('none');
      else if (act === 'attack') {
        if (self.local) self.local.attack(self.world);
      }
      else if (act === 'enter') self.openChat();
    },

    /* ---------- P4-C: ปุ่มมือถือ (.mobile .pad) ----------
       กดค้าง = เดิน/เก็บต่อเนื่อง (touchstart -> keys=true, touchend -> false) */
    bindMobilePads: function () {
      var self = this;
      var pads = document.querySelectorAll('.mobile .pad');
      function keyOf(el) { return el.getAttribute('data-key'); }

      function padDown(e) {
        var el = e.currentTarget;
        var k = keyOf(el);
        if (!k) return;
        if (e.cancelable) e.preventDefault();
        el.classList.add('on');
        if (k === 'up' || k === 'down' || k === 'left' || k === 'right') {
          self.keys[k] = true;
        } else if (k === 'gather') {
          self.keys['gather'] = true;      /* กดค้าง = เก็บต่อเนื่อง */
        } else if (k === 'attack') {
          self.pressAction('attack');
          if (self._atkTimer) clearInterval(self._atkTimer);
          self._atkTimer = setInterval(function () { self.pressAction('attack'); }, 420);
        } else if (k === 'shop') {
          self.pressAction('shop');
        } else if (k === 'fire') {
          self.pressAction('fire');
        }
      }
      function padUp(e) {
        var el = e.currentTarget;
        var k = keyOf(el);
        if (!k) return;
        if (e.cancelable) e.preventDefault();
        el.classList.remove('on');
        if (k === 'up' || k === 'down' || k === 'left' || k === 'right') self.keys[k] = false;
        else if (k === 'gather') self.keys['gather'] = false;
        else if (k === 'attack') {
          self.keys['attack'] = false;
          if (self._atkTimer) { clearInterval(self._atkTimer); self._atkTimer = null; }
        }
      }

      for (var i = 0; i < pads.length; i++) {
        var p = pads[i];
        p.addEventListener('touchstart', padDown, { passive: false });
        p.addEventListener('touchend', padUp, { passive: false });
        p.addEventListener('touchcancel', padUp, { passive: false });
        /* เมาส์ (ใช้ตอนทดสอบบนเดสก์ท็อป) */
        p.addEventListener('mousedown', padDown);
        p.addEventListener('mouseup', padUp);
        p.addEventListener('mouseleave', padUp);
      }
      /* ปล่อยปุ่มนอกหน้าจอ -> หยุดเดิน (กันค้าง) */
      window.addEventListener('touchend', function () {
        for (var j = 0; j < pads.length; j++) {
          var k = keyOf(pads[j]);
          if (k === 'up' || k === 'down' || k === 'left' || k === 'right' || k === 'gather') {
            if (pads[j].classList.contains('on')) self.keys[k] = false;
            pads[j].classList.remove('on');
          }
        }
        if (self._atkTimer) { clearInterval(self._atkTimer); self._atkTimer = null; }
      }, { passive: true });
    },

    /* ---------- P4-D: จอยอนาล็อค (แนว MOBA) ----------
       ซ้ายล่าง = จอยควบคุมทิศทาง (ลากนิ้วได้ ได้ความเร็วตามระยะ = อนาล็อก)
       ขวาล่าง = ปุ่มสกิล/โจมตี (ดู .mact) */
    bindJoystick: function () {
      var self = this;
      var base = document.querySelector('.mjoy');
      var knob = document.querySelector('.mjoy-knob');
      if (!base || !knob) return;
      var touchId = null;
      var cx = 0, cy = 0, max = 40;

      function center() {
        var r = base.getBoundingClientRect();
        cx = r.left + r.width / 2;
        cy = r.top + r.height / 2;
        var kw = knob.offsetWidth || 54;
        max = Math.max(18, r.width / 2 - kw / 2 - 6);
      }
      function reset() {
        self.stick.active = false; self.stick.x = 0; self.stick.y = 0; self.stick.mag = 0;
        knob.style.transform = 'translate(0px, 0px)';
        base.classList.remove('on');
        touchId = null;
      }
      function move(clientX, clientY) {
        var dx = clientX - cx, dy = clientY - cy;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d > max) { dx = dx / d * max; dy = dy / d * max; d = max; }
        knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
        var mag = d / max;
        if (mag < 0.14) {                    /* deadzone เล็กน้อยกันสั่น */
          self.stick.x = 0; self.stick.y = 0; self.stick.mag = 0; self.stick.active = true;
          return;
        }
        self.stick.x = dx / d; self.stick.y = dy / d;
        self.stick.mag = mag; self.stick.active = true;
      }
      function pick(e) {
        if (e.changedTouches && e.changedTouches.length) return e.changedTouches[0];
        return e;
      }
      function start(e) {
        if (e.cancelable) e.preventDefault();
        center();
        touchId = (e.changedTouches && e.changedTouches.length) ? e.changedTouches[0].identifier : 'mouse';
        base.classList.add('on');
        var t = pick(e);
        move(t.clientX, t.clientY);
      }
      function drag(e) {
        if (touchId === null) return;
        if (e.cancelable) e.preventDefault();
        var t = null;
        if (e.changedTouches) {
          for (var i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === touchId) { t = e.changedTouches[i]; break; }
          }
        } else t = e;
        if (!t) return;
        move(t.clientX, t.clientY);
      }
      function end(e) {
        if (touchId === null) return;
        if (e && e.changedTouches && e.changedTouches.length) {
          var id = e.changedTouches[0].identifier;
          if (id !== touchId) return;
        }
        reset();
      }

      base.addEventListener('touchstart', start, { passive: false });
      base.addEventListener('touchmove', drag, { passive: false });
      base.addEventListener('touchend', end, { passive: false });
      base.addEventListener('touchcancel', end, { passive: false });
      /* เมาส์ (ทดสอบบนเดสก์ท็อป) */
      base.addEventListener('mousedown', start);
      window.addEventListener('mousemove', function (e) { if (touchId === 'mouse') drag(e); });
      window.addEventListener('mouseup', function (e) { if (touchId === 'mouse') end(e); });
    },

    /* ---------- P4-D: ทิศทางเดิน (คีย์บอร์ด + จอยอนาล็อค) ----------
       คืน x,y = ทิศทางหน่วย · mag = ความเร็ว 0..1 (จอย) หรือ 1 (คีย์บอร์ด) */
    moveInput: function () {
      var kx = 0, ky = 0;
      if (this.keys['up']) ky -= 1;
      if (this.keys['down']) ky += 1;
      if (this.keys['left']) kx -= 1;
      if (this.keys['right']) kx += 1;
      if (kx || ky) {
        var kl = Math.sqrt(kx * kx + ky * ky);
        return { x: kx / kl, y: ky / kl, mag: 1, analog: false };
      }
      var st = this.stick;
      if (st && st.active && st.mag > 0) {
        return { x: st.x, y: st.y, mag: st.mag, analog: true };
      }
      return { x: 0, y: 0, mag: 0, analog: false };
    },

    /* ---------- P4-C: touch บน canvas ----------
       แตะสั้น = เมนู/เก็บ (เหมือนคลิกซ้าย) · กดค้าง = เดิน/โจมตี (เหมือนคลิกขวา) · ลาก = เดินตามนิ้ว
       P4-D: สองนิ้ว = pinch ซูมเข้า/ออก (ไม่ชนกับ gesture เดิน) */
    bindTouch: function () {
      var self = this;
      var st = null;
      var pinch = null;

      function fingerDist(e) {
        if (!e.touches || e.touches.length < 2) return 0;
        var a = e.touches[0], b = e.touches[1];
        var dx = a.clientX - b.clientX, dy = a.clientY - b.clientY;
        return Math.sqrt(dx * dx + dy * dy);
      }

      this.canvas.addEventListener('touchstart', function (e) {
        if (!e.touches) return;
        if (e.touches.length >= 2) {
          /* P4-D: สองนิ้ว = pinch zoom (ยกเลิก gesture เดิน/แตะของนิ้วเดียว) */
          st = null;
          pinch = { d0: fingerDist(e), z0: (root.DT.Render && root.DT.Render.zoomMul) || 1 };
          if (e.cancelable) e.preventDefault();
          return;
        }
        if (e.touches.length !== 1) return;
        var t = e.touches[0];
        st = { x: t.clientX, y: t.clientY, t0: Date.now(), moved: false };
        if (e.cancelable) e.preventDefault();   /* P4-C: กันเบราว์เซอร์ scroll/zoom */
      }, { passive: false });

      this.canvas.addEventListener('touchmove', function (e) {
        if (pinch) {
          if (e.touches && e.touches.length >= 2) {
            var d = fingerDist(e);
            if (pinch.d0 > 0 && root.DT.Render) {
              root.DT.Render.setZoom(pinch.z0 * (d / pinch.d0));
            }
          }
          if (e.cancelable) e.preventDefault();
          return;
        }
        if (!st || !e.touches || !e.touches.length) return;
        var t = e.touches[0];
        var dx = t.clientX - st.x, dy = t.clientY - st.y;
        if (!st.moved && dx * dx + dy * dy > 36) st.moved = true;
        if (st.moved) {
          var pm = self.touchPos(t);
          self.walkTo(pm.tile.x, pm.tile.y);
        }
        e.preventDefault();
      }, { passive: false });

      /* P4-D: ลูกกลิ้ง = ซูมเข้า/ออก (เดสก์ท็อป) */
      this.canvas.addEventListener('wheel', function (e) {
        if (!root.DT.Render) return;
        if (e.cancelable) e.preventDefault();
        root.DT.Render.zoomStep(e.deltaY < 0 ? 1 : -1);
      }, { passive: false });

      this.canvas.addEventListener('touchend', function (e) {
        if (e.cancelable) e.preventDefault();
        if (pinch) {
          if (e.touches && e.touches.length >= 2) return;
          pinch = null; st = null;
          return;
        }
        var s = st; st = null;
        if (!s || !e.changedTouches || !e.changedTouches.length) return;
        var t = e.changedTouches[0];
        if (s.moved) return;                       /* ลาก = เดิน (จัดการไปแล้ว) */
        var p = self.touchPos(t);
        var dur = Date.now() - s.t0;
        if (dur >= 450) { self.rightClick(p); return; }   /* กดค้าง = เดิน/โจมตี */
        /* แตะสั้น: ถ้าทับมอนส์ -> โจมตี ถ้าทับอาคาร/NPC/ทรัพยากร -> เมนู/เก็บ */
        var mob = self.mobAt(p.px, p.py);
        if (mob) { self.rightClick(p); return; }
        self.leftClick(p);
      }, { passive: false });

      this.canvas.addEventListener('touchcancel', function () { st = null; pinch = null; }, { passive: false });
    },

    /* ---------- P4-C: ตำแหน่งจาก touch ---------- */
    touchPos: function (t) {
      var c = this.canvas;
      if (!c) return { px: 0, py: 0, tile: { x: 0, y: 0 } };
      var r = c.getBoundingClientRect();
      var px = t.clientX - r.left, py = t.clientY - r.top;
      return { px: px, py: py, tile: DT.Render.screenToTile(px, py) };
    },

    /* ---------- mouse-first: ตำแหน่งเมาส์ ---------- */
    mousePos: function (e) {
      var c = this.canvas;
      if (!c) return { px: 0, py: 0, tile: { x: 0, y: 0 } };
      var r = c.getBoundingClientRect();
      var px = e.clientX - r.left, py = e.clientY - r.top;
      return { px: px, py: py, tile: DT.Render.screenToTile(px, py) };
    },

    /* อาคารที่คลิกทับ (ใช้รูปทรง iso ของ footprint) */
    buildingAt: function (px, py) {
      /* top-down: อาคารเป็นสี่เหลี่ยมบนจอ (ไม่ใช่ diamond) */
      var bs = this.world.map.buildings;
      for (var i = bs.length - 1; i >= 0; i--) {
        var b = bs[i];
        var r = DT.Render.buildingRect(b);
        if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return b;
      }
      return null;
    },

    npcAt: function (px, py) {
      var ns = this.world.npcs;
      for (var i = 0; i < ns.length; i++) {
        var p = DT.Render.toScreen(ns[i].x, ns[i].y);
        if (Math.abs(px - p.sx) < 20 && Math.abs(py - (p.sy - 10)) < 24) return ns[i];
      }
      return null;
    },

    nodeAt: function (px, py) {
      var ns = this.world.nodes;
      for (var i = 0; i < ns.length; i++) {
        var n = ns[i];
        if (n.amount <= 0) continue;
        var p = DT.Render.toScreen(n.x + 0.5, n.y + 0.5);
        if (Math.abs(px - p.sx) < 22 && Math.abs(py - p.sy) < 22) return n;
      }
      return null;
    },

    dropAt: function (px, py) {
      var ds = this.world.drops;
      for (var i = 0; i < ds.length; i++) {
        var p = DT.Render.toScreen(ds[i].x, ds[i].y);
        if (Math.abs(px - p.sx) < 18 && Math.abs(py - p.sy) < 18) return ds[i];
      }
      return null;
    },

    mobAt: function (px, py) {
      var ms = this.world.mobs;
      for (var i = 0; i < ms.length; i++) {
        var p = DT.Render.toScreen(ms[i].x, ms[i].y);
        if (Math.abs(px - p.sx) < 22 && Math.abs(py - p.sy) < 22) return ms[i];
      }
      return null;
    },

    /* ---------- เดินไปยัง tile (BFS) ---------- */
    walkTo: function (tx, ty) {
      var L = this.local;
      if (!L) return false;
      var map = this.room ? this.room.map : this.world.map;
      var path = DT.Path.find(map, L.x, L.y, tx, ty);
      if (!path) { this.path = null; return false; }
      this.path = path;
      return true;
    },

    /* ---------- คลิกซ้าย = เลือก / เปิดเมนู ---------- */
    leftClick: function (p) {
      var L = this.local;
      if (!L || !L.alive) return;
      var npc = this.npcAt(p.px, p.py);
      if (npc) { DT.Popup.openNpc(npc); return; }
      var b = this.buildingAt(p.px, p.py);
      if (b) { DT.Popup.openBuilding(b); return; }
      var node = this.nodeAt(p.px, p.py);
      if (node) {
        this.autoGather = node;
        this.walkTo(node.x + 0.5, node.y + 0.5);
        return;
      }
      var drop = this.dropAt(p.px, p.py);
      if (drop) { this.walkTo(drop.x, drop.y); return; }
    },

    /* ---------- คลิกขวา = เดินไป / โจมตี ---------- */
    rightClick: function (p) {
      var L = this.local;
      if (!L || !L.alive) return;
      this.autoAttack = null;
      var mob = this.mobAt(p.px, p.py);
      if (mob) {
        if (DT.dist(mob.x, mob.y, L.x, L.y) <= C.ATTACK_RANGE) {
          L.attack(this.world, mob);
        } else {
          this.autoAttack = mob;
          this.walkTo(mob.x, mob.y);
        }
        return;
      }
      this.walkTo(p.tile.x, p.tile.y);
    },

    /* ---------- กิจกรรมที่ popup เรียกใช้ ---------- */
    doRest: function () {
      var L = this.local, W = this.world;
      if (!L || !W) return;
      L.hp = L.maxHp;
      L.hunger = Math.min(100, L.hunger + 45);
      L.stamina = 100;
      W.time = C.DAY_START;
      W.day += 1;
      W.weather = 'clear';
      if (root.DT.Audio) DT.Audio.play('respawn');
      if (root.DT.FX) DT.FX.text(W, L.x, L.y - 0.4, 'พักผ่อน + ฟื้นเต็ม', '#9be7a3', { life: 1.6 });
      this.toast('นอนฟื้นแล้ว — วันที่ ' + W.day + ' · HP เต็ม');
      DT.Net.saveLocal(L);
    },

    doSmelt: function () {
      var L = this.local, W = this.world;
      if (!L || !W) return;
      var have = DT.inv.count(L.inv, 'stone') >= 2 && DT.inv.count(L.inv, 'ore') >= 1;
      if (!have) {
        this.toast('ต้องมีหิน 2 + แร่ 1');
        if (root.DT.Audio) DT.Audio.play('error');
        return;
      }
      DT.inv.remove(L.inv, 'stone', 2);
      DT.inv.remove(L.inv, 'ore', 1);
      DT.inv.add(L.inv, 'iron_ingot', 1);
      if (root.DT.Audio) DT.Audio.play('craft');
      if (root.DT.FX) { DT.FX.burst(W, L.x, L.y, '#ff9f43', 10, { speed: 2.2, life: 0.7 }); DT.FX.text(W, L.x, L.y - 0.4, '+1 เหล็กก้อน', '#ffd7a0'); }
      this.toast('หลอมได้เหล็กก้อน 1');
      DT.Net.saveLocal(L);
    },

    doCook: function () {
      var L = this.local, W = this.world;
      if (!L || !W) return;
      var made = null;
      if (DT.inv.count(L.inv, 'raw_meat') >= 1) { DT.inv.remove(L.inv, 'raw_meat', 1); made = 'cooked_meat'; }
      else if (DT.inv.count(L.inv, 'fish_raw') >= 1) { DT.inv.remove(L.inv, 'fish_raw', 1); made = 'cooked_meat'; }
      else if (DT.inv.count(L.inv, 'berry') >= 3) { DT.inv.remove(L.inv, 'berry', 3); made = 'salad'; }
      if (!made) {
        this.toast('ต้องมีเนื้อดิบ 1 หรือปลาดิบ 1 หรือผลไม้ 3');
        if (root.DT.Audio) DT.Audio.play('error');
        return;
      }
      DT.inv.add(L.inv, made, 1);
      if (root.DT.Audio) DT.Audio.play('craft');
      if (root.DT.FX) { DT.FX.burst(W, L.x, L.y, '#ffd166', 8, { speed: 1.8, life: 0.6 }); DT.FX.text(W, L.x, L.y - 0.4, '+1 ' + (DT.ITEMS[made] || {}).name, '#ffe9a8'); }
      this.toast('ปรุงได้' + (DT.ITEMS[made] || {}).name);
      DT.Net.saveLocal(L);
    },

    doAction: function (act) {
      var L = this.local;
      /* --- P4-E: เต็มจอ (มือถือ + เดสก์ท็อป) --- */
      if (act === 'toggle:fullscreen') {
        this.toggleFullscreen();
        return;
      }
      /* --- P4-E: ย่อ/ขยายสถานะฮีโร่ (HUD) --- */
      if (act === 'toggle:hud') {
        this.toggleHudMini();
        return;
      }
      /* --- P4-E: เปิด/ปิดเมนูเครื่องมือ (มือถือ) --- */
      if (act === 'toggle:menu') {
        this.toggleMobileMenu();
        return;
      }
      /* --- zoom: ซูมเข้า/ออก --- */
      if (act === 'zoom:in' || act === 'zoom:out') {
        if (!root.DT.Render) return;
        DT.Render.zoomStep(act === 'zoom:in' ? 1 : -1);
        this.toast('ซูม ' + Math.round((DT.Render.zoomMul || 1) * 100) + '%');
        return;
      }
      /* --- toggle: เปิด/ปิดแผง (ปุ่มมุมขวาบน) --- */
      if (act && act.indexOf('toggle:') === 0) {
        var what = act.slice(7);
        if (what === 'sound') {
          var muted = root.DT.Audio ? DT.Audio.toggleMute() : false;
          /* ปุ่มเสียงมี 2 ชุด (เดสก์ท็อป .topright + มือถือ .mtools) → อัปเดตทุกปุ่ม */
          var sBtns = document.querySelectorAll('[data-act="toggle:sound"]');
          for (var si = 0; si < sBtns.length; si++) {
            sBtns[si].textContent = muted ? '🔇' : '🔊';
          }
          this.toast(muted ? 'ปิดเสียง' : 'เปิดเสียง');
          return;
        }
        if (what === 'shop') {
          /* ร้าน: ถ้าอยู่ใกล้ NPC ให้คุย ไม่งั้นเปิดร้าน */
          var npc = this.nearestNpc();
          if (npc) {
            npc.bubble = 4;
            this.panel = 'shop';
            this.shopNpc = npc.id;
            this.refreshPanel();
            this.toast(npc.greeting);
          } else this.togglePanel('shop');
        } else if (what === 'party') {
          /* Phase 5: เปิดหน้าต่างปาร์ตี้ */
          if (root.DT.Popup) DT.Popup.show('👥 ปาร์ตี้', ['party'], 'party', 'menu');
          return;
        } else if (what === 'none') {
          /* P4-C: ปุ่ม ❌ บนมือถือ = ปิดทั้งแผงและ popup */
          this.panel = 'none';
          this.refreshPanel();
          if (root.DT.Popup) DT.Popup.hide();
        } else this.togglePanel(what);
        return;
      }
      if (act && act.indexOf('make:') === 0) {
        var r = act.slice(5);
        if (L.craft(r)) {
          if (root.DT.Audio) DT.Audio.play('craft');
          if (root.DT.FX) DT.FX.sparkle(this.world, L.x, L.y, '#ffd166');
          this.toast('คราฟต์' + DT.ITEMS[DT.RECIPES[r].out].name + 'สำเร็จ!');
          DT.Net.saveLocal(L);
          this.refreshPanel();
        }
        else { if (root.DT.Audio) DT.Audio.play('error'); this.toast('ของไม่พอ'); }
        return;
      }
      if (act && act.indexOf('buy:') === 0) {
        var bid = act.slice(4);
        if (L.buy(bid, 1)) {
          if (root.DT.Audio) DT.Audio.play('buy');
          if (root.DT.FX) DT.FX.sparkle(this.world, L.x, L.y, '#ffd166');
          this.toast('ซื้อ ' + DT.ITEMS[bid].name + ' แล้ว'); DT.Net.saveLocal(L);
        } else { if (root.DT.Audio) DT.Audio.play('error'); this.toast('เหรียญไม่พอ'); }
        this.refreshPanel();
        return;
      }
      if (act && act.indexOf('sell:') === 0) {
        var sid = act.slice(5);
        if (L.sell(sid, 1)) {
          if (root.DT.Audio) DT.Audio.play('sell');
          if (root.DT.FX) DT.FX.sparkle(this.world, L.x, L.y, '#ffe08a');
          this.toast('ขาย ' + DT.ITEMS[sid].name + ' ได้ ' + L.sellPrice(sid) + '🪙'); DT.Net.saveLocal(L);
        } else { if (root.DT.Audio) DT.Audio.play('error'); this.toast('ขายไม่ได้'); }
        this.refreshPanel();
        return;
      }
      if (act && act.indexOf('quest:') === 0) {
        var qid = act.slice(6);
        if (L.completeQuest(qid)) {
          if (root.DT.Audio) DT.Audio.play('quest');
          if (root.DT.FX) { DT.FX.sparkle(this.world, L.x, L.y, '#8ce99a'); DT.FX.text(this.world, L.x, L.y - 0.4, 'รับรางวัล!', '#8ce99a'); }
          this.toast('รับรางวัลแล้ว! +' + DT.QUESTS.filter(function(q){return q.id===qid;})[0].reward + '🪙'); DT.Net.saveLocal(L); }
        else this.toast('ยังไม่เสร็จเควสต์');
        this.refreshPanel();
        return;
      }
      if (act && act.indexOf('use:') === 0) {
        var idx = parseInt(act.slice(4), 10);
        var slot = L.inv[idx];
        if (!slot) return;
        var nm = (DT.ITEMS[slot.id] || {}).name || slot.id;
        if (L.useItem(idx)) {
          if (root.DT.Audio) DT.Audio.play('eat');
          if (root.DT.FX) DT.FX.text(this.world, L.x, L.y - 0.4, '+' + ((DT.ITEMS[slot.id] || {}).heal || 10) + ' HP', '#8ce99a');
          this.toast('ใช้' + nm); this.refreshPanel();
        } else { if (root.DT.Audio) DT.Audio.play('error'); this.toast('ใช้ไม่ได้'); }
        return;
      }
    },

    togglePanel: function (p) {
      this.panel = (this.panel === p) ? 'none' : p;
      if (root.DT.Audio) DT.Audio.play('ui');
      this.refreshPanel();
    },

    /* ---------- P4-E: เต็มจอ ----------
       iOS Safari ไม่รองรับ fullscreen บน documentElement (ต้องใช้ element)
       → ลอง documentElement ก่อน ถ้าไม่ได้ลอง body/canvas */
    toggleFullscreen: function () {
      var el = root.document.documentElement;
      var fs = root.document.fullscreenElement || root.document.webkitFullscreenElement ||
               root.document.mozFullScreenElement || root.document.msFullscreenElement;
      var self = this;
      function done() {
        var on = !!(root.document.fullscreenElement || root.document.webkitFullscreenElement ||
                    root.document.mozFullScreenElement || root.document.msFullscreenElement);
        var btns = root.document.querySelectorAll('[data-act="toggle:fullscreen"]');
        for (var i = 0; i < btns.length; i++) btns[i].textContent = on ? '⤡' : '⛶';
        if (root.DT.Render) DT.Render.resize();
        self.syncToolbarLayout();
        self.toast(on ? 'เต็มจอ' : 'ออกจากเต็มจอ');
      }
      if (fs) {
        var ex = root.document.exitFullscreen || root.document.webkitExitFullscreen ||
                 root.document.mozCancelFullScreen || root.document.msExitFullscreen;
        if (ex) { try { ex.call(root.document); } catch (e) { } }
        setTimeout(done, 120);
        return;
      }
      var req = el.requestFullscreen || el.webkitRequestFullscreen ||
                el.mozRequestFullScreen || el.msRequestFullscreen;
      if (!req) {
        /* iOS: ใช้ element แทน (canvas) */
        var cv = root.document.getElementById('game');
        var rq2 = cv && (cv.webkitRequestFullscreen || cv.webkitEnterFullscreen);
        if (rq2) { try { rq2.call(cv); } catch (e2) { } this.toast('เต็มจอ'); }
        else this.toast('เบราว์เซอร์นี้ไม่รองรับเต็มจอ');
        return;
      }
      try {
        var p = req.call(el);
        if (p && p.then) p.then(done, function () { self.toast('เปิดเต็มจอไม่สำเร็จ'); });
        else setTimeout(done, 120);
      } catch (e) { this.toast('เปิดเต็มจอไม่สำเร็จ'); }
    },

    /* ---------- P4-E: ย่อ/ขยายสถานะฮีโร่ ----------
       ย่อแล้วเหลือแถวเดียว (ชื่อ + Lv) → คืนพื้นที่เล่นบนมือถือ */
    toggleHudMini: function () {
      var hud = el('hud');
      if (!hud) return;
      var mini = hud.classList.toggle('hud-mini');
      if (root.DT.Audio) DT.Audio.play('ui');
      this.toast(mini ? 'ย่อสถานะฮีโร่' : 'ขยายสถานะฮีโร่');
    },

    /* ---------- P4-E: เปิด/ปิดเมนูเครื่องมือ (มือถือ) ---------- */
    toggleMobileMenu: function () {
      var mt = root.document.querySelector('.mtools');
      if (!mt) return;
      var open = mt.classList.toggle('open');
      if (root.DT.Audio) DT.Audio.play('ui');
      /* เปิดเมนู → ปิดแผงข้างที่อาจทับกัน */
      if (open && this.panel !== 'none') { this.panel = 'none'; this.refreshPanel(); }
      this.toast(open ? 'เปิดเมนู' : 'ปิดเมนู');
    },

    /* ---------- NPC ใกล้สุด ---------- */
    nearestNpc: function () {
      var W = this.world, best = null, bd = 2.2;
      for (var i = 0; i < W.npcs.length; i++) {
        var n = W.npcs[i];
        var d = DT.dist(n.x, n.y, this.local.x, this.local.y);
        if (d < bd) { bd = d; best = n; }
      }
      return best;
    },

    openChat: function () {
      var inp = el('chat-input');
      if (!inp) return;
      if (root.DT.Audio) DT.Audio.play('chat');
      inp.classList.add('open');
      inp.focus();
    },

    /* ---------- loop ---------- */
    frame: function (ts) {
      var dt = Math.min(0.05, (ts - this.last) / 1000);
      this.last = ts;
      try {
        this.update(dt);
        this.render();
      } catch (err) {
        /* ห้ามให้ลูปตายเพราะ error แค่ครั้งเดียว */
        if (!this._errShown) {
          this._errShown = true;
          console.error('loop error:', err);
          this.toast('เกมมีปัญหาเล็กน้อย: ' + (err && err.message ? err.message : err));
        }
      }
      requestAnimationFrame(this.frame.bind(this));
    },

    update: function (dt) {
      var L = this.local, W = this.world;
      if (!L) return;

      /* อยู่ในอาคาร? → ใช้ลูปของห้องแทน (เดินบนแผนที่ห้อง) */
      if (this.room) {
        this.updateInRoom(dt);
        return;
      }

      /* เดิน (คีย์บอร์ด + จอยอนาล็อค) */
      var mv = this.moveInput();
      var dx = mv.x, dy = mv.y;
      var len = Math.sqrt(dx * dx + dy * dy);
      var moving = false;
      if (len > 0 && L.alive) {
        moving = true;
        /* ทิศหัน (top-down 4 ทิศ) — จอยเฉียงเลือกตามแกนที่แรงกว่า */
        if (mv.analog) {
          L.dir = (Math.abs(dx) > Math.abs(dy)) ? (dx < 0 ? 'left' : 'right')
                                                : (dy < 0 ? 'up' : 'down');
        } else {
          L.dir = (dy < 0) ? 'up' : (dy > 0 ? 'down' : (dx < 0 ? 'left' : 'right'));
        }
        this.path = null;   /* เดินเอง = ยกเลิกเส้นทางอัตโนมัติ */
        var sp = C.PLAYER_SPEED * (L.stamina > 5 ? 1 : 0.5) * dt * mv.mag;
        var nx = L.x + dx * sp;
        var ny = L.y + dy * sp;
        if (DT.World.walkable(W.map, nx, L.y)) L.x = nx;
        if (DT.World.walkable(W.map, L.x, ny)) L.y = ny;
      } else if (this.path && this.path.length && L.alive) {
        /* เดินตามเส้นทาง (คลิกขวา / ลากซ้าย) */
        var map = this.room ? this.room.map : W.map;
        var wp = this.path[0];
        var wdx = wp.x - L.x, wdy = wp.y - L.y;
        var wd = Math.sqrt(wdx * wdx + wdy * wdy);
        if (wd < 0.14) {
          this.path.shift();
        } else {
          moving = true;
          /* ทิศหันตามทางเดิน */
          if (Math.abs(wdx) > Math.abs(wdy)) L.dir = (wdx > 0 ? 'right' : 'left');
          else L.dir = (wdy > 0 ? 'down' : 'up');
          var sp2 = C.PLAYER_SPEED * (L.stamina > 5 ? 1 : 0.5) * dt;
          var mx = L.x + (wdx / wd) * sp2;
          var my = L.y + (wdy / wd) * sp2;
          if (DT.World.walkable(map, mx, L.y)) L.x = mx;
          if (DT.World.walkable(map, L.x, my)) L.y = my;
        }
        if (!this.path.length) this.path = null;
      }
      L.moving = moving;

      /* เดินแล้วมีเสียงฝุ่น + ฝุ่นเล็กน้อย */
      if (moving) {
        this.stepAcc += dt;
        if (this.stepAcc > 0.34) {
          this.stepAcc = 0;
          if (root.DT.Audio) DT.Audio.play('step');
          if (root.DT.FX) DT.FX.stepDust(W, L.x, L.y);
        }
      } else this.stepAcc = 0;

      /* โจมตีอัตโนมัติเมื่อคลิกขวาที่มอนส์ (เดินเข้าใกล้แล้วตีจนตาย) */
      if (this.autoAttack) {
        var am = this.autoAttack;
        var stillAlive = false;
        for (var ai = 0; ai < W.mobs.length; ai++) if (W.mobs[ai] === am) stillAlive = true;
        if (!stillAlive || !L.alive) this.autoAttack = null;
        else if (DT.dist(am.x, am.y, L.x, L.y) <= C.ATTACK_RANGE) {
          L.attack(W, am);
        }
      }

      /* เก็บของ: กด E ค้างเมื่ออยู่ใกล้ node */
      var near = this.nearestNode(L);
      /* เก็บอัตโนมัติเมื่อคลิกซ้ายที่ต้นไม้/หิน (เดินไปถึงแล้วเก็บต่อ) */
      if (this.autoGather) {
        if (this.autoGather.amount <= 0) this.autoGather = null;
        else if (DT.dist(this.autoGather.x, this.autoGather.y, L.x, L.y) <= C.GATHER_RANGE) near = this.autoGather;
      }
      if (near && L.alive && (this.keys['gather'] || this.autoGather === near)) {
        L.gather(W, near, dt);
      } else { L.gatherT = 0; L.gatherTarget = null; }
      if (near && L.gatherTarget === near.id && L.gatherT > 0) {
        var mult = L.profInfo().gather[near.type] || 1;
        this.progress = Math.min(1, L.gatherT / (C.GATHER_TIME / mult));
      } else this.progress = 0;

      /* เข้าอาคาร: กด E ที่ประตู (ก่อนเก็บของ) */
      if (this.keys['gather'] && !this._enterCd) {
        var bld = this.buildingNear(L);
        if (bld && DT.Interiors.has(bld.name)) {
          this._enterCd = true;
          this.enterBuilding(bld);
          return;
        }
      }
      if (!this.keys['gather']) this._enterCd = false;

      /* เก็บของที่ตกพื้น */
      for (var di = W.drops.length - 1; di >= 0; di--) {
        var drop = W.drops[di];
        if (DT.dist(drop.x, drop.y, L.x, L.y) < 1.1) {
          DT.inv.add(L.inv, drop.item, 1);
          W.drops.splice(di, 1);
          this.toast('เก็บ ' + (DT.ITEMS[drop.item] ? DT.ITEMS[drop.item].name : drop.item));
        }
      }

      /* NPC bubble จาง */
      for (var ni = 0; ni < W.npcs.length; ni++) {
        if (W.npcs[ni].bubble > 0) W.npcs[ni].bubble -= dt;
      }

      /* อัปเดตผู้เล่นทุกคน */
      for (var i = 0; i < this.players.length; i++) {
        this.players[i].update(W, dt, this.players[i] === L ? moving : this.players[i].moving);
      }

      /* โลก */
      DT.World.update(W, dt, this.players);
      DT.World.updateFx(W, dt);

      /* เสียงบรรยากาศ: ฝน / กลางคืน (สลับตามสภาพ) */
      if (root.DT.Audio) {
        var amb = W.weather === 'rain' ? 'rain' : (DT.isNight(W.time) ? 'night' : 'clear');
        if (amb !== this._amb) {
          this._amb = amb;
          DT.Audio.setAmbience(amb);
        }
      }

      /* กล้องตามผู้เล่น */
      DT.Render.cam.x += (L.x - DT.Render.cam.x) * Math.min(1, dt * 8);
      DT.Render.cam.y += (L.y - DT.Render.cam.y) * Math.min(1, dt * 8);

      /* ส่งตำแหน่งออกไป */
      this.sendAcc = (this.sendAcc || 0) + dt;
      if (this.sendAcc > 0.12) {
        this.sendAcc = 0;
        DT.Net.send({
          t: 'state', x: round2(L.x), y: round2(L.y), name: L.name,
          prof: L.prof, hp: Math.round(L.hp), alive: L.alive
        });
      }
    },

    render: function () {
      var W = this.world;
      var night = DT.isNight(W.time) ? 1 : 0;
      /* เปลี่ยนแสงเทอมืดเฉียบพลัน */
      var h = DT.gameHour(W.time);
      var nightAmt = (h >= 18 && h < 20) ? (h - 18) / 2 : (h >= 5 && h < 7 ? (7 - h) / 2 : (night ? 1 : 0));
      DT.Render.draw(this.players, this.local.id, nightAmt);
    },

    /* ---------- เข้า/ออกอาคาร ---------- */
    buildingNear: function (L) {
      var W = this.world, best = null, bd = 1.7;
      for (var i = 0; i < W.map.buildings.length; i++) {
        var b = W.map.buildings[i];
        /* ประตูจริง (ถ้าไม่มีข้อมูล ใช้กลางด้านบนแทน) */
        var dx = b.door ? b.door.x : b.x + b.w / 2;
        var dy = b.door ? b.door.y : b.y;
        var d = DT.dist(dx + 0.5, dy + 0.5, L.x, L.y);
        if (d < bd) { bd = d; best = b; }
      }
      return best;
    },

    enterBuilding: function (b) {
      if (this.room) return;
      var room = DT.Interiors.forBuilding(b);
      if (!room) { this.toast('เข้าไม่ได้'); return; }
      this.room = room;
      this.roomReturn = { x: this.local.x, y: this.local.y };
      this.local.x = room.spawn.x;
      this.local.y = room.spawn.y;
      this.panel = 'none';
      this.refreshPanel();
      if (root.DT.Audio) DT.Audio.play('door');
      this.toast('เข้า' + b.name + ' — กด E ที่จุดใช้งาน');
      /* ส่งสถานะให้คนอื่นเห็นว่าเข้าอาคาร */
      DT.Net.send({ t: 'state', x: this.local.x, y: this.local.y, name: this.local.name, prof: this.local.prof, hp: Math.round(this.local.hp), alive: this.local.alive, inside: b.name });
    },

    exitBuilding: function () {
      if (!this.room) return;
      var r = this.roomReturn;
      this.room = null;
      this.roomReturn = null;
      if (r) { this.local.x = r.x; this.local.y = r.y; }
      if (root.DT.Audio) DT.Audio.play('door');
      this.toast('ออกจากอาคาร');
      DT.Net.send({ t: 'state', x: this.local.x, y: this.local.y, name: this.local.name, prof: this.local.prof, hp: Math.round(this.local.hp), alive: this.local.alive, inside: null });
    },

    /* ---------- อัปเดตตอนอยู่ในห้อง ---------- */
    updateInRoom: function (dt) {
      var L = this.local, room = this.room;
      var mv = this.moveInput();
      var dx = mv.x, dy = mv.y;
      var len = Math.sqrt(dx * dx + dy * dy);
      var moving = false;
      if (len > 0 && L.alive) {
        moving = true;
        /* ทิศหัน (top-down 4 ทิศ) */
        if (mv.analog) {
          L.dir = (Math.abs(dx) > Math.abs(dy)) ? (dx < 0 ? 'left' : 'right')
                                                : (dy < 0 ? 'up' : 'down');
        } else {
          L.dir = (dy < 0) ? 'up' : (dy > 0 ? 'down' : (dx < 0 ? 'left' : 'right'));
        }
        this.path = null;
        var sp = C.PLAYER_SPEED * (L.stamina > 5 ? 1 : 0.5) * dt * mv.mag;
        var nx = L.x + dx * sp;
        var ny = L.y + dy * sp;
        if (DT.World.walkable(room.map, nx, L.y)) L.x = nx;
        if (DT.World.walkable(room.map, L.x, ny)) L.y = ny;
      } else if (this.path && this.path.length && L.alive) {
        /* เดินตามเส้นทางในห้อง */
        var wp = this.path[0];
        var wdx = wp.x - L.x, wdy = wp.y - L.y;
        var wd = Math.sqrt(wdx * wdx + wdy * wdy);
        if (wd < 0.14) this.path.shift();
        else {
          moving = true;
          /* ทิศหันตามทางเดิน */
          if (Math.abs(wdx) > Math.abs(wdy)) L.dir = (wdx > 0 ? 'right' : 'left');
          else L.dir = (wdy > 0 ? 'down' : 'up');
          var sp2 = C.PLAYER_SPEED * (L.stamina > 5 ? 1 : 0.5) * dt;
          var mx = L.x + (wdx / wd) * sp2;
          var my = L.y + (wdy / wd) * sp2;
          if (DT.World.walkable(room.map, mx, L.y)) L.x = mx;
          if (DT.World.walkable(room.map, L.x, my)) L.y = my;
        }
        if (!this.path.length) this.path = null;
      }
      L.moving = moving;

      if (moving) {
        this.stepAcc += dt;
        if (this.stepAcc > 0.34) {
          this.stepAcc = 0;
          if (root.DT.Audio) DT.Audio.play('step');
        }
      } else this.stepAcc = 0;

      /* เดินถึงประตูออก → ออกไปข้างนอก */
      if (DT.dist(L.x, L.y, room.exit.x + 0.5, room.exit.y + 0.5) < 0.7) {
        this.exitBuilding();
        return;
      }

      /* กด E ใกล้จุดใช้งาน */
      var st = DT.Interiors.stationAt(room, L.x, L.y);
      if (this.keys['gather'] && st && !this._stationCd) {
        this._stationCd = true;
        this.useStation(st);
      }
      if (!this.keys['gather']) this._stationCd = false;

      /* particle ยังต้องวิ่ง + เวลาเดินหน้า */
      DT.World.updateFx(this.world, dt);
      this.world.time = (this.world.time + dt / C.DAY_LENGTH) % 1;

      /* กล้องตามผู้เล่น */
      DT.Render.cam.x += (L.x - DT.Render.cam.x) * Math.min(1, dt * 8);
      DT.Render.cam.y += (L.y - DT.Render.cam.y) * Math.min(1, dt * 8);

      /* ส่งตำแหน่งออกไป */
      this.sendAcc = (this.sendAcc || 0) + dt;
      if (this.sendAcc > 0.15) {
        this.sendAcc = 0;
        DT.Net.send({
          t: 'state', x: round2(L.x), y: round2(L.y), name: L.name,
          prof: L.prof, hp: Math.round(L.hp), alive: L.alive, inside: this.room.def.name
        });
      }
    },

    /* ---------- ใช้จุดใช้งานในห้อง ---------- */
    useStation: function (st) {
      var L = this.local, W = this.world;
      if (st.action === 'sleep') {
        L.hp = L.maxHp;
        L.hunger = Math.min(100, L.hunger + 45);
        L.stamina = 100;
        /* ข้ามเวลาไปเป็นเช้าวันใหม่ */
        W.time = C.DAY_START;
        W.day += 1;
        W.weather = 'clear';
        if (root.DT.Audio) DT.Audio.play('respawn');
        if (root.DT.FX) DT.FX.text(W, L.x, L.y - 0.4, 'พักผ่อน + ฟื้นเต็ม', '#9be7a3', { life: 1.6 });
        this.toast('นอนฟื้นแล้ว — วันที่ ' + W.day + ' · HP เต็ม');
        DT.Net.saveLocal(L);
      } else if (st.action === 'craft') {
        this.panel = 'craft'; this.refreshPanel();
        if (root.DT.Audio) DT.Audio.play('ui');
      } else if (st.action === 'chest') {
        this.panel = 'inv'; this.refreshPanel();
        if (root.DT.Audio) DT.Audio.play('ui');
      } else if (st.action === 'shop') {
        this.panel = 'shop'; this.refreshPanel();
        if (root.DT.Audio) DT.Audio.play('ui');
      } else if (st.action === 'smelt') {
        /* หิน + แร่ → เหล็กก้อน */
        var have = DT.inv.count(L.inv, 'stone') >= 2 && DT.inv.count(L.inv, 'ore') >= 1;
        if (!have) {
          this.toast('ต้องมีหิน 2 + แร่ 1');
          if (root.DT.Audio) DT.Audio.play('error');
        } else {
          DT.inv.remove(L.inv, 'stone', 2);
          DT.inv.remove(L.inv, 'ore', 1);
          DT.inv.add(L.inv, 'iron_ingot', 1);
          if (root.DT.Audio) DT.Audio.play('craft');
          if (root.DT.FX) { DT.FX.burst(W, L.x, L.y, '#ff9f43', 10, { speed: 2.2, life: 0.7 }); DT.FX.text(W, L.x, L.y - 0.4, '+1 เหล็กก้อน', '#ffd7a0'); }
          this.toast('หลอมได้เหล็กก้อน 1');
          DT.Net.saveLocal(L);
        }
      } else if (st.action === 'cook') {
        /* ของดิบ → อาหาร */
        var made = null;
        if (DT.inv.count(L.inv, 'raw_meat') >= 1) { DT.inv.remove(L.inv, 'raw_meat', 1); made = 'cooked_meat'; }
        else if (DT.inv.count(L.inv, 'fish_raw') >= 1) { DT.inv.remove(L.inv, 'fish_raw', 1); made = 'cooked_meat'; }
        else if (DT.inv.count(L.inv, 'berry') >= 3) { DT.inv.remove(L.inv, 'berry', 3); made = 'salad'; }
        if (!made) {
          this.toast('ต้องมีเนื้อดิบ 1 หรือปลาดิบ 1 หรือผลไม้ 3');
          if (root.DT.Audio) DT.Audio.play('error');
        } else {
          DT.inv.add(L.inv, made, 1);
          if (root.DT.Audio) DT.Audio.play('craft');
          if (root.DT.FX) { DT.FX.burst(W, L.x, L.y, '#ffd166', 8, { speed: 1.8, life: 0.6 }); DT.FX.text(W, L.x, L.y - 0.4, '+1 ' + (DT.ITEMS[made] || {}).name, '#ffe9a8'); }
          this.toast('ปรุงได้' + (DT.ITEMS[made] || {}).name);
          DT.Net.saveLocal(L);
        }
      }
    },

    nearestNode: function (L) {
      var W = this.world, best = null, bd = C.GATHER_RANGE;
      for (var i = 0; i < W.nodes.length; i++) {
        var n = W.nodes[i];
        if (n.amount <= 0) continue;
        var d = DT.dist(n.x, n.y, L.x, L.y);
        if (d < bd) { bd = d; best = n; }
      }
      return best;
    },

    /* ---------- UI ---------- */
    tickUI: function () {
      if (!this.local) return;
      var L = this.local;
      var hud = el('hud');
      if (!hud) return;
      var W2 = DT.Game.world;
      var wx = W2.weather === 'rain' ? '🌧️' : (W2.weather === 'fog' ? '🌫️' : '☀️');
      hud.innerHTML =
        '<div class="hud-row hud-top"><span class="hud-name">' + esc(L.name) + ' ' + L.profInfo().icon + '</span>' +
        '<span class="hud-lv">Lv.' + L.level + '</span></div>' +
        statBar('❤️ HP', L.hp, L.maxHp, '#5fd35f') +
        statBar('🍖 หิว', L.hunger, 100, '#e8a33c') +
        statBar('⚡ ล้า', L.stamina, 100, '#4aa3d8') +
        statBar('✨ XP', L.xp, L.xpNeeded(), '#a06fe0') +
        '<div class="hud-row"><span>🪙 ' + L.coins + '</span><span>☠ ' + L.kills + '</span>' +
        '<span>🎒 ' + L.inv.length + '</span></div>' +
        '<div class="hud-row"><span>🔫 ' + esc(itemName(L.weapon) || 'มือเปล่า') + '</span>' +
        '<span>🛡 ' + esc(itemName(L.armorId) || 'ไม่มี') + '</span>' +
        '<span>💍 ' + esc(itemName(L.accessoryId) || 'ไม่มี') + '</span></div>' +
        '<div class="hud-row"><span class="hud-clock">วัน ' + W2.day + ' · ' + pad(DT.gameHour(W2.time)) + ':00</span>' +
        '<span>' + (DT.isNight(W2.time) ? '🌙' : '☀️') + ' ' + wx + '</span>' +
        '<span>🌍 ' + DT.Net.mode + '</span></div>';
      /* Phase 5: แถบปาร์ตี้ */
      if (root.DT.Party && DT.Party.members && DT.Party.members.length > 1) {
        var pm = DT.Party.members;
        var ph = '<div class="hud-row hud-party"><span>👥 ปาร์ตี้ ' + pm.length + '/' + (DT.Party.MAX || 4) + '</span>';
        for (var pmi = 0; pmi < pm.length; pmi++) {
          var pmm = pm[pmi];
          ph += '<span class="pm">' + esc(pmm.name) + ' Lv.' + (pmm.level || 1) + '</span>';
        }
        ph += '</div>';
        hud.innerHTML += ph;
      }
      if (this.panel !== 'none') this.refreshPanel();
    },

    refreshPanel: function () {
      var p = el('panel');
      if (!p) return;
      if (this.panel === 'none') { p.classList.remove('open'); p.innerHTML = ''; return; }
      p.classList.add('open');
      if (this.panel === 'inv') p.innerHTML = this.invHtml();
      else if (this.panel === 'craft') p.innerHTML = this.craftHtml();
      else if (this.panel === 'shop') p.innerHTML = this.shopHtml();
      else if (this.panel === 'quest') p.innerHTML = this.questHtml();
    },

    /* ---------- ร้านค้า ---------- */
    SHOP_STOCK: ['wood', 'stone', 'ore', 'herb', 'berry', 'bread', 'salad', 'herbal_tonic',
                 'cooked_meat', 'plank', 'iron_ingot', 'torch', 'campfire_kit', 'bedroll'],

    shopHtml: function () {
      var L = this.local;
      var h = '<h3>🪙 ร้านค้า</h3>';
      var npc = null;
      for (var i = 0; i < this.world.npcs.length; i++) {
        if (this.world.npcs[i].id === this.shopNpc) npc = this.world.npcs[i];
      }
      if (npc) h += '<div class="hint">' + npc.icon + ' ' + esc(npc.name) + ' — ' + esc(npc.greeting) + '</div>';
      h += '<div class="coins">เหรียญของคุณ: <b>' + L.coins + '</b> 🪙</div>';
      h += '<div class="shop-tabs"><span class="tab on">ซื้อ</span></div>';
      h += '<div class="shop-list">';
      for (var j = 0; j < this.SHOP_STOCK.length; j++) {
        var id = this.SHOP_STOCK[j];
        var def = DT.ITEMS[id];
        if (!def) continue;
        var price = L.buyPrice(id);
        var can = L.coins >= price;
        h += '<div class="shop-row">' +
          '<span class="ico">' + def.icon + '</span>' +
          '<span class="nm">' + esc(def.name) + '</span>' +
          '<span class="price">' + price + '🪙</span>' +
          '<button data-act="buy:' + id + '"' + (can ? '' : ' disabled') + '>ซื้อ</button>' +
          '</div>';
      }
      h += '</div><h3 class="mt">ขายของของคุณ</h3><div class="shop-list">';
      if (!L.inv.length) h += '<div class="empty">ยังไม่มีของขาย</div>';
      for (var k = 0; k < L.inv.length; k++) {
        var s = L.inv[k], d2 = DT.ITEMS[s.id];
        if (!d2 || s.id === 'coin') continue;
        var sp = L.sellPrice(s.id);
        h += '<div class="shop-row">' +
          '<span class="ico">' + d2.icon + '</span>' +
          '<span class="nm">' + esc(d2.name) + ' ×' + s.n + '</span>' +
          '<span class="price">' + sp + '🪙</span>' +
          '<button data-act="sell:' + s.id + '">ขาย</button>' +
          '</div>';
      }
      h += '</div><div class="hint">กด F ปิด</div>';
      return h;
    },

    /* ---------- เควสต์ ---------- */
    questHtml: function () {
      var L = this.local;
      var h = '<h3>📜 เควสต์</h3><div class="coins">🪙 เหรียญ <b>' + L.coins + '</b> · ✨ Lv.' + L.level + '</div>';
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
          (ready ? '<button data-act="quest:' + q.id + '">รับรางวัล</button>' : '') +
          '</div>';
      }
      h += '</div><div class="hint">กด Q ปิด</div>';
      return h;
    },

    invHtml: function () {
      var L = this.local;
      var h = '<h3>🎒 กระเป๋า</h3><div class="inv-grid">';
      for (var i = 0; i < L.inv.length; i++) {
        var s = L.inv[i], d = DT.ITEMS[s.id];
        if (!d) continue;
        var usable = d.food || d.heal;
        h += '<div class="slot" title="' + esc(d.name) + '">' +
          '<span class="ico">' + d.icon + '</span>' +
          '<span class="nm">' + esc(d.name) + '</span>' +
          '<span class="ct">' + s.n + '</span>' +
          (usable ? '<button class="use" data-act="use:' + i + '">ใช้</button>' : '') +
          '</div>';
      }
      if (!L.inv.length) h += '<div class="empty">ยังไม่มีของ</div>';
      h += '</div><div class="hint">กด I ปิด</div>';
      return h;
    },

    craftHtml: function () {
      var L = this.local, info = L.profInfo();
      var h = '<h3>' + info.icon + ' คราฟต์ — ' + esc(info.name) + '</h3>';
      h += '<div class="hint">' + esc(info.desc) + '</div><div class="craft-list">';
      var list = info.recipes;
      for (var i = 0; i < list.length; i++) {
        var rid = list[i], r = DT.RECIPES[rid];
        if (!r) continue;
        var out = DT.ITEMS[r.out];
        var ok = DT.inv.hasAll(L.inv, r.need);
        h += '<div class="craft-row' + (ok ? ' ok' : '') + '">' +
          '<span class="ico">' + out.icon + '</span>' +
          '<span class="nm">' + esc(out.name) + '</span>' +
          '<span class="need">' + needHtml(r.need) + '</span>' +
          '<button data-act="make:' + rid + '"' + (ok ? '' : ' disabled') + '>คราฟต์</button>' +
          '</div>';
      }
      h += '</div><div class="hint">กด C ปิด</div>';
      return h;
    },

    toast: function (msg) {
      var t = el('toast');
      if (!t) return;
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(this._tt);
      this._tt = setTimeout(function () { t.classList.remove('show'); }, 1400);
    }
  };

  /* จุดอยู่ในกรอบ 4 จุด (สี่เหลี่ยมใดก็ได้) */
  function inQuad(px, py, a, b, c, d) {
    function sign(x1, y1, x2, y2, x3, y3) {
      return (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
    }
    var d1 = sign(px, py, a.x, a.y, b.x, b.y);
    var d2 = sign(px, py, b.x, b.y, c.x, c.y);
    var d3 = sign(px, py, c.x, c.y, d.x, d.y);
    var d4 = sign(px, py, d.x, d.y, a.x, a.y);
    var neg = (d1 < 0) || (d2 < 0) || (d3 < 0) || (d4 < 0);
    var pos = (d1 > 0) || (d2 > 0) || (d3 > 0) || (d4 > 0);
    return !(neg && pos);
  }

  function itemName(id) {
    var d = id ? DT.ITEMS[id] : null;
    return d ? d.name : '';
  }

  function needHtml(need) {
    var s = '';
    for (var k in need) if (need.hasOwnProperty(k)) {
      s += '<span class="chip">' + DT.ITEMS[k].icon + ' ' + DT.ITEMS[k].name + ' ×' + need[k] + '</span>';
    }
    return s;
  }
  function statBar(label, v, max, color) {
    var pct = Math.max(0, Math.min(100, (v / max) * 100));
    return '<div class="stat"><span class="lbl">' + label + '</span>' +
      '<span class="bar"><span class="fill" style="width:' + pct.toFixed(1) + '%;background:' + color + '"></span></span>' +
      '<span class="num">' + Math.round(v) + '</span></div>';
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function round2(n) { return Math.round(n * 100) / 100; }
})(window);
