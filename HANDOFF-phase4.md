# HANDOFF — Phase 4 (UI สวยงาม + บาลานซ์ + มือถือเต็มรูปแบบ)
<!-- project: path:/data/.openclaw/workspace -->
**อัปเดต: 2026-11-04 02:10 GMT+8** · สถานะ: ⏳ 3 ก้อนกำลังรัน (ยังไม่ merge)

---

## ⚠️ สถานะ ณ เวลา handoff (สำคัญที่สุด)

**3 subagent กำลังรันคู่ขนานอยู่** — ถ้า session ใหม่เข้ามา **ห้าม spawn ซ้ำ** ให้รอผลเดิมก่อน

| ก้อน | runId | sessionKey | สถานะ |
|---|---|---|---|
| A · UI สวยงาม | `232609c1-a0f9-4a7a-bba8-75a56c012a84` | `agent:main:subagent:47ea070e-9d96-4b14-b3c4-c013501f6282` | 🔄 running |
| B · บาลานซ์ | `a262ef4e-a035-4924-8dbb-b1487196cefb` | `agent:main:subagent:da94a652-ad88-4c8f-b33a-ddeaa89c24c9` | 🔄 running |
| C · มือถือ | `51d85f07-d976-4f6e-8d89-9a921e16cf1a` | `agent:main:subagent:cc09d88e-0401-407f-a103-f63e9648f10d` | 🔄 running |

**วิธีตรวจผล:** `dispatch_action id="openclaw:core:subagents" args={"action":"list"}`
**วิธีรอ:** `dispatch_action id="openclaw:core:agents_wait" args={"ids":["<runId>"],"timeoutSeconds":300}`

> ⚠️ เมื่อ session เก่าถูก `/new` — subagent ยังรันต่อและรายงานกลับ session ที่ spawn (session เก่า)
> ถ้า session ใหม่ไม่ได้ผล: ให้ใช้ `sessions_history` ดู sessionKey ของ subagent ข้างบน หรือ `sessions_send` ไปถามสถานะ

---

## 📋 งานที่ต้องทำต่อ (session ใหม่)

### 1. รอผล subagent ทั้ง 3 ก้อนให้เสร็จ
- ก้อน A: `js/art.js` (27 KB) · `js/render.js` (22 KB) · `css/style.css` (ส่วน UI)
- ก้อน B: `js/config.js` (20 KB) · `js/player.js` (22 KB) · `test/smoke.js` (assertion ที่ผูกตัวเลข)
- ก้อน C: `index.html` (145 บรรทัด) · `js/game.js` (54 KB) · `css/style.css` (ส่วน `/* P4-C */`) · `tools/test-touch.js` (ใหม่ 17.5 KB)

### 2. ตรวจ merge CSS (สำคัญ — A และ C แก้ไฟล์เดียวกัน)
`css/style.css` ตอนนี้ 589 บรรทัด:
- บรรทัด 1–460 ≈ ก้อน A (UI สวยงาม) — ตรวจว่ามี marker `/* P4-A */` หรือไม่
- บรรทัด 461–589 = ก้อน C (มือถือ) — มี marker `/* P4-C */` ชัดเจนแล้ว ✅
- ต้องยืนยันว่า A **ไม่ได้เขียนทับ**ส่วนของ C และ C ไม่ทับส่วนของ A
- เทียบกับต้นฉบับ: `git diff` ใช้ไม่ได้ (โปรเจกต์ไม่ได้ push) → ใช้ `grep -n "P4-A\|P4-C"` + ดูโครงสร้าง

### 3. รัน regression ครบทุกชุด (ต้องผ่านทั้งหมด)
```bash
cd /data/.openclaw/workspace/dungeon-town
# ถ้าเซิร์ฟเวอร์ไม่รัน: (python3 -m http.server 8931 >/tmp/dt-http.log 2>&1 &) ; sleep 2
node test/smoke.js          # เดิม 81/0
node tools/smoke-game.js    # เดิม 32/0
node tools/test-input.js    # เดิม 14/0
node tools/test-phase3.js   # เดิม 29/0
node tools/test-mouse.js    # เดิม 19/0
node tools/test-touch.js    # ใหม่ (ก้อน C) — ต้องผ่าน
node --check js/art.js js/render.js js/config.js js/player.js js/game.js
```
**ถ้าเทสต์พัง: แก้โค้ดเกม ห้ามแก้ตัวเทสต์เพื่อให้ผ่าน**

