import { getSupabaseClient } from "../config/supabaseClient";
import type { ItineraryRecord } from "../types/itineraryRecord";
import type { Itinerary } from "../types/itinerary";
import { isItineraryCommitted } from "../utils/itineraryCommit";

type DbRow = {
  id: string;
  tripId: string;
  payload: Itinerary;
  isActive: boolean;
  versionNumber: number;
  generatedAt: string;
  archivedAt: string | null;
  restoredFrom: string | null;
};

const activeByTripId = new Map<string, ItineraryRecord>();
const activeFetchInFlight = new Map<string, Promise<ItineraryRecord | null>>();

function sb() {
  return getSupabaseClient();
}

export function isItineraryCloudEnabled(): boolean {
  return sb() != null;
}

function rowToRecord(row: DbRow): ItineraryRecord {
  const payload = row.payload;
  const mergedPayload: Itinerary = {
    ...payload,
    tripId: payload.tripId || row.tripId,
  };
  return {
    id: row.id,
    tripId: row.tripId,
    payload: mergedPayload,
    isActive: row.isActive,
    versionNumber: row.versionNumber,
    generatedAt: row.generatedAt,
    archivedAt: row.archivedAt ?? undefined,
    restoredFrom: row.restoredFrom ?? undefined,
  };
}

function setActiveCache(tripId: string, record: ItineraryRecord | null): void {
  if (record) activeByTripId.set(tripId, record);
  else activeByTripId.delete(tripId);
}

/** Sync read of the last fetched active itinerary (session memory only — not localStorage). */
export function getCachedActiveItinerary(tripId: string): Itinerary | null {
  return activeByTripId.get(tripId)?.payload ?? null;
}

export function hasCachedActiveItinerary(tripId: string): boolean {
  return activeByTripId.has(tripId);
}

export function getCachedActiveItineraryRecord(tripId: string): ItineraryRecord | null {
  return activeByTripId.get(tripId) ?? null;
}

function withPayloadMeta(tripId: string, payload: Itinerary): Itinerary {
  const now = new Date().toISOString();
  return {
    ...payload,
    tripId,
    savedAt: payload.savedAt ?? now,
    updatedAt: now,
  };
}

export type SaveItineraryVersionResult =
  | { ok: true; record: ItineraryRecord }
  | { ok: false; reason: "no_client" | "db_error"; message: string };

/**
 * Deactivate the current active version, insert a new active version, return the new record.
 */
export async function saveItineraryVersion(
  tripId: string,
  payload: Itinerary
): Promise<SaveItineraryVersionResult> {
  const client = sb();
  if (!client) {
    return {
      ok: false,
      reason: "no_client",
      message:
        "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env, then restart npm run dev.",
    };
  }

  const withMeta = withPayloadMeta(tripId, payload);
  const now = new Date().toISOString();

  const { data: activeRow, error: activeErr } = await client
    .from("trip_itineraries")
    .select("versionNumber")
    .eq("tripId", tripId)
    .eq("isActive", true)
    .maybeSingle();

  if (activeErr) {
    console.warn("[itineraryCloud] saveItineraryVersion active lookup failed", activeErr.message);
    return {
      ok: false,
      reason: "db_error",
      message: `Could not read itinerary versions: ${activeErr.message}. Run supabase/sql/trip_itineraries.sql on your Supabase project.`,
    };
  }

  const nextVersion = (activeRow?.versionNumber ?? 0) + 1;

  const { error: deactivateErr } = await client
    .from("trip_itineraries")
    .update({ isActive: false, archivedAt: now })
    .eq("tripId", tripId)
    .eq("isActive", true);

  if (deactivateErr) {
    console.warn("[itineraryCloud] saveItineraryVersion deactivate failed", deactivateErr.message);
    return {
      ok: false,
      reason: "db_error",
      message: `Could not archive the previous plan version: ${deactivateErr.message}`,
    };
  }

  const { data: inserted, error: insertErr } = await client
    .from("trip_itineraries")
    .insert({
      tripId,
      payload: withMeta,
      isActive: true,
      versionNumber: nextVersion,
      generatedAt: now,
    })
    .select("*")
    .single();

  if (insertErr || !inserted) {
    console.warn("[itineraryCloud] saveItineraryVersion insert failed", insertErr?.message);
    const detail = insertErr?.message ?? "unknown error";
    const fkHint = detail.includes("trip_itineraries_tripId_fkey")
      ? " This trip is not in the cloud database yet — create a new trip or retry after refreshing the page."
      : "";
    return {
      ok: false,
      reason: "db_error",
      message: `Could not save the new plan: ${detail}.${fkHint}`,
    };
  }

  const record = rowToRecord(inserted as DbRow);
  setActiveCache(tripId, record);
  return { ok: true, record };
}

/**
 * Store a generated plan as the active draft. Committed actives are archived to
 * version history; uncommitted drafts are replaced in place (not archived).
 */
