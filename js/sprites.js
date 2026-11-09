/* =========================================================
   DUNGEON TOWN — sprites.js : ตัวโหลดภาพสไปรต์ (Kenney CC0)
   - โหลดแบบ lazy: ครั้งแรกที่ขอภาพจะ "สั่งโหลด" แล้วคืน null
     -> ผู้เรียก (art.js) วาดรูปทรงเดิมไว้ก่อน แล้วค่อยสลับเป็นสไปรต์
        เมื่อภาพโหลดเสร็จ (ไม่ทำให้เฟรมสะดุด ไม่ทำให้จอดำ)
   - แคชรูป + แคชสีย้อม (tint) สำหรับแยกอาชีพ
   - รองรับ single-file build: window.__DT_SPRITE_DATA__ = { key: dataURL }
   - ถ้าโหลดไม่ขึ้น (เช่น เปิดไฟล์โดยไม่มี assets/) -> failed[key] = true
     แล้วไม่ลองใหม่อีก ใช้รูปทรงเดิมต่อไป (fallback ปลอดภัย)
   ========================================================= */
(function (root) {
  'use strict';
  var DT = root.DT || (root.DT = {});
  var S = DT.Sprites = {};

  /* โฟลเดอร์ภาพ (relative จาก index.html) */
  S.BASE = 'assets/';

  /* ข้อมูลภาพแบบ inline สำหรับ single-file build (base64 data URL) */
  S.inline = root.__DT_SPRITE_DATA__ || null;

  S.cache = {};    /* key -> {img, ok} */
  S.failed = {};   /* key -> true (โหลดไม่ได้) */
  S.tints = {};    /* key|color|alpha -> canvas */
  S.stats = { loaded: 0, failed: 0 };
  S.enabled = true; /* ตั้ง false = บังคับใช้รูปทรงเดิม (ใช้ตอนเทียบ/ดีบัก) */

  /* ------------------------------------------------------------
     ตารางตัดภาพ + ขนาด/จุดยึด ต่อไฟล์
       src : [x, y, w, h] พิกเซลในภาพต้นฉบับ (16x16)
       sc  : ตัวคูณขนาด (2 = 1 พิกเซลภาพ = 2 หน่วยวาด)
       dy  : จุดยึด "กลางล่าง" เทียบกับพิกัดที่วาด (บวก = ต่ำลง)
       หมายเหตุ: ตัดตาม bbox จริงของพิกเซลที่ไม่โปร่งใส
         - characters/player_up.png มีภาพของเซลล์ข้างเคียงปนอยู่ที่ x=11..15
           -> ตัดทิ้ง (เก็บแค่ตัวฮีโร่ x=0..9)
     ------------------------------------------------------------ */
  S.SPEC = {
    /* --- ตัวละคร (ผู้เล่น) --- */
    /* ตัดแถวบน (y=0..1) ทิ้ง เพราะเป็นภาพเศษของตัวละครในเซลล์ข้างเคียง
       (มีสีน้ำตาลคนละตัวปนอยู่) -> เหลือแค่ตัวฮีโร่ y=2..15
       ฝั่งข้าง = mirror ของ player_down (ชุด CC0 นี้ไม่มีท่า side จริง) */
    'characters/player_down.png': { src: [0, 2, 11, 14], sc: 2, dy: 0 },
    'characters/player_up.png':   { src: [0, 2, 10, 14], sc: 2, dy: 0 },
    'characters/player_side.png': { src: [5, 2, 11, 14], sc: 2, dy: 0 },

    /* --- ต้นไม้/พุ่ม/หิน --- */
    /* ต้นไม้: ตัดเฉพาะกรอบที่มีภาพจริง (ไม่ตัดตัวต้นไม้ขาด)
       dy ถูกเทียบกับ shape art: relBot = dy - 1
         variant 0 (ทรงพุ่มใบกลมใหญ่) -> relBot 4  -> dy 5
         variant 1 (ทรงพุ่มใบแฉก)      -> relBot 6  -> dy 7 */
    'objects/tree_green_large.png': { src: [0, 0, 16, 16], sc: 2, dy: 5 },
    'objects/tree_green.png':      { src: [2, 0, 13, 16], sc: 2, dy: 7 },
    'objects/tree_gold_round.png': { src: [0, 0, 15, 15], sc: 2, dy: 5 },
    'objects/tree_autumn.png':     { src: [2, 1, 13, 15], sc: 2, dy: 5 },
    /* หิน: ใช้เฉพาะก้อนที่แยกเป็นวัตถุเดี่ยว
       (rock_boulder/rock_small ถูกถอดเพราะเป็น tile ที่ภาพชนขอบ) */
    'objects/urban_rock.png':      { src: [2, 3, 12, 11], sc: 2, dy: 11 },
    'objects/city_rock.png':       { src: [3, 2, 10, 11], sc: 2, dy: 11 },
    /* พุ่ม urban เป็นพุ่มสูง (พุ่งขึ้น) จึงตัดเต็มความสูง ไม่ตัดใบทิ้ง */
    /* พุ่ม: bush/bush_gold = กอพุ่มเตี้ยบนพื้น, urban_bush = พุ่มพุ่งสูง */
    'objects/bush.png':            { src: [2, 7, 12, 9],  sc: 2, dy: 6 },
    'objects/bush_gold.png':       { src: [2, 7, 12, 9],  sc: 2, dy: 6 },
    'objects/urban_bush.png':      { src: [3, 3, 10, 13], sc: 2, dy: 6 },
    'objects/mushrooms.png':       { src: [0, 4, 16, 9],  sc: 2, dy: 3 },

    /* --- ของในบ้าน/ดันเจอ --- */
    'objects/dungeon_torch.png':   { src: [4, 0, 8, 12],  sc: 2, dy: 0 },
    'objects/barrel_pot.png':      { src: [2, 2, 12, 13], sc: 2, dy: 2 },
    'objects/crate.png':           { src: [0, 0, 16, 16], sc: 2, dy: 4 },
    'objects/dungeon_anvil.png':   { src: [2, 4, 12, 11], sc: 2, dy: 2 },
    'objects/dungeon_table.png':   { src: [0, 0, 16, 16], sc: 2, dy: 4 },
    'objects/pot.png':             { src: [0, 0, 16, 16], sc: 2, dy: 4 },

    /* --- มอนส์ (FF 10 Basic RPG Enemies + DawnLike) ---
       FF (redshrike, CC-BY 3.0 + OGA-BY 3.0): 10 ชนิด
         slime / goblin / ghoul / skeleton / mage / imp / knight / bat / dragon / wraith
       DawnLike (CC-BY 4.0): wolf / boar
       ไฟล์ถูกครอปจาก sheet แล้ว trim ขอบ -> src ใช้เต็มภาพ (ดู tools/extract-ff-mobs.py) */
    'mobs/slime.png':    { src: [0, 0, 24, 19], sc: 1, dy: 0 },
    'mobs/wolf.png':     { src: [0, 0, 13, 12], sc: 2, dy: 0 },
    'mobs/goblin.png':   { src: [0, 0, 26, 31], sc: 1, dy: 0 },
    'mobs/boar.png':     { src: [0, 0, 13, 12], sc: 2, dy: 0 },
    'mobs/wraith.png':   { src: [0, 0, 32, 33], sc: 1, dy: 0 },
    'mobs/bat.png':      { src: [0, 0, 41, 22], sc: 1, dy: 0 },
    'mobs/imp.png':      { src: [0, 0, 33, 32], sc: 1, dy: 0 },
    'mobs/ghoul.png':    { src: [0, 0, 30, 24], sc: 1, dy: 0 },
    'mobs/skeleton.png': { src: [0, 0, 28, 45], sc: 1, dy: 0 },
    'mobs/mage.png':     { src: [0, 0, 19, 27], sc: 1, dy: 0 },
    'mobs/knight.png':   { src: [0, 0, 29, 35], sc: 1, dy: 0 },
    'mobs/dragon.png':   { src: [0, 0, 37, 34], sc: 1, dy: 0 },
    /* Platino (DawnLike, CC-BY 4.0) — easter egg ที่ซ่อนอยู่ในป่า
       license ของ Dawnlike บังคับให้ต้องใช้ + ซ่อนตัวนี้ */
    'mobs/platino.png': { src: [0, 0, 16, 16], sc: 2, dy: 0 },
    /* --- ตัวละครหญิง 4 ทิศ (CraftPix: Free Base 4-Direction Female Character Pixel Art) ---
    /*   ทุกเฟรม normalize เป็น canvas 24x34 ก้นล่างตรงกัน -> ขยับไม่กระตุก */
    /* --- อาคาร (CraftPix: Free Fantasy Medieval Village Buildings) --- */
    /* --- Boss จาก CraftPix: Free Fantasy RPG Pirate Boss Character Pack --- */

    'characters/hero_down_0.png': { src: [0, 0, 24, 34], sc: 1, dy: 0 },
    'characters/hero_down_1.png': { src: [0, 0, 24, 34], sc: 1, dy: 0 },
    'characters/hero_down_2.png': { src: [0, 0, 24, 34], sc: 1, dy: 0 },
    'characters/hero_down_3.png': { src: [0, 0, 24, 34], sc: 1, dy: 0 },
    'characters/hero_down_4.png': { src: [0, 0, 24, 34], sc: 1, dy: 0 },
    'characters/hero_down_5.png': { src: [0, 0, 24, 34], sc: 1, dy: 0 },
    'characters/hero_left_0.png': { src: [0, 0, 24, 34], sc: 1, dy: 0 },
    'characters/hero_left_1.png': { src: [0, 0, 24, 34], sc: 1, dy: 0 },
    'characters/hero_left_2.png': { src: [0, 0, 24, 34], sc: 1, dy: 0 },
    'characters/hero_left_3.png': { src: [0, 0, 24, 34], sc: 1, dy: 0 },
    'characters/hero_left_4.png': { src: [0, 0, 24, 34], sc: 1, dy: 0 },
    'characters/hero_left_5.png': { src: [0, 0, 24, 34], sc: 1, dy: 0 },
    'characters/hero_right_0.png': { src: [0, 0, 24, 34], sc: 1, dy: 0 },
    'characters/hero_right_1.png': { src: [0, 0, 24, 34], sc: 1, dy: 0 },
    'characters/hero_right_2.png': { src: [0, 0, 24, 34], sc: 1, dy: 0 },
    'characters/hero_right_3.png': { src: [0, 0, 24, 34], sc: 1, dy: 0 },
    'characters/hero_right_4.png': { src: [0, 0, 24, 34], sc: 1, dy: 0 },
    'characters/hero_right_5.png': { src: [0, 0, 24, 34], sc: 1, dy: 0 },
    'characters/hero_up_0.png': { src: [0, 0, 24, 34], sc: 1, dy: 0 },
    'characters/hero_up_1.png': { src: [0, 0, 24, 34], sc: 1, dy: 0 },
    'characters/hero_up_2.png': { src: [0, 0, 24, 34], sc: 1, dy: 0 },
    'characters/hero_up_3.png': { src: [0, 0, 24, 34], sc: 1, dy: 0 },
    'characters/hero_up_4.png': { src: [0, 0, 24, 34], sc: 1, dy: 0 },
    'characters/hero_up_5.png': { src: [0, 0, 24, 34], sc: 1, dy: 0 },
    'objects/mv_bh_large.png': { src: [0, 0, 90, 92], sc: 1, dy: 0 },
    'objects/mv_bh_med.png': { src: [0, 0, 50, 76], sc: 1, dy: 0 },
    'objects/mv_bh_small_a.png': { src: [0, 0, 38, 56], sc: 1, dy: 0 },
    'objects/mv_bh_small_b.png': { src: [0, 0, 42, 60], sc: 1, dy: 0 },
    'objects/mv_bw_large.png': { src: [0, 0, 91, 96], sc: 1, dy: 0 },
    'objects/mv_bw_med.png': { src: [0, 0, 71, 80], sc: 1, dy: 0 },
    'objects/mv_bw_small_a.png': { src: [0, 0, 42, 58], sc: 1, dy: 0 },
    'objects/mv_bw_small_b.png': { src: [0, 0, 45, 62], sc: 1, dy: 0 },
    'objects/mv_wh_large.png': { src: [0, 0, 87, 92], sc: 1, dy: 0 },
    'objects/mv_wh_med.png': { src: [0, 0, 49, 76], sc: 1, dy: 0 },
    'objects/mv_wh_small_a.png': { src: [0, 0, 38, 56], sc: 1, dy: 0 },
    'objects/mv_wh_small_b.png': { src: [0, 0, 41, 60], sc: 1, dy: 0 },
    'objects/mv_ww_large.png': { src: [0, 0, 91, 96], sc: 1, dy: 0 },
    'objects/mv_ww_med.png': { src: [0, 0, 70, 80], sc: 1, dy: 0 },
    'objects/mv_ww_small_a.png': { src: [0, 0, 39, 58], sc: 1, dy: 0 },
    'objects/mv_ww_small_b.png': { src: [0, 0, 40, 62], sc: 1, dy: 0 },
    'mobs/pirate_leader.png': { src: [0, 0, 42, 60], sc: 1, dy: 0 },
    'mobs/squidman.png': { src: [0, 0, 40, 64], sc: 1, dy: 0 },
    'mobs/pirate_zombie.png': { src: [0, 0, 39, 60], sc: 1, dy: 0 },

    /* --- พื้นผิวจริง (Kenney Roguelike RPG Pack, CC0) ---
       ใช้ sc = 3 ให้ขนาดใกล้เคียง tile 48px (16px * 3) */
    'tiles/ground/tiny_grass.png':        { src: [0, 0, 16, 16], sc: 3 },
    'tiles/ground/tiny_path.png':         { src: [0, 0, 16, 16], sc: 3 },
    'tiles/ground/tiny_stone.png':        { src: [0, 0, 16, 16], sc: 3 },
    'tiles/ground/tiny_floor.png':        { src: [0, 0, 16, 16], sc: 3 },
    'tiles/ground/tiny_grass_flowers.png':{ src: [0, 0, 16, 16], sc: 3 },
    'tiles/town/tiny_water.png':          { src: [0, 0, 16, 16], sc: 3 },
    'tiles/town/tiny_sand.png':           { src: [0, 0, 16, 16], sc: 3 },
    'tiles/town/tiny_dirt.png':           { src: [0, 0, 16, 16], sc: 3 },
    'tiles/town/tiny_field.png':          { src: [0, 0, 16, 16], sc: 3 },

    /* --- วัตถุชุด Tiny Town (palette เดียวกับพื้น) --- */
    'objects/tiny_tallgrass.png':   { src: [0, 0, 16, 16], sc: 2, dy: 6 },
    'objects/tiny_shop_sign.png':   { src: [0, 0, 16, 16], sc: 2, dy: 0 },
    'objects/tiny_awning.png':      { src: [0, 0, 16, 16], sc: 2, dy: 0 },
    'objects/tiny_rock.png':        { src: [0, 0, 13, 13], sc: 2, dy: 11 },
    'objects/tiny_rock_small.png':  { src: [0, 0, 9, 9],   sc: 2, dy: 7 },
    'objects/tiny_flowers.png':     { src: [0, 0, 8, 10],  sc: 2, dy: 6 },

    /* --- NPC (ตัวละครชุดเดียวกับผู้เล่น แต่ย้อมสี) --- */
    'characters/alt_down_6.png':  { src: [0, 0, 16, 16], sc: 2, dy: 0 },
    'characters/alt_down_7.png':  { src: [0, 0, 16, 16], sc: 2, dy: 0 },
    'characters/alt_down_10.png': { src: [0, 0, 16, 16], sc: 2, dy: 0 },

    /* --- ป้าย/สัญญาลักษณ์ร้านค้า + มลน้ำ --- */
    'objects/urban_shop_sign.png':  { src: [0, 0, 16, 16], sc: 2, dy: 0 },
    'objects/urban_shop_awning.png':{ src: [0, 0, 16, 16], sc: 2, dy: 0 },
    'objects/urban_awning_orange.png': { src: [0, 0, 16, 16], sc: 2, dy: 0 },
    'objects/shop_blue_window.png': { src: [0, 0, 16,  16], sc: 2, dy: 0 },
    'objects/city_storefront.png':  { src: [0, 0, 16, 16], sc: 2, dy: 0 },
    'objects/signboard.png':        { src: [0, 0, 16, 16], sc: 2, dy: 0 },
    'objects/signpost.png':         { src: [0, 0, 16, 16], sc: 2, dy: 0 },
    'objects/sign.png':             { src: [0, 0, 16, 16], sc: 2, dy: 0 },

    /* --- เนื้ออาคาร (ใช้เรียงซ้อน) --- */
    'objects/roof.png':            { src: [0, 0, 16, 16], sc: 3, tile: 1 },
    'objects/roof_grey.png':       { src: [0, 0, 16, 16], sc: 3, tile: 1 },
    'objects/house_wall.png':      { src: [0, 0, 16, 16], sc: 3, tile: 1 }
  };

  /* ------------------------------------------------------------
     โหลด / แคช
     ------------------------------------------------------------ */
  function url(key) {
    if (S.inline && S.inline[key]) return S.inline[key];
    return S.BASE + key;
  }

  /* ขอภาพ: คืน Image ถ้าโหลดเสร็จแล้ว, ถ้ายังไม่เสร็จ/ไม่ได้ -> null */
  S.get = function (key) {
    var e = S.cache[key];
    if (e) return e.ok ? e.img : null;
    if (S.failed[key]) return null;
    var img;
    try { img = new Image(); } catch (err) { S.failed[key] = true; return null; }
    e = S.cache[key] = { img: img, ok: false };
    img.onload = function () { e.ok = true; S.stats.loaded++; };
    img.onerror = function () {
      e.ok = false;
      S.failed[key] = true;
      S.stats.failed++;
      try { delete S.cache[key]; } catch (err2) {}
    };
    img.src = url(key);
    return null;
  };

  S.spec = function (key) {
    return S.SPEC[key] || { src: [0, 0, 16, 16], sc: 2, dy: 0 };
  };

  /* โหลดล่วงหน้าแบบไม่บล็อก (เรียกตอนเริ่มเกม) */
  S.preload = function (keys) {
    if (!keys) return;
    for (var i = 0; i < keys.length; i++) S.get(keys[i]);
  };
  S.preloadAll = function () {
    var keys = [];
    for (var k in S.SPEC) if (S.SPEC.hasOwnProperty(k)) keys.push(k);
    S.preload(keys);
  };

  /* ------------------------------------------------------------
     สีย้อม (tint) — ใช้แยกสีตัวละครตามอาชีพ
     ------------------------------------------------------------ */
  S.tinted = function (key, img, color, alpha) {
    var a = (alpha == null ? 0.22 : alpha);
    var id = key + '|' + color + '|' + a;
    var c = S.tints[id];
    if (c) return c;
    try {
      c = document.createElement('canvas');
      c.width = img.naturalWidth || img.width;
      c.height = img.naturalHeight || img.height;
      var cx = c.getContext('2d');
      cx.imageSmoothingEnabled = false;
      cx.drawImage(img, 0, 0);
      cx.globalCompositeOperation = 'source-atop';
      cx.globalAlpha = a;
      cx.fillStyle = color;
      cx.fillRect(0, 0, c.width, c.height);
    } catch (err) {
      c = img;
    }
    S.tints[id] = c;
    return c;
  };

  /* ------------------------------------------------------------
     วาดสไปรต์
     ------------------------------------------------------------ */
  /* วาดสไปรต์ยึด "กลางล่าง" ที่ (x,y) (หน่วย local px ตาม transform ปัจจุบัน)
       flip  = true  -> พลิกแนวนอน (หันซ้าย)
       tint  = สีย้อม · tintA = ความเข้ม (default 0.22)
       คืน true ถ้าวาดได้จริง / false ถ้ายังไม่พร้อม (ให้ fallback) */
  S.draw = function (ctx, key, x, y, flip, tint, tintA, scaleMul) {
    if (!S.enabled) return false;
    var img = S.get(key);
    if (!img) return false;
    var sp = S.spec(key);
    var sx = sp.src[0], sy = sp.src[1], sw = sp.src[2], sh = sp.src[3];
    var sc = sp.sc * (scaleMul || 1);
    var w = sw * sc, h = sh * sc;
    var src = tint ? S.tinted(key, img, tint, tintA) : img;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (flip) {
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.drawImage(src, sx, sy, sw, sh, -w / 2, (sp.dy || 0) - h, w, h);
    } else {
      ctx.drawImage(src, sx, sy, sw, sh, x - w / 2, y + (sp.dy || 0) - h, w, h);
    }
    ctx.restore();
    return true;
  };

  /* เรียงภาพสไปรต์เป็นพื้นผิว (ใช้กับหลังคา/ผนังบ้าน) */
  S.tile = function (ctx, key, x, y, w, h) {
    if (!S.enabled) return false;
    var img = S.get(key);
    if (!img) return false;
    if (!(w > 0) || !(h > 0)) return false;
    var sp = S.spec(key);
    var sc = sp.sc || 3;
    var artW = 16, artH = 16;
    var srcH = Math.min(artH, Math.max(1, Math.round(h / sc)));
    var dstH = srcH * sc;
    var tx = x;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    while (tx < x + w - 0.01) {
      var rest = x + w - tx;
      var full = artW * sc;
      var srcW = rest >= full ? artW : Math.max(1, Math.round(rest / sc));
      ctx.drawImage(img, 0, 0, srcW, srcH, tx, y, srcW * sc, dstH);
      tx += full;
    }
    ctx.restore();
    return true;
  };

  /* คีย์ทั้งหมดที่ใช้จริง (สำหรับ build-single.js ฝัง base64) */
  S.keys = function () {
    var keys = [];
    for (var k in S.SPEC) if (S.SPEC.hasOwnProperty(k)) keys.push(k);
    return keys;
  };
})(window);
