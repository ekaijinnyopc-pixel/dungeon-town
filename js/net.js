/* =========================================================
   DUNGEON TOWN — multiplayer (Supabase Realtime + fallback localStorage)
   - ตำแหน่งผู้เล่น: Realtime channel 'dungeon-town'
   - เซฟข้อมูลถาวร: ตาราง dungeon_town_players (upsert ทุก 10 วิ)
   - ถ้า Supabase ใช้ไม่ได้ -> fallback localStorage + BroadcastChannel (เล่นคนละแท็บได้)
   ========================================================= */
(function (root) {
  'use strict';
  var DT = root.DT || (root.DT = {});

  var CLIENT_ID = (function () {
    try {
      var id = sessionStorage.getItem('dt:client');
      if (!id) {
        id = 'c' + Math.random().toString(36).slice(2, 9);
        sessionStorage.setItem('dt:client', id);
      }
      return id;
    } catch (e) { return 'c' + Math.random().toString(36).slice(2, 9); }
  })();

  DT.Net = {
    mode: 'offline',
    client: null,
    channel: null,
    peers: {},          // id -> {x,y,name,prof,hp,alive}
    onPeer: null,       // callback
    onParty: null,      // callback ข้อความระบบปาร์ตี้ (js/party.js)

    boot: function () {
      var self = this;
      /* fallback เสมอ: BroadcastChannel ภายในเครื่อง */
      try {
        this.bc = new BroadcastChannel('dungeon-town');
        this.bc.onmessage = function (ev) { self.handleMsg(ev.data); };
      } catch (e) { this.bc = null; }

      if (typeof root.supabase === 'undefined' || !root.supabase.createClient) return;
      try {
        this.client = root.supabase.createClient(DT_SUPABASE_URL, DT_SUPABASE_ANON_KEY, {
          auth: { persistSession: false, autoRefreshToken: false }
        });
      } catch (e) { this.client = null; return; }

      try {
        this.channel = this.client.channel('dungeon-town', {
          config: { broadcast: { self: false } }
        });
        this.channel.on('broadcast', { event: 'state' }, function (payload) {
          self.handleMsg(payload.payload);
        });
        this.channel.on('broadcast', { event: 'chat' }, function (payload) {
          self.handleMsg(payload.payload);
        });
        /* ระบบปาร์ตี้ (js/party.js) */
        this.channel.on('broadcast', { event: 'party' }, function (payload) {
          self.handleMsg(payload.payload);
        });
        this.channel.subscribe(function (status) {
          self.mode = (status === 'SUBSCRIBED') ? 'online' : 'offline';
        });
      } catch (e) { this.channel = null; }
    },

    send: function (msg) {
      msg.id = CLIENT_ID;
      if (this.bc) { try { this.bc.postMessage(msg); } catch (e) {} }
      if (this.channel) {
        try { this.channel.send({ type: 'broadcast', event: msg.t || 'state', payload: msg }); } catch (e) {}
      }
    },

    handleMsg: function (m) {
      if (!m || m.id === CLIENT_ID) return;
      /* ข้อความปาร์ตี้ -> ส่งต่อให้ DT.Party (ไม่ผสมกับ peer state) */
      if (m.t === 'party') {
        if (this.onParty) this.onParty(m);
        return;
      }
      if (m.t === 'chat') {
        if (this.onPeer) this.onPeer(m, true);
        return;
      }
      this.peers[m.id] = m;
      if (this.onPeer) this.onPeer(m, false);
    },

    /* ตรวจว่าตาราง dungeon_town_players มีอยู่จริงไหม
       - ถ้ายังไม่ได้รัน SQL: ปิดการเซฟข้ามเครื่อง แล้วใช้ localStorage แทน
       - ตรวจครั้งเดียวต่อ session เพื่อไม่ให้ยิง error ซ้ำ */
    persistReady: null,   // null = ยังไม่ตรวจ, true/false = ผล
    probePersist: function (cb) {
      var self = this;
      this.probeCount = (this.probeCount || 0) + 1;
      if (!this.client) { this.persistReady = false; cb(false); return; }
      try {
        /* ใช้ GET จริง ๆ (HEAD ไม่มี body -> error อาจเป็น null ทั้งที่ 404)
           -> ตรวจ status === 200 ด้วยเสมอ */
        this.client.from('dungeon_town_players').select('client_id').limit(1)
          .then(function (res) {
            var ok = !res.error && (res.status === 200 || res.status === 204);
            self.persistReady = ok;
            self.lastProbe = { error: res.error ? (res.error.message || res.error.code) : null, status: res.status };
            cb(ok);
          })
          .catch(function () { self.persistReady = false; cb(false); });
      } catch (e) { this.persistReady = false; cb(false); }
    },

    /* บันทึกลง DB (ถ้ามีตาราง) */
    save: function (pl) {
      var self = this;
      if (!this.client || this.persistReady !== true) return;
      if (this.saveBlocked) return;
      try {
        this.client.from('dungeon_town_players').upsert({
          client_id: CLIENT_ID,
          name: pl.name,
          prof: pl.prof,
          x: pl.x, y: pl.y,
          hp: pl.hp, hunger: pl.hunger, stamina: pl.stamina,
          inv: pl.inv,
          weapon: pl.weapon || null,
          armor_id: pl.armorId || null,
          accessory_id: pl.accessoryId || null,
          updated_at: new Date().toISOString()
        }).then(function (res) {
          if (res && res.error) {
            /* ถ้าคอลัมน์อุปกรณ์ยังไม่มีในตาราง -> ลองใหม่โดยไม่มีฟิลด์อุปกรณ์ */
            var msg = (res.error && res.error.message) || '';
            if (/column|weapon|armor|accessory/i.test(msg) && !self._gearFallback) {
              self._gearFallback = true;
              try {
                self.client.from('dungeon_town_players').upsert({
                  client_id: CLIENT_ID,
                  name: pl.name, prof: pl.prof, x: pl.x, y: pl.y,
                  hp: pl.hp, hunger: pl.hunger, stamina: pl.stamina, inv: pl.inv,
                  updated_at: new Date().toISOString()
                }).then(function (r2) {
                  if (r2 && r2.error) { self.saveBlocked = true; self.persistReady = false; }
                }).catch(function () { self.saveBlocked = true; });
              } catch (e) { self.saveBlocked = true; }
              return;
            }
            self.saveBlocked = true; self.persistReady = false;
          }
        }).catch(function () { self.saveBlocked = true; });
      } catch (e) {}
    },

    load: function (cb) {
      var self = this;
      /* เซฟซ้อนในเครื่องเสมอ (ใช้ต่อได้แม้ยังไม่มีตาราง) */
      var local = null;
      try { local = JSON.parse(localStorage.getItem('dt:save:' + CLIENT_ID) || 'null'); } catch (e) {}
      if (local) cb(local);
      else cb(null);

      if (!this.client) return;
      this.probePersist(function (ok) {
        if (!ok) return;
        try {
          self.client.from('dungeon_town_players').select('*')
            .eq('client_id', CLIENT_ID).maybeSingle()
            .then(function (res) { if (res && res.data) cb(res.data); })
            .catch(function () {});
        } catch (e) {}
      });
    },

    /* เซฟลง localStorage (ทำทุกครั้งที่มีอะไรเปลี่ยน) */
    saveLocal: function (pl) {
      try {
        localStorage.setItem('dt:save:' + CLIENT_ID, JSON.stringify({
          name: pl.name, prof: pl.prof, x: pl.x, y: pl.y,
          hp: pl.hp, hunger: pl.hunger, stamina: pl.stamina, inv: pl.inv,
          weapon: pl.weapon || null,
          armorId: pl.armorId || null,
          accessoryId: pl.accessoryId || null
        }));
      } catch (e) {}
    },

    clientId: CLIENT_ID
  };
})(window);
