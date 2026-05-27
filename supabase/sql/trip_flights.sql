-- Run once in Supabase SQL editor.
-- Mirrors public.trip_hotels — shared rows per trip, no auth/RLS yet to match
-- the rest of the schema. Columns are quoted-case to match TripFlight (TS).
--
-- Schema mapping (src/types/trip.ts → SQL):
--   id              text  primary key   (uuid string from crypto.randomUUID())
--   tripId          text  not null      (FK by convention, no constraint)
--   memberId        text  not null      (the guest this flight belongs to)
--   direction       text  not null      'arrival' | 'departure'
--   origin          text  not null      IATA, e.g. 'DCA'
--   destination     text  not null      IATA, e.g. 'CDG'
--   date            text  not null      'YYYY-MM-DD' (we don't enforce TZ)
--   airline         text  not null      optional in UI but column is non-null;
--                                        the client passes '' when blank
--   flightNumber    text                optional, NULL when blank
--   durationMinutes integer             optional
--   arrivalTime     text                'HH:MM' 24h — landing or takeoff time

create table if not exists public.trip_flights (
  id text primary key,
  "tripId" text not null,
  "memberId" text not null,
  direction text not null check (direction in ('arrival', 'departure')),
  origin text not null,
  destination text not null,
  date text not null,
  airline text not null default '',
  "flightNumber" text,
  "durationMinutes" integer,
  "arrivalTime" text
);

-- Most queries are "give me all flights for this trip", so index tripId.
create index if not exists trip_flights_trip_idx
  on public.trip_flights ("tripId");

-- Optional: enable Realtime so flights propagate across guests like
-- trip_members / activity_votes do. Dashboard → Database → Publications →
-- supabase_realtime → add table `trip_flights`.
