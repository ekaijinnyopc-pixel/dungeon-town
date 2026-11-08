# status.md — Dungeon Town / wire Kenney CC0 sprites

## งานที่กำลังทำ (active)
- ไม่มี — งานคุณภาพสไปรต์ปิดจบแล้ว (รอคำสั่งถัดไป)

## เสร็จแล้ว
- `js/sprites.js` — lazy loader + cache + failed-state + tint + inline base64 + fallback ไป shape art
- `js/art.js` — ผูกสไปรต์เข้ากับ tree/rock/ore/bush/player/building/prop (ไม่แตะ game logic)
- `index.html` — โหลด `js/sprites.js` ก่อน `js/art.js`; `js/game.js` เรียก `DT.Sprites.preloadAll()`
- `tools/build-single.js` — อ่าน keys จาก `js/sprites.js`, inline PNG เป็น base64, ข้ามไฟล์ที่หายพร้อม fallback
- crop adjacent-cell bleed ออกจาก `characters/player_up.png` (เก็บ x=0..9)

### Wiring สไปรต์ (js/art.js)
- ต้นไม้ 4 variant: `tree_green_large` / `tree_green` / `tree_gold_round` / `tree_autumn`
- หิน+แร่: `urban_rock` (หลักและ ore) + `city_rock` (variant 1) โดยวาดทับแร่เป็น gem
- พุ่ม 3 variant: `bush` / `urban_bush` / `bush_gold`
  (เลิกใช้ `bush_cluster.png` และ `grass_flowers.png` เป็นวัตถุลอย เพราะเป็น tile พื้น/canopy เต็มเฟรม)

### Calibration (ผ่าน tools/calibrate.js — relBot ของสไปรต์ = shape art เป้าหมาย)
| วัตถุ | shape art | sprite | ผล |
|---|---|---|---|
| player down/up/side | relBot -1 | relBot -1 | ✅ ตรง |
| tree v0 / v2 / v3 | relBot 4 | relBot 4 | ✅ ตรง |
| tree v1 | relBot 6 | relBot 6 | ✅ ตรง |
| rock / ore | relBot 10 | relBot 10 | ✅ ตรง |
| bush (ทั้ง 3) | relBot 5 | relBot 5 | ✅ ตรง |

### เอกสาร
- `assets/MANIFEST.md` — อัปเดตสถานะ wiring, หมายเหตุการถอด `rock_boulder`/`rock_small` (edge bleed),
  bush source = Tiny Town `tile_0007`, ตารางเทียบ shape art กับ sprite
- `assets/characters/characters.json` — บันทึก calibration + เหตุผลที่ side pose เป็น derived mirror
  (ชุด CC0 ที่มี: Roguelike Characters 2.0 / Tiny Town / 1-Bit / platformer / roguelikeModernCity
   **ไม่มี side-facing hero จริง** จึงใช้ mirror ของ `player_down`)

### ผลทดสอบ (ล่าสุด)
- ชุดหลัก 285 ผ่าน / 0 ล้มเหลว
  (test-touch 73, test-input 19, test-viewports 32, smoke-game 32, test-phase3 29, test-mouse 19, test/smoke 81)
- ชุดสไปรต์ 26 ผ่าน / 0 ล้มเหลว (test-sprites 11, test-sprite-render 10, test-sprite-fallback 5)
- รวม 311 ผ่าน / 0 ล้มเหลว
- `dist/dungeon-town.html` — single-file build สำเร็จ (inline 22 PNG, ~4 KB → ~7 KB base64, ไฟล์ 502013 bytes)
  และ test-sprite-render ผ่านบนไฟล์ single-file โดยตรง (10/0)

### เครื่องมือวัด
- `tools/measure-art.js` (port 9380), `tools/calibrate.js` (port 9381)

## หมายเหตุ
- `js/render.js` วาด `Art.groundShadow` แยก จึงเทียบ silhouette ไม่รวมเงา
- รันเทสต์ผ่าน URL `http://127.0.0.1:8931/dungeon-town/index.html` (root ถูกต้อง)
  ถ้าใช้ `http://127.0.0.1:8931/index.html` จะหา `pname` ไม่เจอ → เทสต์ fail ทั้งชุด (ไม่ใช่ regression)

## รอพี่เอ
- ไม่มี (ยังไม่ commit — ตามที่สั่ง)

## กฎ
- PNG โหลดจาก `assets/` แบบ relative (ได้ทั้งโฟลเดอร์และ single-file)
- cache + `ctx.imageSmoothingEnabled = false`
- lazy load + fallback shape ทันทีเมื่อโหลดไม่ได้ (ห้ามจอดำ/เกมพัง)
- คง API เดิมของ `DT.Art`
