-- Versioned trip itineraries (payload matches app Itinerary type).
--
-- FRESH PROJECT: run this whole file as-is.
--
-- UPGRADING A LEGACY TABLE WITH DATA TO KEEP (old tripId-PK schema):
--   run supabase/sql/007_versioned_itineraries.sql instead — do NOT drop first.
--
-- REPLACING A BROKEN / OLD EMPTY TABLE (isActive column missing):
--   this file drops trip_itineraries first, then recreates the correct schema.

drop table if exists public.trip_itineraries cascade;

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

create index trip_itineraries_trip_id_idx on public.trip_itineraries ("tripId");
create index trip_itineraries_trip_id_active_idx on public.trip_itineraries ("tripId", "isActive");

comment on table public.trip_itineraries is
  'Versioned trip itineraries; exactly one row per trip has isActive=true. payload matches app Itinerary type.';

grant select, insert, update, delete on public.trip_itineraries
  to anon, authenticated, service_role;

-- Realtime: Database → Replication → enable trip_itineraries (or add to publication), then:
-- alter publication supabase_realtime add table public.trip_itineraries;
