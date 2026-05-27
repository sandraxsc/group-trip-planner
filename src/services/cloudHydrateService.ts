import type { RealtimeChannel } from "@supabase/supabase-js";
import type { ActivityVote } from "../types/itinerary";
import type { MemberPreference } from "../types/preference";
import type { TripMember } from "../types/trip";
import { getSupabaseClient } from "../config/supabaseClient";
import { cloudGetTripMembers, isCloudEnabled } from "./tripCloudStore";
import { cloudGetPreferencesByTripId, isPreferenceCloudEnabled } from "./preferenceCloudStore";
import { cloudGetTripItinerary, isItineraryCloudEnabled } from "./itineraryCloudStore";
import { mergeItineraryFromCloudIfNewer } from "./itineraryService";
import { fetchTripVotesFromCloud } from "./tripVotesCloudHydrate";

/** Debounce rapid Realtime events (e.g. multiple row writes) into one REST hydrate. */
const HYDRATE_DEBOUNCE_MS = 400;

/**
 * Ignores repeat hydrate calls within this window unless {@link hydrateTripFromCloud} is called with `force: true`.
 * Stops accidental traffic from cached/old bundles that still poll every ~25s, while Realtime + forced paths stay fresh.
 */
const NON_FORCE_REPEAT_SUPPRESS_MS = 120_000;

/** Minimum gap between “tab became visible” hydrates (focus churn on mobile). */
const VISIBILITY_MIN_GAP_MS = 90_000;

const REALTIME_TABLES = ["trip_members", "member_preferences", "activity_votes", "trip_itineraries"] as const;

/**
 * Auxiliary trip tables that don't fit the typed `HydrateResult` contract
 * (they're managed by their own services: hotelService / flightService).
 * Watched by `subscribeTripAuxSync` so consumers can re-pull these caches
 * when another guest changes them, without expanding the main hydrate pipeline.
 */
const AUX_REALTIME_TABLES = ["trip_hotels", "trip_flights"] as const;
type AuxTable = (typeof AUX_REALTIME_TABLES)[number];

export type HydrateResult = {
  members?: TripMember[];
  preferences?: MemberPreference[];
  votes?: ActivityVote[];
  /** True when cloud had a newer (or only) itinerary merged into localStorage */
  itineraryUpdated?: boolean;
};

/**
 * Subscribe to Supabase Realtime for this trip so we only refetch when data actually changes.
 * Falls back to: initial hydrate + hydrate when the tab becomes visible (if Realtime is off or misses an event).
 *
 * In Supabase Dashboard: enable Realtime replication for `trip_members`, `member_preferences`, `activity_votes`, `trip_itineraries`.
 */
export function subscribeTripCloudSync(
  tripId: string,
  onAfterHydrate: (result: HydrateResult) => void
): () => void {
  let cancelled = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastVisibilityHydrateAt: number | null = null;

  const run = async () => {
    if (cancelled) return;
    const result = await hydrateTripFromCloud(tripId, { force: true });
    if (cancelled) return;
    onAfterHydrate(result);
  };

  const schedule = () => {
    if (cancelled) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void run();
    }, HYDRATE_DEBOUNCE_MS);
  };

  void run();

  const client = getSupabaseClient();
  let channel: RealtimeChannel | null = null;

  if (client) {
    const filter = `tripId=eq.${tripId}`;
    let ch = client.channel(`sync-trip-${tripId}`);
    for (const table of REALTIME_TABLES) {
      ch = ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter },
        () => {
          schedule();
        }
      );
    }
    ch.subscribe((status) => {
      if (import.meta.env.DEV && status === "CHANNEL_ERROR") {
        // eslint-disable-next-line no-console
        console.warn(
          "[cloudHydrate] Realtime channel error — enable Replication for trip_members, member_preferences, activity_votes, trip_itineraries (Supabase → Database → Publications / Realtime)."
        );
      }
    });
    channel = ch;
  }

  const onVisibility = () => {
    if (cancelled || typeof document === "undefined" || document.visibilityState !== "visible") return;
    const now = Date.now();
    if (
      lastVisibilityHydrateAt != null &&
      now - lastVisibilityHydrateAt < VISIBILITY_MIN_GAP_MS
    ) {
      return;
    }
    lastVisibilityHydrateAt = now;
    void run();
  };
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
  }

  return () => {
    cancelled = true;
    if (debounceTimer) clearTimeout(debounceTimer);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibility);
    }
    if (client && channel) {
      void client.removeChannel(channel);
    }
  };
}

const hydrateInFlight = new Map<string, Promise<HydrateResult>>();
/** Last successful REST hydrate per trip (for non-forced repeat suppression). */
const lastHydrateOk = new Map<string, { at: number; data: HydrateResult }>();

const LS_KEYS = {
  MEMBERS: "tripMembers",
  PREFS: "memberPreferences",
  VOTES: "activityVotes",
} as const;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function upsertByComposite<T extends { tripId: string; memberId: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();
  for (const e of existing) map.set(`${e.tripId}::${e.memberId}`, e);
  for (const n of incoming) map.set(`${n.tripId}::${n.memberId}`, { ...(map.get(`${n.tripId}::${n.memberId}`) as T | undefined), ...n });
  return Array.from(map.values());
}

