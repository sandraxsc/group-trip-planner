-- Add versioning columns to trip_itineraries if they are missing.
--
-- Run this in the Supabase SQL editor when you see the error:
--   "column trip_itineraries.isActive does not exist"
--
-- Safe to run multiple times (all statements use IF NOT EXISTS / IF EXISTS guards).
-- Does NOT drop existing rows.

-- 1. Ensure the table has a uuid `id` primary key (old schema used tripId as PK).
--    If the old schema is present, migrate it first.
do $$
begin
  -- If tripId is the PK (no id column) rename old table and recreate.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'trip_itineraries' and column_name = 'tripId'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'trip_itineraries' and column_name = 'id'
  ) then
    alter table public.trip_itineraries rename to trip_itineraries_old;

    create table public.trip_itineraries (
      id uuid primary key default gen_random_uuid(),
      "tripId" text not null references public.trips(id) on delete cascade,
      payload jsonb not null,
      "isActive" boolean not null default false,
      "versionNumber" integer not null default 1,
      "generatedAt" timestamptz not null default now(),
      "archivedAt" timestamptz,
      "restoredFrom" uuid references public.trip_itineraries(id)
    );

    insert into public.trip_itineraries ("tripId", payload, "isActive", "versionNumber", "generatedAt")
    select o."tripId", o.payload, true, 1, coalesce(o."updatedAt", now())
    from public.trip_itineraries_old o
    where not exists (
      select 1 from public.trip_itineraries ti where ti."tripId" = o."tripId"
    );

    drop table public.trip_itineraries_old;
  end if;
end $$;

-- 2. Add missing versioning columns to an existing table that already has `id`.
alter table public.trip_itineraries
  add column if not exists "isActive" boolean not null default false;

alter table public.trip_itineraries
  add column if not exists "versionNumber" integer not null default 1;

alter table public.trip_itineraries
  add column if not exists "generatedAt" timestamptz not null default now();

alter table public.trip_itineraries
  add column if not exists "archivedAt" timestamptz;

alter table public.trip_itineraries
  add column if not exists "restoredFrom" uuid;

-- 3. Add missing indexes (ignored if they already exist).
create index if not exists trip_itineraries_trip_id_idx
  on public.trip_itineraries ("tripId");

create index if not exists trip_itineraries_trip_id_active_idx
  on public.trip_itineraries ("tripId", "isActive");

-- 4. Ensure grants are in place.
grant select, insert, update, delete on public.trip_itineraries
  to anon, authenticated, service_role;
