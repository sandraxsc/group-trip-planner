-- Run once in Supabase SQL editor.
-- Mirrors the trip_flights pattern: shared rows per trip, no auth/RLS yet to
-- match the rest of the schema. Columns are quoted-case to match TripHotel
-- (src/types/trip.ts) — Supabase folds unquoted identifiers to lowercase, so
-- without the quotes a camelCase upsert like `dayStart` would silently fail.
--
-- Schema mapping (src/types/trip.ts → SQL):
--   id          text  primary key   (uuid string from crypto.randomUUID())
--   tripId      text  not null      (FK by convention, no constraint)
--   placeId     text  not null      Google placeId, '' when free-text only
--   name        text  not null      Hotel display name
--   address     text                Optional formatted address
--   dayStart    integer not null    1-based inclusive check-in day
--   dayEnd      integer not null    1-based inclusive check-out day (> dayStart)
--   createdAt   text  not null      ISO timestamp

create table if not exists public.trip_hotels (
  id text primary key,
  "tripId" text not null,
  "placeId" text not null default '',
  name text not null,
  address text,
  "dayStart" integer not null,
  "dayEnd" integer not null,
  "createdAt" text not null
);

-- Most queries are "give me all hotels for this trip", so index tripId.
create index if not exists trip_hotels_trip_idx
  on public.trip_hotels ("tripId");

-- API access grants — see trips.sql for the full rationale. Required for
-- new projects (after 2026-05-30) and new tables on existing projects
-- (after 2026-10-30), where Supabase no longer auto-grants on create.
grant select, insert, update, delete on public.trip_hotels
  to anon, authenticated, service_role;

-- Optional: enable Realtime so hotels propagate across guests like
-- trip_members / activity_votes do. Dashboard → Database → Publications →
-- supabase_realtime → add table `trip_hotels`.
