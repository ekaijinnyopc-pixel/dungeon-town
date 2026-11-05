# DUNGEON TOWN — Handoff: mouse-first (อัปเดต 2026-11-03 17:39 GMT+7 (พี่เอสั่งสรุปเพื่อ /new))

> ไฟล์นี้คือบริบทสำหรับ session ใหม่ (หลัง `/new`) — อ่านไฟล์นี้ก่อนเริ่มงาน
> โปรเจกต์: `/data/.openclaw/workspace/dungeon-town/`

## 🎯 เป้าหมายรอบนี้ (พี่เอสั่ง 2026-11-03 17:58)
เปลี่ยนระบบเล่นเป็น **mouse-first** ก่อนเริ่ม Phase 4:
- **คลิกซ้าย** = เลือก / เปิดเมนู
- **คลิกขวา** = เดินไป / โจมตี
- **ไม่ต้องเดินเข้าอาคาร** — อาคารเป็นรูปที่คลิกแล้วเด้ง popup เลย
- popup = **แท็บ**: ซื้อ/ขาย · อาวุธ · ชุดเกราะ · เครื่องประดับ · ของใช้ (+ คราฟต์/เควสต์/พักผ่อน/หลอมแร่/ปรุงอาหาร)
- ลดการโหลดหน้าใหม่ → ใช้ popup/menu แทน

## ✅ ทำเสร็จแล้ว (syntax check ผ่านทุกไฟล์)

| ไฟล์ | สิ่งที่ทำ | สถานะ |
|---|---|---|
| `js/path.js` | โมดูลหาเส้นทาง BFS บนตาราง tile · `DT.Path.find(map,sx,sy,tx,ty)` คืน waypoint `{x,y}` · `nearestWalkable()` หา tile เดินได้ใกล้สุดในรัศมี 6 · รองรับแผนที่ห้องในผ่านพารามิเตอร์ `map` | ✅ ใหม่ 3,068 B |
| `js/config.js` | เพิ่มไอเทมเครื่องประดับ `wolf_ring` (acc:2) · `stone_charm` (accDef:2) · `goblin_amulet` (acc:3, accDef:1) · เพิ่มสูตรคราฟต์ + ราคา + ผูกสูตรเข้าอาชีพ (miner/hunter/farmer) | ✅ |
| `js/player.js` | state ใหม่ `armorId`/`accessoryId`/`accDmg` · `recalcGear()` · `equipItem(id)` · `unequipItem(id)` · `equippedIn(slot)` · `equipBest()` เลือกอาวุธ+เสื้อ+เครื่องประดับ · ดาเมจรวม `accDmg` · กันดาเมจรวมเสื้อ+`accDef` · `attack(world,target)` รับเป้าหมายเฉพาะ + กรองมอนส์ · ห้ามขายไอเทมที่สวมอยู่ 3 ช่อง | ✅ |
| `js/render.js` | เพิ่ม `DT.Render.screenToTile(px,py)` แปลงพิกัดเมาส์→tile | ✅ |
| `js/ui-popup.js` | **ไฟล์ใหม่ 18,070 B** — `DT.Popup` พร้อมแท็บทั้งหมด: trade / weapon / armor / accessory / items / craft / quest / rest / smelt / cook · `openBuilding(b)` · `openNpc(n)` · event delegation `data-act="popup:*"` · ปิด popup คลิกพื้นหลัง | ✅ ใหม่ |
| `index.html` | เพิ่ม `<div id="popup">` · เพิ่ม `<script src="js/path.js">` + `<script src="js/ui-popup.js">` (ก่อน game.js) · ข้อความวิธีเล่นใหม่ | ✅ |
| `css/style.css` | CSS popup: `.popup` `.popup-box` `.popup-head` `.popup-tabs .ptab` `.popup-body` | ✅ |

## ❌ ยังไม่เสร็จ (ต้องทำต่อ — ลำดับสำคัญ)

### 1. `js/game.js` — wire mouse-first (ยัง **ไม่ได้แก้เลย**)
`grep mousedown|contextmenu js/game.js` = **0** ยังไม่มีอะไรใหม่

