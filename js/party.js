/* =========================================================
   DUNGEON TOWN — ระบบปาร์ตี้ (สูงสุด 4 คน)
   - สื่อสารผ่านชั้น multiplayer: DT.Net.send({ t:'party', op:'...' })
   - op: invite / accept / decline / leave / sync / update (บวก reject ที่ใช้ภายใน)
   - DT.Party.members[0] คือตัวเองเสมอ, สมาชิกคนอื่นเรียงต่อท้าย
   - DT.Party.invites = คำเชิญที่ "เรา" ได้รับและยังไม่ตอบ
   หมายเหตุ: ถ้าเล่นผ่าน Supabase Realtime ต้องมีการ subscribe event 'party'
     ใน net.js (ดู comment ใน DT.Party.init)
   ========================================================= */
(function (root) {
  'use strict';
  var DT = root.DT || (root.DT = {});

  function randId() {
    return 'i' + Math.random().toString(36).slice(2, 9);
  }

  function num(v, dflt) {
    return (typeof v === 'number' && isFinite(v)) ? v : dflt;
  }

  function cloneMember(m) {
    return {
      id: m.id,
      name: m.name || 'ผู้เล่น',
      prof: m.prof || 'miner',
      level: num(m.level, 1),
      hp: num(m.hp, 0),
      maxHp: num(m.maxHp, 100),
      alive: m.alive !== false
    };
  }

  DT.Party = {
    MAX: 4,                 // จำนวนสมาชิกสูงสุด (รวมตัวเอง)
    members: [],            // [{id,name,prof,level,hp,maxHp,alive}] ตัวเองคนแรก
    invites: [],            // [{id,name,prof,from,leader,count}] คำเชิญที่รอตอบ
    onChange: null,         // callback เมื่อสถานะปาร์ตี้เปลี่ยน
    leader: null,           // id ของหัวหน้าปาร์ตี้ (null = อยู่คนเดียว)
    outgoing: {},           // pid ที่เราส่งคำเชิญไปแล้ว (กันส่งซ้ำ)
    selfOverride: null,     // ผู้เรียก setSelf() ใช้ override ข้อมูลตัวเอง
    lastReason: '',

    /* ---------- ข้อมูลตัวเอง ---------- */
    selfId: function () {
      try {
        if (this.selfOverride && this.selfOverride.id) return this.selfOverride.id;
        if (root.DT && root.DT.Net && root.DT.Net.clientId) return root.DT.Net.clientId;
      } catch (e) {}
      return 'self';
    },

    selfInfo: function () {
      var info = {
        id: this.selfId(), name: 'ผู้เล่น', prof: 'miner',
        level: 1, hp: 100, maxHp: 100, alive: true
      };
      var L = null;
      try { L = (root.DT && root.DT.Game && root.DT.Game.local) ? root.DT.Game.local : null; } catch (e) {}
      if (L) {
        if (L.name) info.name = L.name;
        if (L.prof) info.prof = L.prof;
        info.level = num(L.level, info.level);
        info.hp = num(L.hp, info.hp);
        info.maxHp = num(L.maxHp, info.maxHp);
        info.alive = L.alive !== false;
      }
      if (this.selfOverride) {
        for (var k in this.selfOverride) {
          if (Object.prototype.hasOwnProperty.call(this.selfOverride, k)) info[k] = this.selfOverride[k];
        }
        info.id = this.selfOverride.id || info.id;
      }
      return info;
    },

    setSelf: function (info) {
      this.selfOverride = info || null;
      this.refreshSelf();
      this._changed('set-self');
    },

    selfEntry: function () {
      return cloneMember(this.selfInfo());
    },

    /* อัปเดตข้อมูลตัวเองใน roster (เลือด/เลเวล/ชื่อ) */
    refreshSelf: function () {
      if (!this.members.length) this.members.push(this.selfEntry());
      else this.members[0] = this.selfEntry();
      return this.members[0];
    },

    /* ---------- คำถามเกี่ยวกับสมาชิก ---------- */
    isMember: function (id) {
      if (!id) return false;
      for (var i = 0; i < this.members.length; i++) {
        if (this.members[i].id === id) return true;
      }
      return false;
    },

    /* "อยู่ปาร์ตี้เดียวกับฉัน" = สมาชิกคนอื่น (ไม่นับตัวเอง) */
    isInParty: function (id) {
      if (!id || id === this.selfId()) return false;
      return this.isMember(id);
    },

    leaderId: function () {
      if (this.leader) return this.leader;
      if (this.members.length > 1) return this.members[0].id;
      return null;
    },

    /* ข้อมูลสมาชิกทั้งหมด (สำเนา — แก้ที่ DT.Party.members เท่านั้น) */
    membersInfo: function () {
      this.refreshSelf();
      var out = [];
      for (var i = 0; i < this.members.length; i++) out.push(cloneMember(this.members[i]));
      return out;
    },

    /* ---------- การสื่อสาร ---------- */
    send: function (msg) {
      var net = root.DT && root.DT.Net;
      if (!net || typeof net.send !== 'function') return false;
      msg = msg || {};
      msg.t = 'party';
      try {
        net.send(msg);          /* net.js จะเติม msg.id = CLIENT_ID ให้เอง */
      } catch (e) {
        return false;
      }
      return true;
    },

    /* ผูก callback ของชั้น net + เตรียมตัวเอง */
    init: function () {
      this.refreshSelf();
      try {
        if (root.DT && root.DT.Net) {
          root.DT.Net.onParty = function (m) { DT.Party.handleMsg(m); };
        }
      } catch (e) {}
      this._changed('init');
      return this;
    },

    /* ---------- การเชิญ / ตอบรับ ---------- */
    invite: function (peerId, peerName) {
      if (!peerId) return false;
      if (this.isMember(peerId)) return false;                 /* อยู่ปาร์ตี้แล้ว */
      if (this.outgoing[peerId]) return false;                 /* ส่งไปแล้ว ยังไม่ตอบ */
      if (this.members.length >= this.MAX) return false;       /* ปาร์ตี้เต็ม */

      var info = this.selfInfo();
      this.outgoing[peerId] = true;
      this.send({
        op: 'invite', to: peerId, pid: peerId,
        name: info.name, prof: info.prof,
        level: info.level, hp: info.hp, maxHp: info.maxHp, alive: info.alive,
        count: this.members.length, leader: this.leaderId()
      });
      this._changed('invite-sent');
      return true;
    },

    accept: function (inviteId) {
      var inv = this._findInvite(inviteId);
      if (!inv) return false;
      /* ปาร์ตี้เดียวต่อ 1 คน */
      if (this.members.length > 1) { this.decline(inviteId); return false; }
      /* ปาร์ตี้เต็ม -> รับคำเชิญไม่ได้ */
      if (num(inv.count, 1) >= this.MAX) { this.decline(inviteId); return false; }

      this._removeInvite(inviteId);
      this._cancelOutgoing();

      var leaderId = inv.leader || inv.from;
      if (!this.isMember(leaderId)) {
        this.members.push({
          id: leaderId, name: inv.name || 'ผู้เล่น', prof: inv.prof || 'miner',
          level: 1, hp: 100, maxHp: 100, alive: true
        });
      }
      this.leader = leaderId;

      var info = this.selfInfo();
      this.send({
        op: 'accept', to: leaderId, pid: this.selfId(),
        name: info.name, prof: info.prof,
        level: info.level, hp: info.hp, maxHp: info.maxHp, alive: info.alive
      });
      /* ขอรายชื่อสมาชิกทั้งปาร์ตี้จากหัวหน้า */
      this.send({ op: 'sync', to: leaderId });
      this._changed('accept');
      return true;
    },

    decline: function (inviteId) {
      var inv = this._findInvite(inviteId);
      if (!inv) return false;
      this._removeInvite(inviteId);
      this.send({ op: 'decline', to: inv.from, reason: 'decline' });
      this._changed('decline');
      return true;
    },

    leave: function () {
      var myId = this.selfId();
      if (this.members.length <= 1) { this._changed('leave-solo'); return false; }
      var next = null;
      for (var i = 0; i < this.members.length; i++) {
        if (this.members[i].id !== myId) { next = this.members[i].id; break; }
      }
      this.members = [this.selfEntry()];
      this.leader = null;
      this.outgoing = {};
      this.invites = [];
      this.send({ op: 'leave', to: null, pid: myId, next: next });
      this._changed('leave');
      return true;
    },

    /* ส่งสถานะตัวเอง (เลือด/เลเวล) ให้สมาชิกทราบ */
    updateSelf: function () {
      this.refreshSelf();
      var info = this.selfInfo();
      for (var i = 1; i < this.members.length; i++) {
        this.send({
          op: 'update', to: this.members[i].id,
          name: info.name, prof: info.prof,
          level: info.level, hp: info.hp, maxHp: info.maxHp, alive: info.alive
        });
      }
      this._changed('update-self');
      return true;
    },

    /* ---------- รับข้อความจากชั้น net ---------- */
    handleMsg: function (m) {
      if (!m || m.t !== 'party' || !m.op) return;
      var myId = this.selfId();
      if (m.id && m.id === myId) return;         /* ข้อความจากตัวเอง */
      if (m.to && m.to !== myId) return;          /* ไม่ได้ถูกส่งให้เรา */

      switch (m.op) {
        case 'invite': this._onInvite(m); break;
        case 'accept': this._onAccept(m); break;
        case 'decline': this._onDecline(m); break;
        case 'leave': this._onLeave(m); break;
        case 'sync': this._onSync(m); break;
        case 'update': this._onUpdate(m); break;
        case 'reject': this._onReject(m); break;
        default: break;
      }
    },

    /* ---------- ตัวช่วยภายใน ---------- */
    _indexOf: function (id) {
      for (var i = 0; i < this.members.length; i++) {
        if (this.members[i].id === id) return i;
      }
      return -1;
    },

    _findInvite: function (inviteId) {
      for (var i = 0; i < this.invites.length; i++) {
        if (this.invites[i].id === inviteId) return this.invites[i];
      }
      return null;
    },

    _removeInvite: function (inviteId) {
      for (var i = 0; i < this.invites.length; i++) {
        if (this.invites[i].id === inviteId) { this.invites.splice(i, 1); return true; }
      }
      return false;
    },

    _cancelOutgoing: function () {
      for (var k in this.outgoing) {
        if (!Object.prototype.hasOwnProperty.call(this.outgoing, k)) continue;
        this.send({ op: 'decline', to: k, reason: 'joined' });
        this.outgoing[k] = false;
      }
      this.outgoing = {};
    },

    _roster: function () {
      var out = [];
      for (var i = 0; i < this.members.length; i++) out.push(cloneMember(this.members[i]));
      return out;
    },

    _broadcastSync: function () {
      var roster = this._roster();
      var leader = this.leaderId();
      for (var i = 0; i < this.members.length; i++) {
        if (this.members[i].id === this.selfId()) continue;
        this.send({ op: 'sync', to: this.members[i].id, members: roster, leader: leader });
      }
    },

    _mergeRoster: function (list, leader) {
      var myId = this.selfId();
      var out = [this.selfEntry()];
      for (var i = 0; i < list.length; i++) {
        if (!list[i] || !list[i].id || list[i].id === myId) continue;
        out.push(cloneMember(list[i]));
      }
      /* สมาชิกที่มีในเครื่องแต่ไม่มีในรายชื่อใหม่ -> เก็บไว้กันหลุด */
      for (var k = 0; k < this.members.length; k++) {
        var cur = this.members[k];
        if (!cur || cur.id === myId) continue;
        var found = false;
        for (var q = 0; q < out.length; q++) {
          if (out[q].id === cur.id) { found = true; break; }
        }
        if (!found) out.push(cloneMember(cur));
      }
      this.members = out;
      if (leader) this.leader = leader;
      if (this.members.length <= 1) this.leader = null;   /* อยู่คนเดียว = ไม่มีหัวหน้า */
      this.refreshSelf();
    },

    /* ---------- handler ของแต่ละ op ---------- */
    _onInvite: function (m) {
      var myId = this.selfId();
      if (m.pid && m.pid !== myId) return;        /* เชิญผิดคน */
      /* ปาร์ตี้เดียวต่อ 1 คน -> ปฏิเสธทันที */
      if (this.members.length > 1) {
        this.send({ op: 'decline', to: m.id, reason: 'busy' });
        this._changed('invite-busy');
        return;
      }
      /* กันคำเชิญซ้ำจากคนเดิม */
      for (var i = this.invites.length - 1; i >= 0; i--) {
        if (this.invites[i].from === m.id) this.invites.splice(i, 1);
      }
      this.invites.push({
        id: randId(),
        name: m.name || 'ผู้เล่น',
        prof: m.prof || 'miner',
        from: m.id || (m.pid || myId),
        leader: m.leader || m.id,
        count: num(m.count, 1)
      });
      this._changed('invite');
    },

    _onAccept: function (m) {
      var myId = this.selfId();
      var who = m.pid || m.id;
      if (!who) return;

      /* ถ้าเราไม่ใช่หัวหน้า -> ส่งต่อให้หัวหน้าจริง */
      if (this.leader && this.leader !== myId) {
        this.send({
          op: 'accept', to: this.leader, pid: who,
          name: m.name, prof: m.prof,
          level: num(m.level, 1), hp: num(m.hp, 0), maxHp: num(m.maxHp, 100), alive: m.alive !== false
        });
        return;
      }
      /* ปาร์ตี้เต็ม -> ปฏิเสธ */
      if (this.members.length >= this.MAX) {
        this.send({ op: 'reject', to: who, reason: 'full', leader: myId });
        this._changed('accept-full');
        return;
      }
      var entry = cloneMember({
        id: who, name: m.name, prof: m.prof,
        level: m.level, hp: m.hp, maxHp: m.maxHp, alive: m.alive
      });
      var idx = this._indexOf(who);
      if (idx >= 0) this.members[idx] = entry;
      else this.members.push(entry);

      if (this.members.length > 1 && !this.leader) this.leader = this.members[0].id;
      this._broadcastSync();
      this._changed('accept');
    },

    _onDecline: function (m) {
      if (m.id && this.outgoing[m.id]) {
        this.outgoing[m.id] = false;
        delete this.outgoing[m.id];
        this._changed('decline-received');
      }
    },

    _onLeave: function (m) {
      var who = m.pid || m.id;
      if (!who || who === this.selfId()) return;
      var idx = this._indexOf(who);
      if (idx < 0) return;
      this.members.splice(idx, 1);
      if (this.leader === who) {
        this.leader = m.next || (this.members.length ? this.members[0].id : null);
      }
      if (this.members.length <= 1) this.leader = null;   /* เหลือคนเดียว = ไม่มีหัวหน้า */
      this.refreshSelf();
      this._broadcastSync();
      this._changed('leave');
    },

    _onSync: function (m) {
      if (m.members && m.members.length) {
        this._mergeRoster(m.members, m.leader);
        this._changed('sync');
        return;
      }
      /* คำขอรายชื่อ -> ตอบถ้าเราเป็นหัวหน้า */
      var myId = this.selfId();
      if (this.leaderId() === myId) {
        this.send({
          op: 'sync', to: m.id, members: this._roster(), leader: this.leaderId()
        });
      }
    },

    _onUpdate: function (m) {
      var who = m.pid || m.id;
      if (!who || who === this.selfId()) return;
      var idx = this._indexOf(who);
      if (idx < 0) return;
      var e = this.members[idx];
      if (m.name) e.name = m.name;
      if (m.prof) e.prof = m.prof;
      e.level = num(m.level, e.level);
      e.hp = num(m.hp, e.hp);
      e.maxHp = num(m.maxHp, e.maxHp);
      e.alive = (typeof m.alive === 'boolean') ? m.alive : e.alive;
      this._changed('update');
    },

    _onReject: function (m) {
      var lid = m.leader || null;
      if (lid) {
        var idx = this._indexOf(lid);
        if (idx > 0) this.members.splice(idx, 1);
        if (this.leader === lid) this.leader = null;
      }
      if (this.members.length <= 1) this.leader = null;
      this.refreshSelf();
      this._changed('reject');
    },

    _changed: function (reason) {
      this.lastReason = reason || '';
      if (typeof this.onChange === 'function') {
        try { this.onChange(); } catch (e) {}
      }
    }
  };

  /* เริ่มต้น: มีตัวเองเป็นสมาชิกคนแรกเสมอ */
  DT.Party.refreshSelf();
})(window);
