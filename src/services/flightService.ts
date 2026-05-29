import type { TripFlight } from "../types/trip";
import {
  cloudDeleteTripFlight,
  cloudListTripFlights,
  cloudUpsertTripFlight,
  isCloudEnabled,
} from "./tripCloudStore";

/**
 * Local-first store for trip flights. One row per member-per-(direction)
 * (members always fly themselves, unlike hotels which are shared). Mirrors
 * the `hotelService` pattern: localStorage as source of truth in-session,
 * best-effort Supabase mirror for cross-device / cross-guest sync when the
 * cloud client is enabled.
 */

const STORAGE_KEY = "tripFlights";

function getFlightsStorage(): TripFlight[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TripFlight[];
    // Back-compat: rows persisted before `direction` was introduced should
    // round-trip as "arrival" so existing local data isn't dropped.
    return parsed.map((f) => ({
      ...f,
      direction: f.direction ?? "arrival",
    }));
  } catch {
    return [];
  }
}

function setFlightsStorage(flights: TripFlight[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(flights));
}

function generateFlightId(): string {
  return crypto.randomUUID?.() ?? `f-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Return all flights for a trip, ordered by `date` ascending then by id. */
export function getTripFlights(tripId: string): TripFlight[] {
  return getFlightsStorage()
    .filter((f) => f.tripId === tripId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

/** Return all flights for a single member on a single trip. */
export function getMemberFlights(tripId: string, memberId: string): TripFlight[] {
  return getTripFlights(tripId).filter((f) => f.memberId === memberId);
}

/**
 * Create a new flight for a member on a trip. The caller supplies everything
 * except the `id` (generated here), `tripId` and `memberId` (passed as args
 * so callers can't accidentally mismatch fields).
 */
export function addTripFlight(
  tripId: string,
  memberId: string,
  data: Omit<TripFlight, "id" | "tripId" | "memberId">
): TripFlight {
  const flight: TripFlight = {
    id: generateFlightId(),
    tripId,
    memberId,
    direction: data.direction ?? "arrival",
    origin: data.origin.trim().toUpperCase(),
    destination: data.destination.trim().toUpperCase(),
    date: data.date,
    airline: data.airline.trim(),
    flightNumber: data.flightNumber?.trim() || undefined,
    durationMinutes:
      typeof data.durationMinutes === "number" && Number.isFinite(data.durationMinutes)
        ? Math.max(0, Math.round(data.durationMinutes))
        : undefined,
    arrivalTime: data.arrivalTime?.trim() || undefined,
  };
  const all = getFlightsStorage();
  all.push(flight);
  setFlightsStorage(all);

  if (isCloudEnabled()) {
    void cloudUpsertTripFlight(flight);
  }
  return flight;
}

/**
 * Patch an existing flight. The `id` and `tripId` are immutable. Returns the
 * updated row, or `null` if no flight with that id exists.
 */
export function updateTripFlight(
  flightId: string,
  patch: Partial<Omit<TripFlight, "id" | "tripId">>
): TripFlight | null {
  const all = getFlightsStorage();
  const idx = all.findIndex((f) => f.id === flightId);
  if (idx === -1) return null;

  const sanitized: Partial<TripFlight> = {};
  if (patch.memberId !== undefined) sanitized.memberId = patch.memberId;
  if (patch.direction !== undefined) sanitized.direction = patch.direction;
  if (patch.origin !== undefined) sanitized.origin = patch.origin.trim().toUpperCase();
  if (patch.destination !== undefined) sanitized.destination = patch.destination.trim().toUpperCase();
  if (patch.date !== undefined) sanitized.date = patch.date;
  if (patch.airline !== undefined) sanitized.airline = patch.airline.trim();
  if (patch.flightNumber !== undefined) {
    sanitized.flightNumber = patch.flightNumber?.trim() || undefined;
  }
  if (patch.durationMinutes !== undefined) {
    sanitized.durationMinutes =
      typeof patch.durationMinutes === "number" && Number.isFinite(patch.durationMinutes)
        ? Math.max(0, Math.round(patch.durationMinutes))
        : undefined;
  }
  if (patch.arrivalTime !== undefined) {
    sanitized.arrivalTime = patch.arrivalTime?.trim() || undefined;
  }

  const updated: TripFlight = { ...all[idx]!, ...sanitized };
  all[idx] = updated;
  setFlightsStorage(all);

  if (isCloudEnabled()) {
    void cloudUpsertTripFlight(updated);
  }
  return updated;
}

export function removeTripFlight(flightId: string): void {
  const all = getFlightsStorage();
  const idx = all.findIndex((f) => f.id === flightId);
  if (idx === -1) return;
  all.splice(idx, 1);
  setFlightsStorage(all);

  if (isCloudEnabled()) {
    void cloudDeleteTripFlight(flightId);
  }
}

/**
 * Hydrate the local cache from cloud storage. Best-effort — no-ops if cloud
 * is disabled or the request fails. Call after navigating to a trip to pick
 * up flights other guests added on their devices.
 *
 * Strategy: replace every row for this `tripId` with whatever the server
 * has. We don't merge per-id because the cloud is the canonical store once
 * enabled — local-only rows from before the table existed will reupload
 * automatically the next time the user edits them, and deletes from other
 * devices need to win over our stale local copy.
 */
export async function hydrateTripFlightsFromCloud(tripId: string): Promise<void> {
  if (!isCloudEnabled()) return;
  const result = await cloudListTripFlights(tripId);
  if (!result.ok) return;
  const incoming = (result.data ?? []).map((f) => ({
    ...f,
    direction: f.direction ?? "arrival",
  }));
  const all = getFlightsStorage().filter((f) => f.tripId !== tripId);
  for (const f of incoming) all.push(f);
  setFlightsStorage(all);
}

/**
 * Aggregate flight constraints that the itinerary scheduler should honor:
 *  - `day1Start`: latest known arrival time across **arriving** flights —
 *    Day 1 plans can't start before this.
 *  - `lastDayEnd`: earliest known departure time across **departing**
 *    flights — the last day's plans must wrap up before this.
 *
 * Both ride on the assumption that every member's arrival flight maps to
 * Day 1 and every departure flight maps to the trip's final day. We don't
 * try to match `date` against the trip's day dates because the user's flow
 * doesn't require them to enter exact trip dates — keeping the rule simple
 * makes the UX more forgiving and the scheduler more deterministic.
 *
 * Both values are returned as `HH:MM` 24h or omitted entirely when there
 * are no flights of that direction with a populated `arrivalTime`.
 */
export interface FlightDayConstraints {
  day1Start?: string;
  day1MemberIds?: string[];
  /**
   * Destination IATA of the arrival flight(s) that produced `day1Start`.
   * Used by the trip plan to render an "Arrive at DCA" card at the start
   * of Day 1. When multiple latest arrivals land at different airports we
   * just take the first — that's a rare enough case that picking one
   * representative airport is preferable to showing multiple terminals.
   */
  day1AirportCode?: string;
  /**
   * Real lat / lng for `day1AirportCode`, resolved out-of-band (e.g. via
   * `useAirportLocations`) and merged onto the constraints by the screen
   * before passing to `itineraryToDisplayDays`. When present, the airport
   * display row carries this `location` so transit between the airport
   * and the first stop uses a real driving leg instead of the 10-min
   * heuristic. Optional — falls back to heuristic when unresolved.
   */
  day1AirportLocation?: { lat: number; lng: number };
  lastDayEnd?: string;
  lastDayMemberIds?: string[];
  /** Origin IATA of the departure flight(s) that produced `lastDayEnd`. */
  lastDayAirportCode?: string;
  /** Real lat / lng for `lastDayAirportCode`; see `day1AirportLocation`. */
  lastDayAirportLocation?: { lat: number; lng: number };
}

function timeKey(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return Number.NaN;
  return (h ?? 0) * 60 + (m ?? 0);
}

export function getFlightDayConstraints(tripId: string): FlightDayConstraints {
  const flights = getTripFlights(tripId);
  if (flights.length === 0) return {};

  const arrivals = flights.filter(
    (f) => f.direction === "arrival" && f.arrivalTime?.trim()
  );
  const departures = flights.filter(
    (f) => f.direction === "departure" && f.arrivalTime?.trim()
  );

  const out: FlightDayConstraints = {};

  if (arrivals.length > 0) {
    // Latest arrival across guests → Day 1 can't kick off until this point.
    let bestTime = arrivals[0]!.arrivalTime!;
    let bestKey = timeKey(bestTime);
    for (const f of arrivals) {
      const k = timeKey(f.arrivalTime!);
      if (Number.isFinite(k) && k > bestKey) {
        bestKey = k;
        bestTime = f.arrivalTime!;
      }
    }
    out.day1Start = bestTime;
    const latestArrivals = arrivals.filter((f) => f.arrivalTime === bestTime);
    out.day1MemberIds = latestArrivals.map((f) => f.memberId);
    // Destination = the airport in the trip city where the member lands.
    // Pull from the latest arrival flight (the one defining the clamp).
    const airport = latestArrivals.find((f) => f.destination?.trim())?.destination?.trim();
    if (airport) out.day1AirportCode = airport;
  }

  if (departures.length > 0) {
    // Earliest departure across guests → last day must end before this.
    let bestTime = departures[0]!.arrivalTime!;
    let bestKey = timeKey(bestTime);
    for (const f of departures) {
      const k = timeKey(f.arrivalTime!);
      if (Number.isFinite(k) && k < bestKey) {
        bestKey = k;
        bestTime = f.arrivalTime!;
      }
    }
    out.lastDayEnd = bestTime;
    const earliestDepartures = departures.filter((f) => f.arrivalTime === bestTime);
    out.lastDayMemberIds = earliestDepartures.map((f) => f.memberId);
    // Origin = the airport in the trip city the member takes off from.
    const airport = earliestDepartures.find((f) => f.origin?.trim())?.origin?.trim();
    if (airport) out.lastDayAirportCode = airport;
  }

  return out;
}
