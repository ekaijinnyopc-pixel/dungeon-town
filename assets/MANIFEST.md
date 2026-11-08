# MANIFEST — dungeon-town/assets

ชุดภาพทั้งหมดดาวน์โหลดจาก **Kenney** (kenney.nl) ใบอนุญาต **CC0 1.0 (Public Domain)** — ใช้ค้า ดัดแปลง แจกต่อ ได้โดยไม่ต้องขออนุญาต

> ข้อควรรู้: ภาพชุดนี้ **wire เข้าเกมแล้ว** — `js/sprites.js` (ตัวโหลดแบบ lazy + fallback) และ `js/art.js`
> (ผูกสไปรต์เข้ากับ tree / rock / ore / bush / player / บ้าน / prop) ถ้าโหลดสไปรต์ไม่ได้จะวาดรูปทรงเดิมแบบ shape art ทันที
> ค่าตัดภาพ (`src`) / สเกล (`sc`) / จุดยึด (`dy`) อยู่ใน `js/sprites.js` ตาราง `S.SPEC` — ดูหัวข้อ 6 เรื่องคาลิเบรต

---

## 1. ชุดที่มี (10 packs)

| # | Pack | โฟลเดอร์ | PNG | tile | ใช้ทำอะไร |
|---|---|---|---|---|---|
| 1 | **Tiny Town** | `tiles/town/` | 132 | 16×16 | ธรรมชาติ บ้าน ทุ่ง ไม้ คน |
| 2 | **Tiny Dungeon** | `tiles/dungeon/` | 132 | 16×16 | ดันเจอ หิน ประตู คราบ |
| 3 | **Tiny City** | `tiles/city/` | 132 | 16×16 | เมือง ถนน ร้าน ไฟ |
| 4 | **Roguelike Modern City 2.0** | `tiles/urban/` | 1,036 | 16×16 | ทางเท้า น้ำ ร้าน สัญญาณไฟ |
| 5 | **1-Bit Pack** | `tiles/1bit/` | 704 | 16×16 | น้ำ พื้นแอล โลโก้ |
| 6 | **Roguelike Characters 2.0** | `chars/roguelike/` | 648 | 16×16 | ตัวละครหลายทิศ (หลัก) |
| 7 | **Roguelike Caves & Dungeons** | `chars/dungeon/` | 522 | 16×16 | ตัวละคร/มอนสเตอร์ดันเจอ |
| 8 | **Pixel Platformer** | `chars/platformer/` | 27 | 16×16 | ตัวละครพิเศษ |
| 9 | **Mini Dungeon** | — | — | — | sheet อยู่ใน `sheets/` |
| 10 | **Mini Forest** | — | — | — | sheet อยู่ใน `sheets/` |

- `sheets/` = 11 tilesheet ต้นฉบับ (แหล่งอ้างอิง ตัดต่อ index ได้)
- `licenses/` = License.txt ครบทุกชุด (10 ไฟล์)
- **รวม PNG 3,460 ไฟล์ · 14M**

### URL ดาวน์โหลด

| Pack | URL |
|---|---|
| Tiny Town | `https://kenney.nl/assets/tiny-town` |
| Tiny Dungeon | `https://kenney.nl/assets/tiny-dungeon` |
| Tiny City | `https://kenney.nl/assets/tiny-city` |
| Roguelike Modern City | `https://kenney.nl/assets/roguelike-modern-city` |
| 1-Bit Pack | `https://kenney.nl/assets/1-bit-pack` |
| Roguelike Characters | `https://kenney.nl/assets/roguelike-characters` |
| Roguelike Caves & Dungeons | `https://kenney.nl/assets/roguelike-caves-dungeons` |
| Pixel Platformer | `https://kenney.nl/assets/pixel-platformer` |
| Mini Dungeon | `https://kenney.nl/assets/mini-dungeon` |
| Mini Forest | `https://kenney.nl/assets/mini-forest` |

ดาวน์โหลดผ่าน signed URL `https://kenney.nl/download/...` แล้วแตกเป็น PNG รายตัว

---

## 2. `objects/` — ไฟล์ที่คัดลอกมาใช้จริง