ต้องทำ:
- **ลบ** handler เดิม `this.canvas.addEventListener('click', ...)` → `self.local.attack(self.world)` (บรรทัด ~198) — เดี๋ยวคลิกซ้ายจะโจมตีแทนที่จะเปิดเมนู
- เพิ่ม `mousedown` + `contextmenu` (ต้อง `e.preventDefault()` บน contextmenu เพื่อกันเมนูเบราว์เซอร์)
- แปลงพิกัดเมาส์→tile ด้วย `DT.Render.screenToTile(px, py)` — **พิกัดต้องเป็น CSS px ภายใน canvas** (ใช้ `getBoundingClientRect()` ลบ offset; ระวัง dpr)
- **คลิกขวา**: หา tile เป้าหมาย → ถ้าทับมอนส์ใกล้สุดให้ `L.attack(world, mob)` (ใช้ target) · ถ้าไม่ใช่ให้ `DT.Path.find(map, L.x, L.y, tx, ty)` แล้วเดินตาม waypoint (เก็บ path ไว้ใน `DT.Game` แล้ว update ใน `update()`)
- **คลิกซ้าย**: ถ้าทับอาคาร → `DT.Popup.openBuilding(b)` (เลือกอาคารจาก `DT.Game.world.map.buildings` โดย hit-test รูปทรง iso) · ถ้าทับ NPC → `DT.Popup.openNpc(n)` · ถ้าทับทรัพยากร → เก็บของ
- hit-test อาคาร: ใช้ `DT.Render.toScreen(b.x,b.y)` / `toScreen(b.x+b.w, b.y+b.h)` สร้างกรอบ iso แล้วเช็คพิกัดเมาส์
- popup ต้อง **ไม่ทำให้ canvas ได้คลิกเดิน** — popup เป็น overlay ครอบ canvas (z-index สูง) ให้คลิกที่ popup ไม่ทะลุลง canvas
- เดินตาม path ใน `update()` — รองรับทั้งแผนที่นอก (`this.world.map`) และห้องใน (`this.room.map`)

### 2. `js/game.js` — ฟังก์ชันที่ `js/ui-popup.js` เรียกใช้ (ยังไม่มีทั้งหมด)
`grep doRest|doSmelt|doCook js/game.js` = **0**
- `DT.Game.doRest()` — นอนฟื้น HP/หิว/ล้า + ข้ามเวลาเป็นเช้า (มี logic เดียวกันอยู่ใน `useStation` action `sleep` → **ย้าย/แชร์โค้ดเดิมมาใช้ซ้ำ**)
- `DT.Game.doSmelt()` — หิน 2 + แร่ 1 → เหล็กก้อน 1 (copy จาก `useStation` action `smelt`)
- `DT.Game.doCook()` — เนื้อดิบ/ปลาดิบ/ผลไม้ 3 → อาหาร (copy จาก `useStation` action `cook`)

### 3. `js/net.js` — ยังไม่บันทึกอุปกรณ์ (grep weapon = **0**)
- `save()` → เพิ่ม `weapon`, `armorId`, `accessoryId` ใน upsert
- `saveLocal()` → เพิ่ม 3 ฟิลด์เดียวกันใน localStorage
- `load()` → คืนค่า 3 ฟิลด์นั้น + เรียก `recalcGear()`
- ตาราง `public.dungeon_town_players` **ยังไม่มีคอลัมน์อุปกรณ์** → ต้องเพิ่ม DDL (ดูข้อ 6)

### 4. `tools/build-single.js` — ยังไม่มี `js/path.js` และ `js/ui-popup.js` ใน order
`order` ปัจจุบัน: supabase.js → config.js → iso.js → art.js → audio.js → fx.js → interiors.js → world.js → player.js → render.js → supabase-config.js → net.js → game.js
→ **ต้องเพิ่ม** `'js/path.js'` (หลัง config.js) และ `'js/ui-popup.js'` (ก่อน game.js)

### 5. HUD ใน `js/game.js` (`tickUI`)
แถวปัจจุบัน: `🔫 weapon | 🛡 armor` → ควรเพิ่มช่องเครื่องประดับ `💍 accessoryId` (ใช้ `DT.ITEMS[id].name`)

### 6. SQL — `supabase/dungeon-town.sql`
ตาราง `public.dungeon_town_players` มีแค่ `inv jsonb` → ต้องเพิ่มคอลัมน์ `weapon text`, `armor_id text`, `accessory_id text`
**ไม่พบ service_role key / DB password / Supabase CLI token ที่ใช้ได้ → จิน apply DDL เองไม่ได้** → ต้องส่ง SQL ให้พี่เอรันใน Supabase Dashboard
(พี่เอเคยขอ "เนื้อหา SQL ที่คัดลอกได้" — ให้ส่งเป็นข้อความในแชท)

### 7. เทสต์ + build
- `node --check` ทุกไฟล์
- รันชุดเดิม: logic / browser smoke / input (ปุ่มจริง) / Phase 3 — **ต้องไม่พัง**
- เพิ่มเทสต์คลิกซ้าย/ขวาด้วย CDP (ดูวิธีเดิมใน `tools/test-input.js`)
- `node tools/build-single.js` → `dist/dungeon-town.html`
- ส่งลิงก์ทดสอบ (public URL เดิมอาจตายเมื่อรีสตาร์ท → สร้างใหม่ถ้าจำเป็น, แนะนำ hard refresh)

## 🔍 API สำคัญที่ต้องรู้ (ตรวจแล้วว่ามีจริง)