### 4. สร้างไฟล์เกมไฟล์เดียว + deploy
```bash
node tools/build-single.js    # → dist/dungeon-town.html
grep -c "script src=" dist/dungeon-town.html   # ต้องได้ 0
md5sum js/*.js index.html css/style.css   # เทียบกับไฟล์ที่เสิร์ฟ public
```

### 5. ส่งลิงก์ให้พี่เอทดลอง + รอ feedback บนมือถือจริง
- **เล่น:** https://writing-associates-faced-inform.trycloudflare.com/index.html
- **ไฟล์เดียว (ออฟไลน์):** https://writing-associates-faced-inform.trycloudflare.com/dist/dungeon-town.html
- ⚠️ trycloudflare ตายเมื่อรีสตาร์ทเครื่อง · cloudflared PID 3936 (ยังรัน ~41 นาที ณ 02:09)

---

## 🔍 สิ่งที่ค้นพบระหว่างสำรวจ (Phase 4)

### 🐛 บั๊กสำคัญ: ปุ่มมือถือเดิมใช้ไม่ได้เลย
`index.html` มีปุ่ม `.pad` พร้อม `data-key="up|left|down|right|gather|attack|shop|fire"` แต่ **`grep -rn "data-key" js/` ไม่เจอโค้ดไหน bind เลย** → ปุ่มบนมือถือกดไม่มีอะไรเกิดขึ้น
→ ก้อน C แก้แล้ว: `js/game.js` บรรทัด ~285–380 มี `padDown`/`padUp` + `touchstart/touchmove/touchend` บน canvas ✅

### 📊 บาลานซ์ที่ก้อน B แก้แล้ว (ดูค่าใหม่ใน `js/config.js`)
| ค่า | เดิม | ใหม่ | เหตุผล |
|---|---|---|---|
| `HUNGER_DRAIN` | 0.55 | **0.22** | หิวหมดใน ~7.5 นาที (เดิม ~3 นาทีเร็วเกิน) |
| `SHOP_BUY_MARKUP` | 1.6 | **1.35** | พ่อค้ากำไร 35% แทน 60% |
| `SHOP_SELL_RATE` | 0.55 | **0.65** | ขายได้คืน 65% (เดิมเสียเปรียบซ้ำซ้อน) |
| `XP_PER_LEVEL` | 60 (แบน) | **60 + เส้นโค้ง** | `XP_CURVE_STEP` / `XP_CURVE_ACCEL` + `DT.xpToNext(level)` (config.js บรรทัด 60) |
| ดาเมจ | `weaponDmg + (lv-1)*2 + accDmg` | **สูตรใหม่** (player.js บรรทัด ~103–107) | เกราะถูกนับ + เกราะลดดาเมจที่รับ |

### 🎨 ก้อน A (UI) — ไฟล์โตขึ้นมาก
- `js/art.js`: 25 KB → **27 KB** (1,322 บรรทัด)
- `js/render.js`: 22 KB → **35 KB** (843 บรรทัด)
- `css/style.css`: 248 → **589 บรรทัด**
- `dist/preview-game.png` สร้างแล้ว (511 KB, 02:10)

### 📱 ก้อน C (มือถือ) — เสร็จเกือบหมดแล้ว
- `index.html`: เพิ่ม `<meta viewport>` ถูกต้อง (`user-scalable=no`, `viewport-fit=cover`) + ปุ่ม `.mtool` 4 ปุ่ม (🎒 ⚒️ 📜 ❌) ผูก `data-act` เดิม
- `js/game.js`: 1,222 บรรทัด — pad bind + touch canvas + กัน pinch-zoom
- `css/style.css` บรรทัด 461–589: `/* P4-C */` ครบ — safe-area, HUD บางลง, popup เลื่อนได้, แนวนอนย่อปุ่ม
- `tools/test-touch.js` (17.5 KB, ใหม่) + `tools/dbg-touch.js`, `tools/dbg2.js` (debug)

