# Asset Credits / Attribution

เกมนี้ใช้ภาพจากชุดต่อไปนี้ — ต้องเก็บการอ้างอิงตามเงื่อนไขของแต่ละชุด:

## CC0 (ไม่ต้องอ้างอิง แต่ใส่ไว้เพื่อความชัดเจน)

- **Dungeon Crawl Stone Soup (DCSS)** — https://www.dungeon-crawl.org.uk/
  - ใบอนุญาต: **CC0 1.0 (Public Domain Dedication)** — ยืนยันจาก `LICENSE.txt`
    ในตัว ZIP ต้นทาง (`Dungeon Crawl Stone Soup Full/LICENSE.txt`)
  - ใช้: มอนส์ทั้งหมด 15 ตัว (`assets/mobs/*.png`)
    — slime, wolf, goblin, boar, wraith, bat, imp, ghoul, skeleton,
    mage, knight, dragon, pirate_leader, squidman, pirate_zombie
  - ที่มา: `monster/` ใน `dcss_full.zip` (ดูตารางแมปเต็มที่ `assets/mobs/mapping.json`)
  - การประมวลผลภาพ: `tools/extract-dcss-mobs.py` — trim ขอบโปร่งใสให้เหลือเฉพาะตัวมอนส์
    แล้วย่อมาตรฐานเดียวกับสไปรต์อื่นในเกม
- **Kenney — Roguelike RPG Pack** — https://kenney.nl/assets/roguelike-rpg-pack
  - ใช้: `assets/tiles/ground/*` (tile พื้น: grass, path, stone, water, sand, dirt, field, floor, grass_flowers)
  - ที่มา: `Spritesheet/roguelikeSheet_transparent.png`
- **Kenney — Tiny Dungeon / Tiny Town / Roguelike Characters**
  - ใช้: `assets/chars/*`, `assets/objects/*` (ตัวละคร, ต้นไม้, บ้าน, ป้ายร้าน)

## CC-BY 4.0 — ต้องอ้างอิง

- **Dawnlike — 16x16 Universal Roguelike tileset v1.81**
  - ผู้สร้าง: Thomas Harte (DawnHack / Dawnlike project)
  - ใช้: `assets/mobs/platino.png` (เฉพาะตัวนี้ที่ยังใช้อยู่)
  - ที่มา: `Characters/Quadraped0.png`
  - เงื่อนไข: CC-BY 4.0 — ต้องไม่เอาความดีงานมาเป็นของตัวเอง
  - **เงื่อนไขพิเศษที่ต้องทำตาม (จาก README ของ Dawnlike):**
    1. ต้องอ้างอิง **DawnBringer** ผู้สร้างพาเลตต์สีของชุดนี้
    2. ต้อง **ใช้และซ่อน sprite ชื่อ "Platino"** ไว้ในเกม
    3. ถ้าใช้ชุดนี้ ต้องใช้ Platino sprite นั้นด้วย
  - ✅ **เกมนี้ทำตามครบ:** มี Platino เป็น easter egg ซ่อนอยู่ในป่า
    (แผนที่ช่อง x=7, y=41 — เดินเข้าป่าทางเหนือไปหาให้เจอ)
  - ℹ️ เดิมชุดนี้ยังเป็นเจ้าของภาพมอนส์ `wolf`/`boar` ด้วย แต่**ถูกแทนที่ด้วย
    ภาพจาก DCSS (CC0) แล้ว** — ดูหัวข้อ “CC0” ด้านบน

## CC-BY 4.0 — ต้องอ้างอิง

- **4 Direction Animated Warrior**
  - ผู้สร้าง: **Calciumtrice** (OpenGameArt)
  - หน้า: https://opengameart.org/content/4-direction-animated-warrior
  - ใช้: ชุดตัวผู้เล่นหลัก (`assets/characters/hero_{down,left,right,up}_*.png`)
    — walk 8 เฟรม, idle 12 เฟรม, attack 7 เฟรม ต่อทิศ รวม 108 ไฟล์
  - ที่มา: `warrior.png` + `warrior_labelled_reference.png`
  - เงื่อนไข: **Creative Commons Attribution 4.0 (CC-BY 4.0)**
    — ต้องใส่เครดิตผู้สร้าง + ลิงก์ใบอนุญาต (ทำที่หัวข้อนี้แล้ว)
  - การประมวลผลภาพ: `tools/extract-oga-hero.py` (ตัดเฟรมจาก labelled reference)
    แล้ว `tools/normalize-oga-hero.py` (รวม canvas เป็นขนาดเดียวต่อทิศ ให้ฐานเท้าตรงกัน
    → ไม่เกิด frame jitter) — เป็นการดัดแปลงเชิงภาพ ไม่เปลี่ยนแนวคิดงานศิลป์

