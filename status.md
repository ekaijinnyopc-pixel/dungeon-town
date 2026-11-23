# status.md — Dungeon Town / wire Kenney CC0 sprites

## งานที่กำลังทำ (active)
- **ไม่มีงานค้าง** — งานที่ 8 เสร็จและ deploy แล้ว (ดูหัวข้อ “งานที่ 8” ล่างสุด)

## ✅ งานที่ 8 (23 พ.ย. 2026) ตัวผู้เล่น OGA Warrior + มอนส์ DCSS 15 ชนิด
### 1) ตัวผู้เล่น → OGA "4 Direction Animated Warrior" (Calciumtrice, **CC-BY 4.0**)
- ตัดจาก `warrior_labelled_reference.png` (4000×4800) → **108 ไฟล์**
  `hero_<dir>_<i>.png` (walk 8) · `hero_<dir>_idle_<i>.png` (idle 12) · `hero_<dir>_atk_<i>.png` (attack 7)
  ครบ 4 ทิศ
- **แก้บั๊ก canvas ไม่เท่ากัน** — เดิมแต่ละแอนิเมชันมี canvas ต่างกัน
  (walk 54×105 / idle 60×105 / atk 57×100) → ตัวละครขยับกระตุกตอนสลับแอนิเมชัน
  → เครื่องมือใหม่ `tools/normalize-oga-hero.py` รวม canvas เป็นขนาดเดียวต่อทิศ
  + จัดฐานเท้าให้ตรงกัน + ย่อ LANCZOS เหลือสูง **34px** (ตามขนาดตัวผู้เล่นในเกม)
  - down 19×34 · left 21×34 · right 20×34 · up 19×34
- **แก้ `S.SPEC`** — เดิมใช้ขนาดเก่า `66×108`/`78×108` ทำให้ภาพถูกตัดขาด
  → ซิงก์กับไฟล์จริงทุกเฟรม (`sc: 1`, `dy: 0`) · คืน key ชาย `hero_m_*` ครบ 24 รายการ
  · รวม **218 keys** (HEAD เดิม 134)
- **แก้ `js/art.js`** — walk ใช้ **8** เฟรม (เดิม `% 6`), idle **12** เฟรม, attack **7** เฟรม
  + ย้ายจุดยึดอาวุธให้ไม่ทับใบหน้า (X ±3.6, Y −12.5)
- **ผลวัดจริงบน canvas** (`tools/test-hero-metrics.js` ใหม่) — **ฐานเท้าตรงกัน 0px**
  ทุกทิศ/ทุกแอนิเมชัน (ไม่เกิด frame jitter) · ความสูง walk/idle 30–34px (ต่างกันตามท่ายกแขน)
  · เฟรมโจมตี 28–31px (ทรงตัวต่ำลงตอนทุบ) · อาวุธสูงเท่ากันทุกทิศ (30px)
  · fallback shape-art ยังวาดได้ (372 พิกเซล — ค่าเดิม 488 เป็นตัวเลขผิด จากการเรียก `Art.player` ผิด signature ในเทสต์ ดูหัวข้อ 4)
- ตัวเลือก `ฮีโร่ (นักรบ)` เป็นค่าเริ่มต้น · `DT.CHARACTERS` → `characters/hero_down_0.png`
- เครื่องมือ: `tools/extract-oga-hero.py`, `tools/normalize-oga-hero.py`, `tools/test-hero-metrics.js`, `tools/shot-hero.js`

### 2) มอนส์ → **DCSS** (Dungeon Crawl Stone Soup, **CC0 1.0**) 15 ชนิด
- ยืนยัน license จาก `Dungeon Crawl Stone Soup Full/LICENSE.txt` ใน ZIP (ไม่ต้องใช้ `unzip`)
- แทนที่มอนส์ชุดเดิม (redshrike CC-BY 3.0 / Dawnlike) ครบ 15 ตัว
  slime wolf goblin boar wraith bat imp ghoul skeleton mage knight dragon
  pirate_leader squidman pirate_zombie — แผนที่ใน `assets/mobs/mapping.json`