---

## ✅ สถานะก่อนหน้านี้ (Phase 0–3 + mouse-first เสร็จแล้ว)
- ✅ Phase 0–1: แผนที่ 48×48, 3 อาชีพ, multiplayer, UI ครบ
- ✅ Phase 2: ชุดวาดภาพ canvas จริง, เศรษฐกิจ, NPC, เควสต์, เลเวล, loot, กองไฟ
- ✅ Phase 3: เสียง WebAudio 24 เสียง, เอฟเฟกต์, ห้องใน 5 อาคาร
- ✅ mouse-first: คลิกขวา = เดิน/โจมตี · คลิกซ้าย = เปิด popup · ลากซ้าย = เดิน
- ✅ **ตาราง Supabase สร้างแล้ว** (`public.dungeon_town_players`, มีคอลัมน์ `weapon`/`armor_id`/`accessory_id`, RLS `dt_public_all`) — พี่เอรัน SQL แล้ว ไม่มี 404 อีก
- 🧪 เทสต์ก่อน Phase 4: smoke 81/0 · smoke-game 32/0 · input 14/0 · phase3 29/0 · mouse 19/0

---

## 📌 กฎเหล็กที่ต้องจำ
1. **ก่อนทำงานต่อจากงานที่หยุดไว้ ต้องตรวจไฟล์จริง + รันเทสต์จริงก่อน** อย่าทำซ้ำส่วนที่เสร็จแล้ว
2. **เทสต์ input ต้องกดปุ่มจริงระดับเบราว์เซอร์ผ่าน CDP** ห้ามตั้ง state เกมโดยตรง
3. **ต้องรองรับคีย์บอร์ดไทย** (ใช้ `e.code` ไม่ใช่ `e.key`)
4. เกมเป็น **mouse-first**: คลิกขวา = เดิน/โจมตี · คลิกซ้าย = เปิด popup/เก็บ · ลากซ้าย = เดิน
5. จินไม่มี `service_role key` → การเปลี่ยน DB ต้องให้พี่เอรัน SQL ใน Supabase Dashboard
6. `js/net.js` มี fallback ตอนคอลัมน์อุปกรณ์ยังไม่มี แต่ข้ามเครื่องต้องใช้ตารางที่คอลัมน์ครบ
7. ห้ามนำ art จากเกมอื่นมาใช้ — วาดเองด้วย canvas
8. แก้ไฟล์ด้วย `str.replace(anchor, ...)` ต้อง **assert ว่า anchor เจอ** + grep ตรวจหลังเขียน
9. ลิงก์ trycloudflare ชั่วคราว ตายเมื่อรีสตาร์ทเครื่อง

---

## 📁 ไฟล์สำคัญ
```
dungeon-town/
├─ index.html          (145)  ← ก้อน C
├─ css/style.css       (589)  ← ก้อน A + C (ระวังชนกัน)
├─ js/config.js        (295)  ← ก้อน B
├─ js/player.js        (506)  ← ก้อน B
├─ js/game.js          (1,222)← ก้อน C
├─ js/art.js           (1,322)← ก้อน A
├─ js/render.js        (843)  ← ก้อน A
├─ js/net.js · js/world.js · js/path.js · js/ui-popup.js · js/audio.js · js/fx.js · js/interiors.js
├─ test/smoke.js       (249)  ← ก้อน B (assertion)
├─ tools/test-touch.js (ใหม่) · test-input · test-phase3 · test-mouse · smoke-game · build-single
├─ supabase/dungeon-town.sql
└─ dist/dungeon-town.html (ต้อง rebuild) · preview-game.png
```

---

# 🗺️ HANDOFF: TOP-DOWN RETRO RPG CONVERSION (2026-11-04 13:30)

> 🚨 อ่านส่วนนี้ก่อนทำงานใดๆ — เกมถูกเปลี่ยนจาก 2D isometric เป็น **top-down orthographic แนวตรง** (Final Fantasy / Dragon Quest style) แล้ว

