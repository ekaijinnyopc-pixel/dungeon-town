-- =========================================================
-- DUNGEON TOWN — ตารางเก็บสถานะผู้เล่น
-- วิธีใช้: เปิด Supabase Dashboard > SQL Editor > วางไฟล์นี้ > Run
--   หรือ: psql "$DATABASE_URL" -f dungeon-town.sql
-- =========================================================

create table if not exists public.dungeon_town_players (
  client_id   text primary key,
  name        text not null default 'ผู้เล่น',
  prof        text not null default 'miner',
  x           double precision not null default 24.5,
  y           double precision not null default 24.5,
  hp          double precision not null default 100,
  hunger      double precision not null default 100,
  stamina     double precision not null default 100,
  inv         jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);

-- อุปกรณ์ที่สวมอยู่ (mouse-first: สวมใส่/ถอดได้) — เพิ่มภายหลัง
alter table public.dungeon_town_players add column if not exists weapon text;
alter table public.dungeon_town_players add column if not exists armor_id text;
alter table public.dungeon_town_players add column if not exists accessory_id text;

-- ให้ client เขียน/อ่านได้ (anon key) — เกมนี้ไม่มีข้อมูลส่วนตัว
alter table public.dungeon_town_players enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'dungeon_town_players' and policyname = 'dt_public_all') then
    create policy dt_public_all on public.dungeon_town_players
      for all
      to anon, authenticated
      using (true)
      with check (true);
  end if;
end $$;

-- index สำหรับ query ตาม updated_at (ล้างข้อมูลเก่า)
create index if not exists dungeon_town_players_updated_at_idx
  on public.dungeon_town_players (updated_at desc);

-- ตรวจว่าสร้างสำเร็จ
select count(*) as players from public.dungeon_town_players;