- `assets/mobs/platino.png` (Dawnlike CC-BY 4.0) ยังใช้เป็น easter egg + เงื่อนไข “ต้องมี Platino” ยังครบ

### 3) เอกสาร license
- `assets/CREDITS.md` — เพิ่ม DCSS (CC0) · OGA Warrior (CC-BY 4.0 + ลิงก์ใบอนุญาต)
  · Dawnlike แก้เหลือ platino เท่านั้น · redshrike ทำเครื่องหมายว่าไม่ได้ใช้แล้ว
- `assets/MANIFEST.md` — หัวข้อ 8 (DCSS + ตารางแมป + URL จริงจาก README ใน ZIP)
  และหัวข้อ 9 (OGA + ตาราง canvas/เฟรม + wiring)

### ผลทดสอบ
- hero-metrics **7/0** · sprites 11/0 · sprite-render 9/**1** (tile หลังคา — บั๊กเดิมที่ HEAD ก็ fail)
  · sprite-fallback 5/0 · input 19/0 · mouse 19/0 · touch 73/0 · viewports 32/0
- `tools/build-single.js` → ฝัง **218 สไปรต์** (492 KB → 667 KB base64) ไฟล์ 1.2 MB
- single-file test ผ่าน 11/0

### Deploy
- commit `672fea5` push แล้ว → run `45116481659` **success**
- commit `9fe81e7` (เอกสาร) → run `45116585121` fail จาก artifact ชั่วคราวของ GitHub → `gh run rerun` → **success**
- commit `e50d8a2` (แก้เทสต์) → run `45117007582` **success**
- live verify: `tools/verify-live.js` **34/0** · single-file test ผ่าน **11/0**
- ยืนยันบน live จริง: สไปรต์โหลด **218/218 (failed 0)** · OGA hero walk **32/32**
  · DCSS mobs **16/16** · JS error 0
- live: https://ekaijinnyopc-pixel.github.io/dungeon-town/
- single: https://ekaijinnyopc-pixel.github.io/dungeon-town/dist/dungeon-town.html

### หมายเหตุ
- `assets/_raw/` ถูก `.gitignore` — ไฟล์ต้นทาง (DCSS ZIP, OGA PNG) ไม่ถูก commit
  แต่มี URL ดาวน์โหลดครบใน `assets/MANIFEST.md` หัวข้อ 8
- ชุด OGA ตั้ง `data-female="1"` เพื่อบังคับเลือกชุด `hero_` — ตัวเลือก `hero`/`heroine` ใช้สไปรต์ชุดเดียวกัน (ถูกต้อง)

### 4) แก้บั๊กในเทสต์เอง — `Art.player` signature ผิด (commit `e50d8a2`)
- **อาการ**: `tools/test-hero-metrics.js` เรียก `Art.player(x, 60, 100, o, 0, 0)`
  แต่ signature จริงคือ `Art.player(ctx, sx, sy, z, opts)` → `opts` ไปตกที่ `z`
  → ทุกการวัดได้ **fallback shape-art** ไม่ใช่สไปรต์ OGA (เลข 488 พิกเซล = ค่า fallback)
- **หลักฐาน**: เทียบ silhouette (alpha mask) IoU ระหว่างภาพที่เกมวาดจริง กับสไปรต์ OGA
  และกับ fallback — หลังแก้ได้ **IoU กับ OGA = 1.00 ทุกทิศ** (fallback ได้แค่ 0.56–0.58)
  → ยืนยันว่าตัวผู้เล่นบนจอคือสไปรต์ OGA จริง ไม่ใช่รูปทรง
- ยืนยันซ้ำบน live จริงหลัง deploy: IoU กับ OGA **1.00** ทั้ง 4 ทิศ · fallback 0.56–0.58
- หลังแก้ hero-metrics ผ่าน **7/0** เหมือนเดิม แต่วัดค่าที่ถูกต้องแล้ว
- **ข้อควรระวัง**: เทสต์ที่เรียก `Art.player` ต้องใส่ `z` เป็นอาร์กิวเมนต์ที่ 4 เสมอ

### 5) แก้เครื่องมือถ่ายภาพ — `tools/shot-hero.js` (commit `3ecae3e`)
- **อาการ**: ถ่ายภาพออกมาแต่ข้อมูลตัวละครว่าง และไม่มีไฟล์ zoom
- **สาเหตุ**: เครื่องมืออ่าน `DT.game` (ตัว g เล็ก — ไม่มีอยู่จริง) แต่ instance จริงคือ **`DT.Game`**
  และ `DT.Render` เป็น singleton object ไม่ใช่คลาส → ต้องเรียก `DT.Render.toScreen` ตรง ๆ
- **เพิ่ม**: บวก offset ของ canvas (`getBoundingClientRect`) ให้ crop ตรงตัวผู้เล่นจริง
- **ผล**: ข้อมูลตัวละครครบ (`sprite: characters/hero_down_0.png`, `female: true`, `x/y: 24.5`)
  และได้ภาพ zoom 550×550 (crop 110×110 ที่ scale 5) ทั้งเดสก์ท็อปและมือถือ


## ✅ งานที่ 6 (เสร็จแล้ว — commit `6a17749`) ตัวผู้เล่นชาย + ยกคุณภาพสไปรต์
- **สไปรต์ชาย** → `Free Base 4-Direction Male Character Pixel Art` (CraftPix id **69846**)
  24 ไฟล์ `characters/hero_m_{down,left,right,up}_{0..5}.png` (4 ทิศ × walk cycle 6 เฟรม)
- **แก้ที่ต้นเหตุเรื่องความละเอียด** — เดิม crop แล้วย่อจาก ~52px → 34px ทำให้รายละเอียดหาย/หัวดูใหญ่เกิน
  → เปลี่ยนเป็นเก็บ **native 44×62** แล้วค่อยย่อตอนวาดผ่าน `S.SPEC` (`sc: 0.5484`)
- **baseline เดียวกันทั้งแถว** — ใช้ค่า `base = max(y1)` ของเฟรมที่สมบูรณ์ในแถวนั้น
  แก้เฟรม `up` ที่เดิมถูกตัดหัว/ขาด (ตอนนั้นสูง 26/43px แทนที่จะ ~55px)
- **เส้นขอบ (outline)** — `tools/add-outline.py` ใช้ 4-neighbour dilation (เส้นต่อเนื่อง ไม่มีจุดหลุด)
  หญิง 1px · ชาย 2px (native ใหญ่กว่า) สี `rgba(26,18,32)`
- **contact shadow** — วาด ellipse ใต้เท้าใน `Art.player` ก่อนสไปรต์
- **แก้บั๊กการเดาชุดสไปรต์** — เดิมใช้ `indexOf('hero_m_') === 0` ซึ่งไม่ตรงกับ path จริง `characters/hero_m_...`
  → เปลี่ยนเป็น regex `/(^|[\/])hero_m_/`
- **wiring** — `opts.male` ส่งผ่าน `js/game.js` → `js/render.js` → `Art.player` · ตัวเลือก `ฮีโร่ (ชาย)` ใน `index.html`
  · ค่าเริ่มต้น `js/config.js` เป็น `characters/hero_m_down_0.png` (`male: true`)
- **เอกสาร** — `assets/CREDITS.md` เพิ่มแถว Male pack + หมายเหตุการประมวลผลภาพ
  · `assets/MANIFEST.md` อัปเดตหัวข้อ 3/7 (รวม native-res + outline + wiring ชาย)
- **เครื่องมือ** — `tools/craftpix-hero-male.py` (ปรับ crop/baseline), `tools/add-outline.py` (ใหม่)
- **ผลทดสอบ (รวม 350 ผ่าน / 0 ล้มเหลว)**
  verify-craftpix 14/0 · sprites 11/0 · sprite-render 10/0 · sprite-fallback 5/0
  · refine 128/0 · party 57/0 · market 58/0 · phase3 29/0 · mouse 19/0 · input 19/0
- **build** — `dist/dungeon-town.html` 880 KB · ฝัง 128 สไปรต์ (298 KB → 405 KB base64)
- **ภาพ** — `dist/preview-town-desktop.png` (1280×800) + `preview-town-mobile.png` (390×844)
  ตรวจด้วยตา: ตัวผู้เล่นอ่านออกเป็นคนชัดเจน สัดส่วนหัว/ตัวถูก เส้นขอบสะอาด เงาใต้เท้าชัด
- **Deploy** — push `6a17749` → run `44804111014` **success** (18s)
  live verify: index **34/0** · dist **34/0** · craftpix **14/0** · JS error 0
  ลิงก์: https://ekaijinnyopc-pixel.github.io/dungeon-town/index.html

## ✅ แก้ workflow deploy ที่พัง (2026-11-16 10:05 GMT+8) — commit `6489dd0`
- push commit `5e89832` (status.md งานที่ 5) → run `43789728711` **failure**: `actions/upload-pages-artifact@v3` ไม่สร้าง artifact → `deploy-pages@v4` ตอบ `No artifacts named "github-pages" were found`
- แก้ `.github/workflows/pages.yml`: `upload-pages-artifact@v3` → **v4**
- push แล้ว → run `43789803447` **success** (20s)
- live verify: index 200 · dist 200 · `tools/verify-live.js` บน live URL **34/0** · JS error 0

## ✅ งานที่ 5 (เสร็จแล้ว — commit `07e79cd`) เปลี่ยนธีม asset เป็น CraftPix
1. **อาคาร** → `Free Fantasy Medieval Village Buildings Asset Pack` (id **116565**) — 16 ไฟล์ `objects/mv_*.png` ใช้กับอาคารทั้ง 5 หลังใน `js/world.js`
2. **Boss** → `Free Fantasy RPG Pirate Boss Character Pack` (id 114848) — `mobs/pirate_leader.png`, `squidman.png`, `pirate_zombie.png` (เกิดกลางคืนที่ `world.BOSS_SPOTS`)
3. **ตัวเล่นหญิง** → `Free Base 4-Direction Female Character Pixel Art` (id **69845**) — `characters/hero_{down,up,left,right}_{0..5}.png` (4 ทิศ × 6 เฟรม)
- crop จากภาพ preview `img.craftpix.net` (ดาวน์โหลด pack ต้นฉบับต้องมีบัญชี CraftPix) — เครื่องมือ `tools/craftpix-{assets,buildings,hero}.py`
- wiring: `Art.building` ใช้ `b.sprite` · `Art.mob` โหลด `mobs/<type>.png` · `Art.player` เลือก `hero_*` เมื่อ `opts.female`
- เอกสาร: `assets/CREDITS.md` (แก้ Product ID ที่สลับกัน) · `assets/MANIFEST.md` หัวข้อ 7 · `mapping.json` ทั้ง 3 ไฟล์
- เครื่องมือทดสอบใหม่: `tools/verify-craftpix.js` (อาคาร 5/5 · Boss 3/3 · ฮีโร่ 24/24 · fallback · JS error 0)
- ผลทดสอบ: verify-craftpix 11/0 · verify-live 34/0 · sprites 11/0 · sprite-render 10/0 · sprite-fallback 5/0
  · refine 128/0 · party 57/0 · market 58/0 · phase3 29/0 · mouse 19/0 · touch 73/0 · viewports 32/0 · smoke 81/0
- deploy success (run 43632104582) · live verify: index 34/0, dist 34/0, craftpix 11/0

## ✅ งานที่ 4 (เสร็จแล้ว — commit `63fe42d`) รวมธีมสี Tiny Town ทั้งเกม
- พื้น/หิน/พุ่ม/ป้ายร้าน/มลน้ำ → ชุด Tiny Town เดียวกัน (แก้ปัญหา 3 ชุดสีปนกัน)
- เทสต์: verify-live 34/0 · sprite-render 10/0 · refine 128/0 · party 57/0 · market 58/0
        phase3 29/0 · mouse 19/0 · touch 73/0 · viewports 32/0
- deploy success · live URL verify 34/0

## งานข้อ 1-4 (ส่งมอบแล้ว — commit `c3c1520`)
1. **หน้าแลนด์ดิ้ง** — `#landing` + ปุ่ม `#play-now` "▶ เข้าเล่นทันที"; หน้าเลือกอาชีพซ่อนเป็นค่าเริ่มต้น
2. **ตลาด 3x3 + ป้ายร้าน** — `building(28,19,2,2)` footprint 3x3, `sign: objects/urban_shop_sign.png`, `awning: objects/urban_shop_awning.png` (มี shape-art fallback)
3. **มอนส์ 5 ชนิด + สไปรต์ NPC** — `assets/mobs/` (slime/wolf/goblin/boar/wraith 16x16 RGBA), `Art.mob` โหลดสไปรต์ก่อน fallback, NPC 3 ตัวใช้ `Art.npc` + alt_down_6/7/10
4. **เลือกตัวละคร + บันทึก/คืนตำแหน่ง** — picker 4 ตัว, `DT.CHARACTERS`, ปุ่ม `save:pos`/`reset:pos`, `net.js` เก็บ `sprite`, `game.js` คืนตำแหน่ง+ตัวละครหลังรีเฟรช (localStorage `dt:save:<clientId>`)

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
- `dist/dungeon-town.html` — single-file build สำเร็จ (inline 38 PNG, 8 KB → 12 KB base64, ไฟล์ 524997 bytes)
  และ test-sprite-render ผ่านบนไฟล์ single-file โดยตรง (10/0)
- verify ข้อ 1-4 (`/tmp/verify.js`) — 23 ผ่าน / 0 ล้มเหลว ทั้ง source และ `dist/dungeon-town.html`, JS error 0
- `dist/preview-game.png` — สร้างใหม่จาก build ล่าสุด (140147 bytes) ตรวจด้วยตาแล้ว: ตลาดมีมลน้ำ/ป้าย มอนส์ NPC ครบ UI ปกติ

### Deploy
- commit `c3c1520` push ขึ้น `origin/main` แล้ว · workflow `.github/workflows/pages.yml` deploy อัตโนมัติ
- `df54acb` — แก้เทสต์ค้าง chromium process (spawn `detached:true` + `process.kill(-pid)`) · deploy success
- `a96b948` — แก้ race condition เทสต์ (`waitGameStart()` poll แทน sleep ตาย) · deploy success
- ลิงก์: https://ekaijinnyopc-pixel.github.io/dungeon-town/index.html
  และ https://ekaijinnyopc-pixel.github.io/dungeon-town/dist/dungeon-town.html

### เครื่องมือวัด
- `tools/measure-art.js` (port 9380), `tools/calibrate.js` (port 9381)

## หมายเหตุ
- เทสต์เบราว์เซอร์: ห้ามใช้ `sleep()` ตายเพื่อรอสถานะเกม — ใช้ `waitGameStart()` (poll 200ms, timeout 15s) แทน
  เคยเจอ `Cannot read properties of null (reading 'dir')` เพราะ `DT.Game.local` ยังไม่พร้อมตอนเครื่องช้า
- ฆ่า chromium ต้องฆ่าทั้ง process group: `process.kill(-ch.pid, 'SIGKILL')` (ไม่ใช่ `ch.kill()`)
  ระวัง `pkill` pattern ที่ match shell ตัวเอง → ใช้ bracket เช่น `pkill -f "user-data-dir=/tmp/d[t]"`
- `js/render.js` วาด `Art.groundShadow` แยก จึงเทียบ silhouette ไม่รวมเงา
- รันเทสต์ผ่าน URL `http://127.0.0.1:8931/dungeon-town/index.html` (root ถูกต้อง)
  ถ้าใช้ `http://127.0.0.1:8931/index.html` จะหา `pname` ไม่เจอ → เทสต์ fail ทั้งชุด (ไม่ใช่ regression)

## รอพี่เอ
- ตรวจด้วยตาบนอุปกรณ์จริงว่าสไปรต์มอนส์ 5 ตัว/ป้ายร้าน/ตัวละคร NPC ขนาดพอดีและไม่ทับกัน

## กฎ
- PNG โหลดจาก `assets/` แบบ relative (ได้ทั้งโฟลเดอร์และ single-file)
- cache + `ctx.imageSmoothingEnabled = false`
- lazy load + fallback shape ทันทีเมื่อโหลดไม่ได้ (ห้ามจอดำ/เกมพัง)
- คง API เดิมของ `DT.Art`

---

## งานที่ 7: ตัวผู้เล่นหญิง CraftPix + NPC chibi (22 พ.ย. 2026, 19:30)

### ทำอะไร
- **ตัวผู้เล่นหญิง CraftPix** (`assets/_raw/fem2.jpg` → `assets/characters/hero_{down,left,right,up}_{0..5}.png`)
  - 24 เฟรม walk cycle 4 ทิศ (6 เฟรม/ทิศ) เก็บ native 44x62 ย่อตอนวาด `sc: 0.5484`
  - เพิ่ม outline หนา 2px + contact shadow (เท่าชุดชาย)
  - สคริปต์ครอป: `tools/craftpix-hero-female.py`
- **NPC chibi CraftPix** — Forest Ranger + Forest Guardian (6 ตัว) ใช้แทน NPC เมืองเดิม
  - `npc_ranger_hood / leaf / antler`, `npc_guard_tree / stone / hood`
  - สคริปต์: `tools/craftpix-chibi-npc.py` (flood-fill ลบพื้นหลัง + เก็บก้อนใหญ่สุด + ย่อสูง 72px)
  - เป็นภาพ vector-style chibi (ไม่ใช่ pixel art) → วาดเป็น NPC ยืนนิ่ง + bob เบา และปิด tint ให้คงสีต้นฉบับ
  - NPC เพิ่มเป็น 6 ตัว (เดิม 3 ในเมือง + ผู้พิทักษ์ป่า 3 ตัวฝั่งป่าเหนือ)
- `js/sprites.js`: spec หญิงเปลี่ยนเป็น 44x62/sc 0.5484 + เพิ่ม spec NPC chibi 6 รายการ
- `js/art.js` + `js/render.js`: รองรับ `tint: null` (ไม่ย้อมสี)
- `js/config.js`: ผูก NPC 6 ตัวกับสไปรต์ chibi
- `assets/CREDITS.md`: เพิ่มเครดิต CraftPix Forest Ranger / Forest Guardian

### ผลทดสอบ
- `node test/smoke.js` → 81 ผ่าน / 0 ล้มเหลว (แก้ assertion NPC 3 → 6)
- `node tools/smoke-game.js` → 32 ผ่าน / 0 ล้มเหลว (แก้ assertion NPC 3 → 6)
- `node tools/test-sprites.js` → 11 ผ่าน / 0 ล้มเหลว (134 สไปรต์โหลดครบ, failed 0)
- `node tools/test-sprite-render.js` → 10 ผ่าน / 0 ล้มเหลว
- `node tools/build-single.js` → single-file สำเร็จ (1033 KB)
- `node tools/verify-live.js https://ekaijinnyopc-pixel.github.io/dungeon-town/` → 34 ผ่าน / 0 ล้มเหลว · JS error 0
- `tools/shot-live.js` → ภาพจริงเดสก์ท็อป + มือถือ ตรวจด้วยตาแล้ว (NPC ตัวละครเห็นชัด)

### Deploy
- commit `9772c2d` push แล้ว · run `45017365568` success
- live: https://ekaijinnyopc-pixel.github.io/dungeon-town/
- single: https://ekaijinnyopc-pixel.github.io/dungeon-town/dist/dungeon-town.html

### รอพี่เอ
- ลองเลือกตัวละคร "ผู้กล้าหญิง" แล้วเดิน 4 ทิศดูว่าชอบไหม / ใหญ่เกินไปไหม
- ดูผู้พิทักษ์ป่า 3 ตัวฝั่งตีนเหนือว่าขนาดเข้ากับฉากไหม