## 🔗 ลิงก์ทดสอบ
- ปกติ: https://writing-associates-faced-inform.trycloudflare.com/index.html
- ไฟล์เดียว: https://writing-associates-faced-inform.trycloudflare.com/dist/dungeon-town.html
- server: `python3 -m http.server 8931` (PID 3196, cwd = dungeon-town/) · cloudflared PID 3936

## 🔑 ข้อตกลงสำคัญของโหมดใหม่
- tile จัตุรัส (TILE_W = TILE_H = 48) · projection ตรง ไม่มี diamond
- ตัวละครหัน 4 ทิศ: `down` / `up` / `left` / `right` (`player.dir`)
  - `up` = หลังหัว ไม่มีตา/ปากที่มองเห็น
  - `right` = ภาพด้านตรง · `left` = สะท้อนด้านของ `right` (ทำด้วย `ctx.scale(-1,1)`)
- อาคารมองจากด้านบน/สามส่วนสี่บน · footprint = สี่เหลี่ยม
- depth sort ตามแกว `y` · **อาคารรวมอยู่ใน depth sorting** (เดินหลังอาคารได้)
- retro: backing store = CSS px × DPR ÷ `CFG.PIXEL` (2) แล้วขยาย `image-rendering: pixelated`
- tile responsive: จอ <520px → 32px, <800px → 40px, ไม่งั้น 48px (ตั้งใน `Render.resize()`)

## 📐 API ที่ต้องคงไว้ (renderer เรียกใช้)
```
Art.player(ctx, sx, sy, z, opts)      // opts.dir, opts.prof, opts.t, opts.moving, opts.running, opts.waving, opts.hurt, opts.swing, opts.seed, opts.weapon
Art.building(ctx, b, rect, z)         // rect = {x,y,w,h} (DT.Render.buildingRect(b))
Art.tree / Art.rock / Art.bush / Art.furniture / Art.station / Art.campfire / Art.mob
Art.toolIcon / Art.sunState / Art.hash / Art.variant / Art.mix / Art.lerp
```
`js/art.js` ต้องอยู่ใน IIFE `(function (root) {...})(window)` และ export `var Art = DT.Art = {};` (เรียกผ่าน `DT.Art.*` ในเทสต์)

## 🧪 สถานะเทสต์ (หลัง conversion เสร็จ)
| เทสต์ | ผล |
|---|---|
| `node test/smoke.js` | 81/0 ✅ |
| `node tools/smoke-game.js` | 32/0 ✅ |
| `node tools/test-input.js` | 14/0 ✅ |
| `node tools/test-phase3.js` | 29/0 ✅ |
| `node tools/test-mouse.js` | 19/0 ✅ |
| `node tools/test-touch.js` | 44/0 ✅ |

## 🐛 บั๊กที่เจอ+แก้รอบ conversion
1. **เทสต์เลือกอาคารผิด** — เดิมใช้ center ของ footprint diamond → อาคารหลุดจอ → แก้ `tools/test-mouse.js` + `tools/test-touch.js` ให้ใช้ `DT.Render.buildingRect(b)` ตัดกับ viewport และเลี่ยงจุดที่ถูก NPC บัง
2. **assertion DPR มือถือ** — เดิมคาด `clientWidth × DPR` แต่โหมด retro ใช้ `× DPR ÷ PIXEL` → แก้ใน `tools/test-touch.js`
3. **`dist/dungeon-town.html` พัง** — ฝัง `supabase.js` (webpack bundle) เป็น inline `<script>` แล้วโยน "Automatic publicPath is not supported in this browser" ทำให้ทั้งไฟล์ไม่ทำงาน → แก้ `tools/build-single.js` ให้แทนจุด throw ด้วย fallback `document.baseURI`
   - ⚠️ ถ้าอัปเดตไลบรารี supabase แล้วจุด throw เปลี่ยน ต้องไปแก้ `tools/build-single.js` ใหม่ (ตัว script จะเตือน "ไม่พบจุด publicPath")
4. **tile ใหญ่เกินบนมือถือ** — เพิ่ม tile responsive ใน `Render.resize()`