export async function upsertActiveItineraryDraft(
  tripId: string,
  payload: Itinerary
): Promise<SaveItineraryVersionResult> {
  const client = sb();
  if (!client) {
    return {
      ok: false,
      reason: "no_client",
      message:
        "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env, then restart npm run dev.",
    };
  }

  const draftPayload = withPayloadMeta(tripId, { ...payload, isCommitted: false });
  const now = new Date().toISOString();

  const { data: activeRow, error: activeErr } = await client
    .from("trip_itineraries")
    .select("*")
    .eq("tripId", tripId)
    .eq("isActive", true)
    .maybeSingle();

  if (activeErr) {
    console.warn("[itineraryCloud] upsertActiveItineraryDraft active lookup failed", activeErr.message);
    return {
      ok: false,
      reason: "db_error",
      message: `Could not read itinerary versions: ${activeErr.message}`,
    };
  }

  if (activeRow) {
    const row = activeRow as DbRow;
    if (isItineraryCommitted(row.payload)) {
      const { error: deactivateErr } = row.id
        ? await client
            .from("trip_itineraries")
            .update({ isActive: false, archivedAt: now })
            .eq("id", row.id)
        : await client
            .from("trip_itineraries")
            .update({ isActive: false, archivedAt: now })
            .eq("tripId", tripId)
            .eq("isActive", true);

      if (deactivateErr) {
        console.warn("[itineraryCloud] upsertActiveItineraryDraft archive failed", deactivateErr.message);
        return {
          ok: false,
          reason: "db_error",
          message: `Could not archive the previous plan: ${deactivateErr.message}`,
        };
      }

      const nextVersion = row.versionNumber + 1;
      const { data: inserted, error: insertErr } = await client
        .from("trip_itineraries")
        .insert({
          tripId,
          payload: draftPayload,
          isActive: true,
          versionNumber: nextVersion,
          generatedAt: now,
        })
        .select("*")
        .single();

      if (insertErr || !inserted) {
        console.warn("[itineraryCloud] upsertActiveItineraryDraft insert failed", insertErr?.message);
        return {
          ok: false,
          reason: "db_error",
          message: `Could not save the new plan: ${insertErr?.message ?? "unknown error"}`,
        };
      }

      const record = rowToRecord(inserted as DbRow);
      setActiveCache(tripId, record);
      return { ok: true, record };
    }

    const updateQuery = row.id
      ? client
          .from("trip_itineraries")
          .update({ payload: draftPayload, generatedAt: now })
          .eq("id", row.id)
      : client
          .from("trip_itineraries")
          .update({ payload: draftPayload, generatedAt: now })
          .eq("tripId", tripId)
          .eq("isActive", true);
    const { data: updated, error: updateErr } = await updateQuery.select("*").single();

    if (updateErr || !updated) {
      console.warn("[itineraryCloud] upsertActiveItineraryDraft update failed", updateErr?.message);
      return {
        ok: false,
        reason: "db_error",
        message: `Could not update the plan preview: ${updateErr?.message ?? "unknown error"}`,
      };
    }

    const record = rowToRecord(updated as DbRow);
    setActiveCache(tripId, record);
    return { ok: true, record };
  }

  const { data: inserted, error: insertErr } = await client
    .from("trip_itineraries")
    .insert({
      tripId,
      payload: draftPayload,
      isActive: true,
      versionNumber: 1,
      generatedAt: now,
    })
    .select("*")
    .single();

  if (insertErr || !inserted) {
    console.warn("[itineraryCloud] upsertActiveItineraryDraft insert failed", insertErr?.message);
    return {
      ok: false,
      reason: "db_error",
      message: `Could not save the plan preview: ${insertErr?.message ?? "unknown error"}`,
    };
  }

  const record = rowToRecord(inserted as DbRow);
  setActiveCache(tripId, record);
  return { ok: true, record };
}

/**
 * Mark the active draft as the saved plan (stays active; eligible for version history).
 */
export async function commitActiveItinerary(
  tripId: string,
  payload?: Itinerary
): Promise<SaveItineraryVersionResult> {
  const client = sb();
  if (!client) {
    return {
      ok: false,
      reason: "no_client",
      message:
        "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env, then restart npm run dev.",
    };
  }

  const { data: activeRow, error: activeErr } = await client
    .from("trip_itineraries")
    .select("*")
    .eq("tripId", tripId)
    .eq("isActive", true)
    .maybeSingle();

  if (activeErr || !activeRow) {
    return {
      ok: false,
      reason: "db_error",
      message: activeErr?.message ?? "No active plan to save.",
    };
  }

  const row = activeRow as DbRow;
  const base = payload ?? row.payload;
  const committedPayload = withPayloadMeta(tripId, { ...base, isCommitted: true });

  const commitQuery = row.id
    ? client.from("trip_itineraries").update({ payload: committedPayload }).eq("id", row.id)
    : client
        .from("trip_itineraries")
        .update({ payload: committedPayload })
        .eq("tripId", tripId)
        .eq("isActive", true);
  const { data: updated, error: updateErr } = await commitQuery.select("*").single();

  if (updateErr || !updated) {
    console.warn("[itineraryCloud] commitActiveItinerary failed", updateErr?.message);
    return {
      ok: false,
      reason: "db_error",
      message: `Could not save plan: ${updateErr?.message ?? "unknown error"}`,
    };
  }

  const record = rowToRecord(updated as DbRow);
  setActiveCache(tripId, record);
  return { ok: true, record };
}

