/* =========================================================
   DUNGEON TOWN — render.js (Phase 2 · สไตล์ Lumivara)
   ใช้ Art.* จาก art.js วาดทุกอย่าง (ไม่ใช้ emoji เป็นตัวละคร)
   ========================================================= */
(function (root) {
  'use strict';
  var DT = root.DT || (root.DT = {});
  var C = DT.CFG, T = DT.TILE, Art = DT.Art;

  /* ---------- สี tile + ขอบ ---------- */
  var TILE_COLORS = {
    0: '#5b8f4a', 1: '#a89065', 2: '#8e8e96', 3: '#2f68a8',
    4: '#d4c08d', 5: '#8a6742', 6: '#a37b33', 7: '#5a4632', 8: '#7d6647'
  };
  var TILE_EDGE = {
    0: '#4e7d3f', 1: '#8d7852', 2: '#78787f', 3: '#255a93',
    4: '#bda876', 5: '#75563a', 6: '#8d6a2b', 7: '#493827', 8: '#6a563c'
  };

  /* ---------- พื้นผิวจริง (สไปรต์ tile จาก Kenney Roguelike CC0) ----------
     ผูก DT.TILE -> ไฟล์สไปรต์ใน assets/tiles/ground/
     ถ้าภาพโหลดไม่ได้ -> วาดแบบ canvas เดิม (fallback ปลอดภัย ไม่จอดำ) */
  var GROUND_SPRITES = {};
  GROUND_SPRITES[T.GRASS]  = 'tiles/ground/grass.png';
  GROUND_SPRITES[T.PATH]   = 'tiles/ground/path.png';
  GROUND_SPRITES[T.STONE]  = 'tiles/ground/stone.png';
  GROUND_SPRITES[T.WATER]  = 'tiles/ground/water.png';
  GROUND_SPRITES[T.SAND]   = 'tiles/ground/sand.png';
  GROUND_SPRITES[T.DIRT]   = 'tiles/ground/dirt.png';
  GROUND_SPRITES[T.FIELD]  = 'tiles/ground/field.png';
  GROUND_SPRITES[T.FLOOR]  = 'tiles/ground/floor.png';

  /* พื้นที่ใช้สไปรต์แทนการไล่สี (ให้สลับ tile ได้ ไม่ซ้ำตายตัว) */
  var GROUND_VARIANTS = {
    'tiles/ground/grass.png': ['tiles/ground/grass.png', 'tiles/ground/grass_flowers.png']
  };

  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
    var g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
    var b = Math.max(0, Math.min(255, (n & 255) + amt));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /* ---------- สีท้องฟ้าตามเวลาในวัน ----------
     ไฟล์คีย์เฟรม: [ชั่วโมง, สีบน, สีกลาง, สีขอบฟ้า] */
  var SKY_KEYS = [
    [0,    '#05081a', '#0b1130', '#161f45'],
    [4.5,  '#0b1130', '#1d2450', '#3a3566'],
    [6,    '#243063', '#7c4f80', '#e09263'],
    [7.5,  '#3f86cf', '#84b9e6', '#dfedf7'],
    [12,   '#2f7fd4', '#74b2e8', '#cfe6f7'],
    [16,   '#3d81c4', '#9cbedd', '#f2e3bd'],
    [18.2, '#2b3163', '#9d5c76', '#f2a35e'],
    [19.5, '#101736', '#232c55', '#4a4c78'],
    [24,   '#05081a', '#0b1130', '#161f45']
  ];

  function lerpHex(a, b, t) { return Art.mix(a, b, t); }

  function skyPalette(hour) {
    var h = ((hour % 24) + 24) % 24;
    var i = 0;
    while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1][0] <= h) i++;
    var a = SKY_KEYS[i], b = SKY_KEYS[i + 1];
    var t = (h - a[0]) / (b[0] - a[0]);
    if (t < 0) t = 0; if (t > 1) t = 1;
    return {
      top: lerpHex(a[1], b[1], t),
      mid: lerpHex(a[2], b[2], t),
      bot: lerpHex(a[3], b[3], t),
      t: t
    };
  }

  /* ---------- cache สี tile (ไม่สร้าง gradient ทุกเฟรม) ---------- */
  var tileCache = {};
  function tileStyle(ctx, col, w, h) {
    var key = col + '|' + w.toFixed(1) + '|' + h.toFixed(1);
    var c = tileCache[key];
    if (!c) {
      c = { grad: null, hi: shade(col, 30), dim: shade(col, -14) };
      tileCache[key] = c;
    }
    if (!c.grad) {
      var g = ctx.createLinearGradient(-w, -h, w, h);
      g.addColorStop(0, shade(col, 16));
      g.addColorStop(0.5, col);
      g.addColorStop(1, c.dim);
      c.grad = g;
    }
    return c;
  }
  function clearTileCache() { tileCache = {}; }

  /* ---------- ตำแหน่งดวงอาทิตย์/ดวงจันทร์บนท้องฟ้า ---------- */
  function celestialPos(hour, vw, vh, isMoon) {
    var h = ((hour % 24) + 24) % 24;
    var dayT = isMoon ? ((h + 12) % 24 - 6) / 12 : (h - 6) / 12;   /* 0..1 ระหว่างพระอาทิตย์ขึ้น-ตก */
    var x = vw * (0.08 + 0.84 * dayT);
    var y = vh * (0.62 - Math.sin(Math.PI * Math.max(0, Math.min(1, dayT))) * 0.52);
    return { x: x, y: y };
  }

  DT.Render = {
    init: function (canvas, world) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.world = world;
      this.cam = { x: DT.SPAWNS.player.x, y: DT.SPAWNS.player.y };
      this.zoom = 1;
      /* ระดับซูมที่ผู้ใช้เลือก (1 = ปกติ, มากกว่า 1 = ซูมเข้า) */
      this.zoomMul = 1;
      this.t = 0;
      this.resize();
    },

    resize: function () {
      clearTileCache();
      var c = this.canvas;
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var w = c.clientWidth || 900, h = c.clientHeight || 600;
      /* --- retro pixel-art: วาดที่ความละเอียดต่ำกว่าจอ PIXEL เท่า แล้วขยายแบบ pixelated --- */
      var pix = C.PIXEL || 1;
      c.width = Math.max(1, Math.floor(w * dpr / pix));
      c.height = Math.max(1, Math.floor(h * dpr / pix));
      this.ctx.setTransform(dpr / pix, 0, 0, dpr / pix, 0, 0);
      this.ctx.imageSmoothingEnabled = false;
      this.vw = w; this.vh = h;
      this.pix = pix;
      /* --- snap step: ขนาด 1 พิกเซลของ buffer ความละเอียดต่ำ (กันภาพสั่น/งง) --- */
      this.snap = pix / dpr;
      /* --- ขนาด tile ปรับตามจอ (มือถือแคบ = เห็นแผนที่กว้างขึ้น) --- */
      var base = 48;
      if (w < 520) base = 32;
      else if (w < 800) base = 40;
      /* คูณด้วยระดับซูมที่ผู้ใช้เลือก (pinch / ปุ่ม +/-)
         tile ใหญ่ขึ้น = ซูมเข้า, tile เล็กลง = ซูมออก */
      var mult = this.zoomMul || 1;
      var tpx = Math.max(16, Math.round(base * mult));
      DT.TILE_PX = tpx;
      DT.CELL = tpx;
      this.zoom = tpx / 48;   /* สเกลของ art ให้เข้ากับ tile */
    },

    /* ---------- ซูมเข้า/ออก (ผู้ใช้ควบคุม) ----------
       ระดับ: 0.6 (เห็นแผนที่กว้างสุด) .. 2.2 (ซูมเข้าสุด) */
    ZOOM_MIN: 0.6,
    ZOOM_MAX: 2.2,
    zoomStep: function (dir) {
      var cur = this.zoomMul || 1;
      var mul = dir > 0 ? cur * 1.25 : cur / 1.25;
      if (mul > this.ZOOM_MAX) mul = this.ZOOM_MAX;
      if (mul < this.ZOOM_MIN) mul = this.ZOOM_MIN;
      this.setZoom(mul);
    },
    setZoom: function (mul) {
      var m = Math.max(this.ZOOM_MIN, Math.min(this.ZOOM_MAX, mul));
      if (Math.abs(m - (this.zoomMul || 1)) < 0.001) return;
      this.zoomMul = m;
      this.resize();
    },

    /* พิกัดจอ (CSS px ใน canvas) -> tile — top-down orthographic */
    screenToTile: function (px, py) {
      var cam = DT.iso(this.cam.x, this.cam.y);
      var sx = px - this.vw / 2 + cam.sx;
      var sy = py - this.vh / 2 + cam.sy;
      return { x: sx / DT.TILE_PX, y: sy / DT.TILE_PX };
    },

    toScreen: function (x, y) {
      var p = DT.iso(x, y);
      var cam = DT.iso(this.cam.x, this.cam.y);
      var sx = p.sx - cam.sx + this.vw / 2 + (this.shakeX || 0);
      var sy = p.sy - cam.sy + this.vh / 2 + (this.shakeY || 0);
      /* snap ลงพิกเซลจอ — ทำให้การเดินดูนิ่ง ไม่สั่น/ไม่เลื่อนทแยง */
      var st = this.snap || 1;
      sx = Math.round(sx / st) * st;
      sy = Math.round(sy / st) * st;
      return { sx: sx, sy: sy };
    },

    /* ขอบเขตอาคารเป็นสี่เหลี่ยมบนจอ (top-down) */
    buildingRect: function (bd) {
      var a = this.toScreen(bd.x, bd.y);
      var b = this.toScreen(bd.x + bd.w, bd.y + bd.h);
      return { x: a.sx, y: a.sy, w: b.sx - a.sx, h: b.sy - a.sy };
    },

    /* ---------- tile ---------- */
    /* ---------- tile (top-down สี่เหลี่ยมจัตุรัส) ---------- */
    drawTile: function (ctx, tx, ty, type) {
      var p = this.toScreen(tx, ty);
      var w = DT.TILE_PX, h = DT.TILE_PX;
      if (p.sx + w < 0 || p.sx - w > this.vw || p.sy + h < 0 || p.sy - h > this.vh) return;
      var col = TILE_COLORS[type] || '#5b8f4a';
      var edge = TILE_EDGE[type] || '#4e7d3f';
      var st = tileStyle(ctx, col, w, h);
      var seed = tx * 3.7 + ty * 9.1;

      ctx.save();
      ctx.translate(p.sx, p.sy);

      /* ---------- พื้นผิวจริง (สไปรต์ tile) ----------
         ถ้าโหลดสไปรต์ได้ -> วาด tile จริงทับพื้นไล่สี
         ถ้าไม่ได้ -> ใช้วิธีเดิม (ไล่สี) ต่อ ไม่จอดำ */
      var gKey = GROUND_SPRITES[type];
      var gDrew = false;
      if (gKey && DT.Sprites) {
        /* เลือก variant ให้ไม่ซ้ำตายตัว (สลับตามตำแหน่ง) */
        var variants = GROUND_VARIANTS[gKey];
        if (variants && variants.length > 1) {
          gKey = variants[Math.abs((tx * 7 + ty * 13)) % variants.length];
        }
        /* ขยายให้เต็ม tile เสมอ (ไม่ขึ้นกับขนาดไฟล์) */
        var img = DT.Sprites.get(gKey);
        if (img) {
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          try {
            ctx.drawImage(img, 0, 0, img.naturalWidth || img.width, img.naturalHeight || img.height,
              0, 0, w, h);
            gDrew = true;
          } catch (err) { gDrew = false; }
          ctx.restore();
        }
      }

      /* ตัว tile — สี่เหลี่ยมจัตุรัส (top-down) */
      if (!gDrew) {
        ctx.fillStyle = st.grad;
        ctx.fillRect(0, 0, w, h);
      }

      /* เนื้อผิวตามแบบ tile (สลับตามตำแหน่ง ไม่ซ้ำตายตัว) */
      if (type === T.GRASS) {
        if (((tx * 7 + ty * 13) % 3) === 0) {
          var gh = Art.hash(seed, 3.7);
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          ctx.beginPath();
          ctx.ellipse(w * 0.15 + gh * w * 0.7, h * 0.2 + Art.hash(seed, 5.1) * h * 0.6,
            w * 0.14, h * 0.11, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        if (((tx * 7 + ty * 13) % 5) === 0) {
          Art.grassTuft(ctx, w * 0.3, h * 0.65, this.zoom, this.t, tx + ty);
        }
      } else if (type === T.PATH) {
        var ph = Art.hash(seed, 2.9);
        ctx.fillStyle = 'rgba(255,255,255,0.13)';
        ctx.beginPath();
        ctx.ellipse(w * 0.15 + ph * w * 0.7, h * 0.2 + Art.hash(seed, 6.1) * h * 0.6,
          w * 0.12, h * 0.10, ph * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.10)';
        ctx.beginPath();
        ctx.ellipse(w * 0.6, h * 0.55, w * 0.13, h * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (type === T.STONE) {
        /* ลายแผ่นหิน: เต็มสี่เหลี่ยมตรง (ไม่มีเส้นทแยง เพื่อให้แผนที่ดูไม่เอียง) */
        ctx.strokeStyle = 'rgba(0,0,0,0.13)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(w * 0.5, 0); ctx.lineTo(w * 0.5, h);
        ctx.moveTo(0, h * 0.5); ctx.lineTo(w, h * 0.5);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(0, 0, w * 0.45, h * 0.45);
      } else if (type === T.SAND) {
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        var sh3 = Art.hash(seed, 4.3);
        ctx.beginPath();
        ctx.arc(w * 0.15 + sh3 * w * 0.7, h * 0.2 + Art.hash(seed, 8.9) * h * 0.6,
          w * 0.06, 0, Math.PI * 2);
        ctx.fill();
      } else if (type === T.DIRT) {
        if (((tx * 5 + ty * 3) % 2) === 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.13)';
          var dh = Art.hash(seed, 7.1);
          ctx.beginPath();
          ctx.ellipse(w * 0.15 + dh * w * 0.7, h * 0.2 + Art.hash(seed, 2.3) * h * 0.6,
            w * 0.09, h * 0.08, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (type === T.FIELD) {
        /* แถวพืช */
        ctx.strokeStyle = 'rgba(96,124,50,0.55)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(w * 0.15, h * 0.32); ctx.lineTo(w * 0.85, h * 0.32);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(220,200,110,0.55)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(w * 0.15, h * 0.62); ctx.lineTo(w * 0.85, h * 0.62);
        ctx.stroke();
      } else if (type === T.FLOOR) {
        /* แผ่นไม้พื้น */
        ctx.strokeStyle = 'rgba(60,44,24,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, h * 0.5); ctx.lineTo(w, h * 0.5);
        ctx.stroke();
      } else if (type === T.WATER) {
        this.drawWater(ctx, 0, 0, w, h, tx, ty, p.sx, p.sy);
      }

      /* ขอบ tile (เบา ๆ ให้เห็นตาราง) */
      ctx.strokeStyle = edge;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
      ctx.globalAlpha = 1;

      ctx.restore();
    },

    /* ---------- น้ำ: คลื่น + วงแหวน + สะท้อนแสง (top-down) ---------- */
    drawWater: function (ctx, sx, sy, w, h, tx, ty, absX, absY) {
      var t = this.t;

      /* สีน้ำสะท้อนท้องฟ้า */
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(sx, sy, w, h);

      /* เส้นคลื่น 2 ชั้น ไหลตามเวลา (แนวนอน) */
      for (var i = 0; i < 2; i++) {
        var ph = t * (1.1 + i * 0.35) + tx * 0.6 + ty * 0.9 + i * 1.7;
        var yy = sy + h * (0.28 + i * 0.34);
        ctx.strokeStyle = 'rgba(210,238,255,' + (0.16 + 0.06 * (i % 2)) + ')';
        ctx.lineWidth = 1.1 + i * 0.25;
        ctx.beginPath();
        ctx.moveTo(sx + w * 0.12, yy + Math.sin(ph) * 1.4);
        ctx.quadraticCurveTo(sx + w * 0.36, yy - 2.2 + Math.sin(ph + 0.8) * 1.1,
          sx + w * 0.58, yy + Math.sin(ph + 1.6) * 1.3);
        ctx.quadraticCurveTo(sx + w * 0.76, yy + 2.2 + Math.sin(ph + 2.2) * 1.1,
          sx + w * 0.92, yy + Math.sin(ph + 2.8) * 1.2);
        ctx.stroke();
      }

      /* วงแหวนกระเพื่อม */
      var rip = (t * 0.55 + Art.hash(tx, ty)) % 1;
      ctx.strokeStyle = 'rgba(220,245,255,' + (0.22 * (1 - rip)).toFixed(3) + ')';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(sx + w * (0.2 + Art.hash(tx, ty) * 0.6), sy + h * (0.2 + Art.hash(ty, tx) * 0.6),
        w * 0.08 + rip * w * 0.3, h * 0.08 + rip * h * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();

      /* ประกายแสงสะท้อนจากดวงอาทิตย์/จันทร์ */
      var sun = this.sunScreen;
      var isNight = this.sunState && this.sunState.night;
      var sp = isNight ? this.moonScreen : sun;
      if (sp) {
        var dx = sp.x - (absX == null ? sx : absX);
        var dy = sp.y - (absY == null ? sy : absY);
        if (dx * dx + dy * dy < (this.vw * 0.9) * (this.vw * 0.9)) {
          var tw = 0.5 + 0.5 * Math.sin(t * 3.4 + tx + ty);
          ctx.fillStyle = isNight
            ? 'rgba(200,225,255,' + (0.18 + 0.12 * tw).toFixed(3) + ')'
            : 'rgba(255,246,200,' + (0.24 + 0.16 * tw).toFixed(3) + ')';
          ctx.beginPath();
          ctx.ellipse(sx + w * 0.5 + dx * 0.02, sy + h * 0.5 + dy * 0.03,
            w * 0.16 * (0.6 + tw * 0.6), h * 0.16 * (0.6 + tw * 0.6), 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      /* เงาสีน้ำเข้มชัดขึ้นตอนกลางคืน */
      if (isNight) {
        ctx.fillStyle = 'rgba(20,30,60,0.22)';
        ctx.fillRect(sx, sy, w, h);
      }
    },

    drawNode: function (ctx, n) {
      var p = this.toScreen(n.x + 0.5, n.y + 0.5);
      var z = this.zoom;
      var empty = n.amount <= 0;
      ctx.globalAlpha = empty ? 0.22 : 1;
      Art.groundShadow(ctx, p.sx, p.sy, 10, z, 0.22, this.hour);
      var nseed = n.x * 1.7 + n.y * 3.3;
      if (n.type === 'tree') Art.tree(ctx, p.sx, p.sy, z, this.t, nseed);
      else if (n.type === 'rock') Art.rock(ctx, p.sx, p.sy, z, false, nseed);
      else if (n.type === 'ore') Art.rock(ctx, p.sx, p.sy, z, true, nseed);
      else if (n.type === 'platino') Art.platino(ctx, p.sx, p.sy, z, this.t, nseed);
      else Art.bush(ctx, p.sx, p.sy, z, this.t, n.x * 2.1 + n.y * 5.7);
      ctx.globalAlpha = 1;

      if (!empty && n.amount < n.max) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(p.sx - 12 * z, p.sy + 4 * z, 24 * z, 3.5 * z);
        ctx.fillStyle = '#9be89b';
        ctx.fillRect(p.sx - 12 * z, p.sy + 4 * z, 24 * z * (n.amount / n.max), 3.5 * z);
      }
    },

    /* ---------- มอนส์ ----------
       ความสูงของแถบ HP/ชื่อ: อ่านสเปกสไปรต์จริงถ้ามี (สูงขึ้น = แถบยิ่งสูงขึ้น)
       ถ้าไม่มีสไปรต์ (lazy load ยังไม่เสร็จ) ใช้ค่ากลาง 26 เหมือนเดิม — ไม่จอดำ */
    mobTopOffset: function (type) {
      var S = window.DT && DT.Sprites;
      var sp = null;
      if (S && S.SPEC) {
        sp = S.SPEC['mobs/' + type + '.png'] || null;
        if (sp && !sp.src) sp = null;
      }
      var h = sp ? (sp.src[3] * (sp.sc || 1)) : 26;
      /* clamp: ไม่ต่ำกว่า 20 ไม่สูงกว่า 52 (กันแถบล้นเลย / ทับสไปรต์ข้างเคียง) */
      if (h < 20) h = 20;
      if (h > 52) h = 52;
      return h + 4;
    },

    drawMob: function (ctx, m) {
      var p = this.toScreen(m.x, m.y);
      var z = this.zoom;
      var def = DT.MOBS[m.type] || {};
      Art.groundShadow(ctx, p.sx, p.sy, 9, z, 0.25, this.hour);
      Art.mob(ctx, p.sx, p.sy, z, m.type, { t: this.t, hurt: m.hitFlash, seed: m.x });

      /* hp bar — ความสูงคำนวณจากสไปรต์จริง (fallback shape-art ใช้ค่ากลาง) */
      var top = this.mobTopOffset(m.type) * z;
      var w = 26 * z;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(p.sx - w / 2, p.sy - top, w, 4.5 * z);
      var ratio = Math.max(0, m.hp / m.maxHp);
      ctx.fillStyle = ratio > 0.4 ? '#ff6b6b' : '#ff9a3c';
      ctx.fillRect(p.sx - w / 2, p.sy - top, w * ratio, 4.5 * z);

      /* ชื่อ + ระดับอันตราย */
      ctx.font = (10 * z) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText((def.icon || '') + ' ' + (def.name || ''), p.sx, p.sy - (top + 4) * z);
    },

    /* ---------- ผู้เล่น ---------- */
    drawPlayer: function (ctx, pl, isLocal) {
      var p = this.toScreen(pl.x, pl.y);
      var z = this.zoom;
      var info = pl.profInfo();

      if (!pl.alive) {
        Art.shadow(ctx, p.sx, p.sy, 10, z, 0.2);
        ctx.font = (18 * z) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💀', p.sx, p.sy - 10 * z);
        ctx.font = (10 * z) + 'px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText('กลับใน ' + Math.ceil(pl.respawnT) + 's', p.sx, p.sy - 24 * z);
        return;
      }

      Art.groundShadow(ctx, p.sx, p.sy, 10, z, 0.28, this.hour);
      Art.player(ctx, p.sx, p.sy, z, {
        prof: pl.prof, t: this.t, moving: !!pl.moving,
        running: !!pl.running,
        waving: !!pl.waving,
        hurt: pl.hurtFlash, swing: pl.swing, weapon: Art.toolIcon(pl.weapon),
        dir: pl.dir || 'down',
        seed: pl.x * 0.7 + pl.y * 1.3
      });

      /* ชื่อ */
      ctx.font = (11 * z) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(pl.name + ' ' + info.icon, p.sx + 1, p.sy - 34 * z + 1);
      ctx.fillStyle = isLocal ? '#fff6d8' : '#cfe8ff';
      ctx.fillText(pl.name + ' ' + info.icon, p.sx, p.sy - 34 * z);

      /* hp bar */
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(p.sx - 16 * z, p.sy - 42 * z, 32 * z, 4.5 * z);
      ctx.fillStyle = pl.hp > 40 ? '#6fe06f' : '#ff6b6b';
      ctx.fillRect(p.sx - 16 * z, p.sy - 42 * z, 32 * z * Math.max(0, pl.hp / pl.maxHp), 4.5 * z);

      /* แถบเก็บของ */
      if (pl.gatherT > 0 && pl.gatherTarget) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(p.sx - 16 * z, p.sy - 49 * z, 32 * z, 4.5 * z);
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(p.sx - 16 * z, p.sy - 49 * z, 32 * z * (DT.Game.progress || 0), 4.5 * z);
      }

      /* บอทแชท */
      if (pl.chatT > 0 && pl.chat) {
        ctx.font = (11 * z) + 'px sans-serif';
        var tw = ctx.measureText(pl.chat).width;
        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        ctx.fillRect(p.sx - tw / 2 - 5 * z, p.sy - 66 * z, tw + 10 * z, 17 * z);
        ctx.fillStyle = '#fff';
        ctx.fillText(pl.chat, p.sx, p.sy - 53 * z);
      }
    },

    /* ---------- NPC ---------- */
    drawNpc: function (ctx, n) {
      var p = this.toScreen(n.x, n.y);
      var z = this.zoom;
      Art.groundShadow(ctx, p.sx, p.sy, 10, z, 0.25, this.hour);
      /* ตัว NPC = สไปรต์ตัวละครย้อมสี (fallback = Art.player shape) */
      Art.npc(ctx, p.sx, p.sy, z, {
        sprite: n.sprite,
        prof: n.prof,
        tint: n.tint || '#9aa66a',
        t: this.t + n.x,
        seed: n.x,
        dir: n.dir || 'down'
      });
      /* ป้าย */
      ctx.font = (11 * z) + 'px sans-serif';
      ctx.textAlign = 'center';
      var label = n.icon + ' ' + n.name;
      var tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(20,14,6,0.78)';
      ctx.fillRect(p.sx - tw / 2 - 6 * z, p.sy - 36 * z, tw + 12 * z, 16 * z);
      ctx.fillStyle = '#f2d98a';
      ctx.fillText(label, p.sx, p.sy - 24 * z);

      if (n.bubble > 0) {
        ctx.font = (10 * z) + 'px sans-serif';
        var bw = ctx.measureText(n.greeting).width;
        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        ctx.fillRect(p.sx - bw / 2 - 6 * z, p.sy - 54 * z, bw + 12 * z, 16 * z);
        ctx.fillStyle = '#fff';
        ctx.fillText(n.greeting, p.sx, p.sy - 42 * z);
      }
    },

    /* ---------- กองไฟ ---------- */
    drawCampfire: function (ctx, f) {
      var p = this.toScreen(f.x, f.y);
      var z = this.zoom;
      Art.groundShadow(ctx, p.sx, p.sy, 10, z, 0.22, this.hour);
      Art.campfire(ctx, p.sx, p.sy, z, this.t);
    },

    /* ---------- ของที่ตกพื้น ---------- */
    drawDrop: function (ctx, d) {
      var p = this.toScreen(d.x, d.y);
      var z = this.zoom;
      var bob = Math.sin(this.t * 3 + d.x) * 2 * z;
      var def = DT.ITEMS[d.item] || {};
      ctx.globalAlpha = 0.9;
      Art.groundShadow(ctx, p.sx, p.sy, 5, z, 0.2, this.hour);
      ctx.font = (14 * z) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(def.icon || '•', p.sx, p.sy - 6 * z + bob);
      ctx.globalAlpha = 1;
    },

    /* ---------- ฉากหลัง (ฟ้า/แสง) ---------- */
    drawSky: function (nightAmt) {
      var ctx = this.ctx;
      var hour = this.hour == null ? 12 : this.hour;
      var st = Art.sunState(hour);
      this.sunState = st;
      var pal = skyPalette(hour);
      this.skyPal = pal;

      /* gradient นุ่ม 3 ชั้น: เที่ยง -> เย็น -> กลางคืน */
      var g = ctx.createLinearGradient(0, 0, 0, this.vh);
      g.addColorStop(0, pal.top);
      g.addColorStop(0.55, pal.mid);
      g.addColorStop(1, pal.bot);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.vw, this.vh);

      /* ดาวตอนกลางคืน */
      if (st.night || nightAmt > 0.35) {
        var starA = Math.max(0, Math.min(1, (nightAmt - 0.3) / 0.6));
        ctx.save();
        ctx.globalAlpha = 0.85 * starA;
        ctx.fillStyle = '#ffffff';
        for (var s = 0; s < 26; s++) {
          var sx2 = Art.hash(s, 1.3) * this.vw;
          var sy2 = Art.hash(s, 7.7) * this.vh * 0.55;
          var tw = 0.5 + 0.5 * Math.sin(this.t * 2.2 + s);
          ctx.globalAlpha = starA * (0.25 + 0.7 * tw);
          ctx.beginPath();
          ctx.arc(sx2, sy2, 0.6 + tw * 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      /* ดวงอาทิตย์ */
      if (!st.night) {
        var sp = celestialPos(hour, this.vw, this.vh, false);
        this.sunScreen = sp;
        var glow = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, 90);
        glow.addColorStop(0, 'rgba(255,238,170,0.55)');
        glow.addColorStop(0.35, 'rgba(255,214,120,0.20)');
        glow.addColorStop(1, 'rgba(255,200,100,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 90, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff3c0';
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,235,0.9)';
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 8, 0, Math.PI * 2);
        ctx.fill();
      } else {
        this.sunScreen = null;
      }

      /* ดวงจันทร์ (ตอนกลางคืน) */
      if (st.night) {
        var mp = celestialPos(hour, this.vw, this.vh, true);
        this.moonScreen = mp;
        var mg = ctx.createRadialGradient(mp.x, mp.y, 0, mp.x, mp.y, 70);
        mg.addColorStop(0, 'rgba(200,225,255,0.42)');
        mg.addColorStop(1, 'rgba(160,190,255,0)');
        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.arc(mp.x, mp.y, 70, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f2f0dd';
        ctx.beginPath();
        ctx.arc(mp.x, mp.y, 11, 0, Math.PI * 2);
        ctx.fill();
        /* แจกม (ครึ่งจันทร์) */
        ctx.fillStyle = pal.mid;
        ctx.beginPath();
        ctx.arc(mp.x - 5, mp.y - 2.5, 9.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        this.moonScreen = null;
      }

      /* เมฆลอย 3 ชั้น (หลัง/กลาง/หน้า) — สีตามเวลา */
      var cloudLight = st.night ? '#3b4468' : (st.warm ? '#f6c6a8' : '#ffffff');
      var cloudDark = st.night ? '#232a4a' : (st.warm ? '#e79a72' : '#dfe8f2');
      for (var layer = 0; layer < 2; layer++) {
        var speed = 5 + layer * 8;
        var count = 3 + layer;
        var scale = 0.75 + layer * 0.45;
        for (var i = 0; i < count; i++) {
          var span = this.vw + 460 * scale;
          var cx = ((this.t * speed + i * (span / count) + layer * 137) % span) - 230 * scale;
          var cy = (18 + layer * 34) + (i % 3) * 26 * (0.6 + layer * 0.3);
          var rw = (34 + (i % 3) * 14) * scale;
          var rh = rw * 0.42;
          ctx.globalAlpha = 0.30 + layer * 0.12;
          ctx.fillStyle = cloudDark;
          ctx.beginPath();
          ctx.ellipse(cx, cy + 4, rw * 1.05, rh * 0.95, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = cloudLight;
          ctx.beginPath();
          ctx.ellipse(cx - rw * 0.35, cy, rw * 0.62, rh * 0.9, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(cx + rw * 0.15, cy - rh * 0.35, rw * 0.5, rh * 0.85, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(cx + rw * 0.55, cy + 1, rw * 0.44, rh * 0.72, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    },

    /* ---------- ฝน ---------- */
    drawRain: function () {
      var ctx = this.ctx;
      ctx.save();
      ctx.lineCap = 'round';
      var n = 70;
      for (var i = 0; i < n; i++) {
        var seed = i * 137.5;
        var x = (seed * 7.3 + this.t * 260) % (this.vw + 60) - 30;
        var y = (seed * 13.7 + this.t * 620) % (this.vh + 40) - 20;
        var len = 9 + (i % 4) * 3;
        ctx.strokeStyle = 'rgba(190,215,235,' + (0.28 + (i % 5) * 0.06).toFixed(2) + ')';
        ctx.lineWidth = 0.9 + (i % 3) * 0.35;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 3, y + len);
        ctx.stroke();
      }
      ctx.restore();
    },

    drawFog: function () {
      var ctx = this.ctx;
      var g = ctx.createLinearGradient(0, 0, 0, this.vh);
      g.addColorStop(0, 'rgba(214,224,228,0.36)');
      g.addColorStop(1, 'rgba(198,208,214,0.22)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.vw, this.vh);
    },

    /* ---------- วาดทั้งฉาก ---------- */
    draw: function (players, localId, nightAmt) {
      var ctx = this.ctx, world = this.world;
      var room = (root.DT.Game && DT.Game.room) ? DT.Game.room : null;
      var map = room ? room.map : world.map;
      this.t += 1 / 60;
      /* เวลาในวัน (ใช้คำนวณทิศเงา/สีฟ้า) */
      this.hour = (world && world.time != null && DT.gameHour) ? DT.gameHour(world.time) : 12;

      /* --- สั่นกล้อง (จากการโดนตี/ระเบิด) --- */
      var sh = (root.DT.FX && DT.FX.takeShake) ? DT.FX.takeShake(1 / 60) : 0;
      var shx = 0, shy = 0;
      if (sh > 0) {
        shx = (Math.random() - 0.5) * sh;
        shy = (Math.random() - 0.5) * sh;
      }

      this.drawSky(nightAmt);

      this.shakeX = shx; this.shakeY = shy;

      /* --- พื้น --- */
      var span = Math.max(this.vw, this.vh) / DT.TILE_PX + 3;
      var x0 = Math.max(0, Math.floor(this.cam.x - span));
      var x1 = Math.min(map.w - 1, Math.floor(this.cam.x + span));
      var y0 = Math.max(0, Math.floor(this.cam.y - span));
      var y1 = Math.min(map.h - 1, Math.floor(this.cam.y + span));
      for (var y = y0; y <= y1; y++) {
        for (var x = x0; x <= x1; x++) {
          this.drawTile(ctx, x, y, map.grid[y * map.w + x]);
        }
      }

      /* --- อาคาร (top-down) --- */
      if (!room) {
        /* (วาดในลูป depth ด้านล่าง เพื่อให้ผู้เล่นเดินหลังอาคารได้) */
      } else {
        /* --- ภายในห้อง: ผนัง (top-down เป็นบล็อกเต็ม tile) + เฟอร์นิเจอร์ + จุดใช้งาน --- */
        var iw = DT.TILE_PX, ih = DT.TILE_PX;
        for (var wy = 0; wy < map.h; wy++) {
          for (var wx = 0; wx < map.w; wx++) {
            if (map.grid[wy * map.w + wx] !== T.WALL) continue;
            var wp = this.toScreen(wx, wy);
            ctx.fillStyle = '#6f5943';
            ctx.fillRect(wp.sx, wp.sy, iw, ih);
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            ctx.fillRect(wp.sx + iw - 2 * this.zoom, wp.sy, 2 * this.zoom, ih);
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect(wp.sx, wp.sy, iw, 2 * this.zoom);
          }
        }
        /* เฟอร์นิเจอร์ */
        for (var fu = 0; fu < room.furniture.length; fu++) {
          var f = room.furniture[fu];
          var fp = this.toScreen(f.x + 0.5, f.y + 0.5);
          Art.furniture(ctx, f, fp.sx, fp.sy, this.zoom, this.t);
        }
        /* จุดใช้งาน */
        for (var sti = 0; sti < room.stations.length; sti++) {
          var stt = room.stations[sti];
          var sp2 = this.toScreen(stt.x + 0.5, stt.y + 0.5);
          Art.station(ctx, stt, sp2.sx, sp2.sy, this.zoom, this.t);
        }
        /* ป้ายบอกว่าอยู่ในห้องอะไร */
        ctx.font = (13 * this.zoom) + 'px sans-serif';
        ctx.textAlign = 'center';
        var rt = '🏠 ' + room.def.name;
        var rw = ctx.measureText(rt).width;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.vw / 2 - rw / 2 - 8 * this.zoom, 10, rw + 16 * this.zoom, 20 * this.zoom);
        ctx.fillStyle = '#f2e4b8';
        ctx.fillText(rt, this.vw / 2, 24 * this.zoom);
      }

      /* --- รวม entity เรียงตาม depth --- */
      var ents = [];
      if (room) {
        /* ในห้องมีแค่ผู้เล่นตัวเอง (คนอื่นอยู่ข้างนอกเมือง) */
        for (var rp = 0; rp < players.length; rp++) {
          if (players[rp].id === localId) {
            ents.push({ d: players[rp].y * 1000 + players[rp].x, kind: 'player', o: players[rp] });
          }
        }
        ents.sort(function (a, b) { return a.d - b.d; });
        for (var re = 0; re < ents.length; re++) {
          this.drawPlayer(ctx, ents[re].o, ents[re].o.id === localId);
        }
        /* particle + แสง + อากาศ */
        this.drawParticles(world);
        this.drawNightOverlay(players, localId, nightAmt);
        if (world.weather === 'rain') this.drawRain();
        else if (world.weather === 'fog') this.drawFog();
        this.drawPointer(players, localId);
        return;
      }
      for (var bld = 0; bld < map.buildings.length; bld++) {
        var bdo = map.buildings[bld];
        if (bdo.x + bdo.w < x0 - 3 || bdo.x > x1 + 3 || bdo.y + bdo.h < y0 - 3 || bdo.y > y1 + 3) continue;
        ents.push({ d: (bdo.y + bdo.h) * 1000 + bdo.x, kind: 'building', o: bdo });
      }
      for (var i = 0; i < world.nodes.length; i++) {
        var n = world.nodes[i];
        if (n.x < x0 - 3 || n.x > x1 + 3 || n.y < y0 - 3 || n.y > y1 + 3) continue;
        ents.push({ d: n.y * 1000 + n.x, kind: 'node', o: n });
      }
      for (var cf = 0; cf < world.campfires.length; cf++) {
        ents.push({ d: world.campfires[cf].y * 1000 + world.campfires[cf].x, kind: 'fire', o: world.campfires[cf] });
      }
      for (var d = 0; d < world.drops.length; d++) {
        ents.push({ d: world.drops[d].y * 1000 + world.drops[d].x, kind: 'drop', o: world.drops[d] });
      }
      for (var np = 0; np < world.npcs.length; np++) {
        ents.push({ d: world.npcs[np].y * 1000 + world.npcs[np].x, kind: 'npc', o: world.npcs[np] });
      }
      for (var m = 0; m < world.mobs.length; m++) {
        ents.push({ d: world.mobs[m].y * 1000 + world.mobs[m].x, kind: 'mob', o: world.mobs[m] });
      }
      for (var p = 0; p < players.length; p++) {
        ents.push({ d: players[p].y * 1000 + players[p].x, kind: 'player', o: players[p] });
      }
      ents.sort(function (a, b) { return a.d - b.d; });
      for (var e = 0; e < ents.length; e++) {
        var it = ents[e];
        if (it.kind === 'building') Art.building(ctx, it.o, this.buildingRect(it.o), this.zoom);
        else if (it.kind === 'node') this.drawNode(ctx, it.o);
        else if (it.kind === 'fire') this.drawCampfire(ctx, it.o);
        else if (it.kind === 'drop') this.drawDrop(ctx, it.o);
        else if (it.kind === 'npc') this.drawNpc(ctx, it.o);
        else if (it.kind === 'mob') this.drawMob(ctx, it.o);
        else this.drawPlayer(ctx, it.o, it.o.id === localId);
      }

      /* --- particle / แสงกลางคืน / อากาศ / ตัวชี้นำ --- */
      this.drawParticles(world);
      this.drawNightOverlay(players, localId, nightAmt);
      if (world.weather === 'rain') this.drawRain();
      else if (world.weather === 'fog') this.drawFog();
      this.drawPointer(players, localId);
    },

    /* ---------- particle ---------- */
    drawParticles: function (world) {
      var ctx = this.ctx;
      for (var q = 0; q < world.particles.length; q++) {
        var pt = world.particles[q];
        var pp = this.toScreen(pt.x, pt.y);
        ctx.globalAlpha = Math.max(0, 1 - pt.t / pt.life);
        if (pt.text) {
          ctx.font = (13 * this.zoom) + 'px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          var label = pt.label || pt.c;
          /* สี = pt.c ถ้ามี label (ของใหม่) · ถ้าไม่มี label (ของเก่า = emoji) ใช้สีพื้นฐาน */
          var col = pt.label ? pt.c : '#f2e4b8';
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillText(label, pp.sx + 1, pp.sy - 20 * this.zoom + pt.t * 20 + 1);
          ctx.fillStyle = col;
          ctx.fillText(label, pp.sx, pp.sy - 20 * this.zoom + pt.t * 20);
        } else if (pt.leaf) {
          /* ใบไม้: วงรีบใบ */
          ctx.fillStyle = pt.c;
          ctx.beginPath();
          ctx.ellipse(pp.sx, pp.sy - 10 * this.zoom, (pt.r || 2) * this.zoom * 1.6,
            (pt.r || 2) * this.zoom * 0.6, pt.t * 3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = pt.c;
          ctx.beginPath();
          ctx.arc(pp.sx, pp.sy - 10 * this.zoom, (pt.r || 2) * this.zoom, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    },

    /* ---------- แสงกลางคืน ---------- */
    drawNightOverlay: function (players, localId, nightAmt) {
      if (nightAmt <= 0.01) return;
      var ctx = this.ctx, world = this.world;
      /* น้ำหนักความมืดไล่จากบนลงล่างนุ่มกว่าเดิม */
      var g = ctx.createLinearGradient(0, 0, 0, this.vh);
      g.addColorStop(0, 'rgba(10,16,44,' + (nightAmt * 0.60).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(16,22,52,' + (nightAmt * 0.40).toFixed(3) + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.vw, this.vh);
      for (var fc = 0; fc < world.campfires.length; fc++) {
        var fp = this.toScreen(world.campfires[fc].x, world.campfires[fc].y);
        Art.glow(ctx, fp.sx, fp.sy - 8 * this.zoom, 90 * this.zoom, 'rgba(255,170,70,ALPHA)', 0.34 * nightAmt);
        /* แสงส่องพื้นรอบกองไฟ */
        Art.glow(ctx, fp.sx, fp.sy, 130 * this.zoom, 'rgba(255,150,60,ALPHA)', 0.16 * nightAmt);
      }
      for (var pl2 = 0; pl2 < players.length; pl2++) {
        var lpp = this.toScreen(players[pl2].x, players[pl2].y);
        Art.glow(ctx, lpp.sx, lpp.sy - 12 * this.zoom, 58 * this.zoom, 'rgba(255,240,190,ALPHA)', 0.22 * nightAmt);
      }
    },

    /* ---------- ตัวชี้นำ ---------- */
    drawPointer: function (players, localId) {
      var ctx = this.ctx, loc = null;
      for (var lp = 0; lp < players.length; lp++) if (players[lp].id === localId) loc = players[lp];
      if (!loc || !loc.alive) return;
      var gp = this.toScreen(loc.x, loc.y);
      ctx.strokeStyle = 'rgba(255,240,180,0.55)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(gp.sx, gp.sy, 13 * this.zoom, 6 * this.zoom, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  };
})(window);
