# Asset Credits / Attribution

เกมนี้ใช้ภาพจากชุดต่อไปนี้ — ต้องเก็บการอ้างอิงตามเงื่อนไขของแต่ละชุด:

## CC0 (ไม่ต้องอ้างอิง แต่ใส่ไว้เพื่อความชัดเจน)

- **Kenney — Roguelike RPG Pack** — https://kenney.nl/assets/roguelike-rpg-pack
  - ใช้: `assets/tiles/ground/*` (tile พื้น: grass, path, stone, water, sand, dirt, field, floor, grass_flowers)
  - ที่มา: `Spritesheet/roguelikeSheet_transparent.png`
- **Kenney — Tiny Dungeon / Tiny Town / Roguelike Characters**
  - ใช้: `assets/chars/*`, `assets/objects/*` (ตัวละคร, ต้นไม้, บ้าน, ป้ายร้าน)

## CC-BY 4.0 — ต้องอ้างอิง

- **Dawnlike — 16x16 Universal Roguelike tileset v1.81**
  - ผู้สร้าง: Thomas Harte (DawnHack / Dawnlike project)
  - ใช้: `assets/mobs/wolf.png`, `assets/mobs/boar.png`, `assets/mobs/platino.png`
  - ที่มา: `Characters/Quadraped0.png`, `Characters/Reptile0.png`
  - เงื่อนไข: CC-BY 4.0 — ต้องไม่เอาความดีงานมาเป็นของตัวเอง
  - **เงื่อนไขพิเศษที่ต้องทำตาม (จาก README ของ Dawnlike):**
    1. ต้องอ้างอิง **DawnBringer** ผู้สร้างพาเลตต์สีของชุดนี้
    2. ต้อง **ใช้และซ่อน sprite ชื่อ "Platino"** ไว้ในเกม
    3. ถ้าใช้ชุดนี้ ต้องใช้ Platino sprite นั้นด้วย
  - ✅ **เกมนี้ทำตามครบ:** มี Platino เป็น easter egg ซ่อนอยู่ในป่า
    (แผนที่ช่อง x=7, y=41 — เดินเข้าป่าทางเหนือไปหาให้เจอ)

## CC-BY 3.0 + OGA-BY 3.0 — ต้องอ้างอิง

- **10 Basic RPG Enemies**
  - ผู้สร้าง: **redshrike** (OpenGameArt)
  - ใช้: `assets/mobs/slime.png`, `assets/mobs/goblin.png`, `assets/mobs/ghoul.png`,
    `assets/mobs/skeleton.png`, `assets/mobs/mage.png`, `assets/mobs/imp.png`,
    `assets/mobs/knight.png`, `assets/mobs/bat.png`, `assets/mobs/dragon.png`,
    `assets/mobs/wraith.png` (ทั้งหมด 10 ตัวจากชุดนี้)
  - ที่มา: https://opengameart.org/content/10-basic-rpg-enemies (`rpgcritters2.png`)
  - เงื่อนไข: CC-BY 3.0 + OGA-BY 3.0
  - การครอป: ใช้ `tools/extract-ff-mobs.py` (crop จาก connected-component bbox แล้ว trim ขอบ)
    — แต่ละตัวถูกตัดจากเซลล์ของตัวเอง ไม่มีเศษภาพจากเซลล์ข้างเคียงปนมา

---

## ข้อควรรู้

- สไปรต์ทั้งหมดโหลดแบบ lazy และมี **fallback แบบวาดด้วย Canvas**
  (ถ้าภาพโหลดไม่ได้ เกมยังเล่นได้ ไม่จอดำ)
- รายละเอียดที่มาของแต่ละมอนส์อยู่ที่ `assets/mobs/mapping.json`
