-- Add isHost flag to trip_members.
-- A host lives in the trip destination: no flight needed by default,
-- but they may still add a hotel if joining friends at their stay.
alter table public.trip_members
  add column if not exists "isHost" boolean not null default false;
