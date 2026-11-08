/* =========================================================
   DUNGEON TOWN — art.js : ชุดวาดภาพสไตล์ top-down orthographic (retro RPG)
   - มุมมองแนวตรง (Final Fantasy VI / Dragon Quest) : tile จัตุรัส, ตัวละคร 4 ทิศ
   - รูปทรงกระชับคมชัด ไม่มีเส้นบาง/ไล่สีซับซ้อน (พร้อมขยาย pixelated 2x)
   - ต้นไม้/หิน/พุ่ม/มอนส์ = มุมมองจากบน (top-down)
   - อาคาร = หลังคาเห็นจากบน + ผนังหน้า + ประตู + ป้ายชื่อ
   - ตัวละคร/ต้นไม้/อาคาร วาดด้วย shape ล้วน ไม่ใช้ emoji
   ========================================================= */
(function (root) {
  'use strict';
  var DT = root.DT || (root.DT = {});
  var Art = DT.Art = {};

  /* ---------- สี/ตัวเลขพื้นฐาน ---------- */
  function lerp(a, b, t) { return a + (b - a) * t; }
  Art.lerp = lerp;

  function mix(c1, c2, t) {
    var a = hex(c1), b = hex(c2);
    return 'rgb(' + Math.round(lerp(a[0], b[0], t)) + ',' +
      Math.round(lerp(a[1], b[1], t)) + ',' +
      Math.round(lerp(a[2], b[2], t)) + ')';
  }
  Art.mix = mix;

  function hex(h) {
    if (h[0] !== '#') {
      var m = h.match(/(\d+),(\d+),(\d+)/);
      if (m) return [+m[1], +m[2], +m[3]];
      return [128, 128, 128];
    }
    var n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /* ---------- hash / variant (สุ่มแบบคงที่ตามตำแหน่ง) ---------- */
  Art.hash = function (a, b) {
    var s = Math.sin((a || 0) * 127.1 + (b || 0) * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  Art.variant = function (seed, n) {
    n = n || 1;
    var i = Math.floor(Art.hash(seed, 7.31) * n);
    return ((i % n) + n) % n;
  };

  /* ---------- สภาพแสงตามเวลาในวัน ---------- */
  Art.sunState = function (hour) {
    var h = ((hour == null ? 12 : hour) % 24 + 24) % 24;
    var day = (h >= 6 && h < 18);
    var elev, dir;
    if (day) {
      var t = (h - 6) / 12;
      elev = Math.sin(Math.PI * t);
      dir = (t - 0.5) * 2;              /* -1 = เช้า (เงาไปทางซ้าย) · +1 = เย็น */
    } else {
      elev = 0;
      dir = (h < 6) ? -0.55 : 0.55;
    }
    var len = day ? (0.85 + (1 - elev) * 2.1) : 0.75;
    var warm = (h >= 5 && h < 7) || (h >= 16.5 && h < 19);
    return { elev: elev, dir: dir, len: len, night: !day, warm: warm, hour: h };
  };

  /* ---------- เงาใต้วัตถุ ---------- */
  Art.shadow = function (ctx, sx, sy, rx, z, alpha) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,' + (alpha || 0.25) + ')';
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx * z, rx * 0.5 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  /* ---------- เงาพื้นที่ยืดหดตามเวลาในวัน ---------- */
  Art.groundShadow = function (ctx, sx, sy, rx, z, alpha, hour) {
    var s = Art.sunState(hour);
    var base = rx * z;
    var stretch = s.len;
    var ang = s.dir * 0.30;
    var dx = s.dir * base * 0.42 * (stretch - 0.8);
    var dy = base * 0.20 * (stretch - 0.8);
    ctx.fillStyle = 'rgba(10,16,8,' + (alpha || 0.25).toFixed(3) + ')';
    ctx.beginPath();
    ctx.ellipse(sx + dx, sy + dy, base * (0.66 + 0.40 * stretch), base * 0.46,
      ang, 0, Math.PI * 2);
    ctx.fill();
  };

  /* ================= helpers รูปทรงพื้นฐาน ================= */
  function rrect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function box(ctx, x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  }
  function circle(ctx, x, y, r, c) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  function ell(ctx, x, y, rx, ry, c, rot) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2);
    ctx.fill();
  }
  function poly(ctx, pts, c) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
  }

  /* ---------- สไปรต์ PNG (assets/) : โหลดแบบ lazy + fallback เป็นรูปทรงเดิม ---------- */
  function Spr() { return (root.DT && root.DT.Sprites) || null; }

  /* วาดสไปรต์ยึด "กลางล่าง" ที่ (x,y) (หน่วย local px ตาม transform ปัจจุบัน)
     flip = true -> พลิกแนวนอน (หันซ้าย) · tint = สีย้อม
     คืน true ถ้าวาดได้ / false ถ้าภาพยังไม่โหลด (ให้ผู้เรียก fallback) */
  function drawSprite(ctx, key, x, y, flip, tint, tintA, scaleMul) {
    var S = Spr(); if (!S) return false;
    return S.draw(ctx, key, x, y, flip, tint, tintA, scaleMul);
  }

  /* เรียงสไปรต์เป็นพื้นผิว (หลังคา/ผนัง) */
  function tileSprite(ctx, key, x, y, w, h) {
    var S = Spr(); if (!S) return false;
    return S.tile(ctx, key, x, y, w, h);
  }

  /* เรียงสไปรต์แบบคูณสเกล z (สำหรับอาคารที่วาดด้วยพิกเซลจอจริง) */
  function tileSpriteZ(ctx, key, x, y, w, h, z) {
    if (!(w > 0) || !(h > 0)) return false;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(z, z);
    var ok = tileSprite(ctx, key, 0, 0, w / z, h / z);
    ctx.restore();
    return ok;
  }

  /* ================= ต้นไม้ (มุมมองจากบน) ================= */
  Art.tree = function (ctx, sx, sy, z, t, seed) {
    var v = Art.variant(seed || 0, 4);
    var sway = Math.sin(t * 1.1 + (seed || 0)) * 0.9;

    /* --- สไปรต์ (ถ้าพร้อม) --- */
    /* variant 0 = ทรงพุ่มใบกลม (shape 33x29) -> tree_green_large (ใบกลม)
       variant 1 = ทรงพุ่มใบแฉก (shape 31x26) -> tree_green (ต้นสน)
       variant 2 = ทรงพุ่มใบกลม + ผลไม้        -> tree_gold_round
       variant 3 = ทรงพุ่มใบกลม โทนเข้ม       -> tree_autumn */
    var treeKey = v === 0 ? 'objects/tree_green_large.png'
      : v === 1 ? 'objects/tree_green.png'
      : v === 2 ? 'objects/tree_gold_round.png'
      : 'objects/tree_autumn.png';
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(z, z);
    var treeDrew = drawSprite(ctx, treeKey, 0, 0, false, null, 0);
    ctx.restore();
    if (treeDrew) return;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(z, z);

    if (v === 1) {
      /* --- ต้นสน: พุ่มใบแฉกลักดาย (เห็นจากบน) --- */
      ctx.save();
      ctx.translate(sway * 0.5, -6);
      for (var s = 0; s < 8; s++) {
        var a = (s / 8) * Math.PI * 2 + 0.4;
        var r1 = 17, r2 = 6.5;
        ctx.fillStyle = (s % 2 === 0) ? '#255a2c' : '#2f6f36';
        poly(ctx, [
          [Math.cos(a) * r1, Math.sin(a) * r1 * 0.82],
          [Math.cos(a + 0.32) * r2, Math.sin(a + 0.32) * r2 * 0.82],
          [Math.cos(a - 0.32) * r2, Math.sin(a - 0.32) * r2 * 0.82]
        ], ctx.fillStyle);
      }
      circle(ctx, 0, 0, 7.5, '#3d8842');
      circle(ctx, -2, -2, 4.2, '#4f9b4d');
      ctx.fillStyle = 'rgba(216,240,176,0.30)';
      ctx.beginPath();
      ctx.ellipse(-3, -3.5, 3.2, 2, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.restore();
      return;
    }

    var dark = (v === 3);
    var c1 = dark ? '#1e4f2b' : '#2f6b34';
    var c2 = dark ? '#275f33' : '#3a8239';
    var c3 = dark ? '#33743a' : '#4a9b45';

    ctx.save();
    ctx.translate(sway, -8);

    /* เงาใต้พุ่มใบ (เล็กไว้ใต้ใบ) */
    ell(ctx, 2, 7, 15, 6, 'rgba(10,20,8,0.22)');

    /* ทรงพุ่มใบ (ซ้อนกลม) */
    ell(ctx, 0, 0, 13.5, 12.5, c1);
    ell(ctx, -7.5, 4, 8.5, 7.5, c1);
    ell(ctx, 7.5, 3.5, 8.5, 7.5, c1);
    ell(ctx, 0, -6.5, 10.5, 9.5, c1);

    ell(ctx, 0, -0.5, 11.5, 10.5, c2);
    ell(ctx, -6.5, 3, 7.5, 6.5, c2);
    ell(ctx, 6.5, 2.5, 7.5, 6.5, c2);
    ell(ctx, 0, -6.5, 8.5, 7.5, c2);

    ell(ctx, -1.5, -7.5, 6, 5, c3);
    ell(ctx, 3.5, -5.5, 4.5, 4, c3);

    /* ไฮไลต์ด้านบน */
    ctx.fillStyle = 'rgba(224,246,196,0.30)';
    ctx.beginPath();
    ctx.ellipse(-4.5, -9, 4.4, 2.8, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(10,30,14,0.20)';
    ctx.beginPath();
    ctx.ellipse(4, 6, 7, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    /* ผลไม้ (variant ผลไม้) */
    if (v === 2) {
      circle(ctx, -6.5, -2.5, 2, '#d9556b');
      circle(ctx, 4.5, -3, 1.8, '#d9556b');
      circle(ctx, 1.5, 4.5, 1.7, '#d9556b');
      circle(ctx, -8, 1.5, 1.6, '#e2677c');
    }
    ctx.restore();
    ctx.restore();
  };

  /* ผลึกแร่ทับก้อนหิน (ใช้ร่วมกันทั้งโหมดสไปรต์และโหมดรูปทรง) */
  function drawOreGems(ctx) {
    var gems = [
      { x: -5, y: -3, s: 3.2, c: '#f0c04a' },
      { x: 1.5, y: -6, s: 4, c: '#ffd76a' },
      { x: 6, y: -1, s: 2.8, c: '#f0c04a' }
    ];
    for (var g = 0; g < gems.length; g++) {
      var G = gems[g];
      poly(ctx, [
        [G.x, G.y - G.s], [G.x + G.s * 0.75, G.y], [G.x, G.y + G.s * 0.8], [G.x - G.s * 0.75, G.y]
      ], G.c);
      poly(ctx, [
        [G.x, G.y - G.s], [G.x + G.s * 0.75, G.y], [G.x, G.y + G.s * 0.15]
      ], '#ffe89a');
    }
    /* ประกายแสง */
    ctx.fillStyle = 'rgba(255,215,106,0.18)';
    ctx.beginPath(); ctx.arc(1, -3, 13, 0, Math.PI * 2); ctx.fill();
  }

  /* ================= ก้อนหิน / แร่ (มุมมองจากบน) ================= */
  Art.rock = function (ctx, sx, sy, z, ore, seed) {
    var v = Art.variant((seed || 0) * 1.7, 3);

    /* --- สไปรต์ (ถ้าพร้อม) --- */
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(z, z);
    /* หิน: ใช้ก้อนที่แยกเป็นวัตถุเดี่ยว (isolated) เท่านั้น
       - objects/rock_boulder / rock_small ถูกถอดออกเพราะเป็น tile ที่ภาพ
         ชนขอบ (edge bleed) ทำให้ก้อนหินดูเหมือนถูกตัดขาด */
    var rockKey = ore ? 'objects/urban_rock.png'
      : (v === 1 ? 'objects/city_rock.png' : 'objects/urban_rock.png');
    var rockDrew = drawSprite(ctx, rockKey, 0, 0, false, null, 0);
    if (rockDrew && ore) drawOreGems(ctx);
    ctx.restore();
    if (rockDrew) return;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(z, z);

    /* เงาใต้ก้อน */
    ell(ctx, 2.5, 4, 12, 7, 'rgba(10,14,20,0.24)');

    if (ore) {
      /* --- ผลึกแร่บนก้อนหิน (เห็นจากบน) --- */
      poly(ctx, [[-11, 2], [-6, -8], [4, -11], [11, -2], [7, 7], [-6, 8]], '#6e6c78');
      poly(ctx, [[-6, -8], [4, -11], [6, -3], [-3, -2]], '#8f8d9a');
      poly(ctx, [[-11, 2], [-6, -8], [-3, -2], [-4, 5]], '#7b7986');
      drawOreGems(ctx);
      ctx.restore();
      return;
    }

    if (v === 1) {
      /* --- หินแผ่นเตี้ย --- */
      ell(ctx, 0, 0, 13, 9.5, '#7e7e88');
      ell(ctx, -1.5, -2, 10, 6.5, '#9a9aa4');
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      ctx.fillRect(-8, -4.5, 7, 2);
      ctx.restore();
      return;
    }

    if (v === 2) {
      /* --- ก้อนหิน 2-3 ก้อนซ้อน (มองจากบน) --- */
      ell(ctx, -5, 3, 7, 5.5, '#7f7f89');
      ell(ctx, 6, 2, 6, 4.5, '#73737d');
      ell(ctx, 0, -5, 7.5, 6.5, '#9a9aa4');
      ell(ctx, -1.5, -6.5, 5, 4, '#b0b0ba');
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(-4, -9, 5, 1.8);
      ctx.restore();
      return;
    }

    /* --- ก้อนหินมุม (มองจากบน) --- */
    poly(ctx, [[-11, -1], [-5, -10], [5, -11], [11, -3], [8, 7], [-4, 9]], '#8a8a93');
    poly(ctx, [[-5, -10], [5, -11], [7, -4], [-3, -3]], '#a3a3ac');
    poly(ctx, [[-11, -1], [-5, -10], [-3, -3], [-6, 4]], '#7c7c86');
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(-3.5, -8.5, 6, 2);
    ctx.restore();
  };

  /* ================= พุ่มไม้ (มุมมองจากบน) ================= */
  Art.bush = function (ctx, sx, sy, z, t, seed) {
    var v = Art.variant((seed || 0) * 2.3, 3);
    var sway = Math.sin(t * 1.6 + (seed || 0)) * 0.7;

    /* --- สไปรต์ (ถ้าพร้อม) --- */
    /* พุ่ม: ใช้เฉพาะภาพที่เป็น "พุ่มเดี่ยว" ไม่ใช่ tile พื้น
       - objects/grass_flowers เป็น tile พื้นที่มีดอกไม้ (ห้ามใช้เป็นวัตถุลอย)
       - objects/bush_cluster เป็น tile ที่เต็มเฟรม (ห้ามใช้เป็นวัตถุลอย)
       ที่ใช้จริง:
       - objects/bush.png      = Tiny Town 0007 (กอพุ่มเขียวแยกเดี่ยว ตัดขอบสะอาด)
       - objects/bush_gold.png = Tiny Town 0010 (กอพุ่มทอง แยกเดี่ยว)
       - objects/urban_bush.png = Urban 0403 (พุ่มพุ่งสูง ไม่มีลำต้น) */
    /* variant 0 = พุ่มกลมมีผลไม้ (shape 22x18) -> bush (กอพุ่มเตี้ย)
       variant 1 = กอหญ้าสูง      (shape 21x20) -> urban_bush (พุ่มพุ่งสูง)
       variant 2 = พุ่มดอกไม้      (shape 22x19) -> bush_gold */
    var bushKey = v === 0 ? 'objects/bush.png'
      : v === 1 ? 'objects/urban_bush.png'
      : 'objects/bush_gold.png';
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(z, z);
    var bushDrew = drawSprite(ctx, bushKey, 0, 0, false, null, 0);
    ctx.restore();
    if (bushDrew) return;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(z, z);
    ctx.save();
    ctx.translate(sway, -4);

    ell(ctx, 1.5, 5, 10, 5, 'rgba(10,20,8,0.20)');

    if (v === 1) {
      /* --- กอหญ้าสูง (ใบเป็นแท่งแหลม) --- */
      for (var i = 0; i < 7; i++) {
        var a = -0.9 + i * 0.3;
        ctx.fillStyle = (i % 2 === 0) ? '#3f7a38' : '#4d9245';
        poly(ctx, [
          [Math.sin(a) * 9 - 1.6, Math.cos(a) * 6],
          [Math.sin(a) * 9 + 1.6, Math.cos(a) * 6],
          [Math.sin(a) * 13, Math.cos(a) * 13 - 5]
        ], ctx.fillStyle);
      }
      circle(ctx, -2.5, -8, 1.8, '#5da34e');
      circle(ctx, 3, -6.5, 1.5, '#5da34e');
    } else if (v === 2) {
      /* --- พุ่มดอกไม้ --- */
      ell(ctx, 0, 0, 10, 8, '#356f33');
      ell(ctx, -3.5, -3.5, 6, 5, '#488a41');
      ell(ctx, 4, 2.5, 5, 4, '#488a41');
      var petals = ['#e86fa0', '#f2d86a', '#c8a8f0'];
      for (var p = 0; p < 5; p++) {
        var px = -6.5 + p * 3.2, py = -2 - (p % 2) * 3;
        circle(ctx, px, py, 1.6, petals[p % 3]);
        circle(ctx, px, py, 0.7, '#fff3c4');
      }
    } else {
      /* --- พุ่มกลมมีผลไม้ --- */
      ell(ctx, 0, 0, 9.5, 8, '#3a7a38');
      ell(ctx, -3.5, -2.5, 6, 5, '#4f9c47');
      ell(ctx, 4, 2, 4.5, 3.8, '#6bb85e');
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      ctx.beginPath();
      ctx.ellipse(-4.5, -4.5, 2.8, 1.6, -0.4, 0, Math.PI * 2);
      ctx.fill();
      circle(ctx, 2, -3.5, 1.7, '#d9556b');
      circle(ctx, -5, -1, 1.5, '#d9556b');
    }
    ctx.restore();
    ctx.restore();
  };

  /* ---------- หญ้า/ดอกไม้ (ใบเป็นเส้นสั้น) ---------- */
  Art.grassTuft = function (ctx, sx, sy, z, t, seed) {
    var sway = Math.sin(t * 1.4 + (seed || 0)) * 1.0 * z;
    ctx.strokeStyle = '#4e8a45';
    ctx.lineWidth = 1.6 * z;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx - 3 * z, sy);
    ctx.lineTo(sx - 3.5 * z + sway, sy - 6 * z);
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 1 * z + sway, sy - 8 * z);
    ctx.moveTo(sx + 3 * z, sy);
    ctx.lineTo(sx + 3.5 * z + sway, sy - 5 * z);
    ctx.stroke();
  };

  /* ================= ตัวละครผู้เล่น (4 ทิศ) ================= */
  var PROF_STYLE = {
    miner:   { body: '#c98b3a', trim: '#8a5a1e', hair: '#4a3423', skin: '#f6dcc0', hat: 'helm', tint: '#e0a63c' },
    hunter:  { body: '#4aa3d8', trim: '#2b6f9e', hair: '#5a3a22', skin: '#f6dcc0', hat: 'hood', tint: '#5aa8e0' },
    farmer:  { body: '#5fbf6a', trim: '#3d8a46', hair: '#3a2a1a', skin: '#f6dcc0', hat: 'straw', tint: '#6cc070' }
  };

  /* ---------- หัวถูกตามอาชีพ (วาดด้วย canvas, หน่วย = headR) ----------
     (ctx, headX, headY, headR, z, kind, t, dir) */
  Art.hat = function (ctx, hx, hy, hr, z, kind, t, dir) {
    dir = dir || 'down';
    if (kind === 'helm') {
      /* หมวกเหล็กคนเหมือง + ไฟหน้า */
      if (dir === 'up') {
        ctx.fillStyle = '#d8b24a';
        ctx.beginPath(); ctx.arc(hx, hy - hr * 0.15, hr * 1.08, Math.PI * 1.02, Math.PI * 2.02); ctx.fill();
        ctx.fillStyle = '#a8862f';
        ctx.fillRect(hx - hr * 1.1, hy - hr * 0.2, hr * 2.2, hr * 0.4);
        ctx.fillStyle = '#8c6f26';
        ctx.fillRect(hx - hr * 0.3, hy - hr * 1.05, hr * 0.6, hr * 0.9);
      } else if (dir === 'right') {
        ctx.fillStyle = '#d8b24a';
        ctx.beginPath(); ctx.arc(hx - hr * 0.1, hy - hr * 0.15, hr * 1.05, Math.PI * 1.0, Math.PI * 2.05); ctx.fill();
        ctx.fillStyle = '#a8862f';
        ctx.fillRect(hx - hr * 1.15, hy - hr * 0.25, hr * 2.0, hr * 0.36);
        /* ปีกหมวกด้านหน้า */
        ctx.fillStyle = '#c9a23c';
        poly(ctx, [
          [hx + hr * 0.75, hy - hr * 0.3], [hx + hr * 1.35, hy - hr * 0.15],
          [hx + hr * 1.3, hy + hr * 0.25], [hx + hr * 0.7, hy + hr * 0.2]
        ], '#c9a23c');
      } else {
        ctx.fillStyle = '#d8b24a';
        ctx.beginPath(); ctx.arc(hx, hy - hr * 0.18, hr * 1.06, Math.PI * 1.02, Math.PI * 2.02); ctx.fill();
        ctx.fillStyle = '#a8862f';
        ctx.fillRect(hx - hr * 1.1, hy - hr * 0.22, hr * 2.2, hr * 0.36);
        ctx.fillStyle = '#fff3c4';
        circle(ctx, hx, hy - hr * 0.6, hr * 0.3, '#fff3c4');
      }
    } else if (kind === 'hood') {
      /* หมวกคลุมนักล่า + ขนนก */
      if (dir === 'up') {
        ctx.fillStyle = '#3f6f4a';
        ctx.beginPath(); ctx.arc(hx, hy - hr * 0.05, hr * 1.14, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2f5738';
        ctx.beginPath();
        ctx.moveTo(hx - hr * 1.14, hy - hr * 0.05);
        ctx.quadraticCurveTo(hx, hy + hr * 1.5, hx + hr * 1.14, hy - hr * 0.05);
        ctx.lineTo(hx + hr * 0.9, hy - hr * 0.05);
        ctx.quadraticCurveTo(hx, hy + hr * 0.75, hx - hr * 0.9, hy - hr * 0.05);
        ctx.closePath(); ctx.fill();
        /* ขนนกด้านหลัง */
        ctx.strokeStyle = '#d9556b';
        ctx.lineWidth = hr * 0.28;
        ctx.beginPath();
        ctx.moveTo(hx - hr * 0.2, hy - hr * 1.0);
        ctx.quadraticCurveTo(hx - hr * 1.3, hy - hr * 1.7, hx - hr * 0.95, hy - hr * 2.05);
        ctx.stroke();
      } else if (dir === 'right') {
        ctx.fillStyle = '#3f6f4a';
        ctx.beginPath(); ctx.arc(hx - hr * 0.05, hy - hr * 0.05, hr * 1.12, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
        ctx.fillStyle = '#2f5738';
        ctx.beginPath();
        ctx.moveTo(hx - hr * 1.15, hy - hr * 0.1);
        ctx.quadraticCurveTo(hx - hr * 1.3, hy + hr * 0.95, hx - hr * 0.45, hy + hr * 0.75);
        ctx.quadraticCurveTo(hx - hr * 0.95, hy + hr * 0.2, hx - hr * 0.8, hy - hr * 0.2);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#d9556b';
        ctx.lineWidth = hr * 0.26;
        ctx.beginPath();
        ctx.moveTo(hx - hr * 0.35, hy - hr * 1.0);
        ctx.quadraticCurveTo(hx - hr * 1.4, hy - hr * 1.5, hx - hr * 1.15, hy - hr * 1.95);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#3f6f4a';
        ctx.beginPath(); ctx.arc(hx, hy - hr * 0.05, hr * 1.1, Math.PI * 1.0, Math.PI * 2.05); ctx.fill();
        ctx.fillStyle = '#2f5738';
        ctx.beginPath();
        ctx.moveTo(hx - hr * 1.1, hy - hr * 0.1);
        ctx.quadraticCurveTo(hx - hr * 1.3, hy + hr * 0.9, hx - hr * 0.5, hr * 0.7 + hy);
        ctx.quadraticCurveTo(hx - hr * 0.95, hy + hr * 0.2, hx - hr * 0.75, hy - hr * 0.2);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#d9556b';
        ctx.lineWidth = hr * 0.26;
        ctx.beginPath();
        ctx.moveTo(hx + hr * 0.5, hy - hr * 0.85);
        ctx.quadraticCurveTo(hx + hr * 1.3, hy - hr * 1.6, hx + hr * 0.9, hy - hr * 1.9);
        ctx.stroke();
      }
    } else {
      /* หมวกฟางชาวนา */
      if (dir === 'up') {
        ctx.fillStyle = '#c2a84e';
        ctx.beginPath();
        ctx.ellipse(hx, hy - hr * 0.5, hr * 1.3, hr * 0.72, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d9c063';
        ctx.beginPath();
        ctx.ellipse(hx, hy - hr * 0.45, hr * 1.5, hr * 0.36, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (dir === 'right') {
        ctx.fillStyle = '#d9c063';
        ctx.beginPath();
        ctx.ellipse(hx - hr * 0.05, hy - hr * 0.45, hr * 1.3, hr * 0.36, -0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c2a84e';
        ctx.beginPath();
        ctx.ellipse(hx - hr * 0.1, hy - hr * 0.8, hr * 0.72, hr * 0.5, 0, Math.PI, 0);
        ctx.fill();
      } else {
        ctx.fillStyle = '#d9c063';
        ctx.beginPath();
        ctx.ellipse(hx, hy - hr * 0.45, hr * 1.5, hr * 0.36, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c2a84e';
        ctx.beginPath();
        ctx.ellipse(hx, hy - hr * 0.8, hr * 0.78, hr * 0.52, 0, Math.PI, 0);
        ctx.fill();
      }
    }
  };

  /* ---------- อาวุธ (วาดเป็น shape ไม่ใช้ emoji) ---------- */
  function weaponKind(w) {
    if (!w) return null;
    if (w.indexOf('⛏') >= 0) return 'pick';
    if (w.indexOf('🪓') >= 0) return 'axe';
    if (w.indexOf('🗡') >= 0 || w.indexOf('⚔') >= 0) return 'sword';
    if (w.indexOf('🏹') >= 0) return 'bow';
    if (w.indexOf('🕯') >= 0) return 'torch';
    return 'sword';
  }
  function drawWeapon(ctx, kind, swing) {
    if (!kind) return;
    /* อยู่ที่ปลายแขน (0,0) หันขึ้น */
    if (kind === 'sword') {
      ctx.save();
      ctx.rotate(swing ? swing * 1.2 : 0);
      box(ctx, -1, -13, 2.4, 12, '#dfe6ee');
      box(ctx, -1, -13, 1, 12, '#ffffff');
      box(ctx, -3.5, -1.5, 7, 2.2, '#8a6a3a');
      box(ctx, -1, -3.5, 2.4, 2.2, '#d8b24a');
      ctx.restore();
    } else if (kind === 'pick') {
      ctx.save();
      ctx.rotate(swing ? swing * 1.6 : -0.2);
      box(ctx, -1, -14, 2.2, 13, '#8a6230');
      poly(ctx, [[-6, -12], [6, -12], [7, -15], [-7, -15]], '#a8b0bc');
      ctx.restore();
    } else if (kind === 'axe') {
      ctx.save();
      ctx.rotate(swing ? swing * 1.6 : -0.15);
      box(ctx, -1, -14, 2.2, 13, '#8a6230');
      poly(ctx, [[1, -13], [8, -11], [8, -5], [1, -7]], '#c3ccd8');
      poly(ctx, [[1, -13], [5, -11.5], [5, -7], [1, -7]], '#e4ebf3');
      ctx.restore();
    } else if (kind === 'bow') {
      ctx.save();
      ctx.rotate(swing ? swing * 1.0 : 0);
      ctx.strokeStyle = '#8a6230';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, -7, 6.5, -1.15, 1.15);
      ctx.stroke();
      ctx.strokeStyle = '#e8e0c8';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(-4.6, -12.4); ctx.lineTo(-4.6, -1.6);
      ctx.stroke();
      ctx.restore();
    } else if (kind === 'torch') {
      box(ctx, -1, -11, 2.2, 10, '#7a5a34');
      ctx.fillStyle = '#ff9a3c';
      ctx.beginPath();
      ctx.moveTo(-3, -11);
      ctx.quadraticCurveTo(0, -19, 3, -11);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffe27a';
      ctx.beginPath();
      ctx.moveTo(-1.6, -11);
      ctx.quadraticCurveTo(0, -16, 1.6, -11);
      ctx.closePath();
      ctx.fill();
    }
  }

  /* ---------- ตัวละคร (top-down 4 ทิศ) ---------- */
  Art.player = function (ctx, sx, sy, z, opts) {
    opts = opts || {};
    var st = PROF_STYLE[opts.prof] || PROF_STYLE.miner;
    var dir = opts.dir || 'down';
    if (dir !== 'up' && dir !== 'left' && dir !== 'right') dir = 'down';
    var t = opts.t || 0;
    var moving = !!opts.moving;
    var running = !!opts.running;
    var waving = !!opts.waving;
    var hurt = opts.hurt || 0;
    var swing = opts.swing || 0;
    var seed = opts.seed || 0;

    /* ---------- สไปรต์ (ถ้าพร้อม) : 4 ทิศ + idle/เดิน ---------- */
    var custom = opts.sprite;
    var charKey = custom
      ? (dir === 'up' ? 'characters/player_up.png'
        : (dir === 'left' || dir === 'right') ? 'characters/player_side.png'
        : custom)
      : (dir === 'up' ? 'characters/player_up.png'
        : (dir === 'left' || dir === 'right') ? 'characters/player_side.png'
        : 'characters/player_down.png');
    /* เดิน = ขึ้นลงตามจังหวะ · ยืนนิ่ง = หายใจเบาๆ */
    var freq = running ? 15 : 9.5;
    var sprBob = moving ? Math.abs(Math.sin(t * freq)) * (running ? 2.4 : 1.6)
      : Math.sin(t * 2.2) * 0.45;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(z, z);
    if (hurt > 0) ctx.globalAlpha = 0.55;
    var charDrew = drawSprite(ctx, charKey, 0, sprBob, dir === 'left',
      opts.tintSprite === false ? null : st.tint, 0.24);
    if (charDrew) {
      /* เครื่องมือในมือ (วาดทับสไปรต์) */
      var wkind = weaponKind(opts.weapon);
      if (wkind) {
        var handX = dir === 'left' ? -4.6 : 4.6;
        var handY = -16;
        ctx.save();
        ctx.translate(handX, handY);
        var frontArm;
        if (swing > 0) frontArm = -1.45 + swing * 2.5;
        else if (waving) frontArm = -2.25 + Math.sin(t * 8) * 0.25;
        else frontArm = 0.14 + (moving ? Math.sin(t * freq) * 0.35 : 0);
        ctx.rotate(frontArm);
        drawWeapon(ctx, wkind, swing);
        ctx.restore();
      }
      ctx.restore();
      return;
    }
    ctx.restore();

    /* จังหวะเดิน/วิ่ง (หน่วย local px) */
    var step = t * freq;
    var lift = moving ? (running ? 2.2 : 1.1) : 0;      /* ขายกขึ้นลง */
    var bob = moving ? Math.abs(Math.sin(step)) * (running ? 2.0 : 1.1)
                     : Math.sin(t * 2.2) * 0.35;
    var blink = (Math.sin(t * 1.3 + seed) > 0.985) ? 0.2 : 1;

    var legL = moving ? Math.sin(step) * lift : 0;
    var legR = moving ? -Math.sin(step) * lift : 0;
    var armL = moving ? -Math.sin(step) * (running ? 0.55 : 0.30) : 0;
    var armR = moving ? Math.sin(step) * (running ? 0.55 : 0.30) : 0;

    /* สูง/ต่ำของไหล่/หัว */
    var headY = -23 + bob;
    var bodyTop = -17.5 + bob;
    var hr = 5.6;

    ctx.save();
    if (hurt > 0) ctx.globalAlpha = 0.55;
    ctx.translate(sx, sy);
    ctx.scale(z, z);
    if (dir === 'left') { ctx.translate(sx * 0, 0); ctx.scale(-1, 1); }
    /* หันซ้าย = สะท้อนภาพหันขวา */
    var fdir = (dir === 'left') ? 'right' : dir;

    /* ---------- ขา ---------- */
    var legY = -6;
    ctx.fillStyle = st.trim;
    ctx.fillRect(-4.2 + (fdir === 'right' ? 0.6 : 0), legY - legL, 3.6, 6 + legL);
    ctx.fillRect(0.6 - (fdir === 'right' ? 0.6 : 0), legY - legR, 3.6, 6 + legR);
    ctx.fillStyle = '#2b2118';
    ctx.fillRect(-4.6 + (fdir === 'right' ? 0.6 : 0), -1.8, 4, 1.8);
    ctx.fillRect(0.2 - (fdir === 'right' ? 0.6 : 0), -1.8, 4, 1.8);

    /* ---------- แขนหลัง ---------- */
    var backArm = 0.14;
    if (swing > 0) backArm = -0.5 + swing * 0.9;
    else if (waving) backArm = 0.1;
    else backArm += armL;
    ctx.save();
    ctx.translate(-4.6, bodyTop + 1.5);
    ctx.rotate(-backArm);
    ctx.fillStyle = st.trim;
    ctx.fillRect(-1.4, 0, 2.8, 8);
    circle(ctx, 0, 8.2, 2.0, st.skin);
    ctx.restore();

    /* ---------- ตัว (เสื้อ) ---------- */
    ctx.fillStyle = st.body;
    rrect(ctx, -6, bodyTop, 12, 11.5, 2.4);
    ctx.fill();
    /* ไฮไลต์ด้านซ้าย */
    ctx.fillStyle = mix(st.body, '#ffffff', 0.18);
    rrect(ctx, -6, bodyTop, 4.4, 11.5, 2.2);
    ctx.fill();
    /* แถบเข็มขัด */
    ctx.fillStyle = st.trim;
    ctx.fillRect(-6, bodyTop + 7.4, 12, 2.4);
    ctx.fillStyle = mix(st.trim, '#000000', 0.25);
    ctx.fillRect(-1, bodyTop + 7.4, 2, 2.4);
    /* ปกเสื้อ (คอ) */
    ctx.fillStyle = mix(st.body, '#000000', 0.12);
    ctx.fillRect(-2.4, bodyTop, 4.8, 1.6);

    /* ---------- แขนหน้า (ถือเครื่องมือ) ---------- */
    var frontArm, openHand = false;
    if (swing > 0) {
      frontArm = -1.45 + swing * 2.5;           /* ตีลงจากท่าเหนือหัว */
    } else if (waving) {
      frontArm = -2.25 + Math.sin(t * 8) * 0.25; /* โบกมือขึ้นเหนือหัว */
      openHand = true;
    } else {
      frontArm = 0.14 + armR;
    }
    ctx.save();
    ctx.translate(4.6, bodyTop + 1.5);
    ctx.rotate(frontArm);
    ctx.fillStyle = st.body;
    ctx.fillRect(-1.4, 0, 2.8, 8.2);
    if (openHand) {
      circle(ctx, 0, 8.4, 2.4, st.skin);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 8.4, 3.9, -0.85, 0.85); ctx.stroke();
    } else {
      circle(ctx, 0, 7.8, 2.1, st.skin);
    }
    var wkind = weaponKind(opts.weapon);
    if (wkind) drawWeapon(ctx, wkind, swing);
    ctx.restore();

    /* ---------- หัว ---------- */
    var hx = 0;
    if (fdir === 'right') {
      /* โปรไฟล์: ผมอยู่ด้านหลัง (ซ้าย) */
      circle(ctx, hx - 1.1, headY, hr * 1.02, st.hair);
      circle(ctx, hx + 1.0, headY, hr * 0.9, st.skin);
      /* จมูก */
      ctx.fillStyle = st.skin;
      poly(ctx, [[hx + 5.0, headY - 1.2], [hx + 7.0, headY + 0.4], [hx + 4.6, headY + 1.4]], st.skin);
      /* ตาเดียว */
      ctx.fillStyle = '#2b2118';
      ctx.beginPath();
      ctx.ellipse(hx + 2.6, headY - 0.6, 1.1, 1.2 * blink, 0, 0, Math.PI * 2);
      ctx.fill();
      /* ปาก */
      ctx.fillStyle = '#8a5a4a';
      ctx.fillRect(hx + 2.2, headY + 2.0, 2.2, 1.0);
      /* แก้ม */
      ctx.fillStyle = 'rgba(240,140,140,0.28)';
      circle(ctx, hx + 3.0, headY + 1.0, 1.3, 'rgba(240,140,140,0.28)');
    } else if (fdir === 'up') {
      /* หลังหัว: ไม่มีตา/ปาก */
      circle(ctx, hx, headY, hr, st.hair);
      ctx.fillStyle = mix(st.hair, '#000000', 0.18);
      ctx.beginPath();
      ctx.ellipse(hx, headY + hr * 0.45, hr * 0.85, hr * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.beginPath();
      ctx.ellipse(hx - 1.6, headY - 2.4, 3.2, 1.8, -0.4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      /* หันหน้า: เห็นหน้า/ตา/ปาก */
      circle(ctx, hx, headY, hr, st.skin);
      /* ผม (ทับหน้าผาก) */
      ctx.fillStyle = st.hair;
      ctx.beginPath();
      ctx.arc(hx, headY - hr * 0.2, hr * 1.02, Math.PI * 1.02, Math.PI * 2.02);
      ctx.fill();
      ctx.fillRect(hx - hr * 1.02, headY - hr * 0.25, hr * 0.5, hr * 0.9);
      ctx.fillRect(hx + hr * 0.52, headY - hr * 0.25, hr * 0.5, hr * 0.9);
      /* ตา */
      ctx.fillStyle = '#2b2118';
      ctx.beginPath();
      ctx.ellipse(hx - 2.3, headY + 0.2, 1.05, 1.15 * blink, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(hx + 2.3, headY + 0.2, 1.05, 1.15 * blink, 0, 0, Math.PI * 2);
      ctx.fill();
      /* ปาก */
      ctx.strokeStyle = '#8a5a4a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (hurt > 0) {
        ctx.ellipse(hx, headY + 2.6, 1.6, 1.2, 0, 0, Math.PI * 2);
      } else if (waving) {
        ctx.arc(hx, headY + 2.2, 2.2, 0.15 * Math.PI, 0.85 * Math.PI);
      } else {
        ctx.arc(hx, headY + 2.0, 2.4, 0.18 * Math.PI, 0.82 * Math.PI);
      }
      ctx.stroke();
      /* แก้ม */
      ctx.fillStyle = 'rgba(240,140,140,0.30)';
      circle(ctx, hx - 3.7, headY + 1.6, 1.3, 'rgba(240,140,140,0.30)');
      circle(ctx, hx + 3.7, headY + 1.6, 1.3, 'rgba(240,140,140,0.30)');
    }

    /* ---------- หัวถูกเฉพาะอาชีพ ---------- */
    Art.hat(ctx, hx, headY, hr, 1, st.hat, t, fdir);

    ctx.restore();
  };

  /* ================= มอนส์ (มุมมองจากบน/สามส่วนสี่บน) ================= */
  var MOB_STYLE = {
    slime:  { c: '#6ec96e', d: '#4aa34a', eye: '#123' },
    wolf:   { c: '#8b8f9c', d: '#5f636e', eye: '#e05a5a' },
    goblin: { c: '#b98bd4', d: '#8a5fa5', eye: '#ffd54f' },
    boar:   { c: '#a9714a', d: '#7d4e2f', eye: '#fff' },
    wraith: { c: '#8f9bd6', d: '#5f6ba5', eye: '#a0f0ff' }
  };

  Art.mob = function (ctx, sx, sy, z, type, opts) {
    opts = opts || {};
    var st = MOB_STYLE[type] || MOB_STYLE.slime;
    var t = opts.t || 0;
    var hurt = opts.hurt || 0;
    var face = (opts.face === 0 || opts.face === false) ? 0 : 1; /* 1 = หันหน้าเข้าหาผู้เล่น */

    ctx.save();
    if (hurt > 0) ctx.globalAlpha = 0.5;
    ctx.translate(sx, sy);
    ctx.scale(z, z);
    /* หันหลัง = พลิกแนวตั้ง (หัวไปด้านบน) */
    if (!face) { ctx.translate(0, -11); ctx.scale(1, -1); ctx.translate(0, 11); }

    /* ---------- สไปรต์มอนส์จริง (ถ้าพร้อม) ---------- */
    var mobKey = 'mobs/' + type + '.png';
    var mobBob = Math.sin(t * 4 + (opts.seed || 0)) * 0.8;
    var mobDrew = drawSprite(ctx, mobKey, 0, mobBob, false, null, 0);
    if (mobDrew) { ctx.restore(); return; }

    if (type === 'slime') {
      var squash = 1 + Math.sin(t * 5) * 0.10;
      ell(ctx, 0, -9, 11 / squash, 9 * squash, st.c);
      ell(ctx, 0, -6.5, 6 / squash, 4.4 * squash, st.d);
      ctx.fillStyle = 'rgba(255,255,255,0.30)';
      ctx.beginPath();
      ctx.ellipse(-4, -13, 3.4, 2.1, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.ellipse(-5, -14, 1.3, 0.9, -0.4, 0, Math.PI * 2);
      ctx.fill();
      /* ตาโต (อยู่ด้านหน้า = ล่าง) */
      var eY = -8;
      ell(ctx, -3.6, eY, 2.5, 2.8, '#fdfdf5');
      ell(ctx, 3.6, eY, 2.5, 2.8, '#fdfdf5');
      circle(ctx, -3.4, eY + 0.4, 1.35, st.eye);
      circle(ctx, 3.8, eY + 0.4, 1.35, st.eye);
      circle(ctx, -4.1, eY - 0.5, 0.6, '#fff');
      circle(ctx, 3.1, eY - 0.5, 0.6, '#fff');
      /* ปาก */
      ell(ctx, 0, -3.6, 2.4, 1.9 * (0.6 + 0.4 * Math.abs(Math.sin(t * 5))), '#2a4a2a');
    } else if (type === 'wolf') {
      /* มองจากบน: หัวอยู่ด้านล่าง (หันหน้า), หางด้านบน */
      var swayW = Math.sin(t * 6) * 2;
      ctx.strokeStyle = st.d;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -19);
      ctx.quadraticCurveTo(swayW, -23, swayW * 1.6, -26);
      ctx.stroke();
      /* ลำตัว */
      ell(ctx, 0, -11, 7.5, 9.5, st.d);
      ell(ctx, 0, -11, 5.4, 7.2, st.c);
      /* ขาเห็นเป็นตะแอง */
      circle(ctx, -6.5, -7, 1.8, st.d);
      circle(ctx, 6.5, -7, 1.8, st.d);
      circle(ctx, -6, -16, 1.8, st.d);
      circle(ctx, 6, -16, 1.8, st.d);
      /* หัว */
      circle(ctx, 0, -3, 5.6, st.c);
      /* ปากยาว (มองจากบน = ยื่นออกมาด้านล่าง) */
      ell(ctx, 0, 2.2, 3.2, 2.6, mix(st.c, '#ffffff', 0.22));
      circle(ctx, 0, 4.0, 1.3, '#22242c');
      /* ฟัน */
      poly(ctx, [[-2.2, 2.6], [-1.2, 4.6], [-0.2, 2.6]], '#fff');
      poly(ctx, [[0.6, 2.6], [1.6, 4.6], [2.6, 2.6]], '#fff');
      /* หู */
      poly(ctx, [[-4.6, -5.6], [-5.6, -11.4], [-1.4, -7.2]], st.d);
      poly(ctx, [[4.6, -5.6], [5.6, -11.4], [1.4, -7.2]], st.d);
      poly(ctx, [[-4.0, -6.6], [-4.6, -9.8], [-2.2, -7.4]], '#4a3540');
      poly(ctx, [[4.0, -6.6], [4.6, -9.8], [2.2, -7.4]], '#4a3540');
      /* ตาแดง */
      ell(ctx, -2.3, -4.2, 1.5, 1.2, st.eye);
      ell(ctx, 2.3, -4.2, 1.5, 1.2, st.eye);
      circle(ctx, -2.3, -4.2, 0.5, '#3a0d0d');
      circle(ctx, 2.3, -4.2, 0.5, '#3a0d0d');
    } else if (type === 'goblin') {
      /* มองจากบน: หัวกลมบน, ตัวล่าง */
      var gy = -23 + Math.sin(t * 4) * 0.6;
      /* หูยาว */
      poly(ctx, [[-5.4, gy - 2.4], [-11.4, gy - 8.4], [-2.6, gy - 5.2]], st.c);
      poly(ctx, [[5.4, gy - 2.4], [11.4, gy - 8.4], [2.6, gy - 5.2]], st.c);
      poly(ctx, [[-5.0, gy - 2.8], [-9.4, gy - 6.8], [-4.0, gy - 4.4]], st.d);
      poly(ctx, [[5.0, gy - 2.8], [9.4, gy - 6.8], [4.0, gy - 4.4]], st.d);
      /* ตัว */
      ctx.fillStyle = st.d;
      rrect(ctx, -4.4, gy + 4, 8.8, 11, 2);
      ctx.fill();
      ell(ctx, 0, gy + 12, 3, 3.4, mix(st.c, '#ffffff', 0.12));
      /* หัว */
      circle(ctx, 0, gy, 6.5, st.c);
      /* ตาเหลือง + รูกมัด */
      ell(ctx, -2.4, gy - 0.8, 1.9, 1.6, st.eye);
      ell(ctx, 2.4, gy - 0.8, 1.9, 1.6, st.eye);
      box(ctx, -2.8, gy - 1.7, 0.8, 1.8, '#3d2a10');
      box(ctx, 2.0, gy - 1.7, 0.8, 1.8, '#3d2a10');
      /* จมูกใหญ่ */
      ell(ctx, 0, gy + 2.2, 1.9, 1.5, mix(st.c, '#d8a0c8', 0.4));
      /* ยิ้มเผยฟัน */
      ctx.fillStyle = '#3d2a45';
      ctx.beginPath();
      ctx.moveTo(-3.4, gy + 3.2);
      ctx.quadraticCurveTo(0, gy + 6.8, 3.4, gy + 3.2);
      ctx.quadraticCurveTo(0, gy + 4.4, -3.4, gy + 3.2);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fdf6e0';
      for (var gt = 0; gt < 4; gt++) {
        var gx = -2.6 + gt * 1.7;
        poly(ctx, [[gx, gy + 3.4], [gx + 0.8, gy + 5.2], [gx + 1.6, gy + 3.4]], '#fdf6e0');
      }
      /* ไม้เท้า */
      ctx.strokeStyle = '#7a5a34';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(6.4, gy + 12);
      ctx.lineTo(8.4, gy + 20);
      ctx.stroke();
      circle(ctx, 8.6, gy + 21, 2.2, '#6b4a2a');
    } else if (type === 'boar') {
      /* มองจากบน: หัวอยู่ด้านล่าง, ขนหลังด้านบน */
      var by = -12 + Math.sin(t * 4) * 0.5;
      /* ขา */
      circle(ctx, -7.5, by - 3, 2, '#5e3a22');
      circle(ctx, 7.5, by - 3, 2, '#5e3a22');
      circle(ctx, -6.5, by + 5, 2, '#5e3a22');
      circle(ctx, 6.5, by + 5, 2, '#5e3a22');
      /* ลำตัว */
      ell(ctx, 0, by, 9, 10, st.d);
      ell(ctx, 0, by, 6.5, 7.5, st.c);
      /* ขนหลัง */
      ctx.strokeStyle = '#3d2615';
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      for (var br = 0; br < 5; br++) {
        var bx2 = -5 + br * 2.6;
        ctx.beginPath();
        ctx.moveTo(bx2, by - 8);
        ctx.lineTo(bx2 + 0.8, by - 12.5);
        ctx.stroke();
      }
      /* หัว */
      circle(ctx, 0, -3.5, 6.4, st.c);
      ell(ctx, 0, 2.2, 3.2, 2.6, '#c98f6b');
      circle(ctx, -0.9, 1.6, 0.6, '#5e3a22');
      circle(ctx, 0.9, 2.6, 0.6, '#5e3a22');
      /* เขี้ยว */
      ctx.strokeStyle = '#f0e0c0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-2.4, 2.6); ctx.quadraticCurveTo(-4.2, 4.4, -3.4, 0.8);
      ctx.moveTo(2.4, 2.6); ctx.quadraticCurveTo(4.2, 4.4, 3.4, 0.8);
      ctx.stroke();
      /* ตา */
      ell(ctx, -2.6, -5.0, 1.6, 1.4, '#f6efe2');
      ell(ctx, 2.6, -5.0, 1.6, 1.4, '#f6efe2');
      circle(ctx, -2.4, -5.0, 0.8, '#3a2a20');
      circle(ctx, 2.4, -5.0, 0.8, '#3a2a20');
      /* หู */
      poly(ctx, [[-4.6, -8.2], [-7.6, -12.6], [-1.4, -9.4]], st.d);
      poly(ctx, [[4.6, -8.2], [7.6, -12.6], [1.4, -9.4]], st.d);
    } else { /* wraith */
      var wy2 = -20 + Math.sin(t * 2.4) * 1.2;
      ctx.fillStyle = 'rgba(160,240,255,0.13)';
      ctx.beginPath(); ctx.arc(0, wy2, 15, 0, Math.PI * 2); ctx.fill();
      /* ผ้าคลุม (กางออกลงล่าง) */
      ctx.fillStyle = 'rgba(143,155,214,0.85)';
      ctx.beginPath();
      ctx.moveTo(-8, wy2 + 4);
      ctx.quadraticCurveTo(-9, wy2 - 9, 0, wy2 - 11);
      ctx.quadraticCurveTo(9, wy2 - 9, 8, wy2 + 4);
      for (var wr = 0; wr < 4; wr++) {
        var wx2 = -8 + wr * 5.4;
        ctx.quadraticCurveTo(wx2 + 1.4, wy2 + 8 + Math.sin(t * 5 + wr) * 2,
          wx2 + 2.7, wy2 + 3.5);
      }
      ctx.closePath();
      ctx.fill();
      ell(ctx, 0, wy2 + 3, 6.4, 3, 'rgba(60,70,120,0.55)');
      /* หัวโหม่ */
      circle(ctx, 0, wy2 - 3.5, 5.8, 'rgba(30,36,66,0.9)');
      /* ตาเรืองแสง */
      ell(ctx, -2.4, wy2 - 4, 1.6, 2.0, st.eye);
      ell(ctx, 2.4, wy2 - 4, 1.6, 2.0, st.eye);
      circle(ctx, -2.4, wy2 - 4.6, 0.7, 'rgba(200,255,255,0.9)');
      circle(ctx, 2.4, wy2 - 4.6, 0.7, 'rgba(200,255,255,0.9)');
      ctx.strokeStyle = 'rgba(200,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, wy2 - 1, 2.0, 2.4, 0, 0, Math.PI);
      ctx.stroke();
    }
    ctx.restore();
  };

  /* ================= NPC (สไปรต์ตัวละครย้อมสี) ================= */
  Art.npc = function (ctx, sx, sy, z, opts) {
    opts = opts || {};
    var key = opts.sprite || 'characters/player_down.png';
    var t = opts.t || 0;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(z, z);
    var bob = Math.sin(t * 2.4 + (opts.seed || 0)) * 0.6;
    var drew = drawSprite(ctx, key, 0, bob, false,
      opts.tint || '#8fa05a', 0.30);
    ctx.restore();
    if (drew) return true;
    /* fallback: ใช้ Art.player แบบ shape */
    Art.player(ctx, sx, sy, z, {
      prof: opts.prof === 'merchant' ? 'hunter' : (opts.prof === 'blacksmith' ? 'miner' : 'farmer'),
      t: t, moving: false, hurt: 0, swing: 0, weapon: null, dir: opts.dir || 'down'
    });
    return false;
  };

  /* ================= อาคาร (top-down) =================
     b    = ข้อมูลอาคาร { x, y, w, h, name, icon }
     rect = { x, y, w, h } พิกัด pixel ของ footprint บนจอ
     z    = สเกล */
  Art.building = function (ctx, b, rect, z) {
    b = b || {};
    rect = rect || {};
    var x = rect.x || 0, y = rect.y || 0, w = rect.w || 0, h = rect.h || 0;
    z = z || 1;

    /* รองรับการเรียกแบบเก่า (top.sx/br.sx) เผื่อระหว่างเปลี่ยนระบบ */
    if (rect.sx !== undefined && rect.w === undefined) {
      var a = rect, c = arguments[3] || 1;
      x = Math.min(a.sx, c.sx);
      y = Math.min(a.sy, c.sy);
      w = Math.abs(c.sx - a.sx);
      h = Math.abs(c.sy - a.sy);
      z = arguments[4] || c;
    }
    if (w <= 0 || h <= 0) return;

    var seed = Art.hash(b.x || 0, b.y || 0);
    var PAL = [
      ['#a8483c', '#8d3a30'],   /* หลังคาสีแดง */
      ['#7d5c3a', '#6b4e31'],   /* หลังคาน้ำตาล */
      ['#4f6f8a', '#43607a'],   /* หลังคาสีน้ำเงิน */
      ['#6f7f45', '#5d6c39'],   /* หลังคาสีเขียว */
      ['#8a5f7a', '#764f68']    /* หลังคาสีม่วง */
    ];
    var pc = PAL[Math.floor(seed * PAL.length) % PAL.length];

    var wallH = Math.min(16 * z, Math.max(8 * z, h * 0.30));
    var roofH = h - wallH;

    ctx.save();

    /* เงาใต้อาคาร */
    ctx.fillStyle = 'rgba(10,16,8,0.24)';
    ctx.fillRect(x + 4 * z, y + 6 * z, w, h);

    /* ฐาน/ลานหน้าอาคาร */
    ctx.fillStyle = 'rgba(120,100,72,0.20)';
    ctx.fillRect(x - 2 * z, y + h - wallH, w + 4 * z, wallH + 3 * z);

    /* ---- ผนังด้านหน้า ---- */
    var wallY = y + roofH;
    ctx.fillStyle = '#8a6a45';
    ctx.fillRect(x, wallY, w, wallH);
    /* ผนังจากภาพสไปรต์ (ถ้าพร้อม) */
    var wallDrew = tileSpriteZ(ctx, 'objects/house_wall.png', x, wallY, w, wallH, z);
    if (!wallDrew) {
      /* ไฮไลต์ขอบบนผนัง */
      ctx.fillStyle = 'rgba(255,236,190,0.18)';
      ctx.fillRect(x, wallY, w, Math.max(1.5 * z, wallH * 0.22));
      /* เนื้อไม้แนวตั้ง */
      ctx.fillStyle = 'rgba(70,48,26,0.28)';
      var planks = Math.max(2, Math.round(w / (9 * z)));
      for (var i = 1; i < planks; i++) {
        ctx.fillRect(x + (w / planks) * i - 0.6 * z, wallY + wallH * 0.25, 1.2 * z, wallH * 0.75);
      }
    }
    /* ฐานเข้ม */
    ctx.fillStyle = 'rgba(50,34,16,0.35)';
    ctx.fillRect(x, y + h - Math.max(2 * z, wallH * 0.18), w, Math.max(2 * z, wallH * 0.18));

    /* ---- ประตู ---- */
    var doorW = Math.min(14 * z, w * 0.34);
    var doorX = x + w / 2 - doorW / 2;
    ctx.fillStyle = '#4a3019';
    ctx.fillRect(doorX - 1 * z, wallY, doorW + 2 * z, wallH);
    ctx.fillStyle = '#6b4526';
    ctx.fillRect(doorX, wallY + 1.5 * z, doorW, wallH - 1.5 * z);
    ctx.fillStyle = '#d8b24a';
    ctx.fillRect(doorX + doorW - 3.4 * z, wallY + wallH * 0.45, 1.8 * z, 1.8 * z);

    /* ---- หน้าต่างผนัง ---- */
    if (w > 30 * z) {
      var winW = 5 * z, winH = 4 * z;
      var winY = wallY + wallH * 0.25;
      var winXs = [x + w * 0.16 - winW / 2, x + w * 0.84 - winW / 2];
      for (var wi = 0; wi < winXs.length; wi++) {
        ctx.fillStyle = '#3c4a52';
        ctx.fillRect(winXs[wi], winY, winW, winH);
        ctx.fillStyle = 'rgba(180,220,240,0.55)';
        ctx.fillRect(winXs[wi] + 0.6 * z, winY + 0.6 * z, winW - 1.2 * z, winH - 1.2 * z);
      }
    }

    /* ---- หลังคา (มองจากบน) ---- */
    ctx.fillStyle = pc[0];
    ctx.fillRect(x, y, w, roofH);
    var roofDrew = tileSpriteZ(ctx, 'objects/roof.png', x, y, w, roofH, z);
    if (!roofDrew) {
      /* สันคา/เส้นแบ่งสองเชิง */
      ctx.fillStyle = mix(pc[0], '#ffffff', 0.16);
      ctx.fillRect(x, y, w, roofH * 0.5);
      ctx.fillStyle = mix(pc[1], '#000000', 0.12);
      ctx.fillRect(x, y + roofH * 0.5 - Math.max(1 * z, 2 * z), w, Math.max(1 * z, 2 * z));
    }
    /* สีเข้มชายล่างของหลังคา (ด้านใกล้ผู้ดู) */
    ctx.fillStyle = mix(pc[1], '#000000', 0.10);
    ctx.fillRect(x, y + roofH - Math.max(3 * z, roofH * 0.18), w, Math.max(3 * z, roofH * 0.18));
    /* มุงจั่วตรงกลาง */
    if (!roofDrew) {
      ctx.fillStyle = mix(pc[0], '#ffffff', 0.08);
      ctx.fillRect(x + w * 0.5 - Math.max(2 * z, w * 0.04), y, Math.max(4 * z, w * 0.08), roofH);
    }
    /* เชิงชาย (eaves) */
    ctx.fillStyle = pc[1];
    ctx.fillRect(x - 2 * z, y + roofH - Math.max(3 * z, roofH * 0.18), w + 4 * z, Math.max(3 * z, roofH * 0.18));
    if (!roofDrew) {
      ctx.fillStyle = 'rgba(255,214,180,0.28)';
      ctx.fillRect(x, y, w, Math.max(1.5 * z, roofH * 0.12));
    }

    /* ---- สัญญาลักษณ์ร้านค้า (ป้าย + มลน้ำ) ---- */
    if (b.sign) {
      var sw = 16 * z, sh = 16 * z;
      var signX = x + w / 2 - sw / 2;
      var signY = wallY - sh * 0.55;
      ctx.save();
      ctx.globalAlpha = 0.98;
      var signDrew = drawSprite(ctx, b.sign, signX + sw / 2, signY + sh, false, null, 0);
      if (!signDrew) {
        /* fallback: ป้ายไม้ + หมวดค้าสีส้ม */
        ctx.fillStyle = '#7a5230';
        ctx.fillRect(signX, signY + sh * 0.2, sw, sh * 0.55);
        ctx.fillStyle = '#e08a3c';
        ctx.fillRect(signX + sw * 0.1, signY + sh * 0.3, sw * 0.8, sh * 0.35);
      }
      ctx.restore();
      /* มลน้ำ (awning) ใต้ป้าย ยื่นออกมาด้านหน้า */
      if (b.awning) {
        var aw = 16 * z, ah = 10 * z;
        var awX = x + w / 2 - aw / 2;
        var awY = wallY + wallH * 0.15;
        ctx.save();
        var awDrew = drawSprite(ctx, b.awning, awX + aw / 2, awY + ah, false, null, 0);
        if (!awDrew) {
          ctx.fillStyle = '#e8e2d0';
          ctx.fillRect(awX, awY, aw, ah);
          ctx.fillStyle = '#4f9f52';
          for (var ai = 0; ai < 4; ai++) {
            ctx.fillRect(awX + ai * (aw / 4), awY, aw / 8, ah);
          }
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(awX, awY + ah - 2 * z, aw, 2 * z);
        }
        ctx.restore();
      }
    }

    /* ---- ป้ายชื่ออาคาร ---- */
    var label = (b.icon ? b.icon + ' ' : '') + (b.name || '');
    if (label) {
      ctx.font = Math.max(9, 11 * z) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      var tw = ctx.measureText(label).width;
      var ly = y - 7 * z;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x + w / 2 - tw / 2 - 6 * z, ly - 13 * z, tw + 12 * z, 16 * z);
      ctx.fillStyle = '#f2e4b8';
      ctx.fillText(label, x + w / 2, ly - 1.5 * z);
    }

    ctx.restore();
  };

  /* ================= เฟอร์นิเจอร์ภายในอาคาร (มุมมองตรง) ================= */
  Art.furniture = function (ctx, f, sx, sy, z, t) {
    f = f || {};
    var type = f.type;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(z, z);

    /* เงาใต้ของ */
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    /* --- สไปรต์เฟอร์นิเจอร์ (ถ้าพร้อม) --- */
    var fKey = type === 'barrel' ? 'objects/barrel_pot.png'
      : type === 'chest' ? 'objects/crate.png'
      : type === 'anvil' ? 'objects/dungeon_anvil.png'
      : type === 'table' ? 'objects/dungeon_table.png'
      : null;
    if (fKey) {
      var fDrew = drawSprite(ctx, fKey, 0, 2, false, null, 0, 0.7);
      if (fDrew) { ctx.restore(); return; }
    }

    if (type === 'bed') {
      /* เตียง (มองจากด้านข้างตรง) */
      box(ctx, -10, -6, 20, 6, '#c9b896');            /* ฐาน */
      box(ctx, -10, -6, 20, 1.4, '#e9dcc0');         /* ขอบที่นอน */
      box(ctx, -8, -9, 14, 3.4, '#a8c8e8');          /* ผ้าห่ม */
      box(ctx, -8, -9, 14, 1.2, '#c9e0f5');
      box(ctx, -8, -12, 5, 3.2, '#fff');             /* หมอน */
      box(ctx, -11, -15, 2.4, 15, '#7a5c3a');        /* หัวเตียง */
      box(ctx, 8.6, -8, 2.4, 8, '#7a5c3a');         /* หัวเตียงอีกข้าง */
    } else if (type === 'chest') {
      box(ctx, -9, -11, 18, 11, '#7a5230');         /* ตัวหีบ */
      box(ctx, -9, -11, 18, 4.5, '#9a6b3c');        /* ฝาปิด */
      box(ctx, -9, -7, 18, 1.6, '#d8b24a');         /* หลายเหล็ก */
      box(ctx, -1.6, -8, 3.2, 4, '#d8b24a');        /* กุญแจ */
      box(ctx, -0.6, -6.4, 1.2, 1.6, '#6b4728');
    } else if (type === 'table') {
      box(ctx, -12, -13, 24, 3.4, '#a9793f');       /* พื้นโต๊ะ */
      box(ctx, -12, -13, 24, 1.2, '#c9975a');
      box(ctx, -10, -9.6, 3, 9.6, '#7d5729');       /* ขา */
      box(ctx, 7, -9.6, 3, 9.6, '#7d5729');
    } else if (type === 'chair') {
      box(ctx, -6, -13, 12, 5, '#8a6230');          /* พนัก */
      box(ctx, -6, -8, 12, 2.4, '#a9793f');         /* ที่นั่ง */
      box(ctx, -5, -5.6, 2.4, 5.6, '#7d5729');
      box(ctx, 2.6, -5.6, 2.4, 5.6, '#7d5729');
    } else if (type === 'shelf') {
      box(ctx, -7, -22, 14, 22, '#8a6230');
      box(ctx, -7, -22, 14, 1.6, '#a9793f');
      for (var sh = 0; sh < 3; sh++) {
        var shy = -18 + sh * 5.4;
        ctx.fillStyle = 'rgba(0,0,0,0.20)';
        ctx.fillRect(-6, shy + 2.2, 12, 1);
        ctx.fillStyle = ['#d9b26a', '#8fb8d8', '#c98b8b'][sh % 3];
        ctx.fillRect(-4.6 + sh * 2, shy - 2.4, 2.6, 3);
      }
    } else if (type === 'barrel') {
      ctx.fillStyle = '#8a6230';
      ctx.beginPath();
      ctx.moveTo(-7, 0); ctx.lineTo(7, 0);
      ctx.lineTo(6, -13); ctx.lineTo(-6, -13);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#b98c4f';
      ctx.beginPath();
      ctx.ellipse(0, -13, 6, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5c401f';
      ctx.fillRect(-6.6, -11, 13.2, 1.6);
      ctx.fillRect(-6.2, -5, 12.4, 1.6);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(-4.6, -12.2, 2, 10);
    } else if (type === 'plant') {
      /* กระถาง + ใบ */
      ctx.fillStyle = '#b5714a';
      poly(ctx, [[-6, -6], [6, -6], [4.4, 0], [-4.4, 0]], '#b5714a');
      box(ctx, -6.6, -7.4, 13.2, 2, '#95593a');
      for (var pl = 0; pl < 6; pl++) {
        var ang = (Math.PI * 2 * pl) / 6 + (t || 0) * 0.4;
        ell(ctx, Math.cos(ang) * 4.2, -10 + Math.sin(ang) * 3.2, 4.2, 2.1, '#4f9a4a', ang);
      }
      circle(ctx, 0, -11, 2.6, '#5fb055');
    } else if (type === 'furnace') {
      box(ctx, -9, -15, 18, 15, '#6d6a66');
      box(ctx, -9, -15, 18, 2.4, '#84817c');
      box(ctx, -9, -6, 18, 6, '#55524e');
      /* ปากเตาไฟ */
      var fl = 0.8 + Math.sin((t || 0) * 9) * 0.2;
      ctx.fillStyle = 'rgba(40,24,14,0.9)';
      ctx.beginPath();
      ctx.arc(0, -6, 4.4, Math.PI, 0);
      ctx.lineTo(4.4, 0); ctx.lineTo(-4.4, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,140,40,' + (0.75 * fl).toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(0, -5.4, 3.4 * fl, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,220,120,0.9)';
      ctx.beginPath();
      ctx.arc(0, -5.2, 1.8 * fl, 0, Math.PI * 2);
      ctx.fill();
      Art.glow(ctx, sx, sy - 6 * z, 40 * z, 'rgba(255,150,60,ALPHA)', 0.30);
    } else if (type === 'anvil') {
      poly(ctx, [
        [-8, -10], [9, -10], [5.5, -6.5], [3, -6.5], [4, 0],
        [-4, 0], [-3, -6.5], [-5.5, -6.5]
      ], '#3f4448');
      box(ctx, -8, -10, 17, 1.8, '#5b6166');
      box(ctx, -4, -6, 8, 1.4, '#4d5257');
    } else if (type === 'counter') {
      box(ctx, -13, -13, 26, 13, '#8a6230');
      box(ctx, -13, -13, 26, 3, '#b5814a');
      box(ctx, -13, -10, 26, 1.2, '#c9975a');
      box(ctx, -13, -2, 26, 2, '#785327');
    } else if (type === 'stall') {
      box(ctx, -10, -9, 20, 9, '#7a5230');
      box(ctx, -10, -9, 20, 2.4, '#9a6b3c');
      /* ผ้าคลุมแผง */
      ctx.fillStyle = '#c9564a';
      ctx.fillRect(-11, -15, 22, 4.4);
      ctx.fillStyle = '#e8e2d4';
      for (var st = 0; st < 4; st++) ctx.fillRect(-11 + st * 5.5, -15, 2.6, 4.4);
      /* ขาแผง */
      box(ctx, -9.4, -5.6, 2, 5.6, '#6b4728');
      box(ctx, 7.4, -5.6, 2, 5.6, '#6b4728');
    } else if (type === 'stove') {
      box(ctx, -8, -12, 16, 12, '#6d6a66');
      box(ctx, -8, -12, 16, 2, '#84817c');
      var fl2 = 0.8 + Math.sin((t || 0) * 7 + 1) * 0.2;
      ctx.fillStyle = 'rgba(40,24,14,0.9)';
      ctx.fillRect(-4.4, -8, 8.8, 5);
      ctx.fillStyle = 'rgba(255,140,40,' + (0.7 * fl2).toFixed(2) + ')';
      ctx.fillRect(-3.4, -7.4, 6.8, 3.8);
      Art.glow(ctx, sx, sy - 6 * z, 32 * z, 'rgba(255,150,60,ALPHA)', 0.26);
      /* หม้อ */
      ell(ctx, 0, -13, 4.4, 2.4, '#3f4448');
      box(ctx, -4.6, -13, 9.2, 1.6, '#565c62');
    }
    ctx.restore();
  };

  /* ---------- จุดใช้งาน (ไอคอนลอย) ---------- */
  Art.station = function (ctx, s, sx, sy, z, t) {
    var bob = Math.sin(t * 3) * 1.6 * z;
    ctx.save();
    var gg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 22 * z);
    gg.addColorStop(0, 'rgba(255,220,130,0.30)');
    gg.addColorStop(1, 'rgba(255,220,130,0)');
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 22 * z, 10 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = (15 * z) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(s.icon || '★', sx, sy - 20 * z + bob);
    ctx.strokeStyle = 'rgba(255,220,130,' + (0.5 + 0.3 * Math.sin(t * 4)).toFixed(2) + ')';
    ctx.lineWidth = 1.4 * z;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 10 * z, 4.5 * z, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  /* ---------- กองไฟ (top-down: วงแหวนหิน + เผาไฟ) ---------- */
  Art.campfire = function (ctx, sx, sy, z, t) {
    var fl = Math.sin(t * 9) * 0.5 + Math.sin(t * 13.7) * 0.3;
    var flick = 0.85 + 0.15 * Math.sin(t * 11);

    /* แสงอุ่นบนพื้น */
    var gl = ctx.createRadialGradient(sx, sy - 2 * z, 0, sx, sy - 2 * z, 44 * z * flick);
    gl.addColorStop(0, 'rgba(255,190,90,0.42)');
    gl.addColorStop(0.45, 'rgba(255,150,60,0.18)');
    gl.addColorStop(1, 'rgba(255,140,50,0)');
    ctx.save();
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.ellipse(sx, sy - 2 * z, 44 * z * flick, 22 * z * flick, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(z, z);

    /* วงแหวนหินรอบกองไฟ */
    for (var s = 0; s < 8; s++) {
      var a = (s / 8) * Math.PI * 2;
      ctx.fillStyle = (s % 2 === 0) ? '#8f8f99' : '#7a7a84';
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 9.5, Math.sin(a) * 5.5, 2.6, 2, a, 0, Math.PI * 2);
      ctx.fill();
    }
    /* แก่งไฟ */
    ctx.fillStyle = '#5a3d22';
    for (var i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate((i / 3) * Math.PI);
      ctx.fillRect(-7, -1.6, 14, 3.2);
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(255,190,110,0.30)';
    ctx.beginPath();
    ctx.ellipse(0, -1, 7, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    /* เปลวไฟ */
    ctx.fillStyle = '#ff9a3c';
    ctx.beginPath();
    ctx.moveTo(-5, -1);
    ctx.quadraticCurveTo(fl * 2, -11, 0, -16 - fl * 2);
    ctx.quadraticCurveTo(-fl * 2, -11, 5, -1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffe27a';
    ctx.beginPath();
    ctx.moveTo(-2.6, -1);
    ctx.quadraticCurveTo(fl, -7, 0, -10);
    ctx.quadraticCurveTo(-fl, -7, 2.6, -1);
    ctx.closePath();
    ctx.fill();
    /* ประกายไฟลอย */
    ctx.fillStyle = 'rgba(255,220,140,0.75)';
    for (var sp = 0; sp < 3; sp++) {
      var pa = (sp / 3) * Math.PI * 2 + t * 1.4;
      var pr = (5 + ((t * 12 + sp * 7) % 12));
      ctx.beginPath();
      ctx.arc(Math.cos(pa) * 3, -8 - pr * 0.3, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  /* ---------- แสงฟุ้ง ---------- */
  Art.glow = function (ctx, sx, sy, radius, color, alpha) {
    var g = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
    g.addColorStop(0, color.replace('ALPHA', alpha || 0.5));
    g.addColorStop(0.5, color.replace('ALPHA', (alpha || 0.5) * 0.35));
    g.addColorStop(1, color.replace('ALPHA', 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();
  };

  /* ---------- ดาบ/เครื่องมือ (คืนค่า icon สำหรับ UI) ---------- */
  Art.toolIcon = function (id) {
    var map = {
      pickaxe: '⛏️', axe: '🪓', wood_sword: '🗡️', iron_sword: '⚔️',
      bow: '🏹', torch: '🕯️'
    };
    return map[id] || null;
  };
})(window);