## 🎨 ข้อบังคับด้านศิลป์
- ห้ามใช้ art จากเกมอื่น — ต้องวาดเองทั้งหมด
- ชุดภาพต้องเป็น shape-based ไม่ใช้ emoji เป็นตัวละคร ต้นไม้ หรืออาคาร
  (emoji ที่ยังใช้อยู่มีแค่ใน `Art.toolIcon` / `weaponKind` / `Art.station` ซึ่งเป็นไอคอนไอเทม ไม่ใช่ตัวละคร-ต้นไม้-อาคาร)
- ตัวละครต้องรองรับ 4 ทิศตามข้อตกลงข้างบน

## ⏭️ สถานะปัจจุบัน
- ✅ conversion เสร็จสมบูรญ · regression เขียวหมด · deploy แล้ว
- ⏸️ **Phase 5 ยังไม่เริ่ม** — รอพี่เอทดสอบเวอร์ชัน top-down แล้วอนุมัติ

---

## 🐛 FIX 2026-11-04 13:42 — "กดเดินงงๆ / กดขวาเดินทะแยง"
พี่เอรายงานว่าการเดินดูงงๆ และกดขวาแล้วเดินทะแยง

### ผลการวัดจริงในเบราว์เซอร์ (Chromium headless + input จริงระดับเบราว์เซอร์)
การเดิน **ถูกต้องตั้งแต่แรก** — ไม่เคยทะแยงในตัวโค้ด:
```
proj   {"right":{"dx":48,"dy":0},"down":{"dx":0,"dy":48}}
after RIGHT {"x":26.39,"y":24.5,"dir":"right"}   ← ขวาเป๊ะ (y ไม่ขยับ)
after UP    {"x":26.39,"y":22.05,"dir":"up"}     ← ขึ้นเป๊ะ (x ไม่ขยับ)
waypoints [[28.5,22.5],[29.5,22.5],[30.5,22.5],[30.5,23.5],...]  ← แนวตรงทุกขั้น
```

### สาเหตุจริง 3 ข้อ (แก้ครบ)
1. **แคชไฟล์เก่าในเบราว์เซอร์พี่เอ** — `js/*.js` โหลดด้วย URL เดิมไม่มี version → เบราว์เซอร์ใช้ไฟล์ **isometric เก่า** ทำให้เห็นแผนที่ทะแยง
   → แก้ `index.html`: ใส่ `?v=20261104b` ทุก `<script src>` + `<link stylesheet>`
   → แก้ `tools/build-single.js` ให้ regex รองรับ query string (`(?:\?[^"]*)?`)
2. **ภาพสั่น/ดูงงๆ** — ตำแหน่งวาดเป็นเลขทศนิยม ไม่ snap ลงพิกเซลจอ (โหมด retro PIXEL=2) → ภาพขยับครึ่งพิกเซล
   → แก้ `js/render.js`: เพิ่ม `this.snap = pix / dpr` ใน `resize()` และ snap `sx/sy` ใน `toScreen()`
3. **ลายทแยงในพื้น tile** — tile STONE วาดเส้น X ทแยง → สายตาอ่านว่าแผนที่เอียง
   → แก้ `js/render.js`: เปลี่ยนเป็นเส้นกากบาทตรง (แนวตั้ง+แนวนอน)

### ผลตรวจ
- `node --check` ทุก `js/*.js` + `tools/*.js` + `test/*.js` ผ่าน ✅
- regression เขียวหมด: smoke 81/0 · smoke-game 32/0 · input 14/0 · phase3 29/0 · mouse 19/0 · touch 44/0 → **219/0**
- live ทดสอบบน URL จริง (index + dist) → เดินขวา/ขึ้นเป๊ะ ไม่มี JS error
- `dist/dungeon-town.html` rebuild แล้ว ตรงกับ source (diff ไม่มีอะไรค้าง) และ live มีโค้ดใหม่ครบ

### ⚠️ ข้อควรรู้
- **เวลาแก้ `index.html` ให้เพิ่ม version ใหม่ทุกครั้ง** (เช่น `?v=20261104c`) ไม่งั้นพี่เอจะเจอไฟล์เก่าอีก
- `dist/dungeon-town.html` เป็นไฟล์เดียวจบ ไม่มีปัญหา cache
