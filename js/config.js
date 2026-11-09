/* =========================================================
   DUNGEON TOWN — config, items, recipes, professions
   เมืองดับดันเจียน · เกม 2D isometric survival 3 อาชีพ
   ========================================================= */
(function (root) {
  'use strict';
  var DT = root.DT || (root.DT = {});

  /* ---------- ค่าคงที่เกม ---------- */
  DT.CFG = {
    TILE_W: 48,          // กว้าง tile (top-down จัตุรัส)
    TILE_H: 48,          // สูง tile (top-down จัตุรัส เท่ากับ TILE_W)
    PIXEL: 2,            // retro: วาดที่ความละเอียดต่ำกว่าจอ 2 เท่า แล้วขยาย pixelated
    MAP_W: 48,           // กว้างแผนที่ (tile)
    MAP_H: 48,           // สูงแผนที่ (tile)
    PLAYER_SPEED: 4.2,   // tile/วินาที
    DAY_LENGTH: 360,     // วินาทีต่อหนึ่งวันเกม (กลางวัน+กลางคืน)
    DAY_START: 0.30,     // เริ่มตอนเช้า (0..1 ของวัน)
    GATHER_TIME: 1.2,    // วินาทีต่อการเก็บ 1 ครั้ง
    GATHER_RANGE: 1.6,   // ระยะเก็บ (tile)
    ATTACK_RANGE: 1.8,   // ระยะโจมตี (tile)
    ATTACK_COOLDOWN: 0.55,
    STACK_MAX: 20,
    /* --- ความหิว (Phase 4: บาลานซ์ตัวเลข) ---
       HUNGER_DRAIN เดิม 0.55 → ใหม่ 0.22 : หิว 100 หมดใน ~7.5 นาที (เดิม ~3 นาที
       สั้นเกินไปสำหรับเกม survival และทำให้ผู้เล่นตายโดยไม่มีทางแก้) */
    HUNGER_DRAIN: 0.22,        // เดิม 0.55 → 0.22 (ต่อวินาที) หิวหมดใน ~7.5 นาที
    HUNGER_WEAK: 20,           // ใหม่ : หิว < 20 = อาการ "อ่อนแรง" (โจมตี/เก็บช้าลง) แทนการตายทันที
    HUNGER_STARVE_HP: 1.5,     // ใหม่ : หิวหมด = เสีย HP 1.5/วิ (เดิม 2/วิ แต่หิวหมดเร็วเกินจนตายโดยไม่ทันแก้)
    WEAK_DMG_MULT: 0.85,       // ใหม่ : ดาเมจที่ตี ตอนหิวน้อย (อ่อนแรง)
    STARVE_DMG_MULT: 0.7,      // ใหม่ : ดาเมจที่ตี ตอนหิวหมด (อดอาหาร)
    WEAK_GATHER_MULT: 1.5,     // ใหม่ : เวลาเก็บของตอนหิวหมด (ช้าลง 50%)
    WEAK_GATHER_MULT_LOW: 1.25,// ใหม่ : เวลาเก็บของตอนหิวน้อย (ช้าลง 25%)
    WEAK_STAMINA_REGEN: 0.6,   // ใหม่ : ฟื้นเหนื่อยตอนอดอาหารเหลือ 60%
    STAMINA_DRAIN_MOVE: 0.9,
    STAMINA_REGEN: 3.2,
    RESPAWN_BASE: 8,     // วินาทีก่อน node ฟื้น
    /* --- เศรษฐกิจ (Phase 4) --- */
    SHOP_BUY_MARKUP: 1.35,     // เดิม 1.6 → 1.35 (พ่อค้ากำไร 35% แทน 60%)
    SHOP_SELL_RATE: 0.65,      // เดิม 0.55 → 0.65 (ขายได้คืน 65% แทน 45% ไม่ทำให้ผู้เล่นจน)
    /* --- XP / เลเวล (Phase 4) --- */
    XP_PER_LEVEL: 60,          // เดิม 60 → คงเป็น "ค่าฐาน" ของเลเวล 1→2 (เลเวลแรกต้องไม่น่าเบื่อ)
                               // เลเวล 2 ขึ้นไปใช้เส้นโค้ง DT.xpToNext() : 60, 75, 94, 116, 142, ...
    XP_CURVE_STEP: 0.22,       // ใหม่ : +22% ของค่าฐาน ต่อเลเวล
    XP_CURVE_ACCEL: 0.03,      // ใหม่ : +3% ของค่าฐาน ต่อเลเวล (ยกกำลังให้ยากขึ้นเรื่อย ๆ)
    LEVEL_HP_BONUS: 15,        // เดิม 15 → 15 (คงเดิม เลเวล 2 = 115 HP)
    LEVEL_DMG_BONUS: 3,        // เดิม 2 → 3 (บวกดาเมจตายตัวต่อเลเวล)
    LEVEL_DMG_SCALE: 0.08,     // ใหม่ : อาวุธแรงขึ้น 8% ต่อเลเวล (ของดีแรงกว่าของธรรมดาทุกเลเวล)
    /* --- มอนส์ (Phase 4) --- */
    MOB_SCALE_PER_DAY: 0.08,   // ใหม่ : มอนส์ HP/ดาเมจ +8% ต่อวัน (วัน 1 = 1.00 เท่า, วัน 5 = 1.32 เท่า)
    WEATHER_CHANCE: 0.25,
    TOWN_RADIUS: 8,     // รัศมีปลอดภัย (ไม่มีมอนส์เข้า)
    /* --- ตีเหล็ก refine (Phase 5) --- */
    REFINE_MAX: 10,             // ระดับสูงสุดของการตีเหล็ก (+0 → +10)
    REFINE_BASE_CHANCE: 0.6,    // โอกาสสำเร็จตอน +0 → +1
    REFINE_CHANCE_DECAY: 0.045, // ลดลงทุกระดับ (0.6, 0.555, 0.51, ...)
    REFINE_COST_COINS: 50,      // ค่าเงินต่อ 1 ขั้น (ขั้นที่ n ราคา 50*(n+1))
    REFINE_COST_STONE: 2,       // หินตีบวกต่อ 1 ขั้น (ขั้นที่ n ใช้ 2*(n+1) หิน)
    REFINE_PROTECT_CHANCE: 0.9, // โอกาสที่หินกันแตกจะกันของแตกได้
    REFINE_LUCKY_BONUS: 0.15,   // หินเสี่ยงโชค +15% โอกาสสำเร็จ
    REFINE_DMG_PER_LEVEL: 0.10, // ดาเมจ +10% ต่อ 1 ระดับ refine
    REFINE_ARMOR_PER_LEVEL: 0.10,// กันดาเมจ +10% ต่อ 1 ระดับ refine
    /* --- ตลาดผู้เล่น (Phase 5) ---
       false = โหมด fallback (localStorage + broadcast, ไม่ต่อ DB)
       true  = โหมดออนไลน์ (ตาราง public.dungeon_town_market)
       พี่เอต้องรัน supabase/dungeon-town-market.sql ใน Supabase SQL Editor ก่อน
       แล้วค่อยเปลี่ยนเป็น true (ไม่งั้นจะได้ 404 ทุกครั้งที่เปิดเกม) */
    MARKET_USE_DB: true
  };

  /* ---------- ฟังก์ชันช่วยบาลานซ์ ---------- */

  /* XP ที่ต้องใช้เพื่อเลเวลถัดไป (เส้นโค้ง 60 → 75 → 94 → 116 → 142 → ...)
     เลเวล 1→2 ยังใช้ 60 XP เท่าเดิม (ไม่น่าเบื่อ) แต่เลเวลสูงขึ้นยากขึ้นเรื่อย ๆ */
  DT.xpToNext = function (level) {
    var l = Math.max(1, level || 1) - 1;
    return Math.round(DT.CFG.XP_PER_LEVEL * (1 + DT.CFG.XP_CURVE_STEP * l + DT.CFG.XP_CURVE_ACCEL * l * l));
  };

  /* ตัวคูณความแข็งแรงของมอนส์ตามวัน (วัน 1 = 1.00, วัน 2 = 1.08, วัน 5 = 1.32) */
  DT.mobDayScale = function (day) {
    var d = Math.max(1, day || 1);
    return 1 + DT.CFG.MOB_SCALE_PER_DAY * (d - 1);
  };

  /* สถิติมอนส์ที่ scale ตามวันแล้ว (ไว้ให้ js/world.js เรียกใช้ในอนาคต) */
  DT.mobStats = function (type, day) {
    var def = DT.MOBS && DT.MOBS[type];
    if (!def) return null;
    var f = DT.mobDayScale(day);
    return {
      hp: Math.max(1, Math.round(def.hp * f)),
      dmg: Math.max(1, Math.round(def.dmg * f)),
      xp: def.xp
    };
  };

  /* ---------- ราคาแตกต่างตามอาชีพ ----------
     ของที่อาชีพผลิตเอง = พ่อค้ามีของเยอะ → ขายให้ได้ถูกลง
     ของที่อาชีพขาดเอง (อาหาร/ยา) = พ่อค้าขายให้ได้แพงขึ้นเล็กน้อย (ไม่เกิน ~10%)
     ทั้งสองทางชดเชยกัน → ผู้เล่นไม่จนไม่รวย */
  DT.PRICE_ADJ = {
    miner: {
      sell: { ore: 0.88, stone: 0.92, iron_ingot: 0.92, pickaxe: 0.95 },
      buy:  { bread: 0.95, salad: 0.95, roast: 0.95, herbal_tonic: 0.90 }
    },
    hunter: {
      sell: { raw_meat: 0.88, hide: 0.88, wolf_pelt: 0.92, leather: 0.92, jerky: 0.95 },
      buy:  { bread: 0.95, roast: 0.92, herbal_tonic: 0.95 }
    },
    farmer: {
      sell: { herb: 0.88, berry: 0.88, bread: 0.95, salad: 0.95 },
      buy:  { raw_meat: 0.90, jerky: 0.90, cooked_meat: 0.92 }
    }
  };

  /* ---------- ชนิดของ tile ---------- */
  DT.TILE = {
    GRASS: 0,
    PATH: 1,
    STONE: 2,
    WATER: 3,
    SAND: 4,
    DIRT: 5,
    FIELD: 6,
    WALL: 7,      // ตึก (กันเดินผ่าน)
    FLOOR: 8      // พื้นในตึก
  };
  DT.WALKABLE = {
    0: true, 1: true, 2: true, 3: false, 4: true, 5: true, 6: true, 7: false, 8: true
  };

  /* ---------- อาชีพ 3 สาย ---------- */
  DT.PROFESSIONS = {
    miner: {
      id: 'miner',
      name: 'คนเหมือง',
      icon: '⛏️',
      color: '#c98b3a',
      desc: 'ขุดแร่/หินเร็ว · คราฟต์เครื่องมือและอาวุธโลหะ',
      gather: { rock: 2.0, ore: 2.2, tree: 0.9, bush: 1.0 },
      recipes: ['pickaxe', 'axe', 'iron_sword', 'steel_sword', 'iron_armor', 'shovel', 'lantern', 'campfire_kit', 'torch', 'coin_mint', 'stone_charm', 'goblin_amulet', 'refine_stone', 'protect_stone']
    },
    hunter: {
      id: 'hunter',
      name: 'นักล่า',
      icon: '🏹',
      color: '#4aa3d8',
      desc: 'เก็บไม้/เนื้อสัตว์เร็ว · คราฟต์อาวุธและเสื้อผ้า',
      gather: { tree: 2.1, bush: 1.6, rock: 0.9, ore: 0.8 },
      recipes: ['bow', 'bow_strong', 'wood_sword', 'leather_armor', 'tan_leather', 'jerky', 'bedroll', 'campfire_kit', 'torch', 'wolf_ring', 'goblin_amulet', 'refine_stone', 'lucky_stone']
    },
    farmer: {
      id: 'farmer',
      name: 'ช่างปลูก',
      icon: '🌾',
      color: '#5fbf6a',
      desc: 'เก็บผัก/สมุนไพรเร็ว · คราฟต์อาหารและยา',
      gather: { bush: 2.2, tree: 1.2, rock: 1.0, ore: 0.9 },
      recipes: ['bread', 'salad', 'herbal_tonic', 'stew', 'roast', 'jerky', 'bedroll', 'campfire_kit', 'torch', 'stone_charm']
    }
  };

  /* ---------- ไอเทม ---------- */
  DT.ITEMS = {
    wood:      { name: 'ไม้',            icon: '🪵', stack: 20 },
    stone:     { name: 'หิน',            icon: '🪨', stack: 20 },
    ore:       { name: 'แร่',            icon: '⛏️', stack: 20 },
    herb:      { name: 'สมุนไพร',        icon: '🌿', stack: 20 },
    berry:     { name: 'ผลไม้ป่า',       icon: '🫐', stack: 20 },
    raw_meat:  { name: 'เนื้อดิบ',        icon: '🥩', stack: 20 },
    cooked_meat:{ name: 'เนื้อย่าง',      icon: '🍖', stack: 20 },
    fish:      { name: 'ปลา',            icon: '🐟', stack: 20 },
    plank:     { name: 'ไม้แผ่น',         icon: '🪚', stack: 20 },
    iron_ingot:{ name: 'เหล็กก้อน',       icon: '🧱', stack: 20 },
    pickaxe:   { name: 'คีม',            icon: '⛏️', stack: 1, weapon: 3 },
    axe:       { name: 'ขวาน',           icon: '🪓', stack: 1, weapon: 4 },
    wood_sword:{ name: 'ดาบไม้',         icon: '🗡️', stack: 1, weapon: 6 },
    iron_sword:{ name: 'ดาบเหล็ก',        icon: '⚔️', stack: 1, weapon: 11 },
    bow:       { name: 'ธนู',            icon: '🏹', stack: 1, weapon: 9 },
    leather_armor:{ name: 'เสื้อหนัง',     icon: '🦺', stack: 1, armor: 4 },
    bread:     { name: 'ขนมปัง',         icon: '🍞', stack: 10, food: 28 },
    salad:     { name: 'สลัด',           icon: '🥗', stack: 10, food: 20 },
    cooked_meat_food: { name: 'เนื้อย่าง(กิน)', icon: '🍖', stack: 10, food: 40 },
    herbal_tonic:{ name: 'ยาสมุนไพร',     icon: '🧪', stack: 5, heal: 35 },
    campfire_kit:{ name: 'ชุดกองไฟ',      icon: '🔥', stack: 5 },
    torch:     { name: 'คบไฟ',           icon: '🕯️', stack: 5 },
    /* --- Phase 2 --- */
    coin:      { name: 'เหรียญ',          icon: '🪙', stack: 999 },
    hide:      { name: 'หนังสัตว์',        icon: '🟫', stack: 20 },
    leather:   { name: 'หนังฟอก',          icon: '🟨', stack: 20 },
    wolf_pelt: { name: 'หนังหมูป่า',       icon: '🟧', stack: 20 },
    goblin_ear:{ name: 'หูโกเบิล',         icon: '👂', stack: 20 },
    fish_raw:  { name: 'ปลาดิบ',           icon: '🐟', stack: 20 },
    stew:      { name: 'ซุป',             icon: '🍲', stack: 10, food: 55, heal: 12 },
    roast:     { name: 'ข้าวหมกคั่ว',       icon: '🍚', stack: 10, food: 35 },
    jerky:     { name: 'เนื้อตากแห้ง',      icon: '🥩', stack: 10, food: 45, heal: 5 },
    iron_armor:{ name: 'เสื้อเหล็ก',       icon: '🛡️', stack: 1, armor: 9 },
    steel_sword:{ name: 'ดาบเหล็กกล้า',     icon: '🗡️', stack: 1, weapon: 18 },
    bow_strong:{ name: 'ธนูแข็ง',          icon: '🏹', stack: 1, weapon: 15 },
    bedroll:   { name: 'ผ้าห่ม',           icon: '🛏️', stack: 1 },
    /* --- เครื่องประดับ (acc = ดาเมจเพิ่ม, accDef = กันดาเมจเพิ่ม) --- */
    wolf_ring:   { name: 'แหวนหนังหมูป่า',   icon: '💍', stack: 1, acc: 2 },
    stone_charm: { name: 'เครื่องรางหิน',     icon: '🪬', stack: 1, accDef: 2 },
    goblin_amulet:{ name: 'ต่างหูโกเบิล',     icon: '📿', stack: 1, acc: 3, accDef: 1 },
    shovel:    { name: 'พลั่ว',            icon: '🥄', stack: 1 },
    lantern:   { name: 'ตะเกียง',          icon: '🏮', stack: 3 },
    /* --- Phase 5: ของสำหรับตีเหล็ก --- */
    refine_stone:  { name: 'หินตีบวก',      icon: '🔷', stack: 20 },
    protect_stone: { name: 'หินกันแตก',     icon: '🔶', stack: 20 },
    lucky_stone:   { name: 'หินเสี่ยงโชค',  icon: '🎲', stack: 20 }
  };
  // อาหารที่กินได้จริง
  DT.ITEMS.cooked_meat.food = 40;
  DT.ITEMS.cooked_meat.icon = '🍖';

  /* ---------- สูตรคราฟต์ ---------- */
  DT.RECIPES = {
    pickaxe:   { out: 'pickaxe', n: 1, need: { wood: 3, ore: 2 } },
    axe:       { out: 'axe', n: 1, need: { wood: 4, stone: 2 } },
    wood_sword:{ out: 'wood_sword', n: 1, need: { plank: 3, stone: 1 } },
    iron_sword:{ out: 'iron_sword', n: 1, need: { iron_ingot: 3, plank: 2 } },
    bow:       { out: 'bow', n: 1, need: { plank: 4, herb: 1 } },
    leather_armor:{ out: 'leather_armor', n: 1, need: { raw_meat: 4, plank: 2 } },
    campfire_kit:{ out: 'campfire_kit', n: 1, need: { wood: 5, stone: 3 } },
    torch:     { out: 'torch', n: 1, need: { wood: 1, herb: 1 } },
    bread:     { out: 'bread', n: 1, need: { berry: 3 } },
    salad:     { out: 'salad', n: 1, need: { herb: 2, berry: 2 } },
    herbal_tonic:{ out: 'herbal_tonic', n: 1, need: { herb: 3, fish: 1 } },
    plank:     { out: 'plank', n: 1, need: { wood: 2 } },
    iron_ingot:{ out: 'iron_ingot', n: 1, need: { ore: 2, wood: 1 } },
    cooked_meat:{ out: 'cooked_meat', n: 1, need: { raw_meat: 1, wood: 1 } },
    cook_fish: { out: 'cooked_meat', n: 1, need: { fish_raw: 1, wood: 1 } },
    /* --- Phase 2 --- */
    stew:      { out: 'stew', n: 1, need: { cooked_meat: 1, herb: 2, berry: 2 } },
    roast:     { out: 'roast', n: 1, need: { berry: 2, herb: 1, fish_raw: 1 } },
    jerky:     { out: 'jerky', n: 1, need: { raw_meat: 2, herb: 1 } },
    tan_leather:{ out: 'leather', n: 1, need: { hide: 2, herb: 1 } },
    iron_armor:{ out: 'iron_armor', n: 1, need: { leather: 3, iron_ingot: 2, plank: 1 } },
    steel_sword:{ out: 'steel_sword', n: 1, need: { iron_ingot: 4, plank: 2, herb: 2 } },
    bow_strong:{ out: 'bow_strong', n: 1, need: { plank: 6, leather: 2 } },
    bedroll:   { out: 'bedroll', n: 1, need: { hide: 3, herb: 2 } },
    shovel:    { out: 'shovel', n: 1, need: { iron_ingot: 1, plank: 2 } },
    lantern:   { out: 'lantern', n: 1, need: { iron_ingot: 1, plank: 1, herb: 2 } },
    coin_mint: { out: 'coin', n: 5, need: { ore: 2, iron_ingot: 1 } },
    wolf_ring:   { out: 'wolf_ring', n: 1, need: { wolf_pelt: 1, leather: 1 } },
    stone_charm: { out: 'stone_charm', n: 1, need: { ore: 2, herb: 1 } },
    /* --- Phase 5: หินสำหรับตีเหล็ก --- */
    refine_stone:  { out: 'refine_stone', n: 1, need: { stone: 3, ore: 1 } },
    protect_stone: { out: 'protect_stone', n: 1, need: { ore: 3, herb: 1 } },
    lucky_stone:   { out: 'lucky_stone', n: 1, need: { ore: 2, herb: 2, wolf_pelt: 1 } },
    goblin_amulet:{ out: 'goblin_amulet', n: 1, need: { goblin_ear: 2, iron_ingot: 1 } }
  };

  /* ---------- ชนิด node เก็บทรัพยากร ---------- */
  DT.NODES = {
    tree: { label: 'ต้นไม้', icon: '🌳', yields: 'wood', amount: 6 },
    rock: { label: 'ก้อนหิน', icon: '🪨', yields: 'stone', amount: 6 },
    ore:  { label: 'แร่', icon: '⛏️', yields: 'ore', amount: 5 },
    bush: { label: 'พุ่มไม้', icon: '🌿', yields: 'herb', amount: 4 },
    /* easter egg — ซ่อนไว้ในป่า (DawnLike license: ต้องใช้ + ซ่อน Platino) */
    platino: { label: 'จิ้าจอกเงา', icon: '🦎', yields: 'herb', amount: 1, secret: true }
  };

  /* ---------- มอนส์ ----------
     ค่า hp/dmg ด้านล่างคือ "วันที่ 1" (ยังไม่ scale)
     ตัวคูณตามวันอยู่ที่ DT.mobDayScale() (+8%/วัน) ใช้โดย js/player.js (syncMobScale) */
  DT.MOBS = {
    slime:  { name: 'สลิม', icon: '🟢', hp: 20, dmg: 4, speed: 1.5, spawnWeight: 5, radius: 0.45, xp: 8,
              loot: [['raw_meat', 0.35], ['berry', 0.3], ['coin', 0.25]] },
    wolf:   { name: 'หมูป่า', icon: '🐺', hp: 26, dmg: 6, speed: 2.6, spawnWeight: 3, radius: 0.45, xp: 14,
              loot: [['raw_meat', 0.5], ['hide', 0.55], ['wolf_pelt', 0.3]] },
    goblin: { name: 'โกเบิล', icon: '👺', hp: 34, dmg: 8, speed: 2.1, spawnWeight: 2, radius: 0.45, xp: 22,
              loot: [['goblin_ear', 0.5], ['coin', 0.4], ['ore', 0.35]] },
    boar:   { name: 'หมูป่าเผือก', icon: '🐗', hp: 42, dmg: 10, speed: 2.3, spawnWeight: 2, radius: 0.5, xp: 26,
              loot: [['raw_meat', 0.6], ['hide', 0.5], ['coin', 0.3]] },
    wraith: { name: 'วิญญาต', icon: '👻', hp: 30, dmg: 12, speed: 1.9, spawnWeight: 1, radius: 0.45, xp: 35,
              night: true, loot: [['herbal_tonic', 0.25], ['coin', 0.5], ['herb', 0.4]] },

    /* --- มอนส์เพิ่มเติมจาก FF "10 Basic RPG Enemies" (redshrike, CC-BY 3.0 + OGA-BY 3.0) --- */
    bat:     { name: 'ค้างคาว', icon: '🦇', hp: 18, dmg: 5, speed: 3.2, spawnWeight: 2, radius: 0.4, xp: 12,
               loot: [['raw_meat', 0.3], ['coin', 0.2]] },
    imp:     { name: 'นายภูต', icon: '👹', hp: 26, dmg: 9, speed: 2.6, spawnWeight: 1.5, radius: 0.45, xp: 20,
               loot: [['coin', 0.45], ['herb', 0.3], ['goblin_ear', 0.15]] },
    ghoul:   { name: 'ผีกลืน', icon: '🧟', hp: 44, dmg: 12, speed: 1.7, spawnWeight: 1.5, radius: 0.5, xp: 30,
               night: true, loot: [['hide', 0.35], ['coin', 0.45], ['herb', 0.35]] },
    skeleton: { name: 'กระดูก', icon: '💀', hp: 52, dmg: 14, speed: 1.8, spawnWeight: 1, radius: 0.5, xp: 38,
               loot: [['ore', 0.4], ['iron_ingot', 0.25], ['coin', 0.4]] },
    mage:    { name: 'ผู้หญิงผมขาว', icon: '🧙', hp: 38, dmg: 16, speed: 2.0, spawnWeight: 1, radius: 0.45, xp: 42,
               night: true, loot: [['herbal_tonic', 0.4], ['herb', 0.45], ['coin', 0.5]] },
    knight:  { name: 'อัศวินโบราณ', icon: '⚔️', hp: 60, dmg: 18, speed: 1.9, spawnWeight: 0.6, radius: 0.55, xp: 55,
               loot: [['iron_ingot', 0.45], ['coin', 0.6], ['ore', 0.35]] },
    dragon:  { name: 'มังกร', icon: '🐉', hp: 90, dmg: 24, speed: 2.2, spawnWeight: 0.35, radius: 0.6, xp: 90,
               night: true, loot: [['iron_ingot', 0.55], ['coin', 0.7], ['ore', 0.4]] }
  };

  /* ---------- ราคาขายของซื้อ (เหรียญต่อชิ้น) ---------- */
  DT.PRICES = {
    wood: 3, stone: 4, ore: 8, herb: 6, berry: 5, raw_meat: 10, fish_raw: 12,
    hide: 14, leather: 22, wolf_pelt: 30, goblin_ear: 20,
    cooked_meat: 26, stew: 42, roast: 30, jerky: 34, bread: 14, salad: 18,
    herbal_tonic: 35, plank: 8, iron_ingot: 26,
    pickaxe: 55, axe: 60, wood_sword: 45, iron_sword: 120, steel_sword: 240,
    bow: 90, bow_strong: 180, leather_armor: 130, iron_armor: 320,
    campfire_kit: 25, torch: 8, bedroll: 40, shovel: 55, lantern: 70, coin: 1,
    wolf_ring: 90, stone_charm: 120, goblin_amulet: 160,
    refine_stone: 25, protect_stone: 60, lucky_stone: 110
  };

  /* ---------- NPC ในเมือง ---------- */
  DT.NPCS = [
    { id: 'merchant', name: 'พ่อค้าเมือง', icon: '🧑‍🌾', x: 29.5, y: 21.5, prof: 'merchant',
      sprite: 'characters/alt_down_6.png',
      greeting: 'ยินดีต้อนรับนักเดินทาง! สินค้ามีขายนะ' },
    { id: 'blacksmith', name: 'ตาลึง', icon: '👨‍🔧', x: 20.5, y: 20.5, prof: 'blacksmith',
      sprite: 'characters/alt_down_7.png',
      greeting: 'ต้องการให้ตีอะไร? แต่งเครื่องดีๆ ได้ที่นี่' },
    { id: 'guide', name: 'ผู้กำกับเมือง', icon: '🧙', x: 24.5, y: 27.5, prof: 'guide',
      sprite: 'characters/alt_down_10.png',
      greeting: 'รับใช้! มีเควสต์ให้ทำตลอดเวลา' }
  ];

  /* ---------- เควสต์ ---------- */
  DT.QUESTS = [
    /* รางวัลเควสต์ (Phase 4: ปรับให้สมดุลกับ DT.PRICES และความยาก)
       เดิม → ใหม่ (เหรียญ / XP):
       q_slime 40/30 → 75/40  (สลิมตายให้ XP 8 ตัว = 40 XP, ของลอตกน้อย)
       q_wood  35/20 → 60/30  (ไม้ 10 ชิ้น มูลค่า 30 เหรียญ)
       q_ore   55/35 → 110/55 (แร่ 8 ชิ้น มูลค่า 64 เหรียญ)
       q_boar  70/45 → 170/90 (หมูป่าเผือกตายให้ XP 26 ตัว = 78 XP) */
    { id: 'q_slime', name: 'กำจัดสลิม', desc: 'ป่าด้านเหนือเต็มไปด้วยสลิม', goal: 5, type: 'kill', target: 'slime', reward: 75, xp: 40 },
    { id: 'q_wood', name: 'เติมไม้ให้เมือง', desc: 'เก็บไม้มาให้เมือง 10 ไม้', goal: 10, type: 'gather', target: 'wood', reward: 60, xp: 30 },
    { id: 'q_ore', name: 'แร่สำหรับตาลึง', desc: 'ขุดแร่มาให้ตาลึง 8 แร่', goal: 8, type: 'gather', target: 'ore', reward: 110, xp: 55 },
    { id: 'q_boar', name: 'ปัญหาหมูป่า', desc: 'กำจัดหมูป่าเผือก 3 ตัว', goal: 3, type: 'kill', target: 'boar', reward: 170, xp: 90 }
  ];

  /* ---------- ตัวละครที่ผู้เล่นเลือกได้ ---------- */
  DT.CHARACTERS = [
    { id: 'hero',    name: 'ฮีโร่',          sprite: 'characters/player_down.png' },
    { id: 'trav_a',  name: 'นักเดินทาง A',   sprite: 'characters/alt_down_6.png' },
    { id: 'trav_b',  name: 'นักเดินทาง B',   sprite: 'characters/alt_down_7.png' },
    { id: 'trav_c',  name: 'นักเดินทาง C',   sprite: 'characters/alt_down_10.png' }
  ];

  /* ---------- จุด spawn ---------- */
  DT.SPAWNS = {
    player: { x: 24.5, y: 24.5 },
    forge:  { x: 20.5, y: 22.5 }
  };
})(window);
