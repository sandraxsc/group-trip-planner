-- One-time migration: single itinerary row per trip → versioned rows.
-- Run once in Supabase SQL editor when upgrading an EXISTING production DB.
--
-- SKIP THIS FILE on a brand-new iteration project if you already ran
-- supabase/sql/trip_itineraries.sql (drop + create). You do not need 007.
--
-- Safe to skip if trip_itineraries already has an `id` uuid column.
-- RLS is intentionally NOT enabled (matches project convention).

-- Rename legacy table when it still uses tripId as the primary key (no `id` column).
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trip_itineraries'
      and column_name = 'tripId'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trip_itineraries'
      and column_name = 'id'
  ) then
    alter table public.trip_itineraries rename to trip_itineraries_old;
  end if;
end $$;

create table if not exists public.trip_itineraries (
  id uuid primary key default gen_random_uuid(),
  "tripId" text not null references public.trips(id) on delete cascade,
  payload jsonb not null,
  "isActive" boolean not null default false,
  "versionNumber" integer not null default 1,
  "generatedAt" timestamptz not null default now(),
  "archivedAt" timestamptz,
  "restoredFrom" uuid references public.trip_itineraries(id)
);

create index if not exists trip_itineraries_trip_id_idx on public.trip_itineraries ("tripId");
create index if not exists trip_itineraries_trip_id_active_idx on public.trip_itineraries ("tripId", "isActive");

comment on table public.trip_itineraries is
  'Versioned trip itineraries; exactly one row per trip has isActive=true. payload matches app Itinerary type.';

-- Migrate legacy rows (tripId PK + payload + updatedAt) when rename happened.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'trip_itineraries_old'
  ) then
    insert into public.trip_itineraries ("tripId", payload, "isActive", "versionNumber", "generatedAt")
    select o."tripId", o.payload, true, 1, coalesce(o."updatedAt", now())
    from public.trip_itineraries_old o
    where not exists (
      select 1 from public.trip_itineraries ti where ti."tripId" = o."tripId"
    );
    drop table public.trip_itineraries_old;
  end if;
end $$;

grant select, insert, update, delete on public.trip_itineraries
  to anon, authenticated, service_role;

-- Realtime: Database → Replication → enable trip_itineraries (or add to publication), then:
-- alter publication supabase_realtime add table public.trip_itineraries;