function upsertByMemberId(existing: TripMember[], incoming: TripMember[]): TripMember[] {
  const map = new Map(existing.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, { ...(map.get(m.id) ?? m), ...m });
  return Array.from(map.values());
}

function upsertVotes(existing: ActivityVote[], incoming: ActivityVote[]): ActivityVote[] {
  // Vote key: tripId + memberId + placeId
  const map = new Map(existing.map((v) => [`${v.tripId}::${v.memberId}::${v.placeId}`, v]));
  for (const v of incoming) map.set(`${v.tripId}::${v.memberId}::${v.placeId}`, v);
  return Array.from(map.values());
}

export async function hydrateTripFromCloud(
  tripId: string,
  opts?: { force?: boolean }
): Promise<HydrateResult> {
  const force = opts?.force === true;
  if (!force) {
    const prev = lastHydrateOk.get(tripId);
    if (prev && Date.now() - prev.at < NON_FORCE_REPEAT_SUPPRESS_MS) {
      return prev.data;
    }
  }

  const pending = hydrateInFlight.get(tripId);
  if (pending) return pending;

  const promise = (async (): Promise<HydrateResult> => {
    const out: HydrateResult = {};

    if (isCloudEnabled()) {
      const m = await cloudGetTripMembers(tripId);
      if (m.ok) {
        const existing = readJson<TripMember[]>(LS_KEYS.MEMBERS, []);
        const merged = upsertByMemberId(existing, m.data);
        writeJson(LS_KEYS.MEMBERS, merged);
        out.members = m.data;
      }
    }

    if (isPreferenceCloudEnabled()) {
      const p = await cloudGetPreferencesByTripId(tripId);
      if (p.ok) {
        const existing = readJson<MemberPreference[]>(LS_KEYS.PREFS, []);
        const merged = upsertByComposite(existing, p.data);
        writeJson(LS_KEYS.PREFS, merged);
        out.preferences = p.data;
      }
    }

    const voteRows = await fetchTripVotesFromCloud(tripId);
    if (voteRows) {
      const existing = readJson<ActivityVote[]>(LS_KEYS.VOTES, []);
      const merged = upsertVotes(existing, voteRows);
      writeJson(LS_KEYS.VOTES, merged);
      out.votes = voteRows;
    }

    if (isItineraryCloudEnabled()) {
      const it = await cloudGetTripItinerary(tripId);
      if (it.ok && it.data) {
        const applied = mergeItineraryFromCloudIfNewer(it.data);
        if (applied) out.itineraryUpdated = true;
      }
    }

    lastHydrateOk.set(tripId, { at: Date.now(), data: out });
    return out;
  })();

  hydrateInFlight.set(tripId, promise);
  void promise.finally(() => {
    hydrateInFlight.delete(tripId);
  });
  return promise;
}

/**
 * Subscribe to Realtime changes on the auxiliary trip tables
 * (`trip_hotels`, `trip_flights`) so other-guest edits show up live without a
 * page refresh. The callback fires once per table-event, debounced lightly to
 * coalesce bursts. Consumers are expected to call the appropriate hydrate
 * function (e.g. `hydrateTripHotelsFromCloud`) inside the callback.
 *
 * Falls back to a no-op when Supabase isn't configured. Returns an unsubscribe
 * function — call it on screen unmount.
 *
 * In Supabase Dashboard: enable Realtime replication for `trip_hotels` and
 * `trip_flights` (Database → Publications → supabase_realtime).
 */
export function subscribeTripAuxSync(
  tripId: string,
  onChange: (table: AuxTable) => void
): () => void {
  const client = getSupabaseClient();
  if (!client) return () => {};

  let cancelled = false;
  const debounceTimers = new Map<AuxTable, ReturnType<typeof setTimeout>>();

  const schedule = (table: AuxTable) => {
    if (cancelled) return;
    // Tiny per-table debounce so a multi-row write doesn't trigger N hydrates.
    const existing = debounceTimers.get(table);
    if (existing) clearTimeout(existing);
    debounceTimers.set(
      table,
      setTimeout(() => {
        debounceTimers.delete(table);
        if (cancelled) return;
        onChange(table);
      }, HYDRATE_DEBOUNCE_MS)
    );
  };

  const filter = `tripId=eq.${tripId}`;
  let ch = client.channel(`sync-trip-aux-${tripId}`);
  for (const table of AUX_REALTIME_TABLES) {
    ch = ch.on(
      "postgres_changes",
      { event: "*", schema: "public", table, filter },
      () => schedule(table)
    );
  }
  ch.subscribe((status) => {
    if (import.meta.env.DEV && status === "CHANNEL_ERROR") {
      // eslint-disable-next-line no-console
      console.warn(
        "[cloudHydrate] Aux realtime channel error — enable Replication for trip_hotels, trip_flights (Supabase → Database → Publications)."
      );
    }
  });

  return () => {
    cancelled = true;
    for (const t of debounceTimers.values()) clearTimeout(t);
    debounceTimers.clear();
    void client.removeChannel(ch);
  };
}