/**
 * Return the single active row for this trip, or null when cloud is unavailable / none exists.
 * Does not fall back to localStorage.
 */
export async function getActiveItinerary(tripId: string): Promise<ItineraryRecord | null> {
  const pending = activeFetchInFlight.get(tripId);
  if (pending) return pending;

  const promise = (async (): Promise<ItineraryRecord | null> => {
    const client = sb();
    if (!client) return null;

    const { data, error } = await client
      .from("trip_itineraries")
      .select("*")
      .eq("tripId", tripId)
      .eq("isActive", true)
      .maybeSingle();

    if (error) {
      console.warn("[itineraryCloud] getActiveItinerary failed", error.message);
      return null;
    }

    if (!data) {
      setActiveCache(tripId, null);
      return null;
    }

    const record = rowToRecord(data as DbRow);
    setActiveCache(tripId, record);
    return record;
  })();

  activeFetchInFlight.set(tripId, promise);
  void promise.finally(() => {
    activeFetchInFlight.delete(tripId);
  });
  return promise;
}

/** All versions for a trip, newest versionNumber first. */
export async function getItineraryHistory(tripId: string): Promise<ItineraryRecord[]> {
  const client = sb();
  if (!client) return [];

  const { data, error } = await client
    .from("trip_itineraries")
    .select("*")
    .eq("tripId", tripId)
    .order("versionNumber", { ascending: false });

  if (error) {
    console.warn("[itineraryCloud] getItineraryHistory failed", error.message);
    return [];
  }

  return (data ?? []).map((row) => rowToRecord(row as DbRow));
}

/**
 * Activate a prior version: archive the current active row and mark `versionId` active.
 * Sets `restoredFrom` on the activated row to the previously active version id (audit trail).
 */
export async function restoreItineraryVersion(tripId: string, versionId: string): Promise<void> {
  const client = sb();
  if (!client) return;

  const { data: target, error: targetErr } = await client
    .from("trip_itineraries")
    .select("id, tripId, isActive")
    .eq("id", versionId)
    .eq("tripId", tripId)
    .maybeSingle();

  if (targetErr || !target) {
    console.warn("[itineraryCloud] restoreItineraryVersion target not found", targetErr?.message);
    return;
  }

  const { data: currentActive, error: currentErr } = await client
    .from("trip_itineraries")
    .select("id")
    .eq("tripId", tripId)
    .eq("isActive", true)
    .maybeSingle();

  if (currentErr) {
    console.warn("[itineraryCloud] restoreItineraryVersion active lookup failed", currentErr.message);
    return;
  }

  const previousActiveId = currentActive?.id ?? null;
  if (previousActiveId === versionId) {
    await getActiveItinerary(tripId);
    return;
  }

  const now = new Date().toISOString();

  if (previousActiveId) {
    const { error: archiveErr } = await client
      .from("trip_itineraries")
      .update({ isActive: false, archivedAt: now })
      .eq("id", previousActiveId);

    if (archiveErr) {
      console.warn("[itineraryCloud] restoreItineraryVersion archive failed", archiveErr.message);
      return;
    }
  }

  const { error: restoreErr } = await client
    .from("trip_itineraries")
    .update({
      isActive: true,
      archivedAt: null,
      restoredFrom: previousActiveId ?? versionId,
    })
    .eq("id", versionId);

  if (restoreErr) {
    console.warn("[itineraryCloud] restoreItineraryVersion activate failed", restoreErr.message);
    return;
  }

  await getActiveItinerary(tripId);
}

/**
 * Update the active row payload in place (no new version). Used for transit snapshots
 * and other derived metadata that should not increment versionNumber.
 */
export async function updateActiveItineraryPayload(
  tripId: string,
  payload: Itinerary
): Promise<void> {
  const client = sb();
  if (!client) return;

  const withMeta = withPayloadMeta(tripId, payload);
  const { error } = await client
    .from("trip_itineraries")
    .update({ payload: withMeta })
    .eq("tripId", tripId)
    .eq("isActive", true);

  if (error) {
    console.warn("[itineraryCloud] updateActiveItineraryPayload failed", error.message);
    return;
  }

  const cached = activeByTripId.get(tripId);
  if (cached) {
    setActiveCache(tripId, { ...cached, payload: withMeta });
  } else {
    await getActiveItinerary(tripId);
  }
}

/** Warm the session cache for many trips (list screens). */
export async function prefetchActiveItineraries(tripIds: string[]): Promise<void> {
  await Promise.all(tripIds.map((id) => getActiveItinerary(id)));
}
