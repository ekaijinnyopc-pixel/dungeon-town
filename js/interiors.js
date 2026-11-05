/* =========================================================
   DUNGEON TOWN — interiors (ภายในอาคาร)
   แต่ละอาคารในเมืองมีห้องข้างใน + เฟอร์นิเจอร์ + จุดใช้งาน
   (เตียงนอน / ตู้เก็บของ / เตาหุง / โต๊ะขาย / เตาหลอมแร่)
   ========================================================= */
(function (root) {
  'use strict';
  var DT = root.DT || (root.DT = {});
  var T = DT.TILE;

  /* ---------- นิยามห้อง ----------
     grid: 0 = พื้น, 1 = ผนัง, 2 = ประตูออก
     furniture: { x, y, type, name }
     stations:  { id, name, x, y, action, icon } */
  var DEFS = {
    'โรงตีเหล็ก': {
      id: 'forge', name: 'โรงตีเหล็ก', w: 11, h: 9,
      floor: T.STONE,
      furniture: [
        { x: 2, y: 2, type: 'furnace', name: 'เตาหลอมแร่' },
        { x: 3, y: 2, type: 'anvil', name: 'ทั่งตีเหล็ก' },
        { x: 4, y: 2, type: 'barrel', name: 'ถังน้ำมัน' },
        { x: 8, y: 2, type: 'shelf', name: 'ชั้นวางเครื่องมือ' },
        { x: 9, y: 2, type: 'chest', name: 'ตู้เก็บของ' },
        { x: 2, y: 6, type: 'barrel', name: 'ถังถ่าน' },
        { x: 8, y: 6, type: 'plant', name: 'ต้นไม้ประดับ' }
      ],
      stations: [
        { id: 'forge', name: 'เตาหลอมแร่ (หิน+แร่ → เหล็กก้อน)', x: 2, y: 3, action: 'smelt', icon: '🔥' },
        { id: 'anvil', name: 'ทั่งตีเหล็ก (คราฟต์อาวุธ/เกราะ)', x: 3, y: 3, action: 'craft', icon: '🔨' },
        { id: 'chest', name: 'ตู้เก็บของ', x: 9, y: 3, action: 'chest', icon: '📦' }
      ]
    },
    'ตลาด': {
      id: 'market', name: 'ตลาด', w: 11, h: 9,
      floor: T.PATH,
      furniture: [
        { x: 2, y: 2, type: 'counter', name: 'แผงขายของ' },
        { x: 3, y: 2, type: 'stall', name: 'แผงผัก' },
        { x: 4, y: 2, type: 'stall', name: 'แผงเนื้อ' },
        { x: 7, y: 2, type: 'shelf', name: 'ชั้นของขาย' },
        { x: 8, y: 2, type: 'barrel', name: 'ถังเบียร์' },
        { x: 9, y: 2, type: 'chest', name: 'ตู้เก็บสินค้า' },
        { x: 2, y: 6, type: 'counter', name: 'โต๊ะเสียงดนตรี' },
        { x: 9, y: 6, type: 'plant', name: 'กระถางดอกไม้' }
      ],
      stations: [
        { id: 'counter', name: 'ซื้อ-ขายของ', x: 2, y: 3, action: 'shop', icon: '🪙' },
        { id: 'chest', name: 'ตู้เก็บสินค้า', x: 9, y: 3, action: 'chest', icon: '📦' }
      ]
    },
    'บ้านนักล่า': {
      id: 'house_hunter', name: 'บ้านนักล่า', w: 10, h: 8,
      floor: T.FLOOR,
      furniture: [
        { x: 2, y: 2, type: 'bed', name: 'เตียงนอน' },
        { x: 3, y: 2, type: 'chest', name: 'ตู้เก็บของ' },
        { x: 7, y: 2, type: 'table', name: 'โต๊ะทำงาน' },
        { x: 8, y: 2, type: 'shelf', name: 'ชั้นวางธนู' },
        { x: 7, y: 5, type: 'chair', name: 'เก้าอี้' },
        { x: 2, y: 5, type: 'barrel', name: 'ถังหนังสัตว์' }
      ],
      stations: [
        { id: 'bed', name: 'นอนฟื้น (คืน HP/หิว/ล้า + ข้ามเวลาเป็นเช้า)', x: 2, y: 3, action: 'sleep', icon: '🛏️' },
        { id: 'chest', name: 'ตู้เก็บของ', x: 3, y: 3, action: 'chest', icon: '📦' },
        { id: 'table', name: 'โต๊ะทำงาน (คราฟต์)', x: 7, y: 3, action: 'craft', icon: '🛠️' }
      ]
    },
    'บ้านช่างปลูก': {
      id: 'house_farmer', name: 'บ้านช่างปลูก', w: 10, h: 8,
      floor: T.FLOOR,
      furniture: [
        { x: 2, y: 2, type: 'bed', name: 'เตียงนอน' },
        { x: 3, y: 2, type: 'stove', name: 'เตาหุง' },
        { x: 7, y: 2, type: 'table', name: 'โต๊ะทำอาหาร' },
        { x: 8, y: 2, type: 'shelf', name: 'ชั้นวางผัก' },
        { x: 7, y: 5, type: 'chair', name: 'เก้าอี้' },
        { x: 2, y: 5, type: 'plant', name: 'กระถางผัก' }
      ],
      stations: [
        { id: 'bed', name: 'นอนฟื้น (คืน HP/หิว/ล้า + ข้ามเวลาเป็นเช้า)', x: 2, y: 3, action: 'sleep', icon: '🛏️' },
        { id: 'stove', name: 'เตาหุง (ปรุงอาหาร)', x: 3, y: 3, action: 'cook', icon: '🍲' },
        { id: 'table', name: 'โต๊ะทำอาหาร (คราฟต์)', x: 7, y: 3, action: 'craft', icon: '🛠️' }
      ]
    },
    'บ้านคนเหมือง': {
      id: 'house_miner', name: 'บ้านคนเหมือง', w: 10, h: 8,
      floor: T.FLOOR,
      furniture: [
        { x: 2, y: 2, type: 'bed', name: 'เตียงนอน' },
        { x: 3, y: 2, type: 'chest', name: 'ตู้เก็บของ' },
        { x: 7, y: 2, type: 'table', name: 'โต๊ะคราฟต์' },
        { x: 8, y: 2, type: 'shelf', name: 'ชั้นวางแร่' },
        { x: 7, y: 5, type: 'chair', name: 'เก้าอี้' },
        { x: 2, y: 5, type: 'barrel', name: 'ถังแร่' }
      ],
      stations: [
        { id: 'bed', name: 'นอนฟื้น (คืน HP/หิว/ล้า + ข้ามเวลาเป็นเช้า)', x: 2, y: 3, action: 'sleep', icon: '🛏️' },
        { id: 'chest', name: 'ตู้เก็บของ', x: 3, y: 3, action: 'chest', icon: '📦' },
        { id: 'table', name: 'โต๊ะคราฟต์', x: 7, y: 3, action: 'craft', icon: '🛠️' }
      ]
    }
  };

  /* ---------- สร้างแผนที่ห้อง ---------- */
  function build(def) {
    var w = def.w, h = def.h;
    var grid = new Array(w * h);
    var i, x, y;
    for (i = 0; i < w * h; i++) grid[i] = def.floor || T.FLOOR;
    /* ผนังรอบนอก */
    for (x = 0; x < w; x++) { grid[x] = T.WALL; grid[(h - 1) * w + x] = T.WALL; }
    for (y = 0; y < h; y++) { grid[y * w] = T.WALL; grid[y * w + (w - 1)] = T.WALL; }
    /* ประตูออก (ล่างกลาง) */
    var dx = Math.floor(w / 2);
    grid[(h - 1) * w + dx] = T.PATH;

    var map = {
      w: w, h: h, grid: grid,
      buildings: [],
      isInterior: true
    };
    return {
      def: def,
      map: map,
      furniture: (def.furniture || []).map(function (f) {
        return { x: f.x, y: f.y, type: f.type, name: f.name };
      }),
      stations: (def.stations || []).map(function (s) {
        return { id: s.id, name: s.name, x: s.x, y: s.y, action: s.action, icon: s.icon };
      }),
      spawn: { x: dx, y: h - 2.2 },
      exit: { x: dx, y: h - 1 }
    };
  }

  DT.Interiors = {
    DEFS: DEFS,

    /* ห้องของอาคารนี้ (null = เข้าไม่ได้) */
    forBuilding: function (bd) {
      if (!bd) return null;
      var d = DEFS[bd.name];
      if (!d) return null;
      var built = build(d);
      built.building = bd;
      return built;
    },

    build: build,

    /* จุดใช้งานที่ยืนอยู่ใกล้ (ใช้กด E) */
    stationAt: function (room, x, y) {
      if (!room || !room.stations) return null;
      for (var i = 0; i < room.stations.length; i++) {
        var s = room.stations[i];
        if (DT.dist(s.x + 0.5, s.y + 0.5, x, y) <= 1.3) return s;
      }
      return null;
    },

    /* ใช้ได้ทุกอาคาร */
    has: function (name) { return !!DEFS[name]; }
  };
})(window);
