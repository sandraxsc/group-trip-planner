-- Trip-level outdated itinerary flag + regeneration cap counter.
-- Run once in Supabase SQL editor. RLS intentionally NOT enabled.

alter table public.trips add column if not exists "isOutdated" boolean not null default false;
alter table public.trips add column if not exists "regenCount" integer not null default 0;
