-- Run once in Supabase SQL editor (fixes 400 on upsert after MBTI + categorized deal-breakers).
-- Base table columns: tripId, memberId, budgetLevel, energyLevel, activeHours,
-- activityTypes (jsonb), selectedPlaces (jsonb), dealBreakers (jsonb).

alter table public.member_preferences
  add column if not exists "mbti" text;

comment on column public.member_preferences."mbti" is
  'MBTI type (e.g. INTJ). Omitted from API payload until the member saves this step.';

-- dealBreakers must be jsonb (array of { category, tags, note? } or legacy string tags).
-- If you created the table with text[] instead, convert:
-- alter table public.member_preferences alter column "dealBreakers" type jsonb using to_jsonb("dealBreakers");

-- API access grants — see trips.sql for the full rationale. Required for
-- new projects (after 2026-05-30) and new tables on existing projects
-- (after 2026-10-30), where Supabase no longer auto-grants on create.
-- This file only patches the table (the base CREATE happened earlier in
-- this project's history); the grant is still safe to re-run idempotently.
grant select, insert, update, delete on public.member_preferences
  to anon, authenticated, service_role;
