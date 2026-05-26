import type { TripHotel } from "../types/trip";
import {
  cloudDeleteTripHotel,
  cloudListTripHotels,
  cloudUpsertTripHotel,
  isCloudEnabled,
} from "./tripCloudStore";

/**
 * Local-first store for trip hotels. Shared across all guests on the trip:
 * a single canonical list keyed by tripId. Mirrors the `trip_members` pattern
 * — localStorage as source of truth in-session, best-effort Supabase mirror
 * for cross-device sync when cloud is enabled.
 */

const STORAGE_KEY = "tripHotels";

function getHotelsStorage(): TripHotel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TripHotel[]) : [];
  } catch {
    return [];
  }
}

function setHotelsStorage(hotels: TripHotel[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(hotels));
}

function generateHotelId(): string {
  return crypto.randomUUID?.() ?? `h-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Hotel day-ranges use check-in / check-out semantics, so a range [X, Y]
 * means the guest sleeps on nights X..Y-1 (Y is the check-out morning).
 * Two ranges overlap only when they share at least one night, NOT when they
 * merely touch on a boundary day (A.end === B.start is fine: Hotel A's
 * check-out and Hotel B's check-in fall on the same calendar day, which is
 * how most real hotel transitions work).
 */
function rangesOverlap(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end;
}

export interface HotelDayRangeValidation {
  ok: boolean;
  /** Human-readable error to show in the UI (null when ok). */
  error: string | null;
}

/**
 * Validate a proposed day-range for adding/editing a hotel on a trip.
 * - Both ends must fall inside `1..tripDays` (when tripDays is known).
 * - `dayStart <= dayEnd`.
 * - Must not overlap any *other* hotel's day-range on the same trip.
 *   Pass `excludeHotelId` when editing an existing hotel to skip its own range.
 */
export function validateHotelDayRange(args: {
  tripId: string;
  dayStart: number;
  dayEnd: number;
  tripDays?: number | null;
  excludeHotelId?: string;
}): HotelDayRangeValidation {
  const { tripId, dayStart, dayEnd, tripDays, excludeHotelId } = args;
  if (!Number.isFinite(dayStart) || !Number.isFinite(dayEnd)) {
    return { ok: false, error: "Pick valid day numbers." };
  }
  if (dayStart < 1 || dayEnd < 1) {
    return { ok: false, error: "Days start at 1." };
  }
  if (dayStart >= dayEnd) {
    return { ok: false, error: "Check-out day must be after check-in day." };
  }
  if (typeof tripDays === "number" && tripDays > 0 && dayEnd > tripDays) {
    return {
      ok: false,
      error: `This trip is ${tripDays} day${tripDays === 1 ? "" : "s"} long.`,
    };
  }

  const others = getTripHotels(tripId).filter((h) => h.id !== excludeHotelId);
  const conflict = others.find((h) =>
    rangesOverlap({ start: dayStart, end: dayEnd }, { start: h.dayStart, end: h.dayEnd })
  );
  if (conflict) {
    return {
      ok: false,
      error: `Overlaps with "${conflict.name}" (Day ${conflict.dayStart}–${conflict.dayEnd}).`,
    };
  }

  return { ok: true, error: null };
}

/** Return all hotels for a trip ordered by dayStart ascending. */
export function getTripHotels(tripId: string): TripHotel[] {
  return getHotelsStorage()
    .filter((h) => h.tripId === tripId)
    .sort((a, b) => a.dayStart - b.dayStart || a.createdAt.localeCompare(b.createdAt));
}

/**
 * Lightweight hotel summary used by the itinerary autofill (no need for the
 * full TripHotel shape downstream).
 */
export interface HotelRowSummary {
  placeId: string;
  hotelLabel: string;
  /** Real-world coordinates (resolved from Google Places). When present the
   * transit pipeline can compute proper hotel↔activity leg times instead of
   * falling back to the 10-minute heuristic. Filled in by the caller. */
  location?: { lat: number; lng: number };
}

/**
 * Per-day morning/evening hotel assignment, derived from each hotel's
 * check-in/check-out range:
 *  - A hotel with check-in X, check-out Y covers nights X..Y-1.
 *  - On day D the guest WAKES UP at the hotel that covered night D-1 ("morning"),
 *    and SLEEPS at the hotel that covers night D ("evening").
 *
 * This means a transition day correctly has a different morning (departed
 * hotel) and evening (arrived hotel). Days outside any hotel's coverage get
 * undefined values and stay empty in the itinerary.
 */
export interface DayHotelAssignment {
  morning?: HotelRowSummary;
  evening?: HotelRowSummary;
}

export function getHotelsByDay(tripId: string): Record<number, DayHotelAssignment> {
  const out: Record<number, DayHotelAssignment> = {};
  for (const h of getTripHotels(tripId)) {
    const summary: HotelRowSummary = { placeId: h.placeId, hotelLabel: h.name };
    // Nights covered: [dayStart, dayEnd - 1]
    for (let night = h.dayStart; night <= h.dayEnd - 1; night++) {
      const cur = out[night] ?? {};
      cur.evening = summary;
      out[night] = cur;
      const morningDay = night + 1;
      const curMorning = out[morningDay] ?? {};
      curMorning.morning = summary;
      out[morningDay] = curMorning;
    }
  }
  return out;
}

export interface AddTripHotelInput {
  tripId: string;
  placeId?: string;
  name: string;
  address?: string;
  dayStart: number;
  dayEnd: number;
}

export function addTripHotel(input: AddTripHotelInput): TripHotel {
  const hotel: TripHotel = {
    id: generateHotelId(),
    tripId: input.tripId,
    placeId: input.placeId?.trim() ?? "",
    name: input.name.trim(),
    address: input.address?.trim() || undefined,
    dayStart: input.dayStart,
    dayEnd: input.dayEnd,
    createdAt: new Date().toISOString(),
  };
  const all = getHotelsStorage();
  all.push(hotel);
  setHotelsStorage(all);

  if (isCloudEnabled()) {
    void cloudUpsertTripHotel(hotel);
  }
  return hotel;
}

export function updateTripHotel(
  hotelId: string,
  patch: Partial<Omit<TripHotel, "id" | "tripId" | "createdAt">>
): TripHotel | null {
  const all = getHotelsStorage();
  const idx = all.findIndex((h) => h.id === hotelId);
  if (idx === -1) return null;
  const sanitized: Partial<TripHotel> = {};
  if (patch.placeId !== undefined) sanitized.placeId = patch.placeId.trim();
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (trimmed) sanitized.name = trimmed;
  }
  if (patch.address !== undefined) sanitized.address = patch.address?.trim() || undefined;
  if (patch.dayStart !== undefined && Number.isFinite(patch.dayStart)) {
    sanitized.dayStart = Math.max(1, Math.round(patch.dayStart));
  }
  if (patch.dayEnd !== undefined && Number.isFinite(patch.dayEnd)) {
    sanitized.dayEnd = Math.max(1, Math.round(patch.dayEnd));
  }
  const updated: TripHotel = { ...all[idx], ...sanitized };
  all[idx] = updated;
  setHotelsStorage(all);

  if (isCloudEnabled()) {
    void cloudUpsertTripHotel(updated);
  }
  return updated;
}

export function removeTripHotel(hotelId: string): void {
  const all = getHotelsStorage();
  const idx = all.findIndex((h) => h.id === hotelId);
  if (idx === -1) return;
  all.splice(idx, 1);
  setHotelsStorage(all);

  if (isCloudEnabled()) {
    void cloudDeleteTripHotel(hotelId);
  }
}

/**
 * Hydrate the local cache from cloud storage. Best-effort — no-ops if cloud
 * is disabled or the request fails. Call after navigating to a trip to pick
 * up changes made by other guests.
 */
export async function hydrateTripHotelsFromCloud(tripId: string): Promise<void> {
  if (!isCloudEnabled()) return;
  const result = await cloudListTripHotels(tripId);
  if (!result.ok) return;
  const incoming = result.data ?? [];
  const all = getHotelsStorage().filter((h) => h.tripId !== tripId);
  for (const h of incoming) all.push(h);
  setHotelsStorage(all);
}
