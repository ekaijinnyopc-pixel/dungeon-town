/* =========================================================
   DUNGEON TOWN — effects (particles, floating text, screen shake)
   ========================================================= */
(function (root) {
  'use strict';
  var DT = root.DT || (root.DT = {});

  /* ค่า shake ปัจจุบัน (renderer อ่านไปเลื่อนกล้อง) */
  var shakeAmt = 0;

  function push(world, p) {
    if (!world || !world.particles) return;
    world.particles.push(p);
  }

  DT.FX = {
    /* ---------- particle burst ----------
       ตัวอย่าง: DT.FX.burst(world, x, y, '#ffd166', 8) */
    burst: function (world, x, y, color, n, opts) {
      opts = opts || {};
      n = n || 6;
      var spd = opts.speed || 2.2;
      var life = opts.life || 0.55;
      var r = opts.r || 3;
      for (var i = 0; i < n; i++) {
        var a = (Math.PI * 2 * i) / n + Math.random() * 0.7;
        var s = spd * (0.5 + Math.random() * 0.8);
        push(world, {
          x: x, y: y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s * 0.6 - (opts.up || 0.8),
          t: 0, life: life * (0.7 + Math.random() * 0.6),
          c: color, r: r * (0.7 + Math.random() * 0.7)
        });
      }
    },

    /* ---------- ข้อความลอย (ตัวเลขดาเมจ / +XP / ของได้) ---------- */
    text: function (world, x, y, str, color, opts) {
      opts = opts || {};
      push(world, {
        x: x, y: y,
        vx: (Math.random() - 0.5) * 0.6,
        vy: opts.vy === undefined ? -1.8 : opts.vy,
        t: 0, life: opts.life || 1.1,
        c: color || '#ffffff',
        r: 0, text: true,
        label: str
      });
    },

    /* ---------- เสียงหายใบต้นไม้ ---------- */
    leaves: function (world, x, y) {
      for (var i = 0; i < 4; i++) {
        push(world, {
          x: x + (Math.random() - 0.5) * 0.5,
          y: y + (Math.random() - 0.5) * 0.5,
          vx: (Math.random() - 0.5) * 1.2,
          vy: -0.4 - Math.random() * 0.6,
          t: 0, life: 1.4 + Math.random(),
          c: Math.random() < 0.5 ? '#7fc76a' : '#a8d97a',
          r: 2.4, leaf: true
        });
      }
    },

    /* ---------- ประกายตอนโดนตี ---------- */
    hitSpark: function (world, x, y, color) {
      DT.FX.burst(world, x, y, color || '#ff7a5a', 7, { speed: 3.0, life: 0.32, r: 2.4 });
      DT.FX.shake(3.5);
    },

    /* ---------- ฝุ่นตอนเดิน ---------- */
    stepDust: function (world, x, y) {
      push(world, {
        x: x + (Math.random() - 0.5) * 0.3, y: y + (Math.random() - 0.5) * 0.3,
        vx: (Math.random() - 0.5) * 0.5, vy: -0.3,
        t: 0, life: 0.4, c: 'rgba(220,210,190,0.75)', r: 1.8
      });
    },

    /* ---------- ประกายเลเวลขึ้น ---------- */
    levelUp: function (world, x, y) {
      var cols = ['#ffd166', '#8ce99a', '#74c0fc', '#e599f7'];
      for (var i = 0; i < 18; i++) {
        push(world, {
          x: x, y: y,
          vx: Math.cos(i * 0.7) * 1.6,
          vy: Math.sin(i * 0.7) * 1.2 - 1.6,
          t: 0, life: 0.9 + Math.random() * 0.4,
          c: cols[i % cols.length], r: 3
        });
      }
      DT.FX.text(world, x, y - 0.4, 'LEVEL UP!', '#ffd166', { life: 1.5, vy: -1.1 });
    },

    /* ---------- ประกายเหรียญ/รางวัล ---------- */
    sparkle: function (world, x, y, color) {
      for (var i = 0; i < 8; i++) {
        push(world, {
          x: x, y: y,
          vx: (Math.random() - 0.5) * 2.4,
          vy: -1 - Math.random() * 1.6,
          t: 0, life: 0.7 + Math.random() * 0.4,
          c: color || '#ffd166', r: 2.4
        });
      }
    },

    /* ---------- กองไฟ ---------- */
    ember: function (world, x, y) {
      push(world, {
        x: x + (Math.random() - 0.5) * 0.35,
        y: y + (Math.random() - 0.5) * 0.35,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.9 - Math.random() * 0.8,
        t: 0, life: 0.9 + Math.random() * 0.6,
        c: Math.random() < 0.5 ? '#ff9f43' : '#ffd166', r: 1.8
      });
    },

    /* ---------- หน้าจอสั่น ---------- */
    shake: function (amt) {
      shakeAmt = Math.min(14, Math.max(shakeAmt, amt || 0));
    },
    /* อ่านค่า + ลดลง (renderer เรียกทุกเฟรม) */
    takeShake: function (dt) {
      if (shakeAmt <= 0) return 0;
      var v = shakeAmt;
      shakeAmt = Math.max(0, shakeAmt - dt * 26);
      return v;
    },
    shakeNow: function () { return shakeAmt; },

    /* ---------- อัปเดต particle ทุกเฟรม ---------- */
    update: function (world, dt) {
      if (!world || !world.particles) return;
      var ps = world.particles;
      for (var i = ps.length - 1; i >= 0; i--) {
        var p = ps[i];
        p.t += dt;
        if (p.t >= p.life) { ps.splice(i, 1); continue; }
        p.x += (p.vx || 0) * dt;
        p.y += (p.vy || 0) * dt;
        if (!p.text) {
          p.vy += (p.g === undefined ? 3.2 : p.g) * dt;   /* โน้มถ่วง */
          if (p.leaf) {
            p.vx += Math.sin(p.t * 6) * 0.9 * dt;           /* ใบไม้ลอยลงแกว่ง */
            p.vy *= 0.99;
          }
        }
      }
      /* จำกัดจำนวน particle ไม่ให้ค้างเยอะ */
      if (ps.length > 400) ps.splice(0, ps.length - 400);
    }
  };
})(window);
