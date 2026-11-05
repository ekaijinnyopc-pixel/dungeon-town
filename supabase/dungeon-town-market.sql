-- =========================================================
-- DUNGEON TOWN — ตารางตลาดผู้เล่น (player market)
-- วิธีใช้: เปิด Supabase Dashboard > SQL Editor > วางไฟล์นี้ > Run
--   หรือ: psql "$DATABASE_URL" -f dungeon-town-market.sql
--
-- ถ้ายังไม่รันไฟล์นี้ เกมจะทำงานแบบ fallback อัตโนมัติ
--   (เก็บ listing ใน localStorage key 'dt:market' + broadcast ผ่าน DT.Net)
--   แต่ถ้ารันแล้ว ผู้เล่นคนละเครื่องจะเห็นของกันข้ามอินเทอร์เน็ตได้
-- =========================================================

create table if not exists public.dungeon_town_market (
  id          uuid primary key default gen_random_uuid(),
  seller_id   text not null,
  seller_name text not null default 'ผู้เล่น',
  item_id     text not null,
  qty         integer not null default 1,
  price       integer not null,
  status      text not null default 'active',   -- active | sold | canceled
  buyer_id    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ให้ client เขียน/อ่านได้ (anon key) — เกมนี้ไม่มีข้อมูลส่วนตัว
alter table public.dungeon_town_market enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'dungeon_town_market' and policyname = 'dt_public_all') then
    create policy dt_public_all on public.dungeon_town_market
      for all
      to anon, authenticated
      using (true)
      with check (true);
  end if;
end $$;

-- index สำหรับ query ตามสถานะ (รายการที่ยังตั้งขายอยู่) และเรียงตามเวลาใหม่สุด
create index if not exists dungeon_town_market_status_idx
  on public.dungeon_town_market (status);

create index if not exists dungeon_town_market_created_at_idx
  on public.dungeon_town_market (created_at desc);

-- index ช่วยหา "ของฉันที่ขายแล้วรอรับเงิน"
create index if not exists dungeon_town_market_seller_idx
  on public.dungeon_town_market (seller_id);

-- ตรวจว่าสร้างสำเร็จ
select count(*) as listings from public.dungeon_town_market;
