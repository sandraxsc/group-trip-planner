-- Run once in Supabase SQL editor.
-- Backing table for the TripMember TS type (src/types/trip.ts). Columns
-- are quoted-case to match the camelCase keys the Supabase JS client
-- sends — Postgres folds unquoted identifiers to lowercase, so without
-- the quotes a `preferenceStatus` filter would silently always match
-- nothing.
--
-- Schema mapping (src/types/trip.ts → SQL):
--   id                 text  primary key   uuid string
--   tripId             text  not null      FK by convention to trips.id
--   name               text  not null      Display name picked at join time
--   joinedAt           text  not null      ISO timestamp
--   role               text  not null      'owner' | 'member'
--   preferenceStatus   text  not null      'not_started' | 'in_progress' | 'completed'

create table if not exists public.trip_members (
  id text primary key,
  "tripId" text not null,
  name text not null,
  "joinedAt" text not null,
  role text not null default 'member',
  "preferenceStatus" text not null default 'not_started'
);

-- Most queries are "give me all members for this trip", so index tripId.
create index if not exists trip_members_trip_idx
  on public.trip_members ("tripId");

-- API access grants — see trips.sql for the full rationale. Required for
-- new projects (after 2026-05-30) and new tables on existing projects
-- (after 2026-10-30), where Supabase no longer auto-grants on create.
grant select, insert, update, delete on public.trip_members
  to anon, authenticated, service_role;

-- Optional: enable Realtime so member joins propagate to other guests'
-- screens without a refresh. Dashboard → Database → Publications →
-- supabase_realtime → add table `trip_members`.
