-- Group logistics (shared flights/hotels) + per-member confirmations.
-- Run once in Supabase SQL editor. RLS intentionally NOT enabled.
-- tripId / memberId use text to match trips.id and trip_members.id.

create table if not exists public.group_flights (
  id uuid primary key default gen_random_uuid(),
  "tripId" text not null references public.trips(id) on delete cascade,
  direction text not null check (direction in ('arrival', 'departure')),
  origin text,
  destination text,
  date text,
  "arrivalTime" text,
  airline text,
  "flightNumber" text,
  "durationMinutes" integer,
  "createdAt" timestamptz not null default now()
);

create index if not exists group_flights_trip_id_idx on public.group_flights ("tripId");

create table if not exists public.group_hotels (
  id uuid primary key default gen_random_uuid(),
  "tripId" text not null references public.trips(id) on delete cascade,
  "placeId" text,
  name text not null,
  address text,
  "dayStart" integer,
  "dayEnd" integer,
  "createdAt" timestamptz not null default now()
);

create index if not exists group_hotels_trip_id_idx on public.group_hotels ("tripId");

create table if not exists public.member_logistics_confirmations (
  id uuid primary key default gen_random_uuid(),
  "tripId" text not null references public.trips(id) on delete cascade,
  "memberId" text not null references public.trip_members(id) on delete cascade,
  "logisticsType" text not null check ("logisticsType" in ('flight', 'hotel')),
  "logisticsId" uuid not null,
  confirmed boolean not null default true,
  "separateDate" text,
  "separateArrivalTime" text,
  "separateAirline" text,
  "separateFlightNumber" text,
  "separateHotelName" text,
  "separateHotelAddress" text,
  unique ("memberId", "logisticsType", "logisticsId")
);

create index if not exists member_logistics_confirmations_trip_id_idx
  on public.member_logistics_confirmations ("tripId");
create index if not exists member_logistics_confirmations_member_id_idx
  on public.member_logistics_confirmations ("memberId");

grant select, insert, update, delete on public.group_flights
  to anon, authenticated, service_role;
grant select, insert, update, delete on public.group_hotels
  to anon, authenticated, service_role;
grant select, insert, update, delete on public.member_logistics_confirmations
  to anon, authenticated, service_role;