## CC-BY 3.0 + OGA-BY 3.0 — ไม่ได้ใช้แล้ว

- **10 Basic RPG Enemies** (ผู้สร้าง **redshrike**, OGA) — ภาพมอนส์จากชุดนี้
  (slime / goblin / ghoul / skeleton / mage / imp / knight / bat / dragon / wraith)
  ถูก**แทนที่ด้วยภาพจาก DCSS (CC0)** ทั้งหมดแล้ว
  → ชุดนี้ไม่มีไฟล์ที่ถูกใช้งานในเกมอีกต่อไป

---

## ข้อควรรู้

- สไปรต์ทั้งหมดโหลดแบบ lazy และมี **fallback แบบวาดด้วย Canvas**
  (ถ้าภาพโหลดไม่ได้ เกมยังเล่นได้ ไม่จอดำ)
- รายละเอียดที่มาของแต่ละมอนส์อยู่ที่ `assets/mobs/mapping.json`
- ไฟล์ต้นทางดิบ (ZIP ของ DCSS, PNG ของ OGA) เก็บไว้ใน `assets/_raw/`
  ซึ่งถูก `.gitignore` ไว้ — ต้องดาวน์โหลดใหม่ถ้าจะรันเครื่องมือครั้งถัดไป
  (ดูหัวข้อ “URL ดาวน์โหลด” ใน `assets/MANIFEST.md`)

## CraftPix Freebies (Royalty-free, unlimited projects)

Downloaded as promotional preview imagery and re-cropped for use in this project.
The original pack files require a free CraftPix account to download.

| Pack | URL | Product ID | Used for |
|---|---|---|---|
| Free Fantasy Medieval Village Buildings Asset Pack | https://craftpix.net/freebies/free-fantasy-medieval-village-buildings-asset-pack/ | 116565 | Town buildings & shop (`assets/objects/mv_*.png`) |
| Free Fantasy RPG Pirate Boss Character Pack | https://craftpix.net/freebies/free-fantasy-rpg-pirate-boss-character-pack/ | 114848 | Boss characters (`assets/mobs/pirate_leader.png`, `squidman.png`, `pirate_zombie.png`) |
| Free Base 4-Direction Female Character Pixel Art | https://craftpix.net/freebies/free-base-4-direction-female-character-pixel-art/ | 69845 | Player character walk cycle (`assets/characters/hero_{down,left,right,up}_{0..5}.png`) |
| Free Base 4-Direction Male Character Pixel Art | https://craftpix.net/freebies/free-base-4-direction-male-character-pixel-art/ | 69846 | Player character (male) walk cycle (`assets/characters/hero_m_{down,left,right,up}_{0..5}.png`) |
| Forest Ranger (chibi preview) | https://craftpix.net/freebies/ | — | Town NPC (`assets/characters/npc_ranger_{hood,leaf,antler}.png`) |
| Forest Guardian (chibi preview) | https://craftpix.net/freebies/ | — | Forest guardians NPC (`assets/characters/npc_guard_{tree,stone,hood}.png`) |

Source preview images: `img.craftpix.net` promotional artwork (not original pack assets).

**หมายเหตุการประมวลผลภาพ:** สไปรต์ตัวผู้เล่น (ทั้งหญิงและชาย) ถูกครอปจากภาพตัวอย่าง
โดย `tools/craftpix-hero.py` / `tools/craftpix-hero-male.py` — ลบพื้นหลัง ตัดขอบโปร่งใส
และเพิ่มเส้นขอบสีเข้มด้วย `tools/add-outline.py` (การดัดแปลงเชิงภาพ ไม่เปลี่ยนแนวคิดงานศิลป์)
ชุดชายเก็บความละเอียดต้นฉบับ (44x62) แล้วค่อยย่อตอนวาดในเกม เพื่อไม่ให้รายละเอียดหาย
ชุดหญิงทำแบบเดียวกัน (native 44x62, ย่อ sc 0.5484 ตอนวาด) ด้วย `tools/craftpix-hero-female.py`

**NPC chibi (Forest Ranger / Forest Guardian):** ครอปด้วย `tools/craftpix-chibi-npc.py`
ลบพื้นหลังด้วย flood fill, เก็บเฉพาะก้อนที่ใหญ่ที่สุด แล้วย่อให้สูง 72px
เป็นภาพ vector-style chibi (ไม่ใช่ pixel art) จึงวาดเป็น NPC ยืนนิ่ง + bob เบา และปิด tint เพื่อคงสีต้นฉบับ