**111 PNG** + `mapping.json` (111 รายการ) · 480K

mapping.json แต่ละรายการมี: `file`, `source_pack`, `source_sheet`, `source_index`, `source_path`, `tile_size`, `note`

### แจกแจงตาม pack

| Pack | จำนวน |
|---|---|
| Tiny Town | 47 |
| Roguelike Modern City | 27 |
| Tiny Dungeon | 19 |
| Tiny City | 15 |
| 1-Bit Pack | 3 |

### กลุ่มวัตถุ

- **พื้น** — `grass_plain`, `grass_flowers`, `grass_tufts`, `dirt_path`, `dirt_path_edge`, `dirt_path_pebbles`, `dirt_mound`, `stone_floor`, `stone_floor_dark`, `stone_path`, `urban_grass`, `urban_concrete_floor`, `urban_wood_floor`, `urban_wood_floor_vertical`, `urban_wood_boards`, `wood_planks`
- **น้ำ** — `water`, `water_edge`, `water_shore`, `urban_water`, `urban_water_rim`, `urban_water_over_brick`
- **ต้นไม้/พุ่ม** — `tree_green`, `tree_green_large`, `tree_autumn`, `tree_gold_round`, `bush`, `bush_cluster`, `hedge`, `urban_tree`, `urban_tree_planter`, `urban_bush`, `urban_bush_dark`, `city_tree_green`, `city_tree_gold`, `city_bush_planter`
- **บ้าน/อาคาร** — `house_wall`, `house_wall_brick`, `house_wall_castle`, `house_window`, `house_door`, `door_wood`, `doorway`, `roof`, `roof_grey`, `brick_wall`, `brick_wall_dark`, `wood_wall`, `city_brick_wall`, `city_building_brown`, `city_storefront`, `shop_blue_window`
- **ประตู/ทางเข้า** — `dungeon_door_stone`, `dungeon_door_wood`, `dungeon_arch_door`, `dungeon_portcullis`, `dungeon_bars`, `dungeon_grate`, `urban_door`, `urban_door_panes`
- **ดันเจอ** — `dungeon_wall`, `dungeon_wall_slab`, `dungeon_floor_stone`, `dungeon_floor_dirt`, `dungeon_floor_sand`, `dungeon_pillar`, `dungeon_table`, `dungeon_anvil`, `dungeon_rubble`, `dungeon_pool`, `dungeon_torch`
- **บันได/รั้ว** — `stairs` (urban 0168), `stairs_wide`, `fence`, `fence_corner`, `fence_vertical`, `urban_fence`, `city_fence_chainlink`
- **ไฟ/ป้าย** — `lamp_street`, `street_lamp_arm`, `city_lamp_post`, `urban_lamp_post`, `urban_lamp_street`, `urban_lamp_wall`, `urban_traffic_light`, `sign`, `signboard`, `signpost`, `urban_shop_sign`, `urban_shop_awning`, `urban_awning_orange`
- **ของเก็บ/ใช้** — `axe`, `pickaxe`, `shovel`, `key`, `pot`, `barrel_pot`, `crate`, `dungeon_potion`, `beehive`, `mushrooms`
- **หิน** — `urban_rock`, `city_rock` (เดิมมี `rock_boulder`/`rock_small` แต่ **ถอดออก** เพราะเป็น tile ที่ภาพชนขอบเซลล์ = edge bleed ทำให้ก้อนหินดูเหมือนถูกตัดขาด)
- **อื่น ๆ** — `urban_window_green`, `urban_window_teal`, `city_sidewalk`, `city_road_asphalt`, `city_ground_dirt`, `city_planter`

### mapping ที่เคยผิดและแก้แล้ว (ยืนยันจากภาพจริง)

| ชื่อ | เดิม (ผิด) | ใหม่ (ถูก) |
|---|---|---|
| `bush` | town 0016 (ต้นไม้) | **town 0007** (พุ่มจริง — tile 0006 เป็น tile พื้นแบบเฉียง ไม่ใช่พุ่ม) |
| `stairs` | dungeon 0037 (ผนัง) | **urban 0168** (บันไดจริง) |
| `house_wall` | city 0084 (หน้าต่าง) | **town 0108** (ผนังจริง) |

