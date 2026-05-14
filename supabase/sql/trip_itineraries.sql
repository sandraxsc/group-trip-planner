-- Run in Supabase SQL editor (once per project).
-- Stores full trip itinerary JSON + optional transit snapshot for cross-device restore.

create table if not exists public.trip_itineraries (
  "tripId" text primary key,
  payload jsonb not null,
  "updatedAt" timestamptz not null default now()
);

comment on table public.trip_itineraries is 'Saved itinerary per trip; payload matches app Itinerary type (incl. optional transitSnapshot).';

-- Realtime: Database → Replication → enable trip_itineraries (or add to publication), then:
-- alter publication supabase_realtime add table public.trip_itineraries;
