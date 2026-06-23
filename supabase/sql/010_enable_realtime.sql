-- Enable Supabase Realtime for trip planner tables.
-- Run once after the base table migrations (trips, trip_members, etc.).
-- Safe to re-run: duplicate publication entries are ignored.

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'trips',
    'trip_members',
    'member_preferences',
    'activity_votes',
    'trip_itineraries',
    'trip_hotels',
    'trip_flights'
  ]
  loop
    begin
      execute format(
        'alter publication supabase_realtime add table public.%I',
        tbl
      );
    exception
      when duplicate_object then
        null;
      when undefined_table then
        raise notice 'Skipping realtime for missing table: %', tbl;
    end;
  end loop;
end $$;