| API | ที่อยู่ | หมายเหตุ |
|---|---|---|
| `DT.Path.find(map,sx,sy,tx,ty)` | `js/path.js` | คืน array `{x,y}` หรือ `null` |
| `DT.Render.screenToTile(px,py)` | `js/render.js` | เพิ่มใหม่ · พิกัด CSS px ใน canvas |
| `DT.Render.toScreen(x,y)` | `js/render.js` | → `{sx,sy}` |
| `DT.isoToTile(sx,sy)` | `js/iso.js` | ไม่รวมกล้อง — ใช้ `screenToTile` แทน |
| `L.equipItem/unequipItem/equippedIn` | `js/player.js` | มีครบ |
| `L.questProgress/questReady/completeQuest` | `js/player.js` | มีครบ (`questProgress` เป็น prototype fn ไม่ใช่ object literal) |
| `L.buy/sell/buyPrice/sellPrice/useItem/craft` | `js/player.js` | มีครบ |
| `DT.Audio.play(name)` | `js/audio.js` | ชื่อที่มี: step/gather/chop/mine/swing/hurt/craft/error/buy/sell/coin/levelup/quest/eat/heal/fire/ui/chat/door/death/respawn |
| `DT.FX.text/burst/sparkle/shake/stepDust/levelUp/leaves/hitSpark` | `js/fx.js` | `sparkle(world,x,y,color)` |
| `DT.Net.saveLocal(pl)` | `js/net.js` | เรียกหลังซื้อ/ขาย/สวมใส่ |
| `DT.Interiors.forBuilding(b)` / `stationAt` | `js/interiors.js` | ระบบเข้าห้องเดิม — ยังอยู่ |
| `DT.World.walkable(map,x,y)` | `js/world.js` | ใช้ตอนเดินตาม path |

## 🏗️ โครงสร้างอาคาร (สำหรับ hit-test + popup tabs)
`DT.World.create().map.buildings` = 5 หลัง:
`โรงตีเหล็ก` (19,19 4×4) · `ตลาด` (28,19 4×3) · `บ้านนักล่า` (18,29 4×3) · `บ้านช่างปลูก` (28,29 4×3) · `บ้านคนเหมือง` (23,32 4×3)
แต่ละหลังมี `door: {x,y}` · `icon` · `name`

NPC ใน `DT.NPCS`: `merchant` (29.5,21.5 พ่อค้าเมือง) · `blacksmith` (20.5,20.5 ตาลึง) · `guide` (24.5,27.5 ผู้กำกับเมือง)
→ `DT.Popup.openNpc` ใช้ `NPC_TABS` map ตาม `n.prof`

## ✅ เทสต์ที่ผ่านแล้วก่อนเริ่มงาน mouse-first
- logic `81/81` · browser smoke `32/32` · ปุ่มจริง+คีย์ไทย `14/14` · Phase 3 `29/29` (local + ลิงก์สาธารณะ)

## ⚠️ กฎเหล็กที่ต้องไม่ละเมิด
1. ห้าม grep/อ่านไฟล์ใหญ่แบบไม่จำกัด → ใช้ `| head -c 20000` / `grep -m`
2. เขียนไฟล์ด้วย `str.replace(anchor,...)` ต้อง **assert anchor เจอ** + grep ตรวจหลังเขียนเสมอ
3. ห้ามแตะ production (SQL บน live) โดยไม่ขอพี่เอยืนยัน
4. ห้ามเอา PAT/API key ไปใส่โค้ดหรือ commit
5. งานภาพต้องสร้างเอง ห้ามนำ art จากเกมอื่นมาใช้โดยไม่มีสิทธิ์
6. เทสต์ input ต้องกดปุ่ม/คลิกจริงระดับเบราว์เซอร์ (CDP) ไม่ควรแซมป์ `DT.Game.keys` ตรง ๆ

## ✅ สรุปสถานะ mouse-first (2026-11-04 01:20 GMT+8) — เสร็จครบทุกข้อ
- เทสต์: logic 81/0 · smoke 32/0 · input 14/0 · phase3 29/0 · **mouse 19/0** (local + ลิงก์สาธารณะ)
- build: `dist/dungeon-town.html` 285 KB · script src ที่เหลือ 0
- บั๊กที่แก้: `buildingAt()` ใช้ `A.x/A.y` แต่ `toScreen()` คืน `{sx,sy}` (hit-test ผิดอาคาร) + syntax error ใน `tools/test-mouse.js`
- ลิงก์: https://writing-associates-faced-inform.trycloudflare.com/index.html (tunnel ใหม่ — ลิงก์เดิมตาย)
- ค้างรอพี่เอ: รัน `supabase/dungeon-town.sql` (คอลัมน์อุปกรณ์) + ทดลองเล่นแล้วบอกอาการ

## 📌 Phase 4 ยังไม่เริ่ม
รอพี่เอยืนยันว่า mouse-first ใช้งานได้ก่อน
