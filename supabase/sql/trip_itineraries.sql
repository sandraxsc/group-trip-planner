-- Run in Supabase SQL editor (once per project).
-- Stores full trip itinerary JSON + optional transit snapshot for cross-device restore.

create table if not exists public.trip_itineraries (
  "tripId" text primary key,
  payload jsonb not null,
  "updatedAt" timestamptz not null default now()
);

comment on table public.trip_itineraries is 'Saved itinerary per trip; payload matches app Itinerary type (incl. optional transitSnapshot).';

-- API access grants — see trips.sql for the full rationale. Required for
-- new projects (after 2026-05-30) and new tables on existing projects
-- (after 2026-10-30), where Supabase no longer auto-grants on create.
grant select, insert, update, delete on public.trip_itineraries
  to anon, authenticated, service_role;

-- Realtime: Database → Replication → enable trip_itineraries (or add to publication), then:
-- alter publication supabase_realtime add table public.trip_itineraries;