---

## 3. `characters/` — ตัวละคร 4 ทิศ

**6 PNG** + `characters.json` — สกัดจาก `sheets/roguelikeChar_transparent.png` (grid origin = x6, y9, cell 16×16)

| ไฟล์ | ทิศ | ต้นทาง | หมายเหตุ |
|---|---|---|---|
| `player_down.png` | หน้า (down) | cell r11c1 | ฮีโร่เกราะขาว มีหน้าตา |
| `player_up.png` | หลัง (up) | cell r11c0 | **ตัวเดียวกัน** มองไปข้างหลัง ถือโล่ |
| `player_side.png` | ข้าง (side) | สร้างจาก `player_down` | ⚠️ **พลิกภาพสะท้อนแนวนอน** — pack นี้ไม่มีภาพหันข้างจริง |
| `alt_down_6.png` | หน้า | cell r6c1 | ผู้ชายเครา หนวดเครา |
| `alt_down_7.png` | หน้า | cell r7c1 | ผู้หญิงผมเปีย ชุดสีส้ม |
| `alt_down_10.png` | หน้า | cell r10c1 | ผิวเข้ม ชุดสีส้ม |

โครงสร้าง `characters.json`:

```json
{
  "player": {
    "down": ["player_down.png"],
    "side": ["player_side.png"],
    "up":   ["player_up.png"]
  },
  "alternates": { "down": ["alt_down_6.png", "alt_down_7.png", "alt_down_10.png"] },
  "tile_size": 16,
  "source_pack": "Roguelike Characters 2.0"
}
```

ถ้ามี animation หลายเฟรม ใส่เป็น array เรียงตามลำดับเวลา

### ⚠️ ข้อจำกัดสำคัญ — pack นี้ไม่มีภาพหันข้าง

จินตรวจภาพทุกชุดที่ดาวน์โหลดมาแล้ว (ด้วยการ crop/scale แล้วตรวจด้วยสายตาทีละชุด):

- **Roguelike Characters 2.0** = ชุด **modular** (แยก ผม/เสื้อ/กางเกง/อาวุธ/โล่) + ตัวละครประกอบที่คอลัมน์ซ้าย **หน้า/หลังเท่านั้น** ไม่มี side และไม่มี walk cycle
- **Roguelike Caves & Dungeons** (`chars/dungeon/`) = เป็น **tile สิ่งแวดล้อม** จริง ๆ ไม่ใช่ตัวละคร (ตั้งชื่อโฟลเดอร์เพี้ยน)
- **Pixel Platformer** (`chars/platformer/`) = มีแต่เอเลี่ยน/หุ่นยนต์ หันหน้าอย่างเดียว
- **Roguelike Modern City** / **Tiny Town** = ไม่มีตัวละครเลย มีแต่รถที่มี front/back/side (ใช้เป็นตัวอย่างทิศได้)

**ทางออก:** `player_side.png` พลิกจากภาพหน้า (เป็นแนวปฏิบัติที่พบบ่อย) — ถ้าอยากได้ side จริง ต้องดาวน์โหลด pack อื่นเพิ่ม เช่น **Tiny Dungeon** (มี NPC หลายทิศ) หรือ **Top-down Shooter**

### 🔧 เครื่องมือวิเคราะห์

`/data/.openclaw/agents/subjin1/agent/workshop-skills/dungeon-town-character-select/scripts/select_characters.py` — brute-force หา grid origin ของ sheet (เทียบ pixel bytes แบบ exact) แล้วจัดกลุ่ม pose

```bash
python3 /data/.openclaw/agents/subjin1/agent/workshop-skills/dungeon-town-character-select/scripts/select_characters.py \
  --project /data/.openclaw/workspace/dungeon-town
```

> สคริปต์นี้หา origin ได้ถูก (ox=6, oy=9) แต่ auto-pick ไม่ผ่านเกณฑ์ → ต้องเลือก cell เอง (ผ่านการดูภาพ)
> โมเดลหลัก (MiniMax-M2.7) **มองภาพไม่ได้** — ต้องใช้ `view_image` ซึ่งมี `prompt` ให้ถาม vision ได้

---

