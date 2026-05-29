-- Run once in Supabase SQL editor.
-- Backing table for the TripInvite TS type (src/types/trip.ts). Columns
-- are quoted-case to match the camelCase keys the Supabase JS client
-- sends — Postgres folds unquoted identifiers to lowercase, so without
-- the quotes an `isActive` filter would silently always match nothing.
--
-- Schema mapping (src/types/trip.ts → SQL):
--   tripId      text  not null      FK by convention to trips.id (no constraint)
--   token       text  primary key   Random-ish share token from generateToken()
--   joinUrl     text  not null      Full https URL — generated client-side at
--                                   `${window.location.origin}/join/${token}`
--   createdAt   text  not null      ISO timestamp
--   isActive    boolean not null    Hard-deactivation flag; reads filter by this

create table if not exists public.trip_invites (
  "tripId" text not null,
  token text primary key,
  "joinUrl" text not null,
  "createdAt" text not null,
  "isActive" boolean not null default true
);

-- Most lookups are "give me the invite for this trip" or "by token";
-- token is already the PK, so just index tripId.
create index if not exists trip_invites_trip_idx
  on public.trip_invites ("tripId");
