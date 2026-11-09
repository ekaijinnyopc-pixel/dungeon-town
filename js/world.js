/* =========================================================
   DUNGEON TOWN — โลก: แผนที่เมืองดับดันเจียน, node, มอนส์
   ========================================================= */
(function (root) {
  'use strict';
  var DT = root.DT || (root.DT = {});
  var C = DT.CFG, T = DT.TILE;

  /* ---------- สร้างแผนที่ ---------- */
  function makeMap() {
    var w = C.MAP_W, h = C.MAP_H;
    var g = new Array(w * h);
    for (var i = 0; i < g.length; i++) g[i] = T.GRASS;

    function set(x, y, v) {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      g[y * w + x] = v;
    }
    function rect(x0, y0, x1, y1, v) {
      for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) set(x, y, v);
    }
    function hline(x0, x1, y, v) { for (var x = x0; x <= x1; x++) set(x, y, v); }
    function vline(x, y0, y1, v) { for (var y = y0; y <= y1; y++) set(x, y, v); }

    /* --- ทะเล / ทะเลสาบทางเหนือ --- */
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var edge = (x < 2 || y < 2 || x >= w - 2 || y >= h - 2);
        if (edge) { set(x, y, T.WATER); continue; }
        /* ทะเลสาบรูปหัวใจ */
        var lx = (x - 13) / 7.0, ly = (y - 11) / 5.0;
        if (lx * lx + ly * ly < 1) set(x, y, T.WATER);
      }
    }

    /* --- ถนนหลัก + ถนนแยก --- */
    hline(4, w - 5, 24, T.PATH);
    vline(24, 4, h - 5, T.PATH);
    hline(12, 36, 18, T.PATH);
    vline(16, 18, 30, T.PATH);
    vline(33, 18, 30, T.PATH);

    /* --- พื้นเมือง (ลานกลาง) --- */
    rect(21, 21, 28, 28, T.STONE);

    /* --- ตึกในเมือง: โรงตีเหล็ก / ตลาด / บ้าน 3 หลัง --- */
    function building(x0, y0, bw, bh, doorX, doorY) {
      rect(x0, y0, x0 + bw, y0 + bh, T.FLOOR);
      // กำแพงรอบนอก (เว้นประตู)
      for (var x = x0; x <= x0 + bw; x++) {
        if (!(x === doorX && y0 === doorY)) set(x, y0, T.WALL);
        set(x, y0 + bh, T.WALL);
      }
      for (var y = y0; y <= y0 + bh; y++) {
        if (!(x0 === doorX && y === doorY)) set(x0, y, T.WALL);
        if (!(x0 + bw === doorX && y === doorY)) set(x0 + bw, y, T.WALL);
      }
    }
    /* โรงตีเหล็ก (ซ้ายบน) */
    building(19, 19, 3, 3, 20, 19);
    /* ตลาด (ขวาบน) — ลดขนาดให้เล็กลง เหลือ 2x2 (footprint 3x3) */
    building(28, 19, 2, 2, 29, 19);
    /* บ้านนักล่า */
    building(18, 29, 3, 2, 19, 29);
    /* บ้านช่างปลูก */
    building(28, 29, 3, 2, 29, 29);
    /* บ้านคนเหมือง */
    building(23, 32, 3, 2, 24, 32);

    /* --- ที่นา --- */
    rect(34, 33, 42, 41, T.FIELD);
    /* --- โคมหิน (เหนือ) --- */
    rect(6, 6, 12, 12, T.DIRT);

    /* --- สะพานข้ามทะเลสาบ --- */
    hline(11, 15, 11, T.PATH);

    return {
      w: w, h: h, grid: g,
      buildings: [
        { x: 19, y: 19, w: 4, h: 4, name: 'โรงตีเหล็ก', icon: '🔨', work: true, door: { x: 20, y: 19 },
          sprite: 'objects/mv_bh_large.png' },
        { x: 28, y: 19, w: 3, h: 3, name: 'ตลาด', icon: '🏪', door: { x: 29, y: 19 },
          sprite: 'objects/mv_wh_med.png',
          sign: 'objects/tiny_shop_sign.png', awning: 'objects/tiny_awning.png' },
        { x: 18, y: 29, w: 4, h: 3, name: 'บ้านนักล่า', icon: '🏹', door: { x: 19, y: 29 },
          sprite: 'objects/mv_ww_small_a.png' },
        { x: 28, y: 29, w: 4, h: 3, name: 'บ้านช่างปลูก', icon: '🌾', door: { x: 29, y: 29 },
          sprite: 'objects/mv_wh_small_a.png' },
        { x: 23, y: 32, w: 4, h: 3, name: 'บ้านคนเหมือง', icon: '⛏️', door: { x: 24, y: 32 },
          sprite: 'objects/mv_bw_small_a.png' },
      ]
    };
  }

  /* ---------- สร้าง node เก็บทรัพยากร ---------- */
  function makeNodes(map) {
    var nodes = [], id = 0;
    function put(type, x, y) {
      var def = DT.NODES[type];
      nodes.push({
        id: 'n' + (id++), type: type, x: x, y: y,
        amount: def.amount, max: def.amount,
        cd: 0, respawn: 0
      });
    }
    var w = map.w, h = map.h;
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var t = map.grid[y * w + x];
        if (t === T.WATER || t === T.WALL || t === T.FLOOR) continue;
        var r = DT.rand();
        /* easter egg: จิ้าจอก Platino ซ่อนอยู่ในป่าเหนือ (license DawnLike
           บังคับให้ต้องใช้ + ซ่อนตัวนี้) — อยู่ไกลจากเมือง ต้องเดินไปหาเอง */
        if (x === 7 && y === 41) { put('platino', x, y); continue; }
        if (t === T.FIELD) { if (r < 0.30) put('bush', x, y); continue; }
        if (t === T.DIRT) { if (r < 0.22) put('ore', x, y); else if (r < 0.34) put('rock', x, y); continue; }
        /* ป่า/ทุ่ง */
        if (r < 0.085) put('tree', x, y);
        else if (r < 0.115) put('rock', x, y);
        else if (r < 0.145) put('bush', x, y);
      }
    }
    return nodes;
  }

  /* ---------- สุ่มแบบ deterministic ---------- */
  var _seed = 20261103;
  DT.seedRand = function (s) { _seed = (s || 20261103) >>> 0; };
  DT.rand = function () {
    _seed = (_seed * 1664525 + 1013904223) >>> 0;
    return _seed / 4294967296;
  };

  /* ---------- สร้างมอนส์ ---------- */
  function makeMobs() { return []; }

  /* ---------- สร้างวัตถุในโลก ---------- */
  DT.World = {
    create: function () {
      DT.seedRand(20261103);
      var map = makeMap();
      var world = {
        map: map,
        nodes: makeNodes(map),
        mobs: makeMobs(),
        npcs: (DT.NPCS || []).map(function (n) {
          /* ต้อง copy 'sprite' ด้วย ไม่งั้น NPC จะวาดเป็น shape-art ทั้งหมด */
          return { id: n.id, name: n.name, icon: n.icon, x: n.x, y: n.y,
                   prof: n.prof, greeting: n.greeting, sprite: n.sprite,
                   tint: n.tint, bubble: 0 };
        }),
        campfires: [],
        drops: [],
        particles: [],
        weather: 'clear',       // clear | rain | fog
        weatherT: 0,
        time: C.DAY_START,     // 0..1 ของวัน
        day: 1,
        tickAcc: 0
      };
      /* ---------- Boss 3 ตัว (CraftPix Pirate Boss Pack) ----------
         เกิดคงที่นอกเมือง 1 ตัว/จุด ตอนกลางคืน (ไม่เกิดซ้ำจนกว่าจะตาย) */
      world.BOSS_SPOTS = [
        { type: 'pirate_leader', x: 14.5, y: 37.5 },
        { type: 'squidman',      x: 38.5, y: 37.5 },
        { type: 'pirate_zombie', x: 40.5, y: 10.5 }
      ];
      world.spawnBosses = function () {
        for (var bi = 0; bi < world.BOSS_SPOTS.length; bi++) {
          var spot = world.BOSS_SPOTS[bi];
          var exists = false;
          for (var mi = 0; mi < world.mobs.length; mi++) {
            if (world.mobs[mi].type === spot.type) { exists = true; break; }
          }
          if (exists) continue;
          var bd = DT.MOBS[spot.type];
          if (!bd) continue;
          world.mobs.push({
            id: 'boss_' + spot.type,
            type: spot.type, x: spot.x, y: spot.y,
            hp: bd.hp, maxHp: bd.hp,
            dmg: bd.dmg, speed: bd.speed,
            cd: 0, hitFlash: 0, swing: 0,
            boss: true
          });
        }
      };

      world.spawnNight = function () {
        // เฉพาะกลางคืน
        if (!DT.isNight(world.time)) return;
        var cap = 6 + Math.min(10, world.day * 2);
        if (world.mobs.length >= cap) return;
        /* เลือกชนิดตามน้ำหนัก (wraith เกิดกลางคืนเท่านั้น) */
        var pool = [], total = 0;
        for (var k in DT.MOBS) {
          if (!DT.MOBS.hasOwnProperty(k)) continue;
          var d = DT.MOBS[k];
          if (d.night && !DT.isNight(world.time)) continue;
          pool.push(k); total += d.spawnWeight;
        }
        if (!pool.length) return;
        var r = DT.rand() * total, acc = 0, key = pool[0];
        for (var i = 0; i < pool.length; i++) {
          acc += DT.MOBS[pool[i]].spawnWeight;
          if (r <= acc) { key = pool[i]; break; }
        }
        /* เกิดรอบนอกเมือง (ปลอดภัยในรัศมี TOWN_RADIUS) */
        var x, y, tries = 0, cx = C.MAP_W / 2, cy = C.MAP_H / 2;
        do {
          x = 3 + DT.rand() * (map.w - 6);
          y = 3 + DT.rand() * (map.h - 6);
          tries++;
        } while (tries < 60 && DT.dist(x, y, cx, cy) < C.TOWN_RADIUS + 3);
        var def = DT.MOBS[key];
        world.mobs.push({
          id: 'm' + Math.random().toString(36).slice(2, 8),
          type: key, x: x, y: y,
          hp: def.hp, maxHp: def.hp,
          dmg: def.dmg, speed: def.speed,
          cd: 0, hitFlash: 0, target: null, swing: 0
        });
      };
      return world;
    },

    /* เดินได้ไหม */
    walkable: function (map, x, y) {
      var tx = Math.floor(x), ty = Math.floor(y);
      if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return false;
      return DT.WALKABLE[map.grid[ty * map.w + tx]] === true;
    },

    /* อาคารที่ตำแหน่งนี้อยู่ (ใช้เช็คจุดคราฟต์) */
    buildingAt: function (map, x, y) {
      for (var i = 0; i < map.buildings.length; i++) {
        var b = map.buildings[i];
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
      }
      return null;
    },

    /* อัปเดตมอนส์ + เวลา */
    update: function (world, dt, players) {
      world.time += dt / C.DAY_LENGTH;
      while (world.time >= 1) { world.time -= 1; world.day++; }
      world.tickAcc += dt;
      if (world.tickAcc > 2) {
        world.tickAcc = 0;
        world.spawnNight();
        if (DT.isNight(world.time)) world.spawnBosses();
      }

      /* สภาพอากาศเปลี่ยนเป็นครั้งคราว */
      world.weatherT -= dt;
      if (world.weatherT <= 0) {
        world.weatherT = 25 + DT.rand() * 45;
        var r = DT.rand();
        world.weather = (r < C.WEATHER_CHANCE * 0.6) ? 'rain' : ((r < C.WEATHER_CHANCE) ? 'fog' : 'clear');
      }

      /* กองไฟใช้ได้เวลา (เป็นที่พัก/กันมอนส์) */
      for (var cf = world.campfires.length - 1; cf >= 0; cf--) {
        var fire = world.campfires[cf];
        fire.life -= dt;
        if (fire.life <= 0) { world.campfires.splice(cf, 1); continue; }
        if (DT.rand() < dt * 12) {
          world.particles.push({
            x: fire.x + (DT.rand() - 0.5) * 0.3, y: fire.y + (DT.rand() - 0.5) * 0.3,
            vx: 0, vy: -0.7, t: 0, life: 1.1, c: '#ffb347', r: 2
          });
        }
      }

      /* node เติมกลับ */
      for (var i = 0; i < world.nodes.length; i++) {
        var n = world.nodes[i];
        if (n.amount <= 0) {
          n.respawn -= dt;
          if (n.respawn <= 0) { n.amount = n.max; n.respawn = 0; }
        }
      }

      /* มอนส์ไล่ผู้เล่นใกล้ */
      for (var m = 0; m < world.mobs.length; m++) {
        var mob = world.mobs[m];
        if (mob.hitFlash > 0) mob.hitFlash -= dt;
        if (mob.swing > 0) mob.swing -= dt * 3;
        mob.cd -= dt;
        var best = null, bestD = 9;
        for (var p = 0; p < players.length; p++) {
          var pl = players[p];
          if (!pl.alive) continue;
          var d = DT.dist(mob.x, mob.y, pl.x, pl.y);
          if (d < bestD) { bestD = d; best = pl; }
        }
        mob.target = best;
        if (best && bestD < 7) {
          var sp = mob.speed * (DT.isNight(world.time) ? 1.15 : 0.75);
          var dx = best.x - mob.x, dy = best.y - mob.y;
          var len = Math.sqrt(dx * dx + dy * dy) || 1;
          var nx = mob.x + (dx / len) * sp * dt;
          var ny = mob.y + (dy / len) * sp * dt;
          if (DT.World.walkable(world.map, nx, mob.y)) mob.x = nx;
          if (DT.World.walkable(world.map, mob.x, ny)) mob.y = ny;
          if (bestD < 1.0 && mob.cd <= 0) {
            mob.cd = 1.1;
            mob.swing = 1;
            var armor = best.armor || 0;
            var real = Math.max(1, mob.dmg - armor);
            best.hp -= real;
            best.hurtFlash = 0.35;
            if (best.hp <= 0) { best.hp = 0; best.alive = false; best.respawnT = 6; }
          }
        }
      }
    },

    /* particle/drop หมดอายุ */
    updateFx: function (world, dt) {
      for (var i = world.drops.length - 1; i >= 0; i--) {
        var d = world.drops[i];
        d.t += dt;
        if (d.t > 60) world.drops.splice(i, 1);
      }
      /* particle อัปเดตโดย DT.FX (รองรับ leaf/ข้อความลอย/แรงโน้มถ่วงแยก) */
      if (root.DT.FX) DT.FX.update(world, dt);
      else {
        for (var j = world.particles.length - 1; j >= 0; j--) {
          var p = world.particles[j];
          p.t += dt;
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.vy += 6 * dt;
          if (p.t > p.life) world.particles.splice(j, 1);
        }
      }
    }
  };
})(window);