## 4. เครื่องมือ

`tools/make_objects.py` — สคริปต์คัดลอกไฟล์ + สร้าง `mapping.json` (รันซ้ำได้)

```bash
cd dungeon-town && python3 tools/make_objects.py
```

---

## 5. คาลิเบรตสไปรต์ ↔ shape art (ผลล่าสุด)

วัดด้วย `node tools/calibrate.js` (เปิดเกมแบบ headless แล้ววัด bbox ของ shape art ทุก variant
เทียบกับ bbox ที่วาดจริงผ่าน `DT.Sprites.draw`) — จุดยึดของทุกวัตถุคือ "กลางล่าง" ของภาพ
(`relBot = dy - 1`)

| วัตถุ | shape art (เป้าหมาย) | สไปรต์ (ผลจริง) | หมายเหตุ |
|---|---|---|---|
| ต้นไม้ v0 | w33 h29 relTop-24 relBot4 | w32 h32 relTop-27 relBot4 | `tree_green_large` (Tiny Town 0005) |
| ต้นไม้ v1 | w31 h26 relTop-19 relBot6 | w26 h32 relTop-25 relBot6 | `tree_green` (Tiny Town 0004) |
| ต้นไม้ v2 | w33 h29 relTop-24 relBot4 | w30 h30 relTop-25 relBot4 | `tree_gold_round` (Tiny Town 0015) |
| ต้นไม้ v3 | w33 h29 relTop-24 relBot4 | w26 h30 relTop-25 relBot4 | `tree_autumn` (Tiny Town 0003) |
| หิน v0 / แร่ | w26 h22 relTop-11 relBot10 | w24 h22 relTop-11 relBot10 | `urban_rock` (Urban 0493) |
| หิน v1 | w28 h21 relTop-10 relBot10 | w20 h22 relTop-11 relBot10 | `city_rock` (Tiny City 0102) |
| หิน v2 | w27 h23 relTop-12 relBot10 | w24 h22 relTop-11 relBot10 | `urban_rock` |
| พุ่ม v0 | w22 h18 relTop-12 relBot5 | w24 h18 relTop-12 relBot5 | `bush` (Tiny Town 0007) |
| พุ่ม v1 | w21 h20 relTop-14 relBot5 | w20 h26 relTop-20 relBot5 | `urban_bush` (Urban 0403) — พุ่มพุ่งสูง |
| พุ่ม v2 | w22 h19 relTop-13 relBot5 | w24 h18 relTop-12 relBot5 | `bush_gold` (Tiny Town 0010) |
| ผู้เล่น down | w14 h30 relTop-30 relBot-1 | w22 h28 relTop-28 relBot-1 | `player_down.png` (r11c1) |
| ผู้เล่น up | w14 h30 relTop-30 relBot-1 | w20 h28 relTop-28 relBot-1 | `player_up.png` (r11c0) |
| ผู้เล่น side | w15 h30 relTop-30 relBot-1 | w22 h28 relTop-28 relBot-1 | mirror ของ `player_down` (ไม่มีท่า side ใน pack) |

- **relBot ตรงกันหมดทุกตัว** = วัตถุ/ตัวละคร "ยืน" ที่ระดับเดียวกับ shape art เดิม (ไม่ลอย/ไม่จม)
- ความกว้าง/ส่วนสูงต่างกันเล็กน้อยเพราะภาพ CC0 ขนาด 16×16 ต่อภาพ
  (ฮีโร่กว้าง 11 px = 22 หน่วย จึงกว้างกว่า shape art ที่กว้าง 14 หน่วย — ไม่มีภาพที่แคบกว่านี้ใน pack)
- ห้ามตัดภาพต้นฉบับ: ทุก `src` ถูกตัดเฉพาะขอบโปร่งใส/ภาพของเซลล์ข้างเคียงที่ปนอยู่เท่านั้น

---

## 6. License

ทุกชุดเป็น **Kenney CC0 1.0** — ไฟล์ license ต้นฉบับอยู่ใน `licenses/`
ถ้าจะเผยแพร่เกม ควรใส่เครดิต "Art by Kenney (kenney.nl) — CC0" ในหน้า About/Credits
