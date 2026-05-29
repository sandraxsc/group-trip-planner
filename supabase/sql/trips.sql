-- Run once in Supabase SQL editor.
-- Backing table for the Trip TS type (src/types/trip.ts). Columns are
-- quoted-case to match the camelCase keys the Supabase JS client sends —
-- Postgres folds unquoted identifiers to lowercase, so without the quotes
-- a `tripDays` insert would silently become a NULL `tripdays` insert (or
-- worse, get rejected as an unknown column).
--
-- Schema mapping (src/types/trip.ts → SQL):
--   id           text  primary key   (uuid string from crypto.randomUUID())
--   name         text  not null      Display title, e.g. "Tokyo Trip"
--   destination  text  not null      Free-text city/country
--   tripDays     integer             1-based day count (>= 1 when set)
--   maxGuests    integer             Member capacity incl. owner
--   startDate    text                YYYY-MM-DD, used for weekday mapping
--   groupType    text                Social context: colleagues | family |
--                                    couple | close_friends | meetup |
--                                    new_friends. Drives AI scheduler tone.
--   createdAt    text  not null      ISO timestamp
--
-- IMPORTANT: existing projects that pre-date the `groupType` field need to
-- run the bottom `alter table ... add column if not exists` block as well,
-- otherwise every cloudCreateTripBundle() call will fail with
-- "Could not find the 'groupType' column of 'trips'" and the friend's
-- device will keep seeing "This invite is no longer valid".

create table if not exists public.trips (
  id text primary key,
  name text not null,
  destination text not null,
  "tripDays" integer,
  "maxGuests" integer,
  "startDate" text,
  "groupType" text,
  "createdAt" text not null
);

-- Idempotent upgrade for older databases that were created before some
-- of the optional Trip columns existed. PostgREST reports only the FIRST
-- missing column it encounters in its schema cache, so running these as
-- a batch avoids the whack-a-mole of fixing them one 400 at a time.
-- Safe to re-run on any database.
alter table public.trips add column if not exists "tripDays" integer;
alter table public.trips add column if not exists "maxGuests" integer;
alter table public.trips add column if not exists "startDate" text;
alter table public.trips add column if not exists "groupType" text;
